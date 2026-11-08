// Pure helpers for the AI trip planner page: error messages and the
// draft that survives the login redirect.

import { ApiError } from '../api';

export type RouteErrorKind = 'auth' | 'rate_limit' | 'no_locations' | 'input' | 'network' | 'server';

export interface RouteErrorInfo {
  kind: RouteErrorKind;
  message: string;
  /** Whether a "try again" button makes sense. */
  canRetry: boolean;
}

/** True when the request was cancelled by the user (AbortController). */
export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException
    ? err.name === 'AbortError'
    : (err as { name?: string } | null)?.name === 'AbortError';
}

function minutesText(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return minutes === 1 ? 'דקה' : `${minutes} דקות`;
}

/** Maps any error from generating/saving a route to a friendly Hebrew message. */
export function describeRouteError(err: unknown): RouteErrorInfo {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return { kind: 'auth', message: 'פג תוקף ההתחברות. יש להתחבר מחדש כדי לתכנן מסלול', canRetry: false };
    }
    if (err.status === 429) {
      const wait = err.retryAfterSec ? ` בעוד ${minutesText(err.retryAfterSec)}` : ' מאוחר יותר';
      return { kind: 'rate_limit', message: `הגעת למכסת המסלולים לשעה. אפשר לנסות שוב${wait}`, canRetry: false };
    }
    if (err.status === 404 && err.code === 'NO_LOCATIONS') {
      return { kind: 'no_locations', message: 'לא מצאנו מספיק מקומות באזור הזה. נסו אזור או סגנון אחר', canRetry: false };
    }
    if (err.status === 400) {
      // The backend already returns a short Hebrew message for validation errors.
      return { kind: 'input', message: err.message || 'חלק מהפרטים לא תקינים', canRetry: false };
    }
    return { kind: 'server', message: 'משהו השתבש ביצירת המסלול. נסו שוב בעוד רגע', canRetry: true };
  }
  if (err instanceof TypeError) {
    return { kind: 'network', message: 'אין חיבור לאינטרנט. בדקו את החיבור ונסו שוב', canRetry: true };
  }
  return { kind: 'server', message: 'משהו השתבש ביצירת המסלול. נסו שוב בעוד רגע', canRetry: true };
}

// ── Draft persistence across the login redirect ─────────────────────────────

export const DRAFT_KEY = 'router.tripPlannerDraft';
/** Drafts older than this are ignored (the user probably moved on). */
const DRAFT_MAX_AGE_MS = 30 * 60 * 1000;

export interface PlannerDraft {
  step: number;
  region: string;
  groupType: string;
  styles: string[];
  startTime: string;
  endTime: string;
  stops: string;
}

export function saveDraft(draft: PlannerDraft, storage: Storage | null = safeSession()): void {
  try {
    storage?.setItem(DRAFT_KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch { /* storage may be blocked (private mode); the draft is a convenience only */ }
}

/** Reads and removes the draft. Returns null when missing, stale or malformed. */
export function takeDraft(storage: Storage | null = safeSession(), now = Date.now()): PlannerDraft | null {
  try {
    const raw = storage?.getItem(DRAFT_KEY);
    storage?.removeItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<PlannerDraft> & { savedAt?: number };
    if (typeof d.savedAt !== 'number' || now - d.savedAt > DRAFT_MAX_AGE_MS) return null;
    if (typeof d.region !== 'string' || typeof d.groupType !== 'string' || !Array.isArray(d.styles)) return null;
    return {
      step: Math.min(3, Math.max(0, Number(d.step) || 0)),
      region: d.region,
      groupType: d.groupType,
      styles: d.styles.filter((s): s is string => typeof s === 'string'),
      startTime: typeof d.startTime === 'string' ? d.startTime : '09:00',
      endTime: typeof d.endTime === 'string' ? d.endTime : '16:00',
      stops: typeof d.stops === 'string' ? d.stops : '5',
    };
  } catch {
    return null;
  }
}

function safeSession(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}
