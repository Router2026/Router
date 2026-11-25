// Second source for coordinate repair: Wikidata (Hebrew labels + P625 coordinates).
// READ-ONLY: reads the proposals from fix-coordinates.ts and writes a report.
//
//   npx tsx scripts/wikidata-coordinates.ts --proposals <coord-proposals.json> --skip <applied-batch.json> --out <dir>
//
// For rows OSM matched uncertainly (B): Wikidata agreeing with the OSM point corroborates it.
// For rows OSM didn't match (C): a unique, type-compatible Wikidata item is a new proposal.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeName } from "../src/lib/ai-route/text";

const ENDPOINT = "https://query.wikidata.org/sparql";
const CHUNK = 120;

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0 || !process.argv[i + 1]) throw new Error(`missing --${name}`);
  return process.argv[i + 1];
}

interface Proposal {
  id: number;
  name: string;
  category: string;
  old: { lat: number; lng: number };
  new: { lat: number; lng: number } | null;
  movedKm: number | null;
  confidence: string;
  osm: { ref: string; name: string; kind: string } | null;
}

interface WdHit { item: string; label: string; lat: number; lng: number; types: string[] }

const PREFIX = /^(שמורת טבע|שמורת|גן לאומי|פארק|יער|חוף) /;
function labelsFor(name: string): string[] {
  const n = name.trim();
  const out = new Set([n, n.replace(/׳/g, "'"), n.replace(/'/g, "׳")]);
  const stripped = n.replace(PREFIX, "");
  if (stripped !== n && stripped.length > 2) out.add(stripped);
  if (n.startsWith("שמורת ") && !n.startsWith("שמורת טבע ")) out.add(n.replace(/^שמורת /, "שמורת טבע "));
  return [...out];
}

const sparqlString = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"@he`;

async function query(labels: string[]): Promise<Map<string, WdHit[]>> {
  const q = `
SELECT ?item ?label ?coord (GROUP_CONCAT(DISTINCT ?typeLabel; separator="|") AS ?types) WHERE {
  VALUES ?label { ${labels.map(sparqlString).join(" ")} }
  ?item rdfs:label|skos:altLabel ?label ; wdt:P625 ?coord .
  OPTIONAL { ?item wdt:P31 ?type . ?type rdfs:label ?typeLabel FILTER(LANG(?typeLabel) = "en") }
} GROUP BY ?item ?label ?coord`;
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/sparql-results+json", "User-Agent": "router-coordinate-check/1.0 (data quality script)" },
    body: new URLSearchParams({ query: q }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { results: { bindings: Record<string, { value: string }>[] } };
  const map = new Map<string, WdHit[]>();
  for (const b of json.results.bindings) {
    const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(b.coord.value);
    if (!m) continue;
    const hit: WdHit = { item: b.item.value.replace("http://www.wikidata.org/entity/", ""), label: b.label.value, lng: +m[1], lat: +m[2], types: (b.types?.value ?? "").split("|").filter(Boolean) };
    if (hit.lat < 29.4 || hit.lat > 33.45 || hit.lng < 34.2 || hit.lng > 35.95) continue;
    const list = map.get(hit.label) ?? [];
    if (!list.some((h) => h.item === hit.item)) list.push(hit);
    map.set(hit.label, list);
  }
  return map;
}

const TYPE_HINTS: Record<string, RegExp> = {
  "שמורת טבע": /nature reserve|protected area|national park|park/i,
  "מעיין": /spring|water source|pool/i,
  "חוף": /beach/i,
  "יער": /forest|park|wood/i,
  "מצפה": /viewpoint|lookout|mountain|hill|summit|observation/i,
  "נוף": /viewpoint|lookout|mountain|hill/i,
  "נחל": /stream|river|wadi|waterfall|valley|canyon|nature reserve/i,
  "מסלול": /trail|path|stream|wadi|nature reserve|hiking/i,
  "מים": /spring|waterfall|pool|stream|lake/i,
  "גיאולוגיה": /mountain|hill|crater|makhtesh|canyon|cliff|cave|rock|valley|geolog|summit/i,
  "אתר היסטורי": /archaeolog|tell|ruin|castle|fortress|historic|synagogue|church|national park|site|village|monument/i,
  "היסטוריה": /archaeolog|historic|site|monument|wall/i,
  "טבע": /nature|park|reserve/i,
};

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}
const r1 = (n: number) => Math.round(n * 10) / 10;

async function main() {
  const proposals = JSON.parse(readFileSync(arg("proposals"), "utf8")) as Proposal[];
  const applied = new Set((JSON.parse(readFileSync(arg("skip"), "utf8")) as { id: number }[]).map((x) => x.id));
  const outDir = arg("out");
  const rows = proposals.filter((p) => !applied.has(p.id));

  const allLabels = [...new Set(rows.flatMap((p) => labelsFor(p.name)))];
  const hits = new Map<string, WdHit[]>();
  for (let i = 0; i < allLabels.length; i += CHUNK) {
    const part = await query(allLabels.slice(i, i + CHUNK));
    for (const [k, v] of part) hits.set(k, v);
    process.stdout.write(`.`);
    await new Promise((r) => setTimeout(r, 1000)); // be polite to the public endpoint
  }
  console.log(`\nlabels queried: ${allLabels.length}, labels with hits: ${hits.size}`);

  const report = rows.map((p) => {
    const exactLabels = new Set([p.name.trim(), p.name.replace(/׳/g, "'"), p.name.replace(/'/g, "׳"), p.name.replace(/^שמורת /, "שמורת טבע ")]);
    const cands = labelsFor(p.name).flatMap((l) => (hits.get(l) ?? []).map((h) => ({ ...h, exact: exactLabels.has(l) })));
    const uniq = [...new Map(cands.map((c) => [c.item, c])).values()];
    const hint = TYPE_HINTS[p.category];
    const scored = uniq
      .map((c) => ({ ...c, typeOk: hint ? hint.test(c.types.join(" ")) : false, dOld: km(p.old, c), dOsm: p.new ? km(p.new, c) : null }))
      .sort((a, b) => Number(b.exact) - Number(a.exact) || Number(b.typeOk) - Number(a.typeOk) || a.dOld - b.dOld);
    const best = scored[0] ?? null;
    const rivals = best ? scored.filter((c) => c.item !== best.item && c.exact === best.exact && c.typeOk === best.typeOk && km(c, best) > 5).length : 0;

    // Verdicts
    let verdict: string;
    if (!best) verdict = p.new ? "osm_only" : "not_found";
    else if (p.new && best.dOsm !== null && best.dOsm <= 3) verdict = "osm_confirmed"; // two sources agree
    else if (p.new && best.dOsm !== null && best.dOsm > 3) verdict = best.dOld <= 3 ? "wd_near_old" : "sources_disagree";
    else if (best.exact && best.typeOk && rivals === 0) verdict = "wd_proposal_high";
    else verdict = "wd_proposal_low";

    return {
      id: p.id, name: p.name, category: p.category, osmConfidence: p.confidence, old: p.old, osmNew: p.new, osmMovedKm: p.movedKm, osmName: p.osm?.name ?? null,
      verdict,
      wd: best ? { item: best.item, label: best.label, lat: best.lat, lng: best.lng, types: best.types.slice(0, 3), exact: best.exact, typeOk: best.typeOk, dOldKm: r1(best.dOld), dOsmKm: best.dOsm === null ? null : r1(best.dOsm), rivals } : null,
    };
  });

  writeFileSync(join(outDir, "wikidata-report.json"), JSON.stringify(report, null, 1));
  const count: Record<string, number> = {};
  for (const r of report) count[r.verdict] = (count[r.verdict] ?? 0) + 1;
  console.log("verdicts:", count);
}

main().catch((e) => { console.error(e); process.exit(1); });
