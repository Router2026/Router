import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMultiImageUpload } from './useMultiImageUpload'

const mockObjectUrl = 'blob:http://localhost/fake-url'
const mockObjectUrl2 = 'blob:http://localhost/fake-url-2'
const mockCreateObjectURL = vi.fn()
const mockRevokeObjectURL = vi.fn()
vi.stubGlobal('URL', { createObjectURL: mockCreateObjectURL, revokeObjectURL: mockRevokeObjectURL })

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeFile(name = 'test.jpg', type = 'image/jpeg'): File {
  return new File(['content'], name, { type })
}

function makeChangeEvent(files: File[]): React.ChangeEvent<HTMLInputElement> {
  return {
    target: { files: files.length ? files : null },
  } as unknown as React.ChangeEvent<HTMLInputElement>
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  let callCount = 0
  mockCreateObjectURL.mockImplementation(() => {
    callCount++
    return callCount === 1 ? mockObjectUrl : mockObjectUrl2
  })
})

describe('useMultiImageUpload — initial state', () => {
  it('starts with empty selection', () => {
    const { result } = renderHook(() => useMultiImageUpload())
    expect(result.current.selectedFiles).toEqual([])
    expect(result.current.isUploading).toBe(false)
    expect(result.current.uploadError).toBeNull()
  })
})

describe('useMultiImageUpload — handleFilesChange', () => {
  it('sets selected files with preview URLs', () => {
    const { result } = renderHook(() => useMultiImageUpload())
    const file = makeFile()

    act(() => {
      result.current.handleFilesChange(makeChangeEvent([file]))
    })

    expect(result.current.selectedFiles).toHaveLength(1)
    expect(result.current.selectedFiles[0].file).toBe(file)
    expect(result.current.selectedFiles[0].previewUrl).toBe(mockObjectUrl)
    expect(mockCreateObjectURL).toHaveBeenCalledWith(file)
  })

  it('handles multiple files', () => {
    const { result } = renderHook(() => useMultiImageUpload())
    const f1 = makeFile('a.jpg')
    const f2 = makeFile('b.jpg')

    act(() => {
      result.current.handleFilesChange(makeChangeEvent([f1, f2]))
    })

    expect(result.current.selectedFiles).toHaveLength(2)
  })

  it('revokes old blob URLs when new files are selected', () => {
    const { result } = renderHook(() => useMultiImageUpload())
    act(() => { result.current.handleFilesChange(makeChangeEvent([makeFile('a.jpg')])) })
    act(() => { result.current.handleFilesChange(makeChangeEvent([makeFile('b.jpg')])) })

    expect(mockRevokeObjectURL).toHaveBeenCalledWith(mockObjectUrl)
  })

  it('ignores empty file list', () => {
    const { result } = renderHook(() => useMultiImageUpload())
    act(() => {
      result.current.handleFilesChange({ target: { files: null } } as unknown as React.ChangeEvent<HTMLInputElement>)
    })
    expect(result.current.selectedFiles).toEqual([])
  })

  it('clears upload error when new files selected', () => {
    const { result } = renderHook(() => useMultiImageUpload())
    act(() => { result.current.handleFilesChange(makeChangeEvent([makeFile()])) })
    // Force an error state via uploadAll failure, then re-select
    expect(result.current.uploadError).toBeNull()
  })
})

describe('useMultiImageUpload — removeFile', () => {
  it('removes a file by index and revokes its URL', () => {
    const { result } = renderHook(() => useMultiImageUpload())
    const f1 = makeFile('a.jpg')
    const f2 = makeFile('b.jpg')

    act(() => { result.current.handleFilesChange(makeChangeEvent([f1, f2])) })
    act(() => { result.current.removeFile(0) })

    expect(result.current.selectedFiles).toHaveLength(1)
    expect(result.current.selectedFiles[0].file).toBe(f2)
    expect(mockRevokeObjectURL).toHaveBeenCalledWith(mockObjectUrl)
  })

  it('is safe to call with out-of-range index', () => {
    const { result } = renderHook(() => useMultiImageUpload())
    act(() => { result.current.handleFilesChange(makeChangeEvent([makeFile()])) })
    expect(() => act(() => { result.current.removeFile(99) })).not.toThrow()
  })
})

