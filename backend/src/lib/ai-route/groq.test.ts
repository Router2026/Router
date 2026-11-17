import { describe, it, expect, vi } from "vitest";
import { APIError, APIConnectionTimeoutError, APIUserAbortError } from "openai";
import { GroqStopSelector, resolveResponseMode, SelectorError, DEFAULT_GROQ_MODEL, DEFAULT_MAX_COMPLETION_TOKENS, readMaxCompletionTokens } from "./groq";

function fakeClient(impl: (...args: unknown[]) => unknown) {
  const create = vi.fn(impl);
  return { client: { chat: { completions: { create } } } as never, create };
}

function completion(content: string | null) {
  return { choices: [{ message: { content } }] };
}

const req = { system: "sys", user: "usr", allowedKeys: ["L1", "L2"] };

describe("resolveResponseMode", () => {
  it("uses json_object for llama-3.3-70b-versatile (no json_schema support on Groq)", () => {
    expect(resolveResponseMode("llama-3.3-70b-versatile", undefined)).toBe("json_object");
  });

  it("uses strict json_schema for documented strict models", () => {
    expect(resolveResponseMode("openai/gpt-oss-120b", undefined)).toBe("json_schema_strict");
  });

  it("honors an explicit override and ignores invalid values", () => {
    expect(resolveResponseMode("llama-3.3-70b-versatile", "json_schema")).toBe("json_schema");
    expect(resolveResponseMode("openai/gpt-oss-120b", "nonsense")).toBe("json_schema_strict");
  });
});

describe("GroqStopSelector.buildRequest", () => {
  it("defaults to openai/gpt-oss-20b with strict json_schema and low reasoning effort", () => {
    const { client } = fakeClient(() => null);
    const s = new GroqStopSelector({ client });
    const body = s.buildRequest(req);
    expect(DEFAULT_GROQ_MODEL).toBe("openai/gpt-oss-20b");
    expect(body.model).toBe(DEFAULT_GROQ_MODEL);
    expect(body.response_format).toMatchObject({ type: "json_schema", json_schema: { strict: true } });
    expect(body.messages).toHaveLength(2);
    expect(body.temperature).toBeLessThanOrEqual(0.5);
    expect(body.reasoning_effort).toBe("low");
  });

  it("omits reasoning_effort for non-reasoning models in json_object mode", () => {
    const { client } = fakeClient(() => null);
    const body = new GroqStopSelector({ client, model: "allam-2-7b" }).buildRequest(req);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body).not.toHaveProperty("reasoning_effort");
  });

  it("turns Qwen3 thinking off so hidden reasoning tokens do not eat the output budget", () => {
    const { client } = fakeClient(() => null);
    const body = new GroqStopSelector({ client, model: "qwen/qwen3.8-27b" }).buildRequest(req);
    expect(body.reasoning_effort).toBe("none");
  });

  it("lets callers override or suppress reasoning_effort", () => {
    const { client } = fakeClient(() => null);
    expect(new GroqStopSelector({ client, model: "qwen/qwen3.8-27b", reasoningEffort: null }).buildRequest(req))
      .not.toHaveProperty("reasoning_effort");
    expect(new GroqStopSelector({ client, model: "openai/gpt-oss-20b", reasoningEffort: "low" }).buildRequest(req).reasoning_effort)
      .toBe("low");
  });

  it("sends a strict json_schema with an id enum on strict models", () => {
    const { client } = fakeClient(() => null);
    const body = new GroqStopSelector({ client, model: "openai/gpt-oss-120b" }).buildRequest(req);
    const rf = body.response_format as { type: string; json_schema: { strict: boolean; schema: { properties: { stops: { items: { properties: { id: { enum: string[] } } } } } } } };
    expect(rf.type).toBe("json_schema");
    expect(rf.json_schema.strict).toBe(true);
    expect(rf.json_schema.schema.properties.stops.items.properties.id.enum).toEqual(["L1", "L2"]);
  });

  it("appends the rejected answer and repair prompt on retry", () => {
    const { client } = fakeClient(() => null);
    const body = new GroqStopSelector({ client }).buildRequest({ ...req, repair: { previousRaw: "x".repeat(5000), prompt: "fix it" } });
    expect(body.messages.map((m) => m.role)).toEqual(["system", "user", "assistant", "user"]);
    expect((body.messages[2].content as string).length).toBe(1500);
  });
});

describe("GroqStopSelector constructor", () => {
  it("throws without an API key when no client is injected", () => {
    const prev = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;
    expect(() => new GroqStopSelector()).toThrow(/GROQ_API_KEY/);
    if (prev !== undefined) process.env.GROQ_API_KEY = prev;
  });
});

