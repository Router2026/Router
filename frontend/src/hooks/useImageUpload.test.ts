import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useImageUpload } from './useImageUpload'

// ── Browser API mocks ─────────────────────────────────────────────────────────

const mockObjectUrl = 'blob:http://localhost/fake-url'
const mockCreateObjectURL = vi.fn(() => mockObjectUrl)
const mockRevokeObjectURL = vi.fn()
vi.stubGlobal('URL', { createObjectURL: mockCreateObjectURL, revokeObjectURL: mockRevokeObjectURL })

// FileReader mock
class MockFileReader {
  onload: ((e: ProgressEvent) => void) | null = null
  onerror: ((e: ProgressEvent) => void) | null = null
  result: string | null = null

  readAsDataURL(file: File) {
    // Simulate async read
    setTimeout(() => {
      this.result = `data:${file.type};base64,dGVzdA==`
      this.onload?.({} as ProgressEvent)
    }, 0)
  }
}
vi.stubGlobal('FileReader', MockFileReader)

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mockCreateObjectURL.mockReturnValue(mockObjectUrl)
})

function makeFile(name = 'test.jpg', type = 'image/jpeg'): File {
  return new File(['content'], name, { type })
}

function makeChangeEvent(file: File | null): React.ChangeEvent<HTMLInputElement> {
  return {
    target: { files: file ? [file] : null },
  } as unknown as React.ChangeEvent<HTMLInputElement>
}

// ── handleFileChange ──────────────────────────────────────────────────────────

describe('useImageUpload — handleFileChange', () => {
  it('starts with null state', () => {
    const { result } = renderHook(() => useImageUpload())
    expect(result.current.selectedFile).toBeNull()
    expect(result.current.previewUrl).toBeNull()
    expect(result.current.isUploading).toBe(false)
    expect(result.current.uploadError).toBeNull()
  })

  it('sets selectedFile and previewUrl when a file is selected', () => {
    const { result } = renderHook(() => useImageUpload())
    const file = makeFile()

    act(() => {
      result.current.handleFileChange(makeChangeEvent(file))
    })

    expect(result.current.selectedFile).toBe(file)
    expect(result.current.previewUrl).toBe(mockObjectUrl)
    expect(mockCreateObjectURL).toHaveBeenCalledWith(file)
  })

  it('clears selectedFile and previewUrl when no file', () => {
    const { result } = renderHook(() => useImageUpload())
    const file = makeFile()

    act(() => { result.current.handleFileChange(makeChangeEvent(file)) })
    act(() => { result.current.handleFileChange(makeChangeEvent(null)) })

    expect(result.current.selectedFile).toBeNull()
    expect(result.current.previewUrl).toBeNull()
  })

  it('revokes previous object URL when a new file is selected', () => {
    const { result } = renderHook(() => useImageUpload())

    act(() => { result.current.handleFileChange(makeChangeEvent(makeFile('a.jpg'))) })
    act(() => { result.current.handleFileChange(makeChangeEvent(makeFile('b.jpg'))) })

    expect(mockRevokeObjectURL).toHaveBeenCalledWith(mockObjectUrl)
  })

  it('revokes previous object URL when cleared', () => {
    const { result } = renderHook(() => useImageUpload())

    act(() => { result.current.handleFileChange(makeChangeEvent(makeFile())) })
    act(() => { result.current.handleFileChange(makeChangeEvent(null)) })

    expect(mockRevokeObjectURL).toHaveBeenCalledWith(mockObjectUrl)
  })
})

// ── uploadFile ────────────────────────────────────────────────────────────────

describe('useImageUpload — uploadFile', () => {
  it('throws when no file is selected', async () => {
    const { result } = renderHook(() => useImageUpload())
    await expect(result.current.uploadFile()).rejects.toThrow('No file selected')
  })

  it('uploads successfully and returns public URL', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { url: 'https://storage.example.com/img.jpg' } }),
    })
    localStorage.setItem('router_auth_token', 'test-token')

    const { result } = renderHook(() => useImageUpload())
    act(() => { result.current.handleFileChange(makeChangeEvent(makeFile())) })

    let url: string
    await act(async () => {
      url = await result.current.uploadFile()
    })

    expect(url).toBe('https://storage.example.com/img.jpg')
    expect(result.current.isUploading).toBe(false)
    expect(result.current.uploadError).toBeNull()
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/media/upload'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    )
  })

  it('uploads without auth token when none in localStorage', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { url: 'https://storage.example.com/img.jpg' } }),
    })

    const { result } = renderHook(() => useImageUpload())
    act(() => { result.current.handleFileChange(makeChangeEvent(makeFile())) })

    await act(async () => { await result.current.uploadFile() })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.not.objectContaining({ Authorization: expect.any(String) }),
      })
    )
  })

  it('throws and sets uploadError on HTTP error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'Server error' } }),
    })

    const { result } = renderHook(() => useImageUpload())
    act(() => { result.current.handleFileChange(makeChangeEvent(makeFile())) })

    let thrown: unknown
    await act(async () => {
      try { await result.current.uploadFile() } catch (e) { thrown = e }
    })
    expect((thrown as Error).message).toBe('Server error')
    expect(result.current.uploadError).toBe('Server error')
    expect(result.current.isUploading).toBe(false)
  })

  it('uses fallback error message when server returns no message', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({}),
    })

    const { result } = renderHook(() => useImageUpload())
    act(() => { result.current.handleFileChange(makeChangeEvent(makeFile())) })

    let thrown: unknown
    await act(async () => {
      try { await result.current.uploadFile() } catch (e) { thrown = e }
    })
    expect((thrown as Error).message).toContain('HTTP 403')
    expect(result.current.uploadError).toContain('HTTP 403')
  })

  it('throws when server returns no URL', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    })

    const { result } = renderHook(() => useImageUpload())
    act(() => { result.current.handleFileChange(makeChangeEvent(makeFile())) })

    let thrown: unknown
    await act(async () => {
      try { await result.current.uploadFile() } catch (e) { thrown = e }
    })
    expect((thrown as Error).message).toContain('No URL returned')
    expect(result.current.uploadError).toContain('No URL returned')
  })

  it('handles fetch network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network failure'))

    const { result } = renderHook(() => useImageUpload())
    act(() => { result.current.handleFileChange(makeChangeEvent(makeFile())) })

    let thrown: unknown
    await act(async () => {
      try { await result.current.uploadFile() } catch (e) { thrown = e }
    })
    expect((thrown as Error).message).toBe('Network failure')
    expect(result.current.uploadError).toBe('Network failure')
  })
})

// ── reset ─────────────────────────────────────────────────────────────────────

describe('useImageUpload — reset', () => {
  it('clears all state', () => {
    const { result } = renderHook(() => useImageUpload())
    act(() => { result.current.handleFileChange(makeChangeEvent(makeFile())) })
    act(() => { result.current.reset() })

    expect(result.current.selectedFile).toBeNull()
    expect(result.current.previewUrl).toBeNull()
    expect(result.current.isUploading).toBe(false)
    expect(result.current.uploadError).toBeNull()
  })

  it('revokes object URL on reset', () => {
    const { result } = renderHook(() => useImageUpload())
    act(() => { result.current.handleFileChange(makeChangeEvent(makeFile())) })
    act(() => { result.current.reset() })

    expect(mockRevokeObjectURL).toHaveBeenCalledWith(mockObjectUrl)
  })

  it('reset is safe to call with no file selected', () => {
    const { result } = renderHook(() => useImageUpload())
    expect(() => act(() => { result.current.reset() })).not.toThrow()
    expect(mockRevokeObjectURL).not.toHaveBeenCalled()
  })
})
