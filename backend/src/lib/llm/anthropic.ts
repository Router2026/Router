import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, TripInput, TripPlan, TripStop } from '@/types/llm';
import { LLMOutputError } from '@/types/llm';
import { buildGenerateTripPrompt, buildRegenerateStopPrompt } from './prompts';
import { TripStopSchema, TripPlanSchema } from './schemas';
import { extractJson } from './extract-json';
import type { Poi } from '@/lib/db/schema';

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async generateTrip(input: TripInput, pois: Poi[]): Promise<TripPlan> {
    const message = await this.client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: buildGenerateTripPrompt(input, pois) }],
    });
    const block = message.content[0];
    if (!block || block.type !== 'text') {
      throw new LLMOutputError('No text content in Anthropic response');
    }
    return this.parse(block.text);
  }

  async regenerateStop(
    plan: TripPlan,
    dayIndex: number,
    stopIndex: number,
    pois: Poi[]
  ): Promise<TripStop> {
    const message = await this.client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        { role: 'user', content: buildRegenerateStopPrompt(plan, dayIndex, stopIndex, pois) },
      ],
    });
    const block = message.content[0];
    if (!block || block.type !== 'text') {
      throw new LLMOutputError('No text content in Anthropic response');
    }
    const json = extractJson(block.text);
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
