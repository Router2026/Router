import { createHash } from "node:crypto";

/**
 * The subset of a location (plus its region name) that defines its meaning for search.
 * Changing what goes into the text changes every hash, which triggers a full re-embed
 * on the next sync — that is intentional.
 */
export interface EmbeddableLocation {
  name: string;
  description?: string | null;
  category?: string | null;
  regionName?: string | null;
  difficulty?: string | null;
  durationMinutes?: number | null;
  hasWater?: boolean | null;
  hasShade?: boolean | null;
  accessible?: boolean | null;
}

const MAX_DESCRIPTION_CHARS = 2000;
/** Caps cost and abuse on the user-facing query path. */
export const MAX_QUERY_CHARS = 300;

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Builds the document text that gets embedded for a location.
 * Feature flags are written in Hebrew + English so that queries in either language
 * ("מוצל", "shaded") land near the same locations.
 */
export function buildEmbeddingText(loc: EmbeddableLocation): string {
  const lines: string[] = [];

  const name = clean(loc.name);
  if (!name) throw new Error("buildEmbeddingText: location name is required");
  lines.push(name);

  const meta = [clean(loc.category), clean(loc.regionName)].filter(Boolean);
  if (meta.length) lines.push(meta.join(" · "));

  const features: string[] = [];
  if (loc.hasWater) features.push("יש מים (water)");
  if (loc.hasShade) features.push("מוצל (shaded)");
  if (loc.accessible) features.push("נגיש (wheelchair accessible)");
  const difficulty = clean(loc.difficulty);
  if (difficulty) features.push(`רמת קושי: ${difficulty}`);
  if (loc.durationMinutes && loc.durationMinutes > 0) {
    features.push(`משך: ${formatDuration(loc.durationMinutes)}`);
  }
  if (features.length) lines.push(features.join(", "));

  const description = clean(loc.description).slice(0, MAX_DESCRIPTION_CHARS);
  if (description) lines.push(description);

  return lines.join("\n");
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} דקות`;
  const hours = Math.round((minutes / 60) * 2) / 2; // nearest half hour
  return `${hours} שעות`;
}

/** Normalizes a user search query before embedding / cache keying. */
export function normalizeQuery(query: string): string {
  return clean(query).slice(0, MAX_QUERY_CHARS);
}

/**
 * sha256 over model + dimensions + text. Including the model means switching models
 * marks every row stale automatically.
 */
export function hashEmbeddingInput(text: string, model: string, dimensions: number): string {
  return createHash("sha256").update(`${model}\u0000${dimensions}\u0000${text}`).digest("hex");
}

/** Serializes a vector for a pgvector parameter: '[0.1,0.2,...]'. */
export function toPgVector(vec: number[], expectedDimensions: number): string {
  if (vec.length !== expectedDimensions) {
    throw new Error(`toPgVector: expected ${expectedDimensions} dimensions, got ${vec.length}`);
  }
  for (const v of vec) {
    if (!Number.isFinite(v)) throw new Error("toPgVector: vector contains a non-finite value");
  }
  return `[${vec.join(",")}]`;
}
