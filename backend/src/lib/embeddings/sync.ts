import { buildEmbeddingText, hashEmbeddingInput, toPgVector } from "./text";
import type { EmbeddingProvider } from "./types";

/** Minimal DB surface (rawDb satisfies this) — keeps the sync testable without Postgres. */
export interface SyncDb {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export interface SyncOptions {
  dryRun?: boolean;
  /** Only process the first N stale locations (useful for a trial run). */
  limit?: number;
  batchSize?: number;
  log?: (msg: string) => void;
}

export interface SyncResult {
  total: number;
  upToDate: number;
  stale: number;
  embedded: number;
  failed: number;
  dryRun: boolean;
}

interface LocationRow {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  region_name: string | null;
  difficulty: string | null;
  duration_minutes: number | null;
  has_water: boolean | null;
  has_shade: boolean | null;
  accessible: boolean | null;
  content_hash: string | null;
  model: string | null;
}

const SELECT_LOCATIONS = `
  SELECT l.id, l.name, l.description, l.category, r.name AS region_name,
         l.difficulty, l.duration_minutes, l.has_water, l.has_shade, l.accessible,
         e.content_hash, e.model
  FROM router.locations l
  LEFT JOIN router.regions r ON r.id = l.region_id
  LEFT JOIN router.location_embeddings e ON e.location_id = l.id
  ORDER BY l.id
`;

/**
 * Embeds every location that has no embedding or whose text/model changed (hash mismatch).
 * Idempotent: a second run with no data changes embeds nothing.
 * A failed batch is logged and skipped; the rest continue and the next run retries it.
 */
export async function syncLocationEmbeddings(
  db: SyncDb,
  provider: EmbeddingProvider,
  options: SyncOptions = {},
): Promise<SyncResult> {
  const { dryRun = false, limit, batchSize = 100, log = () => {} } = options;

  const { rows } = await db.query<LocationRow>(SELECT_LOCATIONS);

  const stale: { id: number; text: string; hash: string }[] = [];
  for (const row of rows) {
    let text: string;
    try {
      text = buildEmbeddingText({
        name: row.name,
        description: row.description,
        category: row.category,
        regionName: row.region_name,
        difficulty: row.difficulty,
        durationMinutes: row.duration_minutes,
        hasWater: row.has_water,
        hasShade: row.has_shade,
        accessible: row.accessible,
      });
    } catch {
      log(`skip location ${row.id}: no usable name`);
      continue;
    }
    const hash = hashEmbeddingInput(text, provider.model, provider.dimensions);
    if (row.content_hash !== hash || row.model !== provider.model) stale.push({ id: row.id, text, hash });
  }

  const todo = limit !== undefined ? stale.slice(0, limit) : stale;
  const result: SyncResult = {
    total: rows.length,
    upToDate: rows.length - stale.length,
    stale: stale.length,
    embedded: 0,
    failed: 0,
    dryRun,
  };

  log(`${rows.length} locations · ${result.upToDate} up to date · ${stale.length} stale · processing ${todo.length}`);
  if (dryRun || todo.length === 0) return result;

  for (let i = 0; i < todo.length; i += batchSize) {
    const batch = todo.slice(i, i + batchSize);
    try {
      const vectors = await provider.embed(batch.map((b) => b.text));
      await upsertBatch(db, batch, vectors, provider);
      result.embedded += batch.length;
      log(`embedded ${result.embedded}/${todo.length}`);
    } catch (err) {
      result.failed += batch.length;
      log(`batch ${i / batchSize + 1} failed (${batch.length} locations): ${(err as Error).message}`);
    }
  }

  return result;
}

async function upsertBatch(
  db: SyncDb,
  batch: { id: number; hash: string }[],
  vectors: number[][],
  provider: EmbeddingProvider,
): Promise<void> {
  const params: unknown[] = [provider.model];
  const values = batch.map((item, i) => {
    params.push(item.id, toPgVector(vectors[i], provider.dimensions), item.hash);
    const b = params.length - 3;
    return `($${b + 1}::int, $${b + 2}::vector, $${b + 3}, $1, now())`;
  });

  await db.query(
    `INSERT INTO router.location_embeddings (location_id, embedding, content_hash, model, updated_at)
     VALUES ${values.join(", ")}
     ON CONFLICT (location_id) DO UPDATE
       SET embedding = EXCLUDED.embedding,
           content_hash = EXCLUDED.content_hash,
           model = EXCLUDED.model,
           updated_at = EXCLUDED.updated_at`,
    params,
  );
}
