import type { LLMProvider } from "@/types/llm";
import { OllamaProvider } from "./ollama";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";

let instance: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (instance) return instance;

  const providerName = process.env.LLM_PROVIDER ?? "ollama";

  switch (providerName) {
    case "ollama":
      instance = new OllamaProvider();
      break;
    case "openai":
      instance = new OpenAIProvider();
      break;
    case "anthropic":
      instance = new AnthropicProvider();
      break;
    default:
      throw new Error(
        `Unknown LLM_PROVIDER: "${providerName}". Must be "ollama", "openai", or "anthropic".`
      );
  }

  return instance;
}
