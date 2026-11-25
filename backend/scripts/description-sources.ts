// Proposes replacement descriptions. READ-ONLY: writes a report, never the database.
//
//   npx tsx scripts/description-sources.ts --wikidata-report <wikidata-report.json> --out <dir>
//
// For every non-community location:
//   1. Hebrew Wikipedia: Wikidata id (OSM `wikidata` tag, or a confirmed name match from
//      wikidata-coordinates.ts) → he.wikipedia sitelink → intro extract (≤2 sentences).
//      Accepted only if the Wikidata item's coordinates are near the place (wrong-article guard).
//   2. Otherwise, if the current description is GENERATED (stale region names such as
//      "גליל תחתון וכרמל", doubled words, stock phrases), a facts-only text built from DB fields.
//   3. Otherwise the description is kept (real OSM/human text, or short but harmless).
// Wikipedia text is CC BY-SA 4.0: it must be shown with attribution (link to the article).

import { config } from "dotenv";
config({ path: ".env.local" });
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

const UA = "router-description-check/1.0 (data quality script)";
const WIKI_MAX_KM_POINT = 5;
const WIKI_MAX_KM_AREA = 15; // reserves / forests / streams are large

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0 || !process.argv[i + 1]) throw new Error(`missing --${name}`);
  return process.argv[i + 1];
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Generated-text detector ──────────────────────────────────────────────────
const STALE_REGIONS = ["גליל תחתון וכרמל", "גולן וחרמון", "עמקים ובקעת הירדן", "שפלה וגוש דן", "שרון וכרמל", "אילת וערבה", "ים המלח ויהודה"];
const STOCK = ["יעד מומלץ", "יעד פופולרי", "מאפשרים היכרות", "מהווה מקלט", "עשירה בצמחים ובעלי חיים", "מגוון עשיר של צמחייה",
  "נוף פנורמי מרהיב", "מקום מרגיע ומיוחד", "מתאים לטיולי יום", "נחשבת לאחת", "נחשב לאחד", "לאוהבי טבע",
  // Mined from repeated 3-grams across the remaining descriptions (each template appeared 24–36 times).
  "מצפה מומלץ", "חוויה ייחודית", "ממצאים ארכאולוגיים חשובים", "לאוכלוסייה עתיקה", "לחיים בארץ ישראל לדורותיהם",
  "נקודת תצפית מרהיבה", "מתקופות היסטוריות שונות", "הביקור מעניק"];

export function generatedReasons(name: string, d: string): string[] {
  const out: string[] = [];
  if (STALE_REGIONS.some((p) => d.includes(p))) out.push("stale_region");
  if (/(^|\s)([א-ת]{2,})\s\2(\s|$)/.test(d) || /^מ(מצפה|מצפור)\s/.test(d)) out.push("doubled_word");
  if (STOCK.some((p) => d.includes(p))) out.push("stock_phrase");
  // Seed one-liners ("שמורת טבע עם נחל X בגוש דן") — vague and often name the wrong area.
  if (/^שמורת טבע עם /.test(d)) out.push("seed_template");
  void name;
  return out;
}

/** Text with the place's own name and any region name blanked out — identical skeletons = one template. */
const REGION_WORDS = [...STALE_REGIONS, "גליל עליון", "גליל תחתון", "גליל מערבי", "רמת הגולן", "הגולן", "כרמל", "עמקים", "השרון", "שפלה",
  "שומרון", "יהודה", "ירושלים והסביבה", "ירושלים", "מדבר יהודה", "ים המלח", "הנגב", "נגב", "אילת והסביבה", "אילת", "ערבה", "הגליל", "גליל", "צפון", "דרום"]
  .sort((a, b) => b.length - a.length);
export function skeleton(name: string, d: string): string {
  let t = d.replace(/\s+/g, " ").trim();
  if (name) t = t.split(name).join("{N}");
  for (const w of REGION_WORDS) t = t.split(w).join("{R}");
  return t.replace(/[֑-ׇ]/g, "");
}
/** Skeletons shared by at least this many places are treated as generated templates. */
export const TEMPLATE_MIN_REPEATS = 3;

// ── Facts-only description ───────────────────────────────────────────────────
const CATEGORY_PHRASE: Record<string, string> = {
  "מעיין": "מעיין", "נחל": "נחל", "מצפה": "נקודת תצפית", "נוף": "נקודת נוף", "שמורת טבע": "שמורת טבע",
  "אתר היסטורי": "אתר היסטורי", "היסטוריה": "אתר היסטורי", "יער": "יער", "חוף": "חוף", "מסלול": "מסלול הליכה",
  "גיאולוגיה": "אתר גיאולוגי", "מים": "אתר מים", "טבע": "אתר טבע", "אוכל": "מקום אוכל",
};
const DIFFICULTY_PHRASE: Record<string, string> = { "קל": "קלה", "בינוני": "בינונית", "מאתגר": "מאתגרת" };

