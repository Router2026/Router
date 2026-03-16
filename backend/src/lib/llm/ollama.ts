import OpenAI from "openai";
import type { LLMProvider, TripInput, TripPlan, TripStop } from "@/types/llm";
import { LLMOutputError } from "@/types/llm";
import { buildGenerateTripPrompt, buildRegenerateStopPrompt } from "./prompts";
import { TripStopSchema, TripPlanSchema } from "./schemas";
import { extractJson } from "./extract-json";
import type { Poi } from "@/lib/db/schema";

export class OllamaProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor() {
    this.client = new OpenAI({
      baseURL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
      apiKey: "ollama",
    });
    this.model = process.env.OLLAMA_MODEL ?? "llama3.1:8b";
  }

  async generateTrip(input: TripInput, pois: Poi[]): Promise<TripPlan> {
    const prompt = buildGenerateTripPrompt(input, pois);
    return this.retryParse(
      () => this.callLLM(prompt),
      (raw) => this.parseTripPlan(raw),
      3,
    );
  }

  async regenerateStop(
    plan: TripPlan,
    dayIndex: number,
    stopIndex: number,
    pois: Poi[],
  ): Promise<TripStop> {
    const prompt = buildRegenerateStopPrompt(plan, dayIndex, stopIndex, pois);
    return this.retryParse(
      () => this.callLLM(prompt),
      (raw) => this.parseTripStop(raw),
      3,
    );
  }

  private async callLLM(prompt: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response_format: { type: "json_object" } as any,
    });
    const content = response.choices[0]?.message?.content;
    if (!content) throw new LLMOutputError("Empty response from Ollama");
    return content;
  }

  private async retryParse<T>(
    call: () => Promise<string>,
    parse: (raw: string) => T,
    maxAttempts: number,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const raw = await call();
        return parse(raw);
      } catch (err) {
        lastError = err;
        if (attempt < maxAttempts) {
          console.warn(
            `[OllamaProvider] attempt ${attempt} failed, retrying...`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    }
    throw lastError;
  }

  private parseTripPlan(raw: string): TripPlan {
    const json = extractJson(raw);
    const result = TripPlanSchema.safeParse(json);
    if (!result.success)
      throw new LLMOutputError(`Invalid plan: ${result.error.message}`);
    return result.data;
  }

  private parseTripStop(raw: string): TripStop {
    const json = extractJson(raw);
    const result = TripStopSchema.safeParse(json);
    if (!result.success)
      throw new LLMOutputError(`Invalid stop: ${result.error.message}`);
    return result.data;
  }
}
