import OpenAI from "openai";
import type { LLMProvider, TripInput, TripPlan, TripStop } from "@/types/llm";
import { LLMOutputError } from "@/types/llm";
import { buildGenerateTripPrompt, buildRegenerateStopPrompt } from "./prompts";
import { TripStopSchema, TripPlanSchema } from "./schemas";
import { extractJson } from "./extract-json";
import type { Poi } from "@/lib/db/schema";

export class OpenAIProvider implements LLMProvider {
  private readonly client: OpenAI;

  constructor() {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async generateTrip(input: TripInput, pois: Poi[]): Promise<TripPlan> {
    const response = await this.client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [{ role: "user", content: buildGenerateTripPrompt(input, pois) }],
      temperature: 0.7,
    });
    const content = response.choices[0]?.message?.content;
    if (!content) throw new LLMOutputError("Empty response from OpenAI");
    return this.parse(content);
  }

  async regenerateStop(plan: TripPlan, dayIndex: number, stopIndex: number, pois: Poi[]): Promise<TripStop> {
    const response = await this.client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [{ role: "user", content: buildRegenerateStopPrompt(plan, dayIndex, stopIndex, pois) }],
      temperature: 0.7,
    });
    const content = response.choices[0]?.message?.content;
    if (!content) throw new LLMOutputError("Empty response from OpenAI");
    const json = extractJson(content);
    const result = TripStopSchema.safeParse(json);
    if (!result.success) throw new LLMOutputError(`Invalid stop: ${result.error.message}`);
    return result.data;
  }

  private parse(raw: string): TripPlan {
    const json = extractJson(raw);
    const result = TripPlanSchema.safeParse(json);
    if (!result.success) throw new LLMOutputError(`Invalid plan: ${result.error.message}`);
    return result.data;
  }
}