export function factsDescription(r: { category: string; region: string | null; difficulty: string | null; has_water: boolean; has_shade: boolean; accessible: boolean }): string {
  const parts: string[] = [];
  const what = CATEGORY_PHRASE[r.category] ?? "אתר";
  parts.push(r.region ? `${what} באזור ${r.region}.` : `${what}.`);
  // ~90% of rows carry the import default "קל"; only "מאתגר" was clearly set on purpose.
  if (r.difficulty === "מאתגר") parts.push(`רמת קושי ${DIFFICULTY_PHRASE[r.difficulty]}.`);
  const has = [r.has_water && "מים", r.has_shade && "צל"].filter(Boolean) as string[];
  if (has.length) parts.push(`יש במקום ${has.join(" ו")}.`);
  if (r.accessible) parts.push("נגיש.");
  return parts.join(" ");
}

// ── Wikipedia extract cleanup ────────────────────────────────────────────────
export function cleanExtract(text: string): string | null {
  let t = text.replace(/\s+/g, " ").trim();
  // Drop parentheticals with Latin/Arabic script or coordinates (pronunciations, transliterations).
  t = t.replace(/\s*\([^()]*[A-Za-z؀-ۿ°][^()]*\)/g, "").replace(/\s{2,}/g, " ").trim();
  const sentences = t.match(/[^.!?]+[.!?]+/g) ?? [t];
  let out = sentences.slice(0, 2).join(" ").trim();
  if (out.length > 420) out = (sentences[0] ?? out).trim();
  if (out.length > 420) out = out.slice(0, 417).trimEnd() + "…";
  return /[א-ת]/.test(out) && out.length >= 30 ? out : null;
}

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const AREA_CATEGORIES = new Set(["שמורת טבע", "יער", "נחל", "מסלול", "חוף"]);

/** Current OSM tags via the main API's multi-fetch (lighter than Overpass for a known id list). */
async function osmTags(refs: string[]): Promise<Map<string, Record<string, string>>> {
  const map = new Map<string, Record<string, string>>();
  const by: Record<string, string[]> = { node: [], way: [], relation: [] };
  for (const r of refs) { const [t, id] = r.split("/"); by[t]?.push(id); }
  for (const [type, ids] of Object.entries(by)) {
    for (let i = 0; i < ids.length; i += 200) {
      const part = ids.slice(i, i + 200);
      const url = `https://api.openstreetmap.org/api/0.6/${type}s.json?${type}s=${part.join(",")}`;
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(60_000) });
      // 404/410 = some element in the batch was deleted upstream; fall back to one-by-one for that batch.
      if (res.status === 404 || res.status === 410) {
        for (const id of part) {
          const one = await fetch(`https://api.openstreetmap.org/api/0.6/${type}/${id}.json`, { headers: { "User-Agent": UA } });
          if (one.ok) { const j = (await one.json()) as { elements: { id: number; tags?: Record<string, string> }[] }; map.set(`${type}/${id}`, j.elements[0]?.tags ?? {}); }
          await sleep(200);
        }
        continue;
      }
      if (!res.ok) throw new Error(`OSM API HTTP ${res.status}`);
      const j = (await res.json()) as { elements: { type: string; id: number; tags?: Record<string, string> }[] };
      for (const e of j.elements) map.set(`${e.type}/${e.id}`, e.tags ?? {});
      await sleep(1000);
    }
  }
  return map;
}

