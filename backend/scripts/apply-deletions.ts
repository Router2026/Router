// Applies an APPROVED list of location deletions / merges (from deletion-candidates.ts).
// Writes to DATABASE_URL (.env.local = production Supabase).
//
//   npx tsx scripts/apply-deletions.ts --file <approved-actions.json> --backup-table locations_backup_YYYYMMDD_tag [--confirm]
//
// Actions: { action: "delete", id, name } | { action: "merge", id, name, keepId, keepName }
// A merge copies description / main_image / images / photo_credit onto the kept row when it
// lacks them (longer description wins), then deletes the merged row.
//
// Guards (all inside one transaction; any failure rolls everything back):
//  - every row still exists with the expected name (and the kept row too);
//  - no user data references a removed row (favorites, trips, ratings, reviews, route stops,
//    reports, media, images) — those need a real merge of references, which this script refuses;
//  - community rows are never touched (they mirror community_pois).

import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "node:fs";
import { Client } from "pg";

type Action =
  | { action: "delete"; id: number; name: string }
  | { action: "merge"; id: number; name: string; keepId: number; keepName: string };

const REF_TABLES = ["favorites", "trip_locations", "location_ratings", "reviews", "route_stops", "community_reports", "location_media", "location_images"];

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

async function main() {
  const file = arg("file");
  const backup = arg("backup-table");
  if (!file || !backup || !/^locations_backup_\d{8}_[a-z]+$/.test(backup)) {
    throw new Error("usage: --file <actions.json> --backup-table locations_backup_YYYYMMDD_tag [--confirm]");
  }
  const actions = JSON.parse(readFileSync(file, "utf8")) as Action[];
  const ids = actions.map((a) => a.id);
  if (new Set(ids).size !== ids.length) throw new Error("duplicate ids in actions");
  const keepIds = actions.flatMap((a) => (a.action === "merge" ? [a.keepId] : []));
  if (keepIds.some((k) => ids.includes(k))) throw new Error("a kept row is also scheduled for removal");
  const confirm = process.argv.includes("--confirm");
  console.log(`${confirm ? "APPLYING" : "DRY RUN"}: ${actions.filter((a) => a.action === "delete").length} deletes, ${actions.filter((a) => a.action === "merge").length} merges`);

  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    await c.query("SET search_path TO router, public");
    const exists = (await c.query(`SELECT to_regclass($1) t`, [`router.${backup}`])).rows[0].t;
    if (!exists && confirm) {
      await c.query(`CREATE TABLE router.${backup} AS TABLE router.locations`);
      await c.query(`ALTER TABLE router.${backup} ENABLE ROW LEVEL SECURITY`);
      console.log(`backup created: router.${backup}`);
    } else console.log(exists ? `backup exists: router.${backup}` : `would create backup: router.${backup}`);

    await c.query("BEGIN");
    const rows = await c.query(`SELECT id, name, source FROM locations WHERE id = ANY($1::int[])`, [[...ids, ...keepIds]]);
    const byId = new Map(rows.rows.map((r) => [r.id as number, r]));
    for (const a of actions) {
      const r = byId.get(a.id);
      if (!r || r.name !== a.name) throw new Error(`#${a.id} missing or renamed (expected "${a.name}", found "${r?.name}")`);
      if (r.source === "community") throw new Error(`#${a.id} is a community row`);
      if (a.action === "merge") {
        const k = byId.get(a.keepId);
        if (!k || k.name !== a.keepName) throw new Error(`kept #${a.keepId} missing or renamed (expected "${a.keepName}")`);
      }
    }
    const refs = await c.query(
      `SELECT l.id, ${REF_TABLES.map((t) => `(SELECT count(*) FROM ${t} x WHERE x.location_id = l.id)`).join(" + ")} AS n
       FROM locations l WHERE l.id = ANY($1::int[])`, [ids]);
    const referenced = refs.rows.filter((r) => Number(r.n) > 0);
    if (referenced.length) throw new Error(`rows with user data (refusing): ${referenced.map((r) => `#${r.id}`).join(", ")}`);

    let copied = 0;
    for (const a of actions) {
      if (a.action !== "merge") continue;
      const r = await c.query(`
        UPDATE locations k SET
          description  = CASE WHEN length(coalesce(d.description, '')) > length(coalesce(k.description, '')) THEN d.description ELSE k.description END,
          main_image   = COALESCE(NULLIF(k.main_image, ''), NULLIF(d.main_image, ''), k.main_image),
          images       = CASE WHEN coalesce(jsonb_array_length(k.images::jsonb), 0) = 0 THEN d.images ELSE k.images END,
          photo_credit = COALESCE(k.photo_credit, d.photo_credit)
        FROM locations d WHERE k.id = $1 AND d.id = $2
          AND (length(coalesce(d.description, '')) > length(coalesce(k.description, ''))
               OR (coalesce(k.main_image, '') = '' AND coalesce(d.main_image, '') <> '')
               OR (coalesce(jsonb_array_length(k.images::jsonb), 0) = 0 AND coalesce(jsonb_array_length(d.images::jsonb), 0) > 0)
               OR (k.photo_credit IS NULL AND d.photo_credit IS NOT NULL))
        RETURNING k.id`, [a.keepId, a.id]);
      copied += r.rowCount ?? 0;
    }
    const del = await c.query(`DELETE FROM locations WHERE id = ANY($1::int[]) RETURNING id`, [ids]);
    if (del.rowCount !== ids.length) throw new Error(`expected ${ids.length} deletions, got ${del.rowCount}`);
    const total = (await c.query(`SELECT count(*)::int n FROM locations`)).rows[0].n;
    console.log(`kept rows enriched from merged rows: ${copied}; deleted: ${del.rowCount}; locations now: ${total}`);

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
