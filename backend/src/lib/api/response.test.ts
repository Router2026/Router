import { describe, it, expect } from 'vitest'
import { successResponse, errorResponse } from './response'

describe('successResponse', () => {
  it('wraps data with null error', () => {
    const result = successResponse({ id: 1 })
    expect(result).toEqual({ data: { id: 1 }, error: null })
  })

  it('works with primitive values', () => {
    expect(successResponse('ok')).toEqual({ data: 'ok', error: null })
    expect(successResponse(42)).toEqual({ data: 42, error: null })
    expect(successResponse(null)).toEqual({ data: null, error: null })
  })

  it('works with arrays', () => {
    const result = successResponse([1, 2, 3])
    expect(result.data).toHaveLength(3)
    expect(result.error).toBeNull()
  })
})

describe('errorResponse', () => {
  it('wraps message and code with null data', () => {
    const result = errorResponse('Not found', 'NOT_FOUND')
    expect(result).toEqual({ data: null, error: { message: 'Not found', code: 'NOT_FOUND' } })
  })

  it('preserves message and code exactly', () => {
    const result = errorResponse('Validation failed', 'VALIDATION_ERROR')
    expect(result.error?.message).toBe('Validation failed')
    expect(result.error?.code).toBe('VALIDATION_ERROR')
    expect(result.data).toBeNull()
  })
})
