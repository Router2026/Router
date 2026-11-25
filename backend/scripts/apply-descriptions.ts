// Applies description proposals from description-sources.ts. Writes to DATABASE_URL (production).
//
//   npx tsx scripts/apply-descriptions.ts --file <description-proposals.json> --facts        [--confirm]
//   npx tsx scripts/apply-descriptions.ts --file <description-proposals.json> --stage-wiki   [--confirm]
//   npx tsx scripts/apply-descriptions.ts --publish-pending                                   [--confirm]
//
//  --facts           write the facts-only descriptions now (description_source = 'facts').
//  --stage-wiki      put Wikipedia descriptions in location_description_pending (not shown by the app).
//  --publish-pending move pending rows into locations. Run ONLY after the attribution UI
//                    (POIDetail "מתוך ויקיפדיה · CC BY-SA 4.0") is deployed: the text is CC BY-SA.
//
// Every write is skipped for a row whose current description differs from the one the proposal
// was made against (someone edited it since). Community rows are never touched.
// A backup table locations_backup_<date>_predesc is created before the first write.
// Afterwards run `npm run embed:sync` so semantic search sees the new text.

import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "node:fs";
import { Client } from "pg";

interface Proposal { id: number; name: string; action: "wikipedia" | "facts" | "keep"; old: string; new: string | null; url: string | null }

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}
const flag = (n: string) => process.argv.includes(`--${n}`);
const BACKUP = `locations_backup_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}_predesc`;

async function main() {
  const modes = ["facts", "stage-wiki", "publish-pending"].filter(flag);
  if (modes.length !== 1) throw new Error("choose exactly one of --facts | --stage-wiki | --publish-pending");
  const mode = modes[0];
  const confirm = flag("confirm");
  const proposals = mode === "publish-pending" ? [] : (JSON.parse(readFileSync(arg("file") ?? "", "utf8")) as Proposal[]);
  console.log(`${confirm ? "APPLYING" : "DRY RUN"}: ${mode}`);

  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    await c.query("SET search_path TO router, public");
    const hasCols = (await c.query(`SELECT 1 FROM information_schema.columns WHERE table_schema='router' AND table_name='locations' AND column_name='description_source'`)).rowCount;
    if (!hasCols) throw new Error("migration 0011 is not applied");
    if (mode !== "stage-wiki") {
      const exists = (await c.query(`SELECT to_regclass($1) t`, [`router.${BACKUP}`])).rows[0].t;
      if (!exists && confirm) {
        await c.query(`CREATE TABLE router.${BACKUP} AS TABLE router.locations`);
        await c.query(`ALTER TABLE router.${BACKUP} ENABLE ROW LEVEL SECURITY`);
        console.log(`backup created: router.${BACKUP}`);
      } else console.log(exists ? `backup exists: router.${BACKUP}` : `would create backup: router.${BACKUP}`);
    }

    await c.query("BEGIN");
    let done = 0, skipped = 0;
    if (mode === "facts") {
      for (const p of proposals.filter((x) => x.action === "facts" && x.new)) {
        const r = await c.query(`
          UPDATE locations SET description = $2, description_source = 'facts', description_source_url = NULL
          WHERE id = $1 AND coalesce(description, '') = $3 AND source <> 'community' RETURNING id`, [p.id, p.new, p.old]);
        if (r.rowCount) done++; else skipped++;
      }
    } else if (mode === "stage-wiki") {
      for (const p of proposals.filter((x) => x.action === "wikipedia" && x.new && x.url)) {
        const ok = (await c.query(`SELECT 1 FROM locations WHERE id = $1 AND coalesce(description, '') = $2 AND source <> 'community'`, [p.id, p.old])).rowCount;
        if (!ok) { skipped++; continue; }
        await c.query(`
          INSERT INTO location_description_pending (location_id, description, source, source_url, replaces)
          VALUES ($1, $2, 'wikipedia', $3, $4)
          ON CONFLICT (location_id) DO UPDATE SET description = EXCLUDED.description, source_url = EXCLUDED.source_url,
            replaces = EXCLUDED.replaces, created_at = now()`, [p.id, p.new, p.url, p.old]);
        done++;
      }
    } else {
      const r = await c.query(`
        WITH pub AS (
          UPDATE locations l SET description = p.description, description_source = p.source, description_source_url = p.source_url
          FROM location_description_pending p
          WHERE l.id = p.location_id AND coalesce(l.description, '') = p.replaces AND l.source <> 'community'
          RETURNING l.id)
        DELETE FROM location_description_pending WHERE location_id IN (SELECT id FROM pub) RETURNING location_id`);
      done = r.rowCount ?? 0;
      skipped = (await c.query(`SELECT count(*)::int n FROM location_description_pending`)).rows[0].n;
    }
    const s = (await c.query(`SELECT description_source, count(*)::int n FROM locations GROUP BY 1 ORDER BY 1`)).rows;
    const pending = (await c.query(`SELECT count(*)::int n FROM location_description_pending`)).rows[0].n;
    console.log(`${mode}: ${done} written, ${skipped} skipped (description changed since the report / still pending)`);
    console.log(`locations by description_source: ${JSON.stringify(s)}; pending: ${pending}`);

    if (confirm) { await c.query("COMMIT"); console.log("committed"); }
    else { await c.query("ROLLBACK"); console.log("dry run: rolled back"); }
  } catch (err) {
    await c.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    await c.end();
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
