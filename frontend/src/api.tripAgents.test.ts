import { describe, it, expect, vi, afterEach } from 'vitest';
import { streamTripAgents, ApiError, type AgentEvent } from './api';

/** A fetch Response whose body arrives in the given chunks (lines may be split across chunks). */
function streamResponse(chunks: string[], status = 200, headers: Record<string, string> = {}) {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(c) { for (const ch of chunks) c.enqueue(enc.encode(ch)); c.close(); },
  });
  return new Response(body, { status, headers: { 'Content-Type': 'application/x-ndjson', ...headers } });
}

afterEach(() => vi.unstubAllGlobals());

describe('streamTripAgents', () => {
  it('parses NDJSON lines split across chunks and returns the final result', async () => {
    const result = { type: 'result', data: { plan: { title: 'יום' }, debug: {} } };
    const text = JSON.stringify({ type: 'step', step: 'intent', phase: 'start' }) + '\n'
      + JSON.stringify({ type: 'step', step: 'intent', phase: 'done' }) + '\n'
      + JSON.stringify(result) + '\n';
    const fetchMock = vi.fn(async () => streamResponse([text.slice(0, 17), text.slice(17, 60), text.slice(60)]));
    vi.stubGlobal('fetch', fetchMock);

    const events: AgentEvent[] = [];
    const last = await streamTripAgents('מסלול מים', (e) => events.push(e));
    expect(events.map((e) => e.type)).toEqual(['step', 'step', 'result']);
    expect(last).toEqual(result);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ query: 'מסלול מים' });
  });

  it('handles a final line without a trailing newline and ignores malformed lines', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => streamResponse(['not json\n', JSON.stringify({ type: 'error', code: 'X', message: 'שגיאה' })])));
    const last = await streamTripAgents('q q q', () => {});
    expect(last).toEqual({ type: 'error', code: 'X', message: 'שגיאה' });
  });

  it('throws ApiError with status and Retry-After on HTTP errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Too many', code: 'RATE_LIMITED' } }), { status: 429, headers: { 'Retry-After': '42' } })));
    const err = await streamTripAgents('q q q', () => {}).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 429, code: 'RATE_LIMITED', retryAfterSec: 42 });
  });

  it('returns a NO_RESULT error when the stream ends without a result', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => streamResponse([JSON.stringify({ type: 'step', step: 'intent', phase: 'start' }) + '\n'])));
    const last = await streamTripAgents('q q q', () => {});
    expect(last).toMatchObject({ type: 'error', code: 'NO_RESULT' });
  });
});
