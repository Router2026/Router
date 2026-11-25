// Shared Anthropic access for the trip-planning agents.
// The SDK reads ANTHROPIC_BASE_URL + ANTHROPIC_AUTH_TOKEN (or ANTHROPIC_API_KEY) from env.

import Anthropic from "@anthropic-ai/sdk";

/** Cheapest current model; override with TRIP_AGENTS_MODEL. */
export const DEFAULT_TRIP_AGENTS_MODEL = "claude-haiku-5-5";
export const AGENT_TIMEOUT_MS = 20_000;

export function tripAgentsModel(): string {
  return process.env.TRIP_AGENTS_MODEL || DEFAULT_TRIP_AGENTS_MODEL;
}

let client: Anthropic | null = null;
export function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new Error("ANTHROPIC_AUTH_TOKEN (or ANTHROPIC_API_KEY) is not configured");
  }
  client ??= new Anthropic({ maxRetries: 1, timeout: AGENT_TIMEOUT_MS });
  return client;
}

export class AgentError extends Error {
  constructor(readonly agent: string, message: string) {
    super(`[${agent}] ${message}`);
    this.name = "AgentError";
  }
}

/** Throws on stop reasons that mean the content can't be trusted as complete. */
export function assertUsableStop(agent: string, stopReason: string | null): void {
  if (stopReason === "refusal") throw new AgentError(agent, "model refused the request");
  if (stopReason === "max_tokens") throw new AgentError(agent, "output was truncated (max_tokens)");
}

export interface AgentUsage {
  calls: number;
  inputTokens: number;
  outputTokens: number;
}

export function emptyUsage(): AgentUsage {
  return { calls: 0, inputTokens: 0, outputTokens: 0 };
}

export function addUsage(acc: AgentUsage, u: { input_tokens: number; output_tokens: number } | undefined): void {
  acc.calls++;
  acc.inputTokens += u?.input_tokens ?? 0;
  acc.outputTokens += u?.output_tokens ?? 0;
}

/** Calendar date + weekday in Israel, so "מחר" / "בשבת" resolve against local time. */
export function israelToday(now: Date): { date: string; weekday: string } {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(now);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", weekday: "long" }).format(now);
  return { date, weekday };
}
