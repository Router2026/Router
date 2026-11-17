import OpenAI from "openai";
import { EmbeddingError, type EmbeddingProvider, type EmbedOptions } from "./types";

/** OpenAI allows up to 2048 inputs per request; smaller batches keep requests well under token limits. */
const BATCH_SIZE = 100;

type EmbeddingsClient = Pick<OpenAI, "embeddings">;

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private readonly client: EmbeddingsClient;

  constructor(
    readonly model: string,
    readonly dimensions: number,
    client?: EmbeddingsClient,
  ) {
    if (client) {
      this.client = client;
    } else {
      if (!process.env.OPENAI_API_KEY) throw new EmbeddingError("OPENAI_API_KEY is not set");
      this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
  }

  async embed(texts: string[], options: EmbedOptions = {}): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (texts.some((t) => !t.trim())) throw new EmbeddingError("Cannot embed an empty string");

    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      out.push(...(await this.embedBatch(batch, options)));
    }
    return out;
  }

  private async embedBatch(batch: string[], options: EmbedOptions): Promise<number[][]> {
    let response;
    try {
      response = await this.client.embeddings.create(
        { model: this.model, input: batch, dimensions: this.dimensions, encoding_format: "float" },
        { timeout: options.timeoutMs ?? 30_000, maxRetries: options.maxRetries ?? 3 },
      );
    } catch (err) {
      throw new EmbeddingError(`OpenAI embeddings request failed: ${(err as Error).message}`, { cause: err });
    }

    if (response.data.length !== batch.length) {
      throw new EmbeddingError(`Expected ${batch.length} embeddings, got ${response.data.length}`);
    }

    // The API returns an `index` per item; don't rely on response order.
    const vectors: number[][] = new Array(batch.length);
    for (const item of response.data) {
      if (item.embedding.length !== this.dimensions) {
        throw new EmbeddingError(
          `Expected ${this.dimensions} dimensions, got ${item.embedding.length} (model ${this.model})`,
        );
      }
      vectors[item.index] = item.embedding;
    }
    if (vectors.some((v) => !v)) throw new EmbeddingError("Embeddings response is missing indices");
    return vectors;
  }
}
