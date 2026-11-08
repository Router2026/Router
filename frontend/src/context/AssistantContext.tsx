/**
 * AssistantContext
 * ----------------
 * Conversation state for the AI trip assistant chat. Lives above the router so
 * the same conversation continues between MapView and Explore.
 *
 * The backend is stateless: every send() posts the recent history, the current
 * Trip Bucket and (when known) the user's location. Route edits the assistant
 * makes come back as actions and are applied to the Trip Bucket here.
 *
 * Card buttons ("add to route") are handled locally — no model call, no cost.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, type AssistantChatRequest, type POI } from '../api';
import { useTripBucket } from './TripBucketContext';
import { mapRawToPoi } from '../utils/poiMapper';

export type SheetSnap = 'peek' | 'half' | 'full';

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  places?: POI[];
  /** welcome / local are generated client-side; error messages are never sent to the backend. */
  kind?: 'welcome' | 'local' | 'error';
  /** For error messages: the user text to resend on "try again". */
  retryText?: string;
}

interface AssistantContextValue {
  messages: AssistantMessage[];
  isSending: boolean;
  isOpen: boolean;
  snap: SheetSnap;
  /** Increments when the chat changes the route, so the map can re-frame it (RouteLayer). */
  routeFocus: number;
  open: () => void;
  close: () => void;
  setSnap: (s: SheetSnap) => void;
  send: (text: string) => Promise<void>;
  addFromCard: (poi: POI) => void;
  removeFromCard: (poi: POI) => void;
  resetConversation: () => void;
}

const STORAGE_KEY = 'router_assistant_v1';
const MAX_STORED_MESSAGES = 40;
/** Must stay within the backend limits (types.ts): 12 history messages, 1000 chars, 10 places. */
const HISTORY_SENT = 12;
const MAX_CHARS = 1000;
const NEAR_ME_RE = /(קרוב\s+אלי|קרוב\s+אליי|באזור\s+שלי|לידי|בסביבה\s+שלי|near\s+me|nearby|close\s+to\s+me|around\s+me)/iu;

const WELCOME: AssistantMessage = {
  id: 'welcome',
  role: 'assistant',
  kind: 'welcome',
  text: 'היי! איזה סגנון של טיול מתחשק לך היום? אפשר לחפש לפי אזור, סוג מקום או פשוט לבקש משהו קרוב.',
};

let idCounter = 0;
const newId = () => `${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

function loadMessages(): AssistantMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as AssistantMessage[]) : null;
    return Array.isArray(parsed) && parsed.length ? parsed : [WELCOME];
  } catch {
    return [WELCOME];
  }
}

function isNumericId(id: string): boolean {
  return /^\d+$/.test(id);
}

/** Resolves with the user's position, or null if denied / unavailable / slow. */
function requestLocation(timeoutMs = 6000): Promise<{ lat: number; lng: number } | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: timeoutMs, maximumAge: 5 * 60_000 },
    );
  });
}

function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return 'הצ\'אט זמין כרגע רק לאדמינים.';
    if (err.status === 429) return 'שלחת הרבה הודעות ברצף — נסה שוב בעוד דקה.';
    if (err.status === 400) return 'לא הצלחתי להבין את הבקשה. נסה לנסח אותה אחרת.';
  }
  return 'משהו השתבש בדרך. אפשר לנסות שוב?';
}

const AssistantContext = createContext<AssistantContextValue | null>(null);

export function AssistantProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const { items, addPoi, removePoi, userLocation, setUserLocation } = useTripBucket();
  const [messages, setMessages] = useState<AssistantMessage[]>(loadMessages);
  const [isSending, setIsSending] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [snap, setSnap] = useState<SheetSnap>('half');
  const [routeFocus, setRouteFocus] = useState(0);
  const sendingRef = useRef(false);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)));
    } catch { /* storage full / unavailable — conversation just won't persist */ }
  }, [messages]);

  const append = useCallback((m: Omit<AssistantMessage, 'id'>) => {
    setMessages(prev => [...prev, { ...m, id: newId() }]);
  }, []);

  const send = useCallback(async (rawText: string) => {
    const text = rawText.trim().slice(0, MAX_CHARS);
    if (!text || sendingRef.current) return;
    sendingRef.current = true;
    setIsSending(true);

    // Build history from what the user saw (minus errors), before appending the new message.
    const history: AssistantChatRequest['messages'] = messages
      .filter(m => m.kind !== 'error' && m.text.trim())
      .slice(-(HISTORY_SENT - 1))
      .map(m => ({
        role: m.role,
        content: m.text.slice(0, MAX_CHARS),
        ...(m.places?.length
          ? { places: m.places.filter(p => isNumericId(p.id)).slice(0, 10).map(p => ({ id: Number(p.id), name: p.name.slice(0, 200) })) }
          : {}),
      }));

    append({ role: 'user', text });

    try {
      let location = userLocation;
      if (!location && NEAR_ME_RE.test(text)) {
        location = await requestLocation();
        if (location) setUserLocation(location);
      }

      const res = await api.assistant.chat({
        messages: [...history, { role: 'user', content: text }],
        route: items
          .filter(i => isNumericId(i.poi.id))
          .slice(0, 25)
          .map(i => ({ id: Number(i.poi.id), name: i.poi.name.slice(0, 200) })),
        userLocation: location ?? null,
      });

      for (const action of res.actions) {
        if (action.type === 'add') addPoi(mapRawToPoi(action.place));
        else removePoi(String(action.id));
      }

      append({ role: 'assistant', text: res.reply, places: res.places.map(mapRawToPoi) });
      // Route changed → drop the sheet and re-frame the map so the new stop is visible.
      if (res.actions.length) {
        setSnap('peek');
        setRouteFocus(n => n + 1);
      }
    } catch (err) {
      append({ role: 'assistant', kind: 'error', text: errorText(err), retryText: text });
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  }, [messages, items, userLocation, setUserLocation, addPoi, removePoi, append]);

  const addFromCard = useCallback((poi: POI) => {
    addPoi(poi);
    append({
      role: 'assistant',
      kind: 'local',
      text: `מעולה! הוספתי את '${poi.name}' למסלול שלך. רוצה שאחפש עוד משהו באזור?`,
    });
    setSnap('peek');
    setRouteFocus(n => n + 1);
  }, [addPoi, append]);

  const removeFromCard = useCallback((poi: POI) => {
    removePoi(poi.id);
    append({ role: 'assistant', kind: 'local', text: `הסרתי את '${poi.name}' מהמסלול.` });
  }, [removePoi, append]);

  const resetConversation = useCallback(() => setMessages([WELCOME]), []);
  const open = useCallback(() => { setIsOpen(true); setSnap('half'); }, []);
  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo<AssistantContextValue>(() => ({
    messages, isSending, isOpen, snap, routeFocus, open, close, setSnap, send, addFromCard, removeFromCard, resetConversation,
  }), [messages, isSending, isOpen, snap, routeFocus, open, close, send, addFromCard, removeFromCard, resetConversation]);

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAssistant(): AssistantContextValue {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error('useAssistant must be used inside <AssistantProvider>');
  return ctx;
}
