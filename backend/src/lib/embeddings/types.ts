export interface EmbedOptions {
  /** Per-request timeout in ms. Use short values on user-facing paths. */
  timeoutMs?: number;
  /** Retries on transient errors (429 / 5xx / network). */
  maxRetries?: number;
}

export interface EmbeddingProvider {
  /** Model id stored alongside every vector (router.location_embeddings.model). */
  readonly model: string;
  /** Must equal the vector(N) dimension in the DB. */
  readonly dimensions: number;
  /** Embeds texts in input order. Splits into API-sized batches internally. */
  embed(texts: string[], options?: EmbedOptions): Promise<number[][]>;
}

export class EmbeddingError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "EmbeddingError";
  }
}
