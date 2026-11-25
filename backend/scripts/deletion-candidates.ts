// Lists locations that are candidates for deletion or merging. READ-ONLY: writes a report.
//
//   npx tsx scripts/deletion-candidates.ts --out <dir>
//
// Groups:
//   outside_israel   point outside Israel (incl. Golan) bounding box
//   food             category "אוכל" (Router is nature-focused; already excluded from planning)
//   generic_name     names that say nothing on their own ("גת" = an ancient winepress)
//   cave_exit        "יציאה מערה N" — an exit of a cave that has its own row
//   duplicate        same place twice (same canonical name within 1 km); one row is kept and
//                    the other merged into it (user references move to the kept row)
//   truncated_name   cut-off names ("שמורת נחל ע") — rename, not delete
// Every row lists how much user data references it, because deleting cascades to favorites,
// trip_locations, ratings, media and images, and nulls reviews / route_stops / reports.

import { config } from "dotenv";
config({ path: ".env.local" });
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { normalizeName } from "../src/lib/ai-route/text";

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0 || !process.argv[i + 1]) throw new Error(`missing --${name}`);
  return process.argv[i + 1];
}

const GENERIC_NAMES = new Set(["גת", "מצד", "באר", "בור", "מערה", "חורבה", "תל", "מעיין", "תצפית", "נקודה"]);

/** Canonical name for duplicate detection: "שמורת טבע X" = "שמורת X" = "X" for reserves. */
function canonical(name: string): string {
  return normalizeName(name).replace(/^(שמורת טבע|שמורת|גן לאומי) /, "").replace(/-/g, " ").trim();
}

interface Row {
  id: number; name: string; category: string; source: string; lat: number; lng: number;
  verified: boolean; desc_len: number; has_image: boolean; region: string | null;
  refs: Record<string, number>; ref_total: number;
}

async function main() {
  const out = arg("out");
  mkdirSync(out, { recursive: true });
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query("BEGIN TRANSACTION READ ONLY");
  await c.query("SET LOCAL search_path TO router, public");
  const refTables = ["favorites", "trip_locations", "location_ratings", "reviews", "route_stops", "community_reports", "location_media", "location_images"];
  const refCounts = refTables.map((t) => `(SELECT count(*) FROM ${t} x WHERE x.location_id = l.id)::int AS "${t}"`).join(", ");
  const { rows } = await c.query(`
    SELECT l.id, l.name, l.category, l.source, l.latitude::float8 lat, l.longitude::float8 lng, l.coords_verified verified,
           coalesce(length(trim(l.description)), 0) desc_len, (coalesce(l.main_image, '') <> '') has_image, r.slug region,
           ${refCounts}
    FROM locations l LEFT JOIN regions r ON r.id = l.region_id ORDER BY l.id`);
  // Same-point pairs with different names (cave exits, sub-features).
  const pairs = await c.query(`
    SELECT a.id a, b.id b, round(ST_Distance(a.geom, b.geom))::int m
    FROM locations a JOIN locations b ON a.id < b.id AND ST_DWithin(a.geom, b.geom, 1000)`);
  await c.query("ROLLBACK");
  await c.end();

  const data: Row[] = rows.map((r) => {
    const refs = Object.fromEntries(refTables.map((t) => [t, r[t] as number]));
    return { ...r, refs, ref_total: Object.values(refs).reduce((s, n) => s + n, 0) };
  });
  const byId = new Map(data.map((r) => [r.id, r]));
  const out_: { group: string; action: "delete" | "merge" | "rename"; id: number; keepId?: number; reason: string }[] = [];
  const add = (group: string, action: "delete" | "merge" | "rename", id: number, reason: string, keepId?: number) =>
    out_.push({ group, action, id, reason, ...(keepId ? { keepId } : {}) });

  for (const r of data) {
    // Community rows mirror a user's community_pois entry; they are never deletion candidates.
    if (r.source === "community") continue;
    if (r.lat < 29.4 || r.lat > 33.45 || r.lng < 34.2 || r.lng > 35.95) add("outside_israel", "delete", r.id, `${r.lat.toFixed(3)}, ${r.lng.toFixed(3)}`);
    if (r.category === "אוכל") add("food", "delete", r.id, "category אוכל");
    if (GENERIC_NAMES.has(normalizeName(r.name))) add("generic_name", "delete", r.id, `name is only "${r.name}"`);
    if (/^יציאה\s/.test(r.name)) add("cave_exit", "delete", r.id, "exit of a cave that has its own row");
    if (/\s\S$/.test(r.name.trim()) || /\s[א-ת]{1,2}$/.test(r.name.trim()) && r.name.trim().split(/\s+/).at(-1)!.length === 1) {
      add("truncated_name", "rename", r.id, "name looks cut off");
    }
  }

  // Duplicates: same canonical name within 1 km. Keep the better row; merge the other into it.
  const score = (r: Row) => (r.verified ? 8 : 0) + (r.ref_total > 0 ? 4 : 0) + (r.desc_len >= 40 ? 2 : 0) + (r.has_image ? 2 : 0) + (r.source === "community" ? 1 : 0);
  const seen = new Set<number>();
  for (const p of pairs.rows) {
    const a = byId.get(p.a)!, b = byId.get(p.b)!;
    if (canonical(a.name) !== canonical(b.name) || canonical(a.name).length < 3) continue;
    const [keep, drop] = score(a) >= score(b) ? [a, b] : [b, a];
    if (drop.source === "community") continue;
    if (seen.has(drop.id)) continue;
    seen.add(drop.id);
    add("duplicate", "merge", drop.id, `same as #${keep.id} "${keep.name}" (${p.m} m apart)`, keep.id);
  }

  // One action per row: delete/merge beats rename.
  const final = new Map<number, (typeof out_)[number]>();
  for (const o of out_) { const prev = final.get(o.id); if (!prev || (prev.action === "rename" && o.action !== "rename")) final.set(o.id, o); }
  const list = [...final.values()].map((o) => ({ ...o, row: byId.get(o.id)!, keep: o.keepId ? byId.get(o.keepId) : undefined }));

  writeFileSync(join(out, "deletion-candidates.json"), JSON.stringify(list.map((x) => ({
    group: x.group, action: x.action, id: x.id, name: x.row.name, category: x.row.category, region: x.row.region,
    source: x.row.source, verified: x.row.verified, refs: x.row.ref_total, refDetail: x.row.refs, reason: x.reason,
    keepId: x.keepId ?? null, keepName: x.keep?.name ?? null,
  })), null, 1));
  const csv = ["group,action,id,name,category,region,verified,user_refs,reason,keep_id,keep_name",
    ...list.map((x) => [x.group, x.action, x.id, JSON.stringify(x.row.name), x.row.category, x.row.region ?? "", x.row.verified, x.row.ref_total, JSON.stringify(x.reason), x.keepId ?? "", JSON.stringify(x.keep?.name ?? "")].join(","))].join("\n");
  writeFileSync(join(out, "deletion-candidates.csv"), "﻿" + csv);

  const groups: Record<string, { n: number; withRefs: number }> = {};
  for (const x of list) { const g = (groups[x.group] ??= { n: 0, withRefs: 0 }); g.n++; if (x.row.ref_total) g.withRefs++; }
  console.log("groups:", JSON.stringify(groups));
  for (const x of list) console.log(`  ${x.group.padEnd(15)} ${x.action.padEnd(6)} #${x.id} ${x.row.name} [${x.row.category}]${x.row.ref_total ? ` refs=${JSON.stringify(Object.fromEntries(Object.entries(x.row.refs).filter(([, n]) => n)))}` : ""} — ${x.reason}`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
