// Region repair, step 2: split overloaded regions using anchor points (scripts/region-anchors.ts).
//
// For every parent region that loses area, the anchors lying inside it compete:
// Voronoi cells (EPSG:2039, metres) ∩ parent boundary → pieces, unioned per target region.
// Regions not involved keep their boundary untouched.
//
//   npx tsx scripts/split-regions.ts --preview <out-dir>
// Preview mode computes inside a transaction that is always rolled back, and writes
// regions-split.json / places-split.json / split-report.json for review.

import { config } from "dotenv";
config({ path: ".env.local" });
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { SPLIT_SPECS } from "./region-anchors";

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

export const SPLIT_SQL = {
  seeds: `CREATE TEMP TABLE seeds (target text, parents text[], name text, pt geometry(Point, 4326)) ON COMMIT DROP`,
  // Each seed competes inside the parent(s) that contain it.
  pieces: `
    CREATE TEMP TABLE pieces ON COMMIT DROP AS
    WITH parent AS (
      SELECT r.id, r.slug, r.geom FROM regions r
      WHERE r.slug IN (SELECT DISTINCT unnest(parents) FROM seeds)
    ),
    s AS (
      SELECT p.slug AS parent, sd.target, sd.name, sd.pt
      FROM parent p JOIN seeds sd ON p.slug = ANY(sd.parents) AND ST_Contains(p.geom, sd.pt)
    ),
    cells AS (
      SELECT p.slug AS parent, (ST_Dump(ST_VoronoiPolygons(
               ST_Collect(ST_Transform(s.pt, 2039)), 0, ST_Transform(ST_Expand(p.geom, 0.5), 2039)))).geom AS cell
      FROM parent p JOIN s ON s.parent = p.slug GROUP BY p.slug, p.geom
    )
    SELECT c.parent, s.target, s.name AS anchor,
           ST_Transform(ST_Intersection(c.cell, ST_Transform(p.geom, 2039)), 4326) AS piece
    FROM cells c
    JOIN parent p ON p.slug = c.parent
    JOIN s ON s.parent = c.parent AND ST_Contains(c.cell, ST_Transform(s.pt, 2039))`,
};

/** Inside an open transaction: load anchors, build Voronoi pieces, run guards. Returns ignored anchors. */
async function prepare(c: Client) {
  await c.query("SET LOCAL search_path TO router, public");
  await c.query(SPLIT_SQL.seeds);
  for (const spec of SPLIT_SPECS) {
    for (const a of spec.anchors) {
      await c.query(`INSERT INTO seeds VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($5, $4), 4326))`, [spec.slug, spec.parents, a.name, a.lat, a.lng]);
    }
  }
  // Anchors that fall outside all of their parents are ignored — list them so they can be moved.
  const lost = await c.query(`
    SELECT sd.target, sd.name, (SELECT r.slug FROM regions r WHERE ST_Contains(r.geom, sd.pt)) AS lies_in
    FROM seeds sd WHERE NOT EXISTS (SELECT 1 FROM regions r WHERE r.slug = ANY(sd.parents) AND ST_Contains(r.geom, sd.pt))`);
  await c.query(SPLIT_SQL.pieces);
  // Every parent must keep at least one of its own anchors, or it would vanish.
  const orphan = await c.query(`
    SELECT DISTINCT p.parent FROM pieces p WHERE NOT EXISTS (SELECT 1 FROM pieces q WHERE q.parent = p.parent AND q.target = p.parent)`);
  if (orphan.rowCount) throw new Error(`parents with none of their own anchors inside: ${orphan.rows.map((r) => r.parent).join(", ")}`);
  return lost;
}

