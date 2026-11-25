// Marks places whose water is unreliable (locations.water_seasonal, migration 0012).
//
//   npx tsx scripts/mark-seasonal-water.ts [--confirm]
//
// Signals (either is enough):
//   - OSM tag intermittent=yes or seasonal=yes on the place's own OSM element (fetched by id);
//   - explicit wording in the description, e.g. "אין מים רוב השנה", "יבש בקיץ", "בעונה הגשומה בלבד".
// Only sets TRUE (never clears a manual mark). Without --confirm it lists matches and rolls back.

import { config } from "dotenv";
config({ path: ".env.local" });
import { Client } from "pg";
import { dryReason } from "../src/lib/locations/water";

const UA = "router-water-check/1.0 (data quality script)";

async function osmTags(refs: string[]): Promise<Map<string, Record<string, string>>> {
  const map = new Map<string, Record<string, string>>();
  const by: Record<string, string[]> = { node: [], way: [], relation: [] };
  for (const r of refs) { const [t, id] = r.split("/"); by[t]?.push(id); }
  for (const [type, ids] of Object.entries(by)) {
    for (let i = 0; i < ids.length; i += 200) {
      const part = ids.slice(i, i + 200);
      const res = await fetch(`https://api.openstreetmap.org/api/0.6/${type}s.json?${type}s=${part.join(",")}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(60_000) });
      if (!res.ok) { console.warn(`OSM API ${res.status} for a ${type} batch — skipped`); continue; }
      const j = (await res.json()) as { elements: { type: string; id: number; tags?: Record<string, string> }[] };
      for (const e of j.elements) map.set(`${e.type}/${e.id}`, e.tags ?? {});
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return map;
}

async function main() {
  const confirm = process.argv.includes("--confirm");
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const hasCol = (await c.query(`SELECT 1 FROM information_schema.columns WHERE table_schema='router' AND table_name='locations' AND column_name='water_seasonal'`)).rowCount;
    if (!hasCol) throw new Error("migration 0012 is not applied");
    const { rows } = await c.query(`
      SELECT id, name, category, source, description, water_seasonal FROM router.locations
      WHERE has_water OR category IN ('מעיין', 'נחל', 'מים') ORDER BY id`);

    const refs = rows.map((r) => /openstreetmap\.org\/(node|way|relation)\/(\d+)/.exec(r.source)).filter(Boolean).map((m) => `${m![1]}/${m![2]}`);
    const tags = await osmTags(refs);

    const hits: { id: number; name: string; why: string }[] = [];
    for (const r of rows) {
      const m = /openstreetmap\.org\/(node|way|relation)\/(\d+)/.exec(r.source);
      const t = m ? tags.get(`${m[1]}/${m[2]}`) : undefined;
      const why = t?.intermittent === "yes" ? "OSM intermittent=yes" : t?.seasonal === "yes" ? "OSM seasonal=yes" : dryReason(r.description);
      if (why && !r.water_seasonal) hits.push({ id: r.id, name: r.name, why });
    }
    console.log(`${confirm ? "APPLYING" : "DRY RUN"}: ${hits.length} places to mark water_seasonal (checked ${rows.length} water places, ${tags.size} OSM elements)`);
    for (const h of hits) console.log(`  #${h.id} ${h.name} — ${h.why}`);

    await c.query("BEGIN");
    const u = await c.query(`UPDATE router.locations SET water_seasonal = TRUE WHERE id = ANY($1::int[]) AND NOT water_seasonal RETURNING id`, [hits.map((h) => h.id)]);
    if (u.rowCount !== hits.length) throw new Error(`expected ${hits.length} updates, got ${u.rowCount}`);
    if (confirm) { await c.query("COMMIT"); console.log("committed"); } else { await c.query("ROLLBACK"); console.log("dry run: rolled back"); }
  } catch (err) {
    await c.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    await c.end();
  }
}

if (process.argv[1]?.includes("mark-seasonal-water")) {
  main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
}
