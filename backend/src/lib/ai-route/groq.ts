// Groq stop selector (OpenAI-compatible API at https://api.groq.com/openai/v1).
//
// Response mode per Groq docs (console.groq.com/docs/structured-outputs):
//  - `json_schema` + strict: constrained decoding, only on a few models (e.g. openai/gpt-oss-*).
//  - `json_object`: valid JSON but no schema guarantee; works on all models,
//    including llama-3.3-70b-versatile (which does NOT support json_schema).
// In every mode the server-side validation in validate.ts is the real guarantee.

import OpenAI, { APIError, APIConnectionTimeoutError, APIUserAbortError } from "openai";
import type { ChatCompletionCreateParamsNonStreaming, ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { ReasoningEffort } from "openai/resources/shared";
import { extractJson } from "@/lib/llm/extract-json";
import { buildSelectionJsonSchema, SELECTION_SCHEMA_NAME } from "./schema";

export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
/**
 * Primary: small, fast model with strict json_schema. Fallback: stronger model
 * with a tight output-tokens-per-minute limit, so it is used only when the
 * primary is rate-limited (see fallback-selector.ts).
 * Llama chat models are not available on this Groq org (GET /models), so the
 * old llama-* defaults failed with model_not_found.
 */
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";
export const DEFAULT_GROQ_FALLBACK_MODEL = "qwen/qwen3.8-27b";

/**
 * Reasoning models think before answering; those hidden tokens count against
 * max_completion_tokens and OTPM. Picking ids from a closed list needs little:
 * Qwen3 can turn it off ("none"); gpt-oss's lowest level is "low".
 * Returns undefined for models where the param should not be sent.
 */
export function defaultReasoningEffort(model: string): ReasoningEffort | undefined {
  if (model.startsWith("qwen/qwen3")) return "none";
  if (model.startsWith("openai/gpt-oss")) return "low";
  return undefined;
}

/** Models documented by Groq as supporting `strict: true` json_schema. */
export const GROQ_STRICT_SCHEMA_MODELS: ReadonlySet<string> = new Set([
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "qwen/qwen3.8-27b",
  "meta-models/muse-spark-open",
]);

export type ResponseMode = "json_schema_strict" | "json_schema" | "json_object";

export function resolveResponseMode(model: string, configured: string | undefined): ResponseMode {
  if (configured === "json_schema_strict" || configured === "json_schema" || configured === "json_object") {
    return configured;
  }
  return GROQ_STRICT_SCHEMA_MODELS.has(model) ? "json_schema_strict" : "json_object";
}

export interface SelectionRequest {
  system: string;
  user: string;
  allowedKeys: readonly string[];
  /** Present on the repair retry: the rejected answer and why it was rejected. */
  repair?: { previousRaw: string; prompt: string };
}

export interface SelectionResponse {
  json: unknown;
  raw: string;
  model: string;
  mode: ResponseMode;
}

export interface StopSelector {
  selectStops(req: SelectionRequest, opts: { timeoutMs: number; signal?: AbortSignal }): Promise<SelectionResponse>;
}

export type SelectorErrorKind = "timeout" | "aborted" | "rate_limited" | "http" | "parse";

export class SelectorError extends Error {
  constructor(public readonly kind: SelectorErrorKind, message: string, public readonly raw?: string) {
    super(message);
    this.name = "SelectorError";
  }
}

export interface GroqSelectorOptions {
  client?: Pick<OpenAI, "chat">;
  apiKey?: string;
  model?: string;
  mode?: string;
  maxCompletionTokens?: number;
  /** `null` = never send reasoning_effort; omitted = per-model default. */
  reasoningEffort?: ReasoningEffort | null;
}

const MAX_REPAIR_ECHO_CHARS = 1500;

/**
 * Groq checks max_completion_tokens against the org's output-tokens-per-minute
 * limit BEFORE running the request: asking for more than the OTPM limit (1000
 * on qwen/qwen3.8-27b on_demand) fails every call with a 429. A 7-stop answer
 * is ~400-500 tokens, so 800 leaves headroom while staying under that limit.
 */
export const DEFAULT_MAX_COMPLETION_TOKENS = 800;
const MIN_COMPLETION_TOKENS = 256;

export function readMaxCompletionTokens(value: string | undefined): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n >= MIN_COMPLETION_TOKENS ? n : DEFAULT_MAX_COMPLETION_TOKENS;
}
const MAX_RATE_LIMIT_MESSAGE_CHARS = 300;

/**
 * Server-log detail for a Groq 429: which limit was hit (Groq's message names
 * RPM/TPM/RPD/TPD) plus the retry/remaining headers. Contains no secrets.
 */
export function describeRateLimit(err: APIError): string {
  const h = err.headers;
  const header = (name: string) => h?.get(name) ?? "-";
  return [
    (err.message || "no message").slice(0, MAX_RATE_LIMIT_MESSAGE_CHARS),
    `retry-after=${header("retry-after")}`,
    `remaining-requests=${header("x-ratelimit-remaining-requests")}`,
    `remaining-tokens=${header("x-ratelimit-remaining-tokens")}`,
  ].join(" | ");
}

