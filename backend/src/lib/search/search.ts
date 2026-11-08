import { rawDb } from "@/lib/db/raw-client";
import { cacheGet, cacheSet } from "@/lib/cache/mem-cache";
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  getEmbeddingProvider,
  normalizeQuery,
  toPgVector,
  type EmbeddingProvider,
} from "@/lib/embeddings";
import { rowToLocationSlim, type LocationWithDistance } from "@/lib/locations/location-service";
import { normalizeName } from "@/lib/ai-route/text";
import { buildHybridSql, type AttributeMode } from "./hybrid";
import { detectAttributes, type AttributeKey } from "./attributes";
import { detectRegions } from "./regions";
import { GroqQueryTranslator, needsTranslation, type QueryTranslator } from "./translate";

/** User-facing latency budget per external call; on timeout we degrade, never fail. */
export const TRANSLATE_TIMEOUT_MS = 1500;
export const EMBED_TIMEOUT_MS = 1500;
const QUERY_CACHE_TTL_S = 24 * 60 * 60; // translations / query vectors are deterministic enough
const RESULT_CACHE_TTL_S = 5 * 60;
export const MAX_SEARCH_LIMIT = 50;
const DEDUPE_HEADROOM = 10;
/** Chosen by npm run search:eval (boost vs filter). */
export const ATTRIBUTE_MODE: AttributeMode = "boost";

export interface SearchInput {
  q: string;
  regions?: string[];
  categories?: string[];
  difficulties?: string[];
  /** Filter chips (has_water / has_shade / accessible) — hard filters. */
  requiredAttributes?: AttributeKey[];
  near?: { lat: number; lng: number; radiusM?: number } | null;
  limit?: number;
}

export type SearchResultItem = LocationWithDistance & { score: number };

export interface SearchOutput {
  results: SearchResultItem[];
  meta: {
    query: string;
    /** The text actually used for matching (Hebrew translation when one was made). */
    searchedAs: string;
    translated: boolean;
    boostedRegions: string[];
    /** Structured attributes detected in the query (accessible, shade, water, challenging). */
    attributes: AttributeKey[];
    /** "hybrid" = full-text + semantic; "fts" = semantic unavailable, full-text only. */
    mode: "hybrid" | "fts";
  };
}

export interface SearchDeps {
  db: { query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> };
  embedder: EmbeddingProvider;
  translator: QueryTranslator;
  cache: { get<T>(key: string): T | null; set<T>(key: string, value: T, ttlS: number): void };
}

let defaultDeps: SearchDeps | null = null;
function getDefaultDeps(): SearchDeps {
  defaultDeps ??= {
    db: rawDb,
    // Lazy: the provider constructor throws without OPENAI_API_KEY. Deferring it into
    // embed() puts that failure inside embedQuery's try → full-text fallback, not a 500.
    embedder: {
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
      embed: (texts, opts) => getEmbeddingProvider().embed(texts, opts),
    },
    translator: new GroqQueryTranslator(),
    cache: { get: cacheGet, set: cacheSet },
  };
  return defaultDeps;
}

export async function searchLocations(input: SearchInput, deps: SearchDeps = getDefaultDeps()): Promise<SearchOutput> {
  const query = normalizeQuery(input.q);
  if (!query) throw new Error("searchLocations: empty query");
  const limit = Math.min(Math.max(input.limit ?? 20, 1), MAX_SEARCH_LIMIT);

  // Normalize optional fields so `undefined` and `null` / `[]` share one cache entry.
  const resultKey = `search:v1:${JSON.stringify({
    query,
    r: input.regions?.length ? input.regions : null,
    c: input.categories?.length ? input.categories : null,
    d: input.difficulties?.length ? input.difficulties : null,
    a: input.requiredAttributes?.length ? [...input.requiredAttributes].sort() : null,
    n: input.near ?? null,
    limit,
  })}`;
  const cached = deps.cache.get<SearchOutput>(resultKey);
  if (cached) return cached;

  // Region names in the original query (works for both languages).
  const { slugs: boostedRegions } = detectRegions(query);

  // 1. Translate non-Hebrew queries (content is Hebrew).
  let searchedAs = query;
  let translated = false;
  if (needsTranslation(query)) {
    const trKey = `search:tr:${query.toLowerCase()}`;
    let hebrew = deps.cache.get<string>(trKey);
    if (!hebrew) {
      hebrew = await deps.translator.toHebrew(query, { timeoutMs: TRANSLATE_TIMEOUT_MS });
      if (hebrew) deps.cache.set(trKey, hebrew, QUERY_CACHE_TTL_S);
    }
    if (hebrew) {
      searchedAs = hebrew;
      translated = true;
    }
  }

  // 2. Embed the query; on failure fall back to full-text only.
  const vector = await embedQuery(searchedAs, deps);

  // 3. Fused retrieval.
  const attributes = detectAttributes(query, translated ? searchedAs : null);
  const { sql, params } = buildHybridSql({
    ftsText: searchedAs,
    vector,
    boostRegionSlugs: boostedRegions,
    attributes,
    attributeMode: ATTRIBUTE_MODE,
    regions: input.regions,
    categories: input.categories,
    difficulties: input.difficulties,
    requiredAttributes: input.requiredAttributes,
    near: input.near,
    // Over-fetch so duplicates removed below don't leave the page short.
    limit: limit + DEDUPE_HEADROOM,
  });
  const { rows } = await deps.db.query<Record<string, unknown>>(sql, params);

  // The ETL imports some places from several sources; keep the best-scored copy (rows are sorted).
  const seen = new Set<string>();
  const unique = rows.filter((row) => {
    const key = normalizeName(String(row.name ?? ""));
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);

  const results = unique.map((row) => {
    const item = rowToLocationSlim(row) as SearchResultItem;
    if (row.distance_meters !== null && row.distance_meters !== undefined) {
      item.distance_meters = Number(row.distance_meters);
    }
    item.score = Number(row.score);
    return item;
  });

  const output: SearchOutput = {
    results,
    meta: { query, searchedAs, translated, boostedRegions, attributes, mode: vector ? "hybrid" : "fts" },
  };
  // Don't cache degraded results — the next request should retry the semantic path.
  if (vector) deps.cache.set(resultKey, output, RESULT_CACHE_TTL_S);
  return output;
}

async function embedQuery(text: string, deps: SearchDeps): Promise<string | null> {
  const key = `search:emb:${deps.embedder.model}:${text}`;
  const cached = deps.cache.get<string>(key);
  if (cached) return cached;
  try {
    const [vec] = await deps.embedder.embed([text], { timeoutMs: EMBED_TIMEOUT_MS, maxRetries: 0 });
    const literal = toPgVector(vec, EMBEDDING_DIMENSIONS);
    deps.cache.set(key, literal, QUERY_CACHE_TTL_S);
    return literal;
  } catch (err) {
    console.warn("[search] query embedding failed, falling back to full-text:", (err as Error).message);
    return null;
  }
}
