/**
 * Embeds new/changed locations into router.location_embeddings.
 *
 *   npm run embed:sync                 # embed everything stale
 *   npm run embed:sync -- --dry-run    # report counts only, no API calls, no writes
 *   npm run embed:sync -- --limit=20   # trial run on the first 20 stale locations
 *
 * Run after every ETL import / bulk edit. Safe to re-run: unchanged rows are skipped by hash.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number.parseInt(limitArg.split("=")[1], 10) : undefined;
  if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
    throw new Error("--limit must be a positive integer");
  }

  // Imported after dotenv so DATABASE_URL / OPENAI_API_KEY are set when modules initialise.
  const { rawDb } = await import("../src/lib/db/raw-client");
  const { syncLocationEmbeddings, getEmbeddingProvider } = await import("../src/lib/embeddings");

  const started = Date.now();
  const result = await syncLocationEmbeddings(rawDb, getEmbeddingProvider(), {
    dryRun,
    limit,
    log: (m) => console.log(`[embed:sync] ${m}`),
  });
  console.log(`[embed:sync] done in ${((Date.now() - started) / 1000).toFixed(1)}s`, result);
  process.exit(result.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[embed:sync] fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