/** [lat,lng] ring for regions.polygon_coords (what MapView draws), simplified to ~50 m. */
const POLYGON_COORDS = (g: string) => `
  (SELECT jsonb_agg(jsonb_build_array(round(ST_Y(d.geom)::numeric, 6), round(ST_X(d.geom)::numeric, 6)) ORDER BY d.path)
   FROM ST_DumpPoints(ST_ExteriorRing(ST_SimplifyPreserveTopology(${g}, 0.0005))) d)`;

async function apply() {
  const suffix = arg("backup-suffix");
  if (!suffix || !/^\d{8}$/.test(suffix)) throw new Error("usage: --apply --backup-suffix YYYYMMDD [--confirm]");
  const confirm = process.argv.includes("--confirm");
  console.log(confirm ? "APPLYING" : "DRY RUN (apply path, rolled back)");

  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    for (const t of [`regions_backup_${suffix}`, `locations_backup_${suffix}`]) {
      if (!(await c.query(`SELECT to_regclass($1) t`, [`router.${t}`])).rows[0].t) throw new Error(`router.${t} is missing`);
    }
    await c.query("BEGIN");
    await prepare(c);

    const areaBefore = (await c.query(`SELECT sum(ST_Area(geom::geography))::float8 a FROM regions`)).rows[0].a;

    // New geometry per target (union of its pieces); must be one valid Polygon.
    await c.query(`
      CREATE TEMP TABLE newgeom ON COMMIT DROP AS
      SELECT target AS slug, ST_Union(piece) AS g FROM pieces GROUP BY target`);
    const shapes = await c.query(`SELECT slug, ST_GeometryType(g) t, ST_IsValid(g) valid FROM newgeom`);
    const bad = shapes.rows.filter((s) => s.t !== "ST_Polygon" || !s.valid);
    if (bad.length) throw new Error(`not single valid polygons: ${JSON.stringify(bad)}`);

    // 1. Changed existing regions: geometry, map ring, centre, radius, names.
    // 2. New regions: inserted with the same derived fields.
    let updated = 0, inserted = 0;
    for (const spec of SPLIT_SPECS) {
      const derived = `
        geom = n.g,
        polygon_coords = ${POLYGON_COORDS("n.g")},
        center_lat = round(ST_Y(ST_PointOnSurface(n.g))::numeric, 6),
        center_lng = round(ST_X(ST_PointOnSurface(n.g))::numeric, 6),
        radius_meters = round(sqrt(ST_Area(n.g::geography) / pi()) * 1.1)::int,
        zoom = CASE WHEN ST_Area(n.g::geography) < 2.5e9 THEN 11 WHEN ST_Area(n.g::geography) < 6e9 THEN 10 ELSE 9 END`;
      if (!spec.isNew) {
        const r = await c.query(`UPDATE regions SET ${derived}, name = $2, name_en = $3 FROM newgeom n WHERE n.slug = $1::text AND regions.slug = $1::text RETURNING regions.id`,
          [spec.slug, spec.name, spec.nameEn]);
        if (r.rowCount !== 1) throw new Error(`update of ${spec.slug} touched ${r.rowCount} rows`);
        updated++;
      } else {
        const exists = (await c.query(`SELECT 1 FROM regions WHERE slug = $1`, [spec.slug])).rowCount;
        if (exists) throw new Error(`region ${spec.slug} already exists`);
        const r = await c.query(`
          INSERT INTO regions (slug, name, name_en, color, geom, polygon_coords, center_lat, center_lng, radius_meters, zoom)
          SELECT $1::text, $2::text, $3::text, $4::text, n.g, ${POLYGON_COORDS("n.g")},
                 round(ST_Y(ST_PointOnSurface(n.g))::numeric, 6), round(ST_X(ST_PointOnSurface(n.g))::numeric, 6),
                 round(sqrt(ST_Area(n.g::geography) / pi()) * 1.1)::int,
                 CASE WHEN ST_Area(n.g::geography) < 2.5e9 THEN 11 WHEN ST_Area(n.g::geography) < 6e9 THEN 10 ELSE 9 END
          FROM newgeom n WHERE n.slug = $1::text RETURNING id`, [spec.slug, spec.name, spec.nameEn, spec.color ?? "#16a34a"]);
        if (r.rowCount !== 1) throw new Error(`insert of ${spec.slug} failed`);
        inserted++;
      }
    }
    const areaAfter = (await c.query(`SELECT sum(ST_Area(geom::geography))::float8 a FROM regions`)).rows[0].a;
    const drift = Math.abs(areaAfter - areaBefore) / areaBefore;
    if (drift > 0.005) throw new Error(`total area changed by ${(drift * 100).toFixed(2)}%`);
    console.log(`regions: ${updated} updated, ${inserted} inserted; total area change ${(drift * 100).toFixed(3)}%`);

    // 3. Every location (verified and unverified) → containing region, else nearest.
    const moves = await c.query(`
      WITH t AS (
        SELECT l.id, COALESCE(
          (SELECT r.id FROM regions r WHERE ST_Contains(r.geom, l.geom::geometry) ORDER BY r.id LIMIT 1),
          (SELECT r.id FROM regions r ORDER BY ST_Distance(r.geom::geography, l.geom) LIMIT 1)) AS rid
        FROM locations l)
      UPDATE locations l SET region_id = t.rid FROM t WHERE t.id = l.id AND l.region_id IS DISTINCT FROM t.rid
      RETURNING l.id, l.coords_verified`);
    const v = moves.rows.filter((r) => r.coords_verified).length;
    console.log(`locations re-assigned: ${moves.rowCount} (verified ${v}, unverified ${moves.rowCount! - v})`);

    const cp = await c.query(`
      UPDATE community_pois cp SET region_id = l.region_id FROM locations l
      WHERE l.source = 'community' AND l.source_id = cp.id::text AND cp.region_id IS DISTINCT FROM l.region_id RETURNING cp.id`);
    console.log(`community_pois synced: ${cp.rowCount}`);

    const summary = await c.query(`
      SELECT r.slug, r.name, count(l.id) FILTER (WHERE l.coords_verified)::int verified, count(l.id)::int total,
             jsonb_array_length(r.polygon_coords) ring_pts
      FROM regions r LEFT JOIN locations l ON l.region_id = r.id GROUP BY r.id ORDER BY r.id`);
    for (const s of summary.rows) console.log(`  ${s.slug.padEnd(16)} ${s.name.padEnd(16)} verified ${String(s.verified).padStart(4)}  total ${String(s.total).padStart(4)}  ring ${s.ring_pts}`);

    if (confirm) { await c.query("COMMIT"); console.log("committed"); }
    else { await c.query("ROLLBACK"); console.log("dry run: rolled back"); }
  } catch (err) {
    await c.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    await c.end();
  }
}

