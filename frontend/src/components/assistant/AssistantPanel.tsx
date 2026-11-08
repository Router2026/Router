/**
 * AssistantPanel — the chat surface.
 *  - Mobile: bottom sheet above the nav bar with three snap heights (peek / half / full),
 *    draggable by its handle, so the map stays visible.
 *  - Desktop (≥ 900px): docked side panel.
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAssistant, type SheetSnap } from '../../context/AssistantContext';
import { useTripBucket } from '../../context/TripBucketContext';
import PlaceCarousel from './PlaceCarousel';

const NAV_HEIGHT = 72; // Layout's fixed bottom nav
const DESKTOP_QUERY = '(min-width: 900px)';
const PEEK_PX = 150;

const PROMPTS_EMPTY = ['מקום עם מים קרוב אליי', 'משהו מוצל וקריר', 'חוף בכנרת', 'מסלול נגיש לעגלת תינוק'];
const PROMPTS_WITH_ROUTE = ['תוסיף עוד עצירה באזור', 'משהו מוצל על הדרך', 'מה יש במסלול שלי?', 'תמחק את האחרון'];

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(DESKTOP_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isDesktop;
}

function snapHeight(snap: SheetSnap): string {
  if (snap === 'peek') return `${PEEK_PX}px`;
  if (snap === 'half') return '55dvh';
  return `calc(100dvh - ${NAV_HEIGHT + 56}px)`;
}

const KEYFRAMES = `
@keyframes router-dot { 0%, 80%, 100% { transform: translateY(0); opacity: .45 } 40% { transform: translateY(-5px); opacity: 1 } }
@media (prefers-reduced-motion: reduce) { .router-dot { animation: none !important } }
`;

function TypingIndicator() {
  return (
    <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', color: '#64748b', fontSize: 13 }}>
      <span aria-hidden="true" style={{ display: 'inline-flex', gap: 4 }}>
        {[0, 1, 2].map(i => (
          <span key={i} className="router-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: '#0d9e6e', animation: `router-dot 1.2s ${i * 0.15}s infinite ease-in-out` }} />
        ))}
      </span>
      מחפש את המקומות הכי טובים בשבילך...
    </div>
  );
}

export default function AssistantPanel() {
  const { messages, isSending, snap, setSnap, close, send, resetConversation } = useAssistant();
  const { count } = useTripBucket();
  const isDesktop = useIsDesktop();
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Drag to resize (mobile) ───────────────────────────────────────────────
  const drag = useRef<{ startY: number; startH: number } | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragHeight, setDragHeight] = useState<number | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!sheetRef.current) return;
    drag.current = { startY: e.clientY, startH: sheetRef.current.getBoundingClientRect().height };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const max = window.innerHeight - NAV_HEIGHT - 56;
    setDragHeight(Math.min(max, Math.max(PEEK_PX - 40, drag.current.startH + (drag.current.startY - e.clientY))));
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    const h = dragHeight ?? drag.current.startH;
    drag.current = null;
    setDragHeight(null);
    const vh = window.innerHeight;
    if (h < PEEK_PX * 0.7) { close(); return; }            // flick down past peek → close
    const candidates: [SheetSnap, number][] = [['peek', PEEK_PX], ['half', vh * 0.55], ['full', vh - NAV_HEIGHT - 56]];
    candidates.sort((a, b) => Math.abs(a[1] - h) - Math.abs(b[1] - h));
    setSnap(candidates[0][0]);
  };
  // Tap on handle cycles peek ↔ half.
  const onHandleClick = useCallback(() => setSnap(snap === 'peek' ? 'half' : 'peek'), [snap, setSnap]);

  // ── Auto-scroll to the newest message ─────────────────────────────────────
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isSending, snap]);

  const submit = (text: string) => {
    if (!text.trim() || isSending) return;
    setDraft('');
    if (!isDesktop && snap === 'peek') setSnap('half');
    void send(text);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit(draft);
    }
  };

  const collapsed = !isDesktop && snap === 'peek';
  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
  const prompts = count > 0 ? PROMPTS_WITH_ROUTE : PROMPTS_EMPTY;

  const containerStyle: React.CSSProperties = isDesktop
    ? {
      position: 'fixed', left: 16, top: 80, bottom: NAV_HEIGHT + 16, width: 380, zIndex: 1900,
      borderRadius: 20,
    }
    : {
      position: 'fixed', left: 0, right: 0, bottom: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
      height: dragHeight !== null ? `${dragHeight}px` : snapHeight(snap),
      transition: dragHeight !== null ? 'none' : 'height 0.25s ease',
      zIndex: 1900, borderRadius: '20px 20px 0 0',
    };

  return (
    <section
      ref={sheetRef}
      aria-label="עוזר תכנון מסלול"
      dir="rtl"
      style={{
        ...containerStyle, background: '#f8fafc', display: 'flex', flexDirection: 'column',
        boxShadow: '0 -6px 30px rgba(15,23,42,0.18)', overflow: 'hidden', fontFamily: 'Heebo, sans-serif',
      }}
    >
      <style>{KEYFRAMES}</style>

      {/* Header (+ drag handle on mobile) */}
      <div
        onPointerDown={isDesktop ? undefined : onPointerDown}
        onPointerMove={isDesktop ? undefined : onPointerMove}
        onPointerUp={isDesktop ? undefined : onPointerUp}
        onPointerCancel={isDesktop ? undefined : onPointerUp}
        style={{ background: '#fff', borderBottom: '1px solid #e8f5f1', padding: isDesktop ? '12px 14px' : '6px 14px 10px', touchAction: 'none', flexShrink: 0 }}
      >
        {!isDesktop && (
          <button
            onClick={onHandleClick}
            aria-label={collapsed ? 'הרחב את הצ׳אט' : 'כווץ את הצ׳אט'}
            style={{ display: 'block', margin: '0 auto 6px', width: 56, height: 16, border: 'none', background: 'none', cursor: 'grab', padding: 0 }}
          >
            <span aria-hidden="true" style={{ display: 'block', width: 40, height: 5, borderRadius: 3, background: '#cbd5e1', margin: '0 auto' }} />
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span aria-hidden="true" style={{ fontSize: 20 }}>✨</span>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 800, color: '#1a2e2a' }}>מלווה הטיולים</div>
          <button onClick={resetConversation} aria-label="שיחה חדשה" title="שיחה חדשה"
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>
            שיחה חדשה
          </button>
          <button onClick={close} aria-label="סגור את הצ׳אט"
            style={{ border: 'none', background: '#f1f5f9', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      {collapsed ? (
        <button
          onClick={() => setSnap('half')}
          style={{ textAlign: 'right', border: 'none', background: 'none', padding: '8px 14px', fontSize: 13, color: '#334155', cursor: 'pointer', fontFamily: 'inherit', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flexShrink: 0 }}
        >
          {isSending ? 'מחפש...' : lastAssistant?.text}
        </button>
      ) : (
        <div ref={listRef} aria-live="polite" style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 4px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map(m => (
            <div key={m.id} style={{ alignSelf: m.role === 'user' ? 'flex-start' : 'stretch', maxWidth: m.role === 'user' ? '85%' : '100%' }}>
              <div
                dir="auto"
                style={{
                  display: 'inline-block', padding: '9px 13px', borderRadius: 16, fontSize: 14, lineHeight: 1.45, whiteSpace: 'pre-wrap',
                  ...(m.role === 'user'
                    ? { background: 'linear-gradient(135deg, #0d9e6e, #0bba7e)', color: '#fff', borderBottomRightRadius: 4 }
                    : m.kind === 'error'
                      ? { background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }
                      : { background: '#fff', color: '#1a2e2a', border: '1px solid #e2e8f0', borderBottomLeftRadius: 4 }),
                }}
              >
                {m.text}
                {m.kind === 'error' && m.retryText && (
                  <button onClick={() => submit(m.retryText!)} disabled={isSending}
                    style={{ marginInlineStart: 8, border: 'none', background: 'none', color: '#b91c1c', textDecoration: 'underline', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', fontSize: 13 }}>
                    נסה שוב
                  </button>
                )}
              </div>
              {!!m.places?.length && <PlaceCarousel places={m.places} />}
            </div>
          ))}
          {isSending && <TypingIndicator />}
        </div>
      )}

      {/* Quick prompts */}
      {!collapsed && !isSending && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '6px 12px', flexShrink: 0 }}>
          {prompts.map(p => (
            <button key={p} onClick={() => submit(p)}
              style={{ flex: '0 0 auto', border: '1.5px solid #bbf7d0', background: '#f0fdf8', color: '#047857', borderRadius: 18, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={e => { e.preventDefault(); submit(draft); }}
        style={{ display: 'flex', gap: 8, alignItems: 'flex-end', padding: '8px 12px 12px', background: '#fff', borderTop: '1px solid #e8f5f1', flexShrink: 0 }}
      >
        <textarea
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => { if (!isDesktop && snap === 'peek') setSnap('half'); }}
          rows={1}
          maxLength={1000}
          dir="auto"
          placeholder="מה מתחשק לך? למשל: מקום עם מים באזור זכרון"
          aria-label="הודעה לעוזר"
          style={{ flex: 1, resize: 'none', border: '2px solid #e2e8f0', borderRadius: 14, padding: '9px 12px', fontSize: 15, fontFamily: 'inherit', outline: 'none', maxHeight: 96, background: '#f8fafc', color: '#1a2e2a' }}
        />
        <button type="submit" disabled={!draft.trim() || isSending} aria-label="שלח"
          style={{ width: 42, height: 42, borderRadius: 14, border: 'none', flexShrink: 0, cursor: draft.trim() && !isSending ? 'pointer' : 'default', background: draft.trim() && !isSending ? 'linear-gradient(135deg, #0d9e6e, #0bba7e)' : '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* RTL: the arrow points left (towards the reading direction's end) */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
        </button>
      </form>
    </section>
  );
}
