import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSelector } from "./create-selector";
import { FallbackStopSelector } from "./fallback-selector";
import { DEFAULT_GROQ_MODEL, GroqStopSelector } from "./groq";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("createSelector", () => {
  it("returns null (deterministic planner) without a real API key", () => {
    expect(createSelector({})).toBeNull();
    expect(createSelector({ GROQ_API_KEY: "gsk_..." })).toBeNull();
  });

  it("defaults to gpt-oss-20b primary with a qwen fallback", () => {
    const s = createSelector({ GROQ_API_KEY: "gsk_test" });
    expect(s).toBeInstanceOf(FallbackStopSelector);
    const inner = s as unknown as { primary: GroqStopSelector; secondary: GroqStopSelector };
    expect(DEFAULT_GROQ_MODEL).toBe("openai/gpt-oss-20b");
    expect(inner.primary.model).toBe("openai/gpt-oss-20b");
    expect(inner.primary.mode).toBe("json_schema_strict");
    expect(inner.primary.reasoningEffort).toBe("low");
    expect(inner.secondary.model).toBe("qwen/qwen3.8-27b");
    expect(inner.secondary.mode).toBe("json_schema_strict");
    expect(inner.secondary.reasoningEffort).toBe("none");
  });

  it("does not apply the primary's GROQ_RESPONSE_MODE to the fallback", () => {
    const s = createSelector({ GROQ_API_KEY: "gsk_test", GROQ_RESPONSE_MODE: "json_object" });
    const inner = s as unknown as { secondary: GroqStopSelector };
    expect(inner.secondary.mode).toBe("json_schema_strict");
  });

  it("returns a plain selector when primary and fallback are the same model", () => {
    const s = createSelector({ GROQ_API_KEY: "gsk_test", GROQ_MODEL: "qwen/qwen3.8-27b", GROQ_FALLBACK_MODEL: "qwen/qwen3.8-27b" });
    expect(s).toBeInstanceOf(GroqStopSelector);
  });
});