async function sitelinks(qids: string[]): Promise<Map<string, { title: string; lat: number | null; lng: number | null }>> {
  const map = new Map<string, { title: string; lat: number | null; lng: number | null }>();
  for (let i = 0; i < qids.length; i += 200) {
    const part = qids.slice(i, i + 200);
    const q = `SELECT ?item ?title ?coord WHERE { VALUES ?item { ${part.map((x) => `wd:${x}`).join(" ")} }
      ?article schema:about ?item ; schema:isPartOf <https://he.wikipedia.org/> ; schema:name ?title .
      OPTIONAL { ?item wdt:P625 ?coord } }`;
    const res = await fetch("https://query.wikidata.org/sparql", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/sparql-results+json", "User-Agent": UA },
      body: new URLSearchParams({ query: q }), signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`);
    const j = (await res.json()) as { results: { bindings: Record<string, { value: string }>[] } };
    for (const b of j.results.bindings) {
      const qid = b.item.value.replace("http://www.wikidata.org/entity/", "");
      const m = b.coord ? /Point\(([-\d.]+) ([-\d.]+)\)/.exec(b.coord.value) : null;
      if (!map.has(qid)) map.set(qid, { title: b.title.value, lng: m ? +m[1] : null, lat: m ? +m[2] : null });
    }
    await sleep(1000);
  }
  return map;
}

async function extracts(titles: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let i = 0; i < titles.length; i += 20) {
    const part = titles.slice(i, i + 20);
    const params = new URLSearchParams({ action: "query", prop: "extracts", exintro: "1", explaintext: "1", exsentences: "3", exlimit: "20", redirects: "1", format: "json", titles: part.join("|") });
    let res: Response;
    for (let attempt = 1; ; attempt++) {
      res = await fetch(`https://he.wikipedia.org/w/api.php?${params}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(60_000) });
      if (res.ok) break;
      if (res.status !== 429 && res.status < 500) throw new Error(`Wikipedia HTTP ${res.status}`);
      if (attempt >= 5) throw new Error(`Wikipedia HTTP ${res.status} after ${attempt} attempts`);
      const wait = Number(res.headers.get("retry-after")) || 15 * attempt;
      console.log(`  wikipedia ${res.status}, waiting ${wait}s`);
      await sleep(wait * 1000);
    }
    const j = (await res.json()) as { query?: { pages?: Record<string, { title: string; extract?: string }>; redirects?: { from: string; to: string }[]; normalized?: { from: string; to: string }[] } };
    const back = new Map<string, string>();
    for (const n of j.query?.normalized ?? []) back.set(n.to, n.from);
    for (const r of j.query?.redirects ?? []) back.set(r.to, back.get(r.from) ?? r.from);
    for (const p of Object.values(j.query?.pages ?? {})) if (p.extract) map.set(back.get(p.title) ?? p.title, p.extract);
    await sleep(3000); // anonymous clients are rate-limited; stay well under it
  }
  return map;
}

