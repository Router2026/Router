import { jsonrepair } from "jsonrepair";
import { LLMOutputError } from "@/types/llm";

/**
 * Extracts and parses JSON from a raw LLM response string.
 * Attempts four strategies in order:
 *  1. Direct JSON.parse on cleaned string
 *  2. jsonrepair on the full cleaned string (handles preamble/postamble text)
 *  3. Regex-extract first {...} block, then JSON.parse
 *  4. jsonrepair on the extracted block
 */
export function extractJson(raw: string): unknown {
  const cleaned = raw.replace(/```(?:json)?\n?/g, "").trim();

  // 1. Direct parse
  try { return JSON.parse(cleaned); } catch { /* fall through */ }

  // 2. jsonrepair on full string — handles surrounding text and Hebrew quote drops
  try { return JSON.parse(jsonrepair(cleaned)); } catch { /* fall through */ }

  // 3. Extract first plausible JSON object via index scan (no regex — avoids ReDoS on
  //    crafted inputs with many unmatched braces and no closing brace).
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end > start) {
    const block = cleaned.slice(start, end + 1);
    try { return JSON.parse(block); } catch { /* fall through */ }
    // 4. jsonrepair on extracted block
    try { return JSON.parse(jsonrepair(block)); } catch { /* fall through */ }
  }

  throw new LLMOutputError(`Could not parse JSON from response: ${raw.slice(0, 200)}`);
}
