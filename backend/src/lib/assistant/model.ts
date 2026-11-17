// Provider-agnostic chat model interface + OpenAI implementation (Chat Completions with tools).
// Kept behind an interface so other providers can be compared with scripts/assistant-eval.ts.

import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import type { ReasoningEffort } from "openai/resources/shared";

export type ChatMessage = ChatCompletionMessageParam;
export type ToolDefinition = ChatCompletionTool;

export interface ToolCall {
  id: string;
  name: string;
  /** Raw JSON string from the model — parse and validate before use. */
  arguments: string;
}

export interface ModelTurn {
  text: string | null;
  toolCalls: ToolCall[];
  usage?: { inputTokens: number; outputTokens: number };
}

export interface ChatModel {
  readonly name: string;
  complete(messages: ChatMessage[], tools: ToolDefinition[], opts: { timeoutMs: number }): Promise<ModelTurn>;
}

export const DEFAULT_ASSISTANT_MODEL = "gpt-5.4-mini";

/**
 * Reasoning-family models. In Chat Completions, newer ones reject function tools combined with
 * any reasoning_effort other than "none" (API: "Function tools with reasoning_effort are not
 * supported ... set reasoning_effort to 'none'"), so we send "none" for them.
 */
function isReasoningModel(model: string): boolean {
  return /^(gpt-5|gpt-6|o\d)/.test(model);
}

export class OpenAIChatModel implements ChatModel {
  private readonly client: OpenAI;

  constructor(readonly name: string = process.env.OPENAI_ASSISTANT_MODEL ?? DEFAULT_ASSISTANT_MODEL, client?: OpenAI) {
    if (client) {
      this.client = client;
    } else {
      if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");
      this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 1 });
    }
  }

  async complete(messages: ChatMessage[], tools: ToolDefinition[], opts: { timeoutMs: number }): Promise<ModelTurn> {
    const res = await this.client.chat.completions.create(
      {
        model: this.name,
        messages,
        tools,
        tool_choice: "auto",
        max_completion_tokens: 1500,
        ...(isReasoningModel(this.name)
          ? { reasoning_effort: (process.env.OPENAI_ASSISTANT_REASONING ?? "none") as ReasoningEffort }
          : { temperature: 0.4 }),
      },
      { timeout: opts.timeoutMs },
    );
    const msg = res.choices[0]?.message;
    return {
      text: msg?.content ?? null,
      toolCalls: (msg?.tool_calls ?? [])
        .filter((c) => c.type === "function")
        .map((c) => ({ id: c.id, name: c.function.name, arguments: c.function.arguments })),
      usage: res.usage
        ? { inputTokens: res.usage.prompt_tokens, outputTokens: res.usage.completion_tokens }
        : undefined,
    };
  }
}
