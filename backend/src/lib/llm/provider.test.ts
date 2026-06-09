import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockOllama = { type: 'ollama' }
const mockOpenAI = { type: 'openai' }
const mockAnthropic = { type: 'anthropic' }

vi.mock('./ollama', () => ({ OllamaProvider: vi.fn(() => mockOllama) }))
vi.mock('./openai', () => ({ OpenAIProvider: vi.fn(() => mockOpenAI) }))
vi.mock('./anthropic', () => ({ AnthropicProvider: vi.fn(() => mockAnthropic) }))

beforeEach(() => {
  vi.resetModules()
  delete process.env.LLM_PROVIDER
})

describe('getLLMProvider', () => {
  it('returns OllamaProvider by default (no LLM_PROVIDER env)', async () => {
    const { getLLMProvider } = await import('./provider')
    const provider = getLLMProvider()
    expect(provider).toBe(mockOllama)
  })

  it('returns OllamaProvider when LLM_PROVIDER=ollama', async () => {
    process.env.LLM_PROVIDER = 'ollama'
    const { getLLMProvider } = await import('./provider')
    expect(getLLMProvider()).toBe(mockOllama)
  })

  it('returns OpenAIProvider when LLM_PROVIDER=openai', async () => {
    process.env.LLM_PROVIDER = 'openai'
    const { getLLMProvider } = await import('./provider')
    expect(getLLMProvider()).toBe(mockOpenAI)
  })

  it('returns AnthropicProvider when LLM_PROVIDER=anthropic', async () => {
    process.env.LLM_PROVIDER = 'anthropic'
    const { getLLMProvider } = await import('./provider')
    expect(getLLMProvider()).toBe(mockAnthropic)
  })

  it('throws for unknown LLM_PROVIDER', async () => {
    process.env.LLM_PROVIDER = 'gemini'
    const { getLLMProvider } = await import('./provider')
    expect(() => getLLMProvider()).toThrow('Unknown LLM_PROVIDER: "gemini"')
  })
})
