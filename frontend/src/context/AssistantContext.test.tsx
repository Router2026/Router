import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { TripBucketProvider, useTripBucket } from './TripBucketContext'
import { AssistantProvider, useAssistant } from './AssistantContext'
import { api, ApiError, type POI } from '../api'

vi.mock('../api', async (orig) => {
  const actual = await orig<typeof import('../api')>()
  return { ...actual, api: { ...actual.api, assistant: { chat: vi.fn() } } }
})
const chat = vi.mocked(api.assistant.chat)

const raw = (id: number, name: string) => ({
  id, name, category: 'חוף', region_name: 'גליל תחתון', latitude: '32.8', longitude: '35.6',
  main_image: '', difficulty: 'קל', average_rating: '4.5', distance_meters: 5200,
})
const poi = (id: string, name: string): POI => ({
  id, name, description: '', category: 'חוף', region: 'x', latitude: 32, longitude: 35,
  images: [], main_image: '', thumbnail: '', difficulty: 'קל', average_rating: 4,
})
const meta = { model: 'm', toolCalls: 0, modelCalls: 1, inputTokens: 0, outputTokens: 0 }

type Ctx = { a: ReturnType<typeof useAssistant>; b: ReturnType<typeof useTripBucket> }
const holder: { current?: Ctx } = {}
const ctx = new Proxy({} as Ctx, { get: (_t, k: keyof Ctx) => holder.current![k] })
function Probe() {
  const a = useAssistant()
  const b = useTripBucket()
  // Effects run inside act(), so tests always read the latest committed state.
  useEffect(() => { holder.current = { a, b } })
  return null
}
const mount = () => render(<TripBucketProvider><AssistantProvider><Probe /></AssistantProvider></TripBucketProvider>)

beforeEach(() => {
  sessionStorage.clear()
  chat.mockReset()
})

describe('AssistantContext', () => {
  it('starts with the welcome message', () => {
    mount()
    expect(ctx.a.messages).toHaveLength(1)
    expect(ctx.a.messages[0]).toMatchObject({ kind: 'welcome', role: 'assistant' })
  })

  it('sends history + route, renders cards and applies add/remove actions to the bucket', async () => {
    mount()
    act(() => ctx.b.addPoi(poi('3', 'עין חמד')))
    chat.mockResolvedValueOnce({
      reply: 'החלפתי.',
      places: [raw(1, 'חוף גיא')],
      actions: [{ type: 'remove', id: 3, name: 'עין חמד' }, { type: 'add', place: raw(4, 'שמורת חוף דור') }],
      meta,
    })

    await act(() => ctx.a.send('  תחליף את עין חמד בחוף דור  '))

    const body = chat.mock.calls[0][0]
    expect(body.route).toEqual([{ id: 3, name: 'עין חמד' }])
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'תחליף את עין חמד בחוף דור' })
    expect(body.messages[0]).toMatchObject({ role: 'assistant' }) // welcome is context
    expect(ctx.b.items.map(i => i.poi.id)).toEqual(['4'])
    const last = ctx.a.messages.at(-1)!
    expect(last).toMatchObject({ role: 'assistant', text: 'החלפתי.' })
    expect(last.places?.[0]).toMatchObject({ id: '1', name: 'חוף גיא', distance_meters: 5200 })
    expect(ctx.a.snap).toBe('peek') // route changed → reveal the map
  })

  it('sends shown places with earlier assistant messages so follow-ups resolve', async () => {
    mount()
    chat.mockResolvedValueOnce({ reply: 'הנה:', places: [raw(1, 'חוף גיא')], actions: [], meta })
    await act(() => ctx.a.send('חוף בכנרת'))
    chat.mockResolvedValueOnce({ reply: 'הוספתי.', places: [], actions: [], meta })
    await act(() => ctx.a.send('תוסיף את הראשון'))
    const msgs = chat.mock.calls[1][0].messages
    expect(msgs.find(m => m.content === 'הנה:')).toMatchObject({ places: [{ id: 1, name: 'חוף גיא' }] })
  })

  it('card buttons add/remove locally without calling the API', () => {
    mount()
    act(() => ctx.a.addFromCard(poi('7', 'חוף גיא')))
    expect(ctx.b.hasPoi('7')).toBe(true)
    expect(ctx.a.messages.at(-1)).toMatchObject({ kind: 'local', text: expect.stringContaining("'חוף גיא'") })
    act(() => ctx.a.removeFromCard(poi('7', 'חוף גיא')))
    expect(ctx.b.hasPoi('7')).toBe(false)
    expect(chat).not.toHaveBeenCalled()
  })

  it('shows a friendly error with retry, and never sends error messages as history', async () => {
    mount()
    chat.mockRejectedValueOnce(new ApiError('rate', 'RATE_LIMITED', 429))
    await act(() => ctx.a.send('חוף'))
    expect(ctx.a.messages.at(-1)).toMatchObject({ kind: 'error', retryText: 'חוף', text: expect.stringContaining('בעוד דקה') })

    chat.mockResolvedValueOnce({ reply: 'ok', places: [], actions: [], meta })
    await act(() => ctx.a.send('חוף'))
    expect(chat.mock.calls[1][0].messages.some(m => m.content.includes('בעוד דקה'))).toBe(false)
  })

  it('ignores a second send while one is in flight', async () => {
    mount()
    let resolve!: (v: Awaited<ReturnType<typeof chat>>) => void
    chat.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    let first!: Promise<void>
    act(() => { first = ctx.a.send('א') })
    await act(() => ctx.a.send('ב'))
    expect(chat).toHaveBeenCalledTimes(1)
    await act(async () => { resolve({ reply: 'ok', places: [], actions: [], meta }); await first })
  })

  it('persists the conversation in sessionStorage', async () => {
    mount()
    chat.mockResolvedValueOnce({ reply: 'שלום', places: [], actions: [], meta })
    await act(() => ctx.a.send('היי'))
    await waitFor(() => expect(sessionStorage.getItem('router_assistant_v1')).toContain('שלום'))
  })
})
