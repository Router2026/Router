// Pure text helpers (no DB/LLM dependencies) shared by the ai-route modules.

export const DESCRIPTION_MAX_CHARS = 160;

/**
 * Makes user-generated text safe to embed in a prompt as data:
 * strips control characters and characters we use as prompt delimiters,
 * collapses whitespace and truncates.
 */
export function sanitizeForPrompt(text: string | null | undefined, maxChars = DESCRIPTION_MAX_CHARS): string {
  if (!text) return "";
  const cleaned = text
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[<>`{}[\]|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= maxChars) return cleaned;
  return cleaned.slice(0, maxChars - 1).trimEnd() + "…";
}

/** Normalizes a Hebrew/English place name for duplicate detection and matching. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFKC")
    .replace(/[֑-ׇ]/g, "") // Hebrew niqqud and cantillation marks
    .replace(/["'`׳״\-–—_.,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