async function main() {
  const out = arg("out");
  mkdirSync(out, { recursive: true });
  const wdReport = JSON.parse(readFileSync(arg("wikidata-report"), "utf8")) as { id: number; verdict: string; wd: { item: string; typeOk: boolean; exact: boolean; types: string[] } | null }[];

  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query("BEGIN TRANSACTION READ ONLY");
  const { rows } = await c.query(`
    SELECT l.id, l.name, l.category, l.source, l.latitude::float8 lat, l.longitude::float8 lng, coalesce(l.description, '') description,
           l.difficulty, coalesce(l.has_water, false) has_water, coalesce(l.has_shade, false) has_shade, coalesce(l.accessible, false) accessible,
           l.coords_verified, r.name region
    FROM router.locations l LEFT JOIN router.regions r ON r.id = l.region_id
    WHERE l.source <> 'community' ORDER BY l.id`);
  await c.query("ROLLBACK");
  await c.end();

  // 1. Wikidata ids.
  const osmRef = (s: string) => /openstreetmap\.org\/(node|way|relation)\/(\d+)/.exec(s);
  const refs = rows.map((r) => osmRef(r.source)).filter(Boolean).map((m) => `${m![1]}/${m![2]}`);
  const cacheFile = join(out, "osm-tags.json");
  let tags: Map<string, Record<string, string>>;
  try { tags = new Map(Object.entries(JSON.parse(readFileSync(cacheFile, "utf8")))); console.log(`osm tags from cache: ${tags.size}`); }
  catch { tags = await osmTags(refs); writeFileSync(cacheFile, JSON.stringify(Object.fromEntries(tags))); }
  const SETTLEMENT = /settlement|kibbutz|moshav|city|town|village|neighborhood|council/i;
  const wdById = new Map(wdReport
    .filter((w) => w.wd && ["osm_confirmed", "wd_proposal_high", "wd_near_old"].includes(w.verdict) && (w.wd.typeOk || w.wd.exact) && !SETTLEMENT.test(w.wd.types.join(" ")))
    .map((w) => [w.id, w.wd!.item]));
  const qidOf = new Map<number, { qid: string; via: string }>();
  for (const r of rows) {
    const m = osmRef(r.source);
    const t = m ? tags.get(`${m[1]}/${m[2]}`) : undefined;
    if (t?.wikidata && /^Q\d+$/.test(t.wikidata)) qidOf.set(r.id, { qid: t.wikidata, via: "osm_tag" });
    else if (wdById.has(r.id)) qidOf.set(r.id, { qid: wdById.get(r.id)!, via: "name_match" });
  }
  console.log(`wikidata ids: ${qidOf.size} (osm tag ${[...qidOf.values()].filter((v) => v.via === "osm_tag").length}, name match ${[...qidOf.values()].filter((v) => v.via === "name_match").length})`);

  // 2. he.wikipedia titles + extracts.
  const links = await sitelinks([...new Set([...qidOf.values()].map((v) => v.qid))]);
  const titles = [...new Set([...links.values()].map((l) => l.title))];
  const ex = await extracts(titles);
  console.log(`hewiki articles: ${links.size}, extracts: ${ex.size}`);

  // 3. Decide per row.
  type Out = { id: number; name: string; category: string; region: string | null; action: "wikipedia" | "facts" | "keep"; reasons: string[]; old: string; new: string | null; url: string | null; note?: string };
  const result: Out[] = [];
  const norm = (x: string) => x.replace(/\s+/g, " ").trim();
  const skeletonCount = new Map<string, number>();
  for (const r of rows) if (r.description.trim()) { const k = skeleton(r.name, r.description); skeletonCount.set(k, (skeletonCount.get(k) ?? 0) + 1); }
  for (const r of rows) {
    // A description that is the place's own OSM description tag was written by a person: never replace it.
    const m = osmRef(r.source);
    const t = m ? tags.get(`${m[1]}/${m[2]}`) : undefined;
    const osmDesc = t?.["description:he"] ?? t?.description;
    if (osmDesc && norm(osmDesc) === norm(r.description)) {
      result.push({ id: r.id, name: r.name, category: r.category, region: r.region, action: "keep", reasons: [], old: r.description, new: null, url: null, note: "human-written OSM description" });
      continue;
    }
    const gen = generatedReasons(r.name, r.description);
    if (r.description.trim() && (skeletonCount.get(skeleton(r.name, r.description)) ?? 0) >= TEMPLATE_MIN_REPEATS && !gen.length) gen.push("repeated_template");
    const q = qidOf.get(r.id);
    const link = q ? links.get(q.qid) : undefined;
    let wiki: { text: string; url: string } | null = null;
    let note: string | undefined;
    if (link) {
      const text = ex.get(link.title);
      const cleaned = text ? cleanExtract(text) : null;
      const limit = AREA_CATEGORIES.has(r.category) ? WIKI_MAX_KM_AREA : WIKI_MAX_KM_POINT;
      const dist = link.lat !== null && link.lng !== null ? km(r, { lat: link.lat, lng: link.lng }) : null;
      if (!cleaned) note = "article has no usable intro";
      else if (dist !== null && dist > limit) note = `article item is ${dist.toFixed(1)} km away`;
      else wiki = { text: cleaned, url: `https://he.wikipedia.org/wiki/${encodeURIComponent(link.title.replace(/ /g, "_"))}` };
    }
    if (wiki) result.push({ id: r.id, name: r.name, category: r.category, region: r.region, action: "wikipedia", reasons: gen, old: r.description, new: wiki.text, url: wiki.url });
    else if (gen.length || !r.description.trim()) result.push({ id: r.id, name: r.name, category: r.category, region: r.region, action: "facts", reasons: gen.length ? gen : ["empty"], old: r.description, new: factsDescription(r), url: null, note });
    else result.push({ id: r.id, name: r.name, category: r.category, region: r.region, action: "keep", reasons: [], old: r.description, new: null, url: null, note });
  }

  writeFileSync(join(out, "description-proposals.json"), JSON.stringify(result, null, 1));
  const csv = ["id,name,category,region,action,reasons,old,new,url",
    ...result.map((x) => [x.id, JSON.stringify(x.name), x.category, JSON.stringify(x.region ?? ""), x.action, x.reasons.join("+"), JSON.stringify(x.old), JSON.stringify(x.new ?? ""), x.url ?? ""].join(","))].join("\n");
  writeFileSync(join(out, "description-proposals.csv"), "﻿" + csv);
  const count = (a: string) => result.filter((x) => x.action === a).length;
  console.log(`rows ${result.length}: wikipedia ${count("wikipedia")}, facts ${count("facts")}, keep ${count("keep")}`);
  console.log(`generated descriptions found: ${result.filter((x) => x.reasons.some((r) => r !== "empty")).length}`);
  console.log(`kept as human-written OSM descriptions: ${result.filter((x) => x.note === "human-written OSM description").length}`);
  const rejected = result.filter((x) => x.note && x.note !== "human-written OSM description").map((x) => `${x.name}: ${x.note}`);
  console.log(`wiki candidates rejected by guards: ${rejected.length}`, rejected.slice(0, 8).join(" | "));
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