export class GroqStopSelector implements StopSelector {
  private readonly client: Pick<OpenAI, "chat">;
  readonly model: string;
  readonly mode: ResponseMode;
  private readonly maxCompletionTokens: number;
  readonly reasoningEffort: ReasoningEffort | undefined;

  constructor(opts: GroqSelectorOptions = {}) {
    this.model = opts.model ?? process.env.GROQ_MODEL ?? DEFAULT_GROQ_MODEL;
    this.mode = resolveResponseMode(this.model, opts.mode ?? process.env.GROQ_RESPONSE_MODE);
    this.maxCompletionTokens = opts.maxCompletionTokens ?? readMaxCompletionTokens(process.env.GROQ_MAX_COMPLETION_TOKENS);
    this.reasoningEffort = opts.reasoningEffort === undefined
      ? defaultReasoningEffort(this.model)
      : (opts.reasoningEffort ?? undefined);

    if (opts.client) {
      this.client = opts.client;
    } else {
      const apiKey = opts.apiKey ?? process.env.GROQ_API_KEY;
      if (!apiKey) throw new Error("GROQ_API_KEY is not set");
      // Retries are handled by the orchestrator so the total time budget is respected.
      this.client = new OpenAI({ apiKey, baseURL: GROQ_BASE_URL, maxRetries: 0 });
    }
  }

  buildRequest(req: SelectionRequest): ChatCompletionCreateParamsNonStreaming {
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: req.system },
      { role: "user", content: req.user },
    ];
    if (req.repair) {
      messages.push(
        { role: "assistant", content: req.repair.previousRaw.slice(0, MAX_REPAIR_ECHO_CHARS) },
        { role: "user", content: req.repair.prompt },
      );
    }

    const response_format: ChatCompletionCreateParamsNonStreaming["response_format"] =
      this.mode === "json_object"
        ? { type: "json_object" }
        : {
            type: "json_schema",
            json_schema: {
              name: SELECTION_SCHEMA_NAME,
              schema: buildSelectionJsonSchema(req.allowedKeys),
              strict: this.mode === "json_schema_strict",
            },
          };

    return {
      model: this.model,
      messages,
      response_format,
      // Low temperature: we want faithful selection, not creative writing.
      temperature: 0.3,
      max_completion_tokens: this.maxCompletionTokens,
      ...(this.reasoningEffort ? { reasoning_effort: this.reasoningEffort } : {}),
    };
  }

  async selectStops(req: SelectionRequest, opts: { timeoutMs: number; signal?: AbortSignal }): Promise<SelectionResponse> {
    let raw: string;
    try {
      const completion = await this.client.chat.completions.create(this.buildRequest(req), {
        timeout: opts.timeoutMs,
        signal: opts.signal,
        maxRetries: 0,
      });
      raw = completion.choices[0]?.message?.content ?? "";
    } catch (err) {
      throw this.mapError(err);
    }

    if (!raw.trim()) throw new SelectorError("parse", "Empty response from Groq", raw);
    let json: unknown;
    try {
      json = extractJson(raw);
    } catch {
      throw new SelectorError("parse", "Response is not valid JSON", raw);
    }
    // jsonrepair can turn plain prose into an array or string; only an object is a real answer.
    if (json === null || typeof json !== "object" || Array.isArray(json)) {
      throw new SelectorError("parse", "Response is not a JSON object", raw);
    }
    return { json, raw, model: this.model, mode: this.mode };
  }

  private mapError(err: unknown): SelectorError {
    if (err instanceof SelectorError) return err;
    if (err instanceof APIConnectionTimeoutError) return new SelectorError("timeout", "Groq request timed out");
    if (err instanceof APIUserAbortError) return new SelectorError("aborted", "Groq request was aborted");
    if (err instanceof APIError) {
      if (err.status === 429) return new SelectorError("rate_limited", `Groq rate limit reached: ${describeRateLimit(err)}`);
      // On JSON validation failures Groq may include the rejected text; surface it
      // as a parse error so the orchestrator can run its repair retry.
      const body = err.error as { code?: string; failed_generation?: string } | undefined;
      if (err.status === 400 && (body?.code === "json_validate_failed" || typeof body?.failed_generation === "string")) {
        return new SelectorError("parse", "Groq JSON validation failed", body?.failed_generation);
      }
      // Include Groq's error code (e.g. "invalid_api_key", "model_not_found") for the server log.
      const code = body?.code ? ` (${body.code})` : "";
      return new SelectorError("http", `Groq API error ${err.status ?? "unknown"}${code} [model ${this.model}]`);
    }
    return new SelectorError("http", err instanceof Error ? err.message : "Unknown Groq error");
  }
}