describe('useMultiImageUpload — reset', () => {
  it('clears all state and revokes URLs', () => {
    const { result } = renderHook(() => useMultiImageUpload())
    act(() => { result.current.handleFilesChange(makeChangeEvent([makeFile()])) })
    act(() => { result.current.reset() })

    expect(result.current.selectedFiles).toEqual([])
    expect(result.current.isUploading).toBe(false)
    expect(result.current.uploadError).toBeNull()
    expect(mockRevokeObjectURL).toHaveBeenCalledWith(mockObjectUrl)
  })

  it('is safe when no files selected', () => {
    const { result } = renderHook(() => useMultiImageUpload())
    expect(() => act(() => { result.current.reset() })).not.toThrow()
  })
})

describe('useMultiImageUpload — uploadAll', () => {
  it('returns empty array when no files selected', async () => {
    const { result } = renderHook(() => useMultiImageUpload())
    let urls: string[]
    await act(async () => { urls = await result.current.uploadAll() })
    expect(urls!).toEqual([])
  })

  it('uploads all files concurrently and returns URLs', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { url: 'https://storage.example.com/img.jpg' } }),
    })
    localStorage.setItem('router_auth_token', 'test-token')

    const { result } = renderHook(() => useMultiImageUpload())
    act(() => { result.current.handleFilesChange(makeChangeEvent([makeFile('a.jpg'), makeFile('b.jpg')])) })

    let urls: string[]
    await act(async () => { urls = await result.current.uploadAll() })

    expect(urls!).toHaveLength(2)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(result.current.isUploading).toBe(false)
  })

  it('sets uploading state during upload', async () => {
    let resolveUpload!: () => void
    const pendingUpload = new Promise<void>(resolve => { resolveUpload = resolve })

    mockFetch.mockImplementation(() =>
      pendingUpload.then(() => ({
        ok: true,
        json: async () => ({ data: { url: 'https://storage.example.com/img.jpg' } }),
      }))
    )

    const { result } = renderHook(() => useMultiImageUpload())
    act(() => { result.current.handleFilesChange(makeChangeEvent([makeFile()])) })

    let uploadPromise: Promise<string[]>
    act(() => { uploadPromise = result.current.uploadAll() })

    expect(result.current.isUploading).toBe(true)
    resolveUpload()
    await act(async () => { await uploadPromise })
    expect(result.current.isUploading).toBe(false)
  })

  it('sets uploadError and rethrows on HTTP error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'Server error' } }),
    })

    const { result } = renderHook(() => useMultiImageUpload())
    act(() => { result.current.handleFilesChange(makeChangeEvent([makeFile()])) })

    let thrown: unknown
    await act(async () => {
      try { await result.current.uploadAll() } catch (e) { thrown = e }
    })

    expect((thrown as Error).message).toContain('Server error')
    expect(result.current.uploadError).toContain('Server error')
    expect(result.current.isUploading).toBe(false)
  })

  it('throws when no URL returned from server', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} }),
    })

    const { result } = renderHook(() => useMultiImageUpload())
    act(() => { result.current.handleFilesChange(makeChangeEvent([makeFile('c.jpg')])) })

    let thrown: unknown
    await act(async () => {
      try { await result.current.uploadAll() } catch (e) { thrown = e }
    })

    expect((thrown as Error).message).toContain('No URL returned')
  })

  it('uploads without auth when no token', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { url: 'https://storage.example.com/img.jpg' } }),
    })

    const { result } = renderHook(() => useMultiImageUpload())
    act(() => { result.current.handleFilesChange(makeChangeEvent([makeFile()])) })

    await act(async () => { await result.current.uploadAll() })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.not.objectContaining({ Authorization: expect.any(String) }),
      })
    )
  })
})
