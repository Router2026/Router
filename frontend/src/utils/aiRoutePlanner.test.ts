import { describe, it, expect, beforeEach } from 'vitest';
import { ApiError } from '../api';
import { describeRouteError, isAbortError, saveDraft, takeDraft, DRAFT_KEY, type PlannerDraft } from './aiRoutePlanner';

describe('describeRouteError', () => {
  it('maps 401 to an auth error', () => {
    expect(describeRouteError(new ApiError('x', 'AUTH_REQUIRED', 401))).toMatchObject({ kind: 'auth', canRetry: false });
  });

  it('maps 429 and shows the wait time from Retry-After', () => {
    const info = describeRouteError(new ApiError('x', 'RATE_LIMITED', 429, 600));
    expect(info.kind).toBe('rate_limit');
    expect(info.message).toContain('10 דקות');
    expect(describeRouteError(new ApiError('x', 'RATE_LIMITED', 429, 30)).message).toContain('דקה');
    expect(describeRouteError(new ApiError('x', 'RATE_LIMITED', 429)).message).toContain('מאוחר יותר');
  });

  it('maps NO_LOCATIONS to a suggestion to change region', () => {
    expect(describeRouteError(new ApiError('x', 'NO_LOCATIONS', 404)).kind).toBe('no_locations');
  });

  it('shows the backend Hebrew message for 400', () => {
    expect(describeRouteError(new ApiError('האזור שנבחר לא נמצא', 'UNKNOWN_REGION', 400)).message).toBe('האזור שנבחר לא נמצא');
  });

  it('never shows raw server details for 500 and allows retry', () => {
    const info = describeRouteError(new ApiError('stack trace...', 'GENERATION_ERROR', 500));
    expect(info).toMatchObject({ kind: 'server', canRetry: true });
    expect(info.message).not.toContain('stack');
  });

  it('maps fetch TypeErrors to a network error', () => {
    expect(describeRouteError(new TypeError('Failed to fetch'))).toMatchObject({ kind: 'network', canRetry: true });
  });
});

describe('isAbortError', () => {
  it('detects aborts', () => {
    expect(isAbortError(new DOMException('aborted', 'AbortError'))).toBe(true);
    expect(isAbortError({ name: 'AbortError' })).toBe(true);
    expect(isAbortError(new Error('x'))).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });
});

describe('draft persistence', () => {
  const draft: PlannerDraft = {
    step: 3, region: 'golan', groupType: 'family', styles: ['water'], startTime: '08:00', endTime: '15:00', stops: '3',
  };

  beforeEach(() => sessionStorage.clear());

  it('round-trips and is consumed once', () => {
    saveDraft(draft, sessionStorage);
    expect(takeDraft(sessionStorage)).toEqual(draft);
    expect(takeDraft(sessionStorage)).toBeNull();
  });

  it('ignores stale drafts', () => {
    saveDraft(draft, sessionStorage);
    expect(takeDraft(sessionStorage, Date.now() + 31 * 60 * 1000)).toBeNull();
  });

  it('ignores malformed drafts and clamps the step', () => {
    sessionStorage.setItem(DRAFT_KEY, '{not json');
    expect(takeDraft(sessionStorage)).toBeNull();
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: Date.now(), region: 'x' }));
    expect(takeDraft(sessionStorage)).toBeNull();
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, step: 99, styles: ['water', 5], savedAt: Date.now() }));
    expect(takeDraft(sessionStorage)).toMatchObject({ step: 3, styles: ['water'] });
  });

  it('does not throw when storage is unavailable', () => {
    expect(() => saveDraft(draft, null)).not.toThrow();
    expect(takeDraft(null)).toBeNull();
  });
});
