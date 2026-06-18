import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useInstallPrompt } from './useInstallPrompt'

beforeEach(() => {
  vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 10)' })
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useInstallPrompt', () => {
  it('available is false and isIos is false on non-iOS non-standalone desktop', () => {
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.isIos).toBe(false)
    expect(result.current.available).toBe(false)
  })

  it('isIos is true and available is true on iOS user agent', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0)' })
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.isIos).toBe(true)
    expect(result.current.available).toBe(true)
  })

  it('isIos and available are false when already installed (standalone mode)', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0)' })
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.isIos).toBe(false)
    expect(result.current.available).toBe(false)
  })

  it('available becomes true when beforeinstallprompt fires', () => {
    const listeners: Record<string, EventListener> = {}
    vi.stubGlobal('addEventListener', vi.fn((event: string, handler: EventListener) => {
      listeners[event] = handler
    }))
    vi.stubGlobal('removeEventListener', vi.fn())

    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.available).toBe(false)

    const fakeEvent = { preventDefault: vi.fn(), prompt: vi.fn(), userChoice: Promise.resolve({ outcome: 'accepted' as const }), platforms: [] }
    act(() => { listeners['beforeinstallprompt']?.(fakeEvent as unknown as Event) })
    expect(result.current.available).toBe(true)
  })

  it('triggerInstall does nothing when no installEvent is set', async () => {
    const { result } = renderHook(() => useInstallPrompt())
    await act(async () => { await result.current.triggerInstall() })
    expect(result.current.available).toBe(false)
  })

  it('triggerInstall sets available=false when outcome is accepted', async () => {
    const listeners: Record<string, EventListener> = {}
    vi.stubGlobal('addEventListener', vi.fn((event: string, handler: EventListener) => {
      listeners[event] = handler
    }))
    vi.stubGlobal('removeEventListener', vi.fn())

    const fakeEvent = {
      preventDefault: vi.fn(),
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
      platforms: [],
    }

    const { result } = renderHook(() => useInstallPrompt())
    act(() => { listeners['beforeinstallprompt']?.(fakeEvent as unknown as Event) })
    expect(result.current.available).toBe(true)

    await act(async () => { await result.current.triggerInstall() })
    expect(result.current.available).toBe(false)
  })

  it('triggerInstall keeps available=true when outcome is dismissed', async () => {
    const listeners: Record<string, EventListener> = {}
    vi.stubGlobal('addEventListener', vi.fn((event: string, handler: EventListener) => {
      listeners[event] = handler
    }))
    vi.stubGlobal('removeEventListener', vi.fn())

    const fakeEvent = {
      preventDefault: vi.fn(),
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'dismissed' as const }),
      platforms: [],
    }

    const { result } = renderHook(() => useInstallPrompt())
    act(() => { listeners['beforeinstallprompt']?.(fakeEvent as unknown as Event) })

    await act(async () => { await result.current.triggerInstall() })
    expect(result.current.available).toBe(true)
  })
})
