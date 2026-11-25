// Coordinate repair for non-OSM locations (parks.org.il / amudanan / KKL / beaches seeds),
// whose coordinates are rounded to 2 decimals (~1 km) and sometimes simply wrong.
//
// Matches each row by name to OpenStreetMap features (an Overpass export) and proposes new
// coordinates with a confidence level. READ-ONLY: it writes a report, never the database.
// Applying approved changes is a separate, explicit step (see --apply in a later change).
//
// Usage:
//   npx tsx scripts/fix-coordinates.ts --overpass <overpass.json> --out <report-dir>
// Uses DATABASE_URL from .env.local (production Supabase).

import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { normalizeName } from "../src/lib/ai-route/text";

// ── Args ─────────────────────────────────────────────────────────────────────
function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0 || !process.argv[i + 1]) throw new Error(`missing --${name}`);
  return process.argv[i + 1];
}

// ── Types ────────────────────────────────────────────────────────────────────
interface OsmEl {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags: Record<string, string>;
}

interface DbRow {
  id: number;
  name: string;
  category: string;
  source: string;
  lat: number;
  lng: number;
  region: string | null;
}

export type Confidence = "high" | "medium" | "low" | "none";

interface Proposal {
  id: number;
  name: string;
  category: string;
  source: string;
  region: string | null;
  old: { lat: number; lng: number };
  new: { lat: number; lng: number } | null;
  movedKm: number | null;
  confidence: Confidence;
  osm: { ref: string; name: string; kind: string } | null;
  nameMatch: "exact" | "stripped" | null;
  candidates: number;
  /** An existing DB row already holds this exact OSM feature → likely duplicate. */
  duplicateOfDbId: number | null;
}

// ── Name variants ─────────────────────────────────────────────────────────────
const GENERIC_PREFIXES = ["שמורת טבע", "שמורת", "גן לאומי", "גן", "פארק", "יער", "חוף", "אתר", "מצפור", "תצפית"].map(normalizeName);

/** Spelling-level equivalences applied before exact matching. */
function canonical(name: string): string {
  return normalizeName(name)
    .replace(/^שמורת טבע /, "שמורת ")
    .replace(/^מצפור /, "מצפה ")
    .replace(/ח (?=\S)/g, "ח׳ ") // "ח' רבאיה" spelled with a plain apostrophe
    .replace(/-/g, " ");
}

export function variants(name: string): { exact: string; stripped: string[] } {
  const exact = canonical(name);
  const stripped = new Set<string>();
  for (const p of GENERIC_PREFIXES) {
    if (exact.startsWith(p + " ") && exact.length > p.length + 2) stripped.add(exact.slice(p.length + 1));
  }
  return { exact, stripped: [...stripped] };
}

function osmNames(t: Record<string, string>): string[] {
  return ["name", "name:he", "alt_name", "alt_name:he", "official_name", "old_name", "short_name"]
    .map((k) => t[k])
    .filter((v): v is string => !!v)
    .flatMap((v) => v.split(";"));
}

function kindOf(t: Record<string, string>): string {
  return t.leisure || t.boundary || t.natural || t.tourism || t.landuse || t.waterway || (t.historic ? "historic" : "") || t.highway || "other";
}