describe("GroqStopSelector.selectStops", () => {
  it("parses JSON and passes timeout/signal with no SDK retries", async () => {
    const { client, create } = fakeClient(async () => completion('{"stops":[{"id":"L1"}]}'));
    const signal = new AbortController().signal;
    const res = await new GroqStopSelector({ client }).selectStops(req, { timeoutMs: 1234, signal });
    expect(res.json).toEqual({ stops: [{ id: "L1" }] });
    expect(res.mode).toBe("json_schema_strict"); // default model gpt-oss-20b
    expect(create.mock.calls[0][1]).toEqual({ timeout: 1234, signal, maxRetries: 0 });
  });

  it("tolerates fenced JSON", async () => {
    const { client } = fakeClient(async () => completion('```json\n{"stops":[]}\n```'));
    const res = await new GroqStopSelector({ client }).selectStops(req, { timeoutMs: 1000 });
    expect(res.json).toEqual({ stops: [] });
  });

  it("throws a parse error on empty or non-JSON content", async () => {
    for (const content of [null, "   ", "Sorry, I cannot help"]) {
      const { client } = fakeClient(async () => completion(content));
      await expect(new GroqStopSelector({ client }).selectStops(req, { timeoutMs: 1000 }))
        .rejects.toMatchObject({ kind: "parse" });
    }
  });

  const cases: Array<[string, unknown, string]> = [
    ["timeout", new APIConnectionTimeoutError(), "timeout"],
    ["abort", new APIUserAbortError(), "aborted"],
    ["429", new APIError(429, { message: "rate" }, "rate", new Headers()), "rate_limited"],
    ["500", new APIError(500, { message: "boom" }, "boom", new Headers()), "http"],
    ["unknown", new Error("network down"), "http"],
  ];
  it.each(cases)("maps %s errors", async (_name, error, kind) => {
    const { client } = fakeClient(async () => { throw error; });
    const err = await new GroqStopSelector({ client }).selectStops(req, { timeoutMs: 1000 }).catch((e) => e);
    expect(err).toBeInstanceOf(SelectorError);
    expect(err.kind).toBe(kind);
  });

  it("requests at most 800 completion tokens by default (under Groq's 1000 OTPM limit)", () => {
    const { client } = fakeClient(async () => completion("{}"));
    expect(new GroqStopSelector({ client }).buildRequest(req).max_completion_tokens).toBe(DEFAULT_MAX_COMPLETION_TOKENS);
    expect(DEFAULT_MAX_COMPLETION_TOKENS).toBeLessThan(1000);
  });

  it("reads GROQ_MAX_COMPLETION_TOKENS, ignoring invalid or tiny values", () => {
    expect(readMaxCompletionTokens("600")).toBe(600);
    expect(readMaxCompletionTokens(undefined)).toBe(DEFAULT_MAX_COMPLETION_TOKENS);
    expect(readMaxCompletionTokens("abc")).toBe(DEFAULT_MAX_COMPLETION_TOKENS);
    expect(readMaxCompletionTokens("10")).toBe(DEFAULT_MAX_COMPLETION_TOKENS);
  });

  it("includes Groq's rate-limit message and headers on a 429", async () => {
    const headers = new Headers({
      "retry-after": "17",
      "x-ratelimit-remaining-requests": "0",
      "x-ratelimit-remaining-tokens": "120",
    });
    const msg = "Rate limit reached for model qwen on tokens per day (TPD): Limit 500000, Used 499900";
    const apiErr = new APIError(429, { message: msg }, msg, headers);
    const { client } = fakeClient(async () => { throw apiErr; });
    const err = await new GroqStopSelector({ client }).selectStops(req, { timeoutMs: 1000 }).catch((e) => e);
    expect(err.kind).toBe("rate_limited");
    expect(err.message).toContain("tokens per day (TPD)");
    expect(err.message).toContain("retry-after=17");
    expect(err.message).toContain("remaining-requests=0");
    expect(err.message).toContain("remaining-tokens=120");
  });

  it("includes Groq's error code in the message for diagnostics", async () => {
    const apiErr = new APIError(401, { code: "invalid_api_key", message: "Invalid API Key" }, "Invalid API Key", new Headers());
    const { client } = fakeClient(async () => { throw apiErr; });
    const err = await new GroqStopSelector({ client }).selectStops(req, { timeoutMs: 1000 }).catch((e) => e);
    expect(err.kind).toBe("http");
    expect(err.message).toBe(`Groq API error 401 (invalid_api_key) [model ${DEFAULT_GROQ_MODEL}]`);
  });

  it("maps a 400 json_validate_failed to a parse error carrying the failed generation", async () => {
    const apiErr = new APIError(400, { code: "json_validate_failed", failed_generation: '{"stops": [' }, "bad json", new Headers());
    const { client } = fakeClient(async () => { throw apiErr; });
    const err = await new GroqStopSelector({ client }).selectStops(req, { timeoutMs: 1000 }).catch((e) => e);
    expect(err.kind).toBe("parse");
    expect(err.raw).toBe('{"stops": [');
  });
});
