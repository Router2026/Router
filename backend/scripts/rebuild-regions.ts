// Region repair, step 1: use the detailed boundaries the app already draws.
//
//  - regions.geom was a 4-corner rectangle; rebuild it from regions.polygon_coords ([lat,lng] ring).
//  - Re-assign locations.region_id for VERIFIED locations to the region that contains them
//    (nearest region when a point is outside all of them). Unverified rows are left alone.
//  - Keep community_pois.region_id in sync with its live locations row.
//
//   npx tsx scripts/rebuild-regions.ts --backup-suffix YYYYMMDD [--confirm]
// Without --confirm: computes everything inside a transaction, prints the report, rolls back.
// Uses DATABASE_URL from .env.local (production Supabase).

import { config } from "dotenv";
config({ path: ".env.local" });
import { Client } from "pg";

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

const RAW_VALID = `ST_MakeValid(ST_MakePolygon(ST_AddPoint(l.line, ST_StartPoint(l.line))))`;
// A self-crossing ring becomes a MultiPolygon after ST_MakeValid (carmel_emek has a 0 km² sliver).
// The column is POLYGON, so keep the largest part; the guard below rejects dropping anything real.
const RING_TO_POLYGON = `
  (SELECT d.geom FROM ST_Dump(${RAW_VALID}) d ORDER BY ST_Area(d.geom) DESC LIMIT 1)`;
const DROPPED_KM2 = `
  ((ST_Area(${RAW_VALID}::geography) - ST_Area(${RING_TO_POLYGON}::geography)) / 1e6)`;
/** Max area (km²) we allow to drop when keeping the largest part. */
const MAX_DROPPED_KM2 = 1;
const RING_LINE = `
  LATERAL (SELECT ST_MakeLine(array_agg(ST_SetSRID(ST_MakePoint((e.p->>1)::float8, (e.p->>0)::float8), 4326) ORDER BY e.ord)) line
           FROM jsonb_array_elements(r.polygon_coords) WITH ORDINALITY AS e(p, ord)) l`;

async function main() {
  const suffix = arg("backup-suffix");
  if (!suffix || !/^\d{8}$/.test(suffix)) throw new Error("usage: --backup-suffix YYYYMMDD [--confirm]");
  const confirm = process.argv.includes("--confirm");
  const backup = `regions_backup_${suffix}`;
  console.log(confirm ? "APPLYING" : "DRY RUN");

  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    await c.query("SET search_path TO router, public");

    // Backup regions (locations already has locations_backup_<suffix> from the coordinate fix).
    const hasLocBackup = (await c.query(`SELECT to_regclass($1) t`, [`router.locations_backup_${suffix}`])).rows[0].t;
    if (!hasLocBackup) throw new Error(`router.locations_backup_${suffix} is missing; create it first`);
    const hasBackup = (await c.query(`SELECT to_regclass($1) t`, [`router.${backup}`])).rows[0].t;
    if (!hasBackup && confirm) {
      await c.query(`CREATE TABLE router.${backup} AS TABLE router.regions`);
      await c.query(`ALTER TABLE router.${backup} ENABLE ROW LEVEL SECURITY`);
      console.log(`backup created: router.${backup}`);
    } else {
      console.log(hasBackup ? `backup exists: router.${backup}` : `would create backup: router.${backup}`);
    }

    await c.query("BEGIN");

    // 1. Polygons from polygon_coords; every one must be a single valid Polygon (column type).
    const shapes = await c.query(`
      SELECT r.id, r.slug, ST_GeometryType(${RING_TO_POLYGON}) t, ST_IsValid(${RING_TO_POLYGON}) valid,
             ST_NPoints(${RING_TO_POLYGON}) npts, round(${DROPPED_KM2}::numeric, 3)::float8 dropped_km2
      FROM regions r, ${RING_LINE} ORDER BY r.id`);
    const bad = shapes.rows.filter((s) => s.t !== "ST_Polygon" || !s.valid || s.dropped_km2 > MAX_DROPPED_KM2);
    for (const s of shapes.rows.filter((s) => s.dropped_km2 > 0)) console.log(`  ${s.slug}: dropped a ${s.dropped_km2} km² sliver`);
    if (bad.length) throw new Error(`non-polygon results: ${JSON.stringify(bad)}`);
    await c.query(`
      WITH src AS (SELECT r.id, ${RING_TO_POLYGON} AS poly FROM regions r, ${RING_LINE})
      UPDATE regions SET geom = src.poly FROM src WHERE regions.id = src.id`);
    const n = (await c.query(`SELECT count(*)::int n FROM regions WHERE ST_NPoints(geom) > 5`)).rows[0].n;
    console.log(`regions.geom rebuilt: ${n}/${shapes.rowCount} now detailed (${shapes.rows.map((s) => `${s.slug}:${s.npts}`).join(", ")})`);

    // 2. Target region for each verified location.
    await c.query(`
      CREATE TEMP TABLE target ON COMMIT DROP AS
      SELECT l.id, l.region_id AS old_region,
             COALESCE(
               (SELECT r.id FROM regions r WHERE ST_Contains(r.geom, l.geom::geometry) ORDER BY r.id LIMIT 1),
               (SELECT r.id FROM regions r ORDER BY ST_Distance(r.geom::geography, l.geom) LIMIT 1)
             ) AS new_region,
             NOT EXISTS (SELECT 1 FROM regions r WHERE ST_Contains(r.geom, l.geom::geometry)) AS outside
      FROM locations l WHERE l.coords_verified`);
    const flows = await c.query(`
      SELECT ro.slug old_slug, rn.slug new_slug, count(*)::int n, count(*) FILTER (WHERE t.outside)::int outside
      FROM target t LEFT JOIN regions ro ON ro.id = t.old_region JOIN regions rn ON rn.id = t.new_region
      WHERE t.old_region IS DISTINCT FROM t.new_region GROUP BY 1,2 ORDER BY 3 DESC`);
    const changes = flows.rows.reduce((s, r) => s + r.n, 0);
    console.log(`verified locations changing region: ${changes}`);
    for (const f of flows.rows) console.log(`  ${(f.old_slug ?? "(none)").padEnd(16)} → ${f.new_slug.padEnd(16)} ${String(f.n).padStart(4)}${f.outside ? `  (${f.outside} outside all polygons → nearest)` : ""}`);

    const upd = await c.query(`
      UPDATE locations l SET region_id = t.new_region
      FROM target t WHERE l.id = t.id AND l.region_id IS DISTINCT FROM t.new_region RETURNING l.id`);
    if (upd.rowCount !== changes) throw new Error(`expected ${changes} location updates, got ${upd.rowCount}`);

    // 3. community_pois mirrors its live row.
    const cp = await c.query(`
      UPDATE community_pois cp SET region_id = l.region_id
      FROM locations l WHERE l.source = 'community' AND l.source_id = cp.id::text AND cp.region_id IS DISTINCT FROM l.region_id
      RETURNING cp.id`);
    console.log(`community_pois synced: ${cp.rowCount}`);

    // 4. Sanity: every verified location is now inside (or nearest to) its region.
    const check = await c.query(`
      SELECT count(*) FILTER (WHERE ST_Contains(r.geom, l.geom::geometry))::int inside, count(*)::int total
      FROM locations l JOIN regions r ON r.id = l.region_id WHERE l.coords_verified`);
    console.log(`after: ${check.rows[0].inside}/${check.rows[0].total} verified locations inside their region`);

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