// ── Category ↔ OSM kind compatibility ─────────────────────────────────────────
const COMPAT: Record<string, { strong: string[]; weak: string[] }> = {
  "שמורת טבע": { strong: ["nature_reserve", "protected_area", "national_park"], weak: ["stream", "river", "park", "forest", "wood"] },
  "מעיין": { strong: ["spring", "hot_spring", "waterhole"], weak: ["water", "waterfall", "wild_swimming", "protected_area", "nature_reserve"] },
  "חוף": { strong: ["beach", "beach_resort", "bathing_place"], weak: ["protected_area", "nature_reserve", "park", "marina"] },
  "יער": { strong: ["forest", "wood", "park"], weak: ["protected_area", "nature_reserve", "picnic_site"] },
  "מצפה": { strong: ["viewpoint", "peak"], weak: ["attraction", "cliff", "ridge", "historic", "park"] },
  "נוף": { strong: ["viewpoint", "peak"], weak: ["attraction", "cliff", "ridge"] },
  "נחל": { strong: ["stream", "river", "waterfall", "nature_reserve", "protected_area"], weak: ["valley", "wadi", "spring", "gorge"] },
  "מסלול": { strong: ["path", "stream", "nature_reserve", "protected_area"], weak: ["river", "valley", "park", "forest"] },
  "מים": { strong: ["spring", "waterfall", "water", "wild_swimming"], weak: ["stream", "river", "nature_reserve", "protected_area"] },
  "גיאולוגיה": { strong: ["peak", "cliff", "cave_entrance", "crater", "rock", "arch", "valley", "ridge", "gorge"], weak: ["nature_reserve", "protected_area", "viewpoint", "attraction"] },
  "אתר היסטורי": { strong: ["historic", "national_park"], weak: ["attraction", "protected_area", "park", "museum"] },
  "היסטוריה": { strong: ["historic", "national_park"], weak: ["attraction", "protected_area", "park", "museum"] },
  "טבע": { strong: ["nature_reserve", "protected_area", "park", "forest"], weak: ["spring", "stream", "viewpoint"] },
};

function tagScore(category: string, kind: string): number {
  const c = COMPAT[category];
  if (!c) return 0;
  if (c.strong.includes(kind)) return 2;
  if (c.weak.includes(kind)) return 1;
  return 0;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const round = (n: number, d = 6) => Math.round(n * 10 ** d) / 10 ** d;

// ── Matching ──────────────────────────────────────────────────────────────────
interface IndexedEl { el: OsmEl; pt: { lat: number; lng: number }; kind: string; name: string }

function buildIndex(els: OsmEl[]) {
  const byExact = new Map<string, IndexedEl[]>();
  const byStripped = new Map<string, IndexedEl[]>();
  const push = (m: Map<string, IndexedEl[]>, k: string, v: IndexedEl) => { const a = m.get(k); if (a) { if (!a.includes(v)) a.push(v); } else m.set(k, [v]); };
  for (const el of els) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat === undefined || lng === undefined) continue;
    const names = osmNames(el.tags);
    const ix: IndexedEl = { el, pt: { lat, lng }, kind: kindOf(el.tags), name: el.tags["name:he"] || el.tags.name || names[0] };
    for (const n of names) {
      const v = variants(n);
      push(byExact, v.exact, ix);
      for (const s of v.stripped) push(byStripped, s, ix);
    }
  }
  return { byExact, byStripped };
}

