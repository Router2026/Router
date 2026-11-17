import { OpenAIEmbeddingProvider } from "./openai";
import type { EmbeddingProvider } from "./types";

/**
 * Fixed on purpose (not env-configurable): the DB column is vector(768), and vectors from
 * different models are not comparable. Changing either requires a migration + full re-embed.
 */
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 768;

let instance: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (!instance) instance = new OpenAIEmbeddingProvider(EMBEDDING_MODEL, EMBEDDING_DIMENSIONS);
  return instance;
}

/** Test hook. */
export function setEmbeddingProviderForTests(provider: EmbeddingProvider | null): void {
  instance = provider;
}