async function main() {
  if (process.argv.includes("--apply")) return apply();
  const out = arg("preview");
  if (!out) throw new Error("usage: --preview <out-dir> | --apply --backup-suffix YYYYMMDD [--confirm]");

  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    await c.query("BEGIN");
    const lost = await prepare(c);

    // Resulting regions: union of pieces per target (+ untouched regions as they are).
    const regions = await c.query(`
      WITH u AS (SELECT target AS slug, ST_UnionAgg(piece) AS g FROM (SELECT target, piece FROM pieces) x GROUP BY target)
      SELECT u.slug, round((ST_Area(u.g::geography)/1e6)::numeric)::int area, ST_NumGeometries(ST_Multi(u.g)) parts,
             round((100 * (SELECT max(ST_Area(d.geom)) FROM ST_Dump(u.g) d) / ST_Area(u.g))::numeric, 1)::float8 largest_pct,
             ST_AsGeoJSON(ST_SimplifyPreserveTopology(u.g, 0.0015), 4)::json gj, ST_Y(ST_PointOnSurface(u.g)) lat, ST_X(ST_PointOnSurface(u.g)) lng
      FROM u
      UNION ALL
      SELECT r.slug, round((ST_Area(r.geom::geography)/1e6)::numeric)::int, 1, 100,
             ST_AsGeoJSON(ST_SimplifyPreserveTopology(r.geom, 0.0015), 4)::json, ST_Y(ST_PointOnSurface(r.geom)), ST_X(ST_PointOnSurface(r.geom))
      FROM regions r WHERE r.slug NOT IN (SELECT DISTINCT parent FROM pieces)`.replace("ST_UnionAgg", "ST_Union"));

    // Proposed region for every location inside a split parent.
    const moves = await c.query(`
      SELECT l.id, l.name, l.category, round(l.latitude::numeric,5)::float8 lat, round(l.longitude::numeric,5)::float8 lng,
             l.coords_verified v, r.slug old_slug,
             COALESCE((SELECT p.target FROM pieces p WHERE p.parent = r.slug AND ST_Intersects(p.piece, l.geom::geometry) LIMIT 1),
                      (SELECT p.target FROM pieces p WHERE p.parent = r.slug ORDER BY ST_Distance(p.piece, l.geom::geometry) LIMIT 1),
                      r.slug) AS new_slug
      FROM locations l JOIN regions r ON r.id = l.region_id`);

    await c.query("ROLLBACK");

    const specBySlug = Object.fromEntries(SPLIT_SPECS.map((s) => [s.slug, s]));
    const current = await c.query(`SELECT slug, name, color FROM router.regions`);
    const meta = Object.fromEntries(current.rows.map((r) => [r.slug, r]));
    const regionsOut = regions.rows.map((r) => ({
      slug: r.slug,
      name: specBySlug[r.slug]?.name ?? meta[r.slug]?.name ?? r.slug,
      color: specBySlug[r.slug]?.color ?? meta[r.slug]?.color ?? "#16a34a",
      isNew: !!specBySlug[r.slug]?.isNew,
      area: r.area, parts: r.parts, largestPct: r.largest_pct,
      label: [r.lat, r.lng], geometry: r.gj,
    }));
    writeFileSync(join(out, "regions-split.json"), JSON.stringify(regionsOut));
    writeFileSync(join(out, "places-split.json"), "[\n" + moves.rows.map((m) => JSON.stringify([m.id, m.name, m.category, m.lat, m.lng, m.v ? 1 : 0, m.old_slug, m.new_slug])).join(",\n") + "\n]");

    const flows: Record<string, number> = {};
    for (const m of moves.rows) if (m.old_slug !== m.new_slug && m.v) flows[`${m.old_slug} → ${m.new_slug}`] = (flows[`${m.old_slug} → ${m.new_slug}`] ?? 0) + 1;
    const perRegion: Record<string, number> = {};
    for (const m of moves.rows) if (m.v) perRegion[m.new_slug] = (perRegion[m.new_slug] ?? 0) + 1;
    const report = { lostAnchors: lost.rows, regions: regionsOut.map(({ geometry, ...r }) => (void geometry, r)), flows, verifiedPerRegion: perRegion };
    writeFileSync(join(out, "split-report.json"), JSON.stringify(report, null, 1));

    console.log(`anchors outside their parents (ignored): ${lost.rowCount}`);
    for (const l of lost.rows) console.log(`  ${l.target}: ${l.name} lies in ${l.lies_in ?? "(no region)"}`);
    console.log("regions:");
    for (const r of regionsOut) console.log(`  ${r.isNew ? "+" : " "} ${r.slug.padEnd(16)} ${r.name.padEnd(16)} ${String(r.area).padStart(6)} km²  parts=${r.parts} largest=${r.largestPct}%  verified places=${perRegion[r.slug] ?? 0}`);
    console.log("verified places moving:");
    for (const [k, n] of Object.entries(flows).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(34)} ${n}`);
  } catch (err) {
    await c.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    await c.end();
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