export function propose(row: DbRow, index: ReturnType<typeof buildIndex>, osmRefToDbId: Map<string, number>): Proposal {
  const v = variants(row.name);
  type Cand = IndexedEl & { nameScore: number; tScore: number; d: number };
  const cands = new Map<IndexedEl, Cand>();
  const add = (list: IndexedEl[] | undefined, nameScore: number) => {
    for (const ix of list ?? []) {
      const prev = cands.get(ix);
      if (prev && prev.nameScore >= nameScore) continue;
      cands.set(ix, { ...ix, nameScore, tScore: tagScore(row.category, ix.kind), d: haversineKm(row, ix.pt) });
    }
  };
  add(index.byExact.get(v.exact), 3);
  add(index.byStripped.get(v.exact), 2); // DB "נחל שמיר" ↔ OSM "שמורת נחל שמיר"
  for (const s of v.stripped) { add(index.byExact.get(s), 2); add(index.byStripped.get(s), 2); }

  const base: Proposal = {
    id: row.id, name: row.name, category: row.category, source: row.source, region: row.region,
    old: { lat: row.lat, lng: row.lng }, new: null, movedKm: null, confidence: "none",
    osm: null, nameMatch: null, candidates: cands.size, duplicateOfDbId: null,
  };
  const list = [...cands.values()].filter((c) =>
    c.nameScore === 3 ? true : c.tScore > 0 && !(c.kind === "park" && row.category !== "יער"));
  if (!list.length) return base;

  list.sort((a, b) => b.nameScore + b.tScore - (a.nameScore + a.tScore) || a.d - b.d);
  const best = list[0];
  const topScore = best.nameScore + best.tScore;
  const rivals = list.filter((c) => c.nameScore + c.tScore === topScore && c.d - best.d > 5); // same score, clearly elsewhere

  // high   = same name (after canonicalisation), matching kind, no equally good rival elsewhere.
  // medium = good match but a rival exists, or name matched only after removing a generic prefix.
  // low    = weak (kind mismatch / far rivals) — review only, never auto-applied.
  let confidence: Confidence;
  if (best.nameScore === 3 && best.tScore === 2 && rivals.length === 0) confidence = "high";
  else if (topScore >= 4 && (rivals.length === 0 || best.d <= 10)) confidence = "medium";
  else confidence = "low";

  const ref = `${best.el.type}/${best.el.id}`;
  return {
    ...base,
    new: { lat: round(best.pt.lat), lng: round(best.pt.lng) },
    movedKm: Math.round(best.d * 10) / 10,
    confidence,
    osm: { ref, name: best.name, kind: best.kind },
    nameMatch: best.nameScore === 3 ? "exact" : "stripped",
    duplicateOfDbId: osmRefToDbId.get(ref) ?? null,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const overpass = JSON.parse(readFileSync(arg("overpass"), "utf8")) as { elements: OsmEl[] };
  const outDir = arg("out");
  mkdirSync(outDir, { recursive: true });
  const index = buildIndex(overpass.elements);

  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query("BEGIN TRANSACTION READ ONLY");
  await c.query("SET LOCAL search_path TO router, public");
  const { rows } = await c.query(`
    SELECT l.id, l.name, l.category, l.source, l.latitude::float8 lat, l.longitude::float8 lng, r.slug region
    FROM locations l LEFT JOIN regions r ON r.id = l.region_id
    WHERE l.source NOT LIKE '%openstreetmap.org%' ORDER BY l.id`);
  const osmRows = await c.query(`SELECT id, source FROM locations WHERE source LIKE '%openstreetmap.org/%'`);
  await c.query("ROLLBACK");
  await c.end();

  const osmRefToDbId = new Map<string, number>();
  for (const r of osmRows.rows) {
    const m = /openstreetmap\.org\/(node|way|relation)\/(\d+)/.exec(r.source);
    if (m) osmRefToDbId.set(`${m[1]}/${m[2]}`, r.id);
  }

  const proposals = (rows as DbRow[]).map((r) => propose(r, index, osmRefToDbId));
  writeFileSync(join(outDir, "coord-proposals.json"), JSON.stringify(proposals, null, 1));

  const csv = [
    "id,name,category,source,old_lat,old_lng,new_lat,new_lng,moved_km,confidence,name_match,osm_ref,osm_name,osm_kind,candidates,duplicate_of_db_id",
    ...proposals.map((p) => [
      p.id, `"${p.name.replace(/"/g, '""')}"`, p.category, p.source.replace(/^https?:\/\/(www\.)?/, ""),
      p.old.lat, p.old.lng, p.new?.lat ?? "", p.new?.lng ?? "", p.movedKm ?? "", p.confidence, p.nameMatch ?? "",
      p.osm?.ref ?? "", `"${(p.osm?.name ?? "").replace(/"/g, '""')}"`, p.osm?.kind ?? "", p.candidates, p.duplicateOfDbId ?? "",
    ].join(",")),
  ].join("\n");
  writeFileSync(join(outDir, "coord-proposals.csv"), "﻿" + csv); // BOM so Excel reads Hebrew

  const by = (k: Confidence) => proposals.filter((p) => p.confidence === k);
  const moved = (ps: Proposal[], min: number) => ps.filter((p) => (p.movedKm ?? 0) >= min).length;
  console.log(`rows: ${proposals.length}`);
  for (const k of ["high", "medium", "low", "none"] as Confidence[]) {
    const ps = by(k);
    console.log(`${k.padEnd(6)} ${String(ps.length).padStart(4)} | moved ≥1km: ${moved(ps, 1)} ≥5km: ${moved(ps, 5)} ≥20km: ${moved(ps, 20)} | already-in-DB OSM duplicate: ${ps.filter((p) => p.duplicateOfDbId).length}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
