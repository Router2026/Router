import { describe, it, expect } from 'vitest'
import { extractJson } from './extract-json'

describe('extractJson', () => {
  it('parses plain JSON string', () => {
    const result = extractJson('{"name": "test", "value": 42}')
    expect(result).toEqual({ name: 'test', value: 42 })
  })

  it('extracts JSON from markdown code fence', () => {
    const raw = '```json\n{"stops": ["A", "B"]}\n```'
    const result = extractJson(raw) as { stops: string[] }
    expect(result.stops).toEqual(['A', 'B'])
  })

  it('extracts JSON from code fence without language tag', () => {
    const raw = '```\n{"key": "value"}\n```'
    const result = extractJson(raw) as { key: string }
    expect(result.key).toBe('value')
  })

  it('extracts JSON surrounded by prose text', () => {
    const raw = 'Here is the result: {"score": 99} as you can see.'
    const result = extractJson(raw) as { score: number }
    expect(result.score).toBe(99)
  })

  it('handles JSON with Hebrew values', () => {
    const raw = '{"name": "עין גדי", "region": "דרום"}'
    const result = extractJson(raw) as { name: string; region: string }
    expect(result.name).toBe('עין גדי')
  })

  it('handles empty string without crashing (jsonrepair is very permissive)', () => {
    // jsonrepair is extremely permissive — the function either returns something or throws LLMOutputError
    // The important thing is it never throws a generic Error
    try {
      const result = extractJson('')
      // If it didn't throw, it returned something (jsonrepair was able to produce output)
      expect(result).toBeDefined()
    } catch (e) {
      expect((e as Error).name).toBe('LLMOutputError')
    }
  })

  it('parses array JSON', () => {
    const result = extractJson('[1, 2, 3]')
    expect(result).toEqual([1, 2, 3])
  })
})
