/**
 * Offline search-quality evaluation (makes real OpenAI + Groq calls, read-only DB).
 *
 *   npm run search:eval
 *   npm run search:eval -- --out=eval.json          # also write per-case results
 *   GROQ_TRANSLATE_MODEL=openai/gpt-oss-120b npm run search:eval   # compare translation models
 *
 * Variants:
 *   legacy         existing /api/locations?search= (FTS/ILIKE, sorted by rating)
 *   fts            new full-text rank only (no translation, no vectors)
 *   vector         vector only, original query (no translation)
 *   hybrid-no-tr   fts + vector + region boost, no translation
 *   hybrid-no-boost  fts + vector with translation, no region boost
 *   hybrid         production path: searchLocations()
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { writeFileSync } from "node:fs";

const K = 10;

async function main() {
  const outArg = process.argv.find((a) => a.startsWith("--out="))?.split("=")[1];

  const { rawDb } = await import("../src/lib/db/raw-client");
  const { getLocations } = await import("../src/lib/locations/location-service");
  const { getEmbeddingProvider, toPgVector, EMBEDDING_DIMENSIONS } = await import("../src/lib/embeddings");
  const { buildHybridSql } = await import("../src/lib/search/hybrid");
  const { detectRegions } = await import("../src/lib/search/regions");
  const { GroqQueryTranslator, needsTranslation } = await import("../src/lib/search/translate");
  const { searchLocations } = await import("../src/lib/search/search");
  const { normalizeName } = await import("../src/lib/ai-route/text");
  const { EVAL_CASES } = await import("../src/lib/search/eval-cases");

  const embedder = getEmbeddingProvider();
  const translator = new GroqQueryTranslator();
  const vecCache = new Map<string, string>();
  const embed = async (text: string) => {
    if (!vecCache.has(text)) {
      const [v] = await embedder.embed([text], { timeoutMs: 10_000, maxRetries: 2 });
      vecCache.set(text, toPgVector(v, EMBEDDING_DIMENSIONS));
    }
    return vecCache.get(text)!;
  };

  type Row = { id: number; name: string };
  const dedupeIds = (rows: Row[]) => {
    const seen = new Set<string>();
    return rows.filter((r) => {
      const k = normalizeName(r.name);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, K).map((r) => Number(r.id));
  };
  const runHybrid = async (ftsText: string, vector: string | null, boost: string[]) => {
    const { sql, params } = buildHybridSql({ ftsText, vector, boostRegionSlugs: boost, limit: K + 10 });
    return dedupeIds((await rawDb.query<Row>(sql, params)).rows);
  };

  const variants: Record<string, (q: string, hebrew: string) => Promise<number[]>> = {
    legacy: async (q) => dedupeIds((await getLocations({ search: q, limit: K + 10 })) as unknown as Row[]),
    fts: (q) => runHybrid(q, null, []),
    vector: async (q) => {
      const { rows } = await rawDb.query<Row>(
        `SELECT l.id, l.name FROM location_embeddings e JOIN locations l ON l.id = e.location_id
         ORDER BY e.embedding <=> $1::vector LIMIT $2`, [await embed(q), K + 10]);
      return dedupeIds(rows);
    },
    "hybrid-no-tr": async (q) => runHybrid(q, await embed(q), detectRegions(q).slugs),
    "hybrid-no-boost": async (_q, he) => runHybrid(he, await embed(he), []),
    hybrid: async (q) => (await searchLocations({ q, limit: K })).results.map((r) => r.id),
  };
  const names = Object.keys(variants);

  const perCase: Record<string, unknown>[] = [];
  const totals: Record<string, Record<string, number[]>> = {};
  const push = (group: string, variant: string, v: number) => {
    ((totals[group] ??= {})[variant] ??= []).push(v);
  };

  console.log(`case`.padEnd(22) + names.map((n) => n.padStart(16)).join("") + "   searchedAs");
  for (const c of EVAL_CASES) {
    const { rows: rel } = await rawDb.query<{ id: number }>(
      `SELECT l.id FROM locations l LEFT JOIN regions r ON r.id = l.region_id WHERE ${c.relevant}`);
    const relevant = new Set(rel.map((r) => Number(r.id)));
    if (relevant.size === 0) {
      console.warn(`skip ${c.id}: relevance predicate matches nothing`);
      continue;
    }

    const hebrew = needsTranslation(c.q) ? (await translator.toHebrew(c.q, { timeoutMs: 10_000 })) ?? c.q : c.q;

    const scores: Record<string, number> = {};
    for (const name of names) {
      const ids = await variants[name](c.q, hebrew);
      let score: number;
      if (c.kind === "topic") {
        score = ids.filter((id) => relevant.has(id)).length / Math.min(K, relevant.size);
      } else {
        const rank = ids.findIndex((id) => relevant.has(id));
        score = rank === -1 ? 0 : 1 / (rank + 1);
      }
      scores[name] = score;
      push(`${c.kind}`, name, score);
      push(`${c.kind}/${c.lang}`, name, score);
      push("all", name, score);
    }
    perCase.push({ ...c, relevantCount: relevant.size, searchedAs: hebrew, scores });
    console.log(c.id.padEnd(22) + names.map((n) => scores[n].toFixed(2).padStart(16)).join("") + `   ${hebrew}`);
  }

  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  console.log("\nmean (topic = P@10, known = MRR@10)");
  for (const group of ["topic/he", "topic/en", "known/he", "known/en", "topic", "known", "all"]) {
    if (!totals[group]) continue;
    const n = totals[group][names[0]].length;
    console.log(`${group} (n=${n})`.padEnd(22) + names.map((v) => avg(totals[group][v]).toFixed(3).padStart(16)).join(""));
  }

  if (outArg) {
    writeFileSync(outArg, JSON.stringify({ k: K, translateModel: process.env.GROQ_TRANSLATE_MODEL ?? process.env.GROQ_MODEL, perCase }, null, 2));
    console.log(`\nwrote ${outArg}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[search:eval] fatal:", err);
  process.exit(1);
});
