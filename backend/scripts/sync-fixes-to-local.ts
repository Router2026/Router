// Copies the 2026-11 data fixes from production (read-only) to the LOCAL dev database.
//
//   npx tsx scripts/sync-fixes-to-local.ts [--deleted <approved-actions.json>] [--confirm]
//
// Source: DATABASE_URL in .env.local (production, read-only transaction).
// Target: DATABASE_URL in .env.development.local — must be localhost / 127.0.0.1, or the script refuses.
//
// Copies:
//  - regions: every production row by id (updates the 10 existing, inserts the new ones), then
//    resets the id sequence;
//  - locations, only rows whose id AND name match in both databases: latitude, longitude, geom,
//    coords_verified, region_id, description, main_image, images, photo_credit, description_source(_url);
//  - deletions: rows listed in --deleted (apply-deletions.ts input), only if id + name match;
//  - community_pois.region_id synced to its live locations row.
// Local-only rows and local test data (favorites, routes, reviews…) are left alone.
// Without --confirm everything runs in a transaction that is rolled back.

import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "node:fs";
import { Client } from "pg";

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

const LOC_COLS = ["latitude", "longitude", "coords_verified", "region_id", "description", "main_image", "images", "photo_credit",
  "description_source", "description_source_url"] as const;

async function main() {
  const confirm = process.argv.includes("--confirm");
  const deletedFile = arg("deleted");
  const localUrl = readFileSync(".env.development.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
  if (!localUrl) throw new Error("no DATABASE_URL in .env.development.local");
  const host = new URL(localUrl).hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(host)) throw new Error(`refusing: target host is "${host}", not local`);
  if (process.env.DATABASE_URL === localUrl) throw new Error("source and target are the same database");
  console.log(confirm ? "APPLYING to local" : "DRY RUN (local changes rolled back)");

  const prod = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const local = new Client({ connectionString: localUrl });
  await prod.connect();
  await local.connect();
  try {
    // ── Read production ────────────────────────────────────────────────────
    await prod.query("BEGIN TRANSACTION READ ONLY");
    const regions = (await prod.query(`
      SELECT id, name, name_en, slug, center_lat, center_lng, zoom, radius_meters, color, polygon_coords, ST_AsEWKT(geom) geom_wkt
      FROM router.regions ORDER BY id`)).rows;
    const locs = (await prod.query(`
      SELECT id, name, ${LOC_COLS.join(", ")}, ST_AsEWKT(geom::geometry) geom_wkt FROM router.locations`)).rows;
    await prod.query("ROLLBACK");

    await local.query("BEGIN");
    await local.query("SET LOCAL search_path TO router, public");
    // Local schema must already have migrations 0010 and 0011.
    const cols = (await local.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='router' AND table_name='locations' AND column_name IN ('coords_verified','description_source')`)).rowCount;
    if (cols !== 2) throw new Error("local DB is missing migration 0010 or 0011");

    // ── Regions ────────────────────────────────────────────────────────────
    let regUpd = 0, regIns = 0;
    for (const r of regions) {
      const params = [r.id, r.name, r.name_en, r.slug, r.center_lat, r.center_lng, r.zoom, r.radius_meters, r.color, JSON.stringify(r.polygon_coords), r.geom_wkt];
      const u = await local.query(`
        UPDATE regions SET name=$2, name_en=$3, slug=$4, center_lat=$5, center_lng=$6, zoom=$7, radius_meters=$8, color=$9,
               polygon_coords=$10::jsonb, geom=ST_GeomFromEWKT($11) WHERE id=$1`, params);
      if (u.rowCount) { regUpd++; continue; }
      await local.query(`
        INSERT INTO regions (id, name, name_en, slug, center_lat, center_lng, zoom, radius_meters, color, polygon_coords, geom)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,ST_GeomFromEWKT($11))`, params);
      regIns++;
    }
    await local.query(`SELECT setval(pg_get_serial_sequence('router.regions', 'id'), (SELECT max(id) FROM router.regions))`);
    console.log(`regions: ${regUpd} updated, ${regIns} inserted`);

    // ── Locations (same id + name only) ────────────────────────────────────
    const localNames = new Map((await local.query(`SELECT id, name FROM locations`)).rows.map((r) => [r.id as number, r.name as string]));
    let locUpd = 0, skipped = 0;
    for (const l of locs) {
      if (localNames.get(l.id) !== l.name) { skipped++; continue; }
      const r = await local.query(`
        UPDATE locations SET latitude=$2, longitude=$3, coords_verified=$4, region_id=$5, description=$6, main_image=$7,
               images=$8::jsonb, photo_credit=$9, geom=ST_GeomFromEWKT($10)::geography,
               description_source=$11, description_source_url=$12
        WHERE id=$1 AND (latitude IS DISTINCT FROM $2::numeric OR longitude IS DISTINCT FROM $3::numeric
               OR coords_verified IS DISTINCT FROM $4 OR region_id IS DISTINCT FROM $5 OR description IS DISTINCT FROM $6
               OR main_image IS DISTINCT FROM $7 OR images::jsonb IS DISTINCT FROM $8::jsonb OR photo_credit IS DISTINCT FROM $9
               OR ST_AsEWKT(geom::geometry) IS DISTINCT FROM $10
               OR description_source IS DISTINCT FROM $11 OR description_source_url IS DISTINCT FROM $12)`,
        [l.id, l.latitude, l.longitude, l.coords_verified, l.region_id, l.description, l.main_image, JSON.stringify(l.images ?? []), l.photo_credit, l.geom_wkt,
         l.description_source, l.description_source_url]);
      locUpd += r.rowCount ?? 0;
    }
    console.log(`locations: ${locUpd} updated (${skipped} production rows not matched locally by id + name)`);

    // ── Deletions from the approved list ───────────────────────────────────
    if (deletedFile) {
      const acts = JSON.parse(readFileSync(deletedFile, "utf8")) as { id: number; name: string }[];
      const match = acts.filter((a) => localNames.get(a.id) === a.name).map((a) => a.id);
      const d = await local.query(`DELETE FROM locations WHERE id = ANY($1::int[]) AND source <> 'community' RETURNING id`, [match]);
      console.log(`deleted: ${d.rowCount} of ${acts.length} listed (${acts.length - match.length} not present locally)`);
    }

    const cp = await local.query(`
      UPDATE community_pois cp SET region_id = l.region_id FROM locations l
      WHERE l.source = 'community' AND l.source_id = cp.id::text AND cp.region_id IS DISTINCT FROM l.region_id RETURNING cp.id`);
    console.log(`community_pois synced: ${cp.rowCount}`);

    const s = (await local.query(`SELECT (SELECT count(*) FROM regions)::int regions, (SELECT count(*) FROM locations)::int locations,
      (SELECT count(*) FROM locations WHERE NOT coords_verified)::int unverified`)).rows[0];
    console.log(`local now: ${JSON.stringify(s)}`);

    if (confirm) { await local.query("COMMIT"); console.log("committed (local)"); }
    else { await local.query("ROLLBACK"); console.log("dry run: rolled back"); }
  } catch (err) {
    await local.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    await prod.end();
    await local.end();
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
