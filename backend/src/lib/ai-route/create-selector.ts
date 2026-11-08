// Builds the LLM stop selector used by POST /api/ai/generate-route.
// Lives outside route.ts because Next.js only allows route-handler exports there.

import { FallbackStopSelector } from "./fallback-selector";
import { DEFAULT_GROQ_FALLBACK_MODEL, DEFAULT_GROQ_MODEL, GroqStopSelector, type StopSelector } from "./groq";

/**
 * Primary model (GROQ_MODEL, default openai/gpt-oss-20b) with a rate-limit
 * fallback (GROQ_FALLBACK_MODEL, default qwen/qwen3.8-27b).
 * Returns null (deterministic fallback planner) when Groq is not configured.
 * Never throws, so a bad config cannot break loading the route module.
 */
export type SelectorEnv = Record<string, string | undefined>;

export function createSelector(env: SelectorEnv = process.env): StopSelector | null {
  const key = env.GROQ_API_KEY?.trim();
  if (!key || key.includes("...")) {
    console.warn(
      key
        ? "[ai-route] GROQ_API_KEY is still the .env.example placeholder; using the deterministic fallback planner"
        : "[ai-route] GROQ_API_KEY is not set; using the deterministic fallback planner",
    );
    return null;
  }
  try {
    const primaryModel = env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
    const fallbackModel = env.GROQ_FALLBACK_MODEL?.trim() || DEFAULT_GROQ_FALLBACK_MODEL;
    const primary = new GroqStopSelector({ apiKey: key, model: primaryModel, mode: env.GROQ_RESPONSE_MODE });
    if (fallbackModel === primaryModel) return primary;
    // "auto": the response mode is chosen per model, so a GROQ_RESPONSE_MODE meant
    // for the primary (e.g. json_object) does not disable strict schema on Qwen.
    const secondary = new GroqStopSelector({ apiKey: key, model: fallbackModel, mode: "auto" });
    return new FallbackStopSelector(primary, secondary, { primaryName: primaryModel, secondaryName: fallbackModel });
  } catch (err) {
    console.error("[ai-route] failed to create the Groq selector; using the deterministic fallback planner", err);
    return null;
  }
}
