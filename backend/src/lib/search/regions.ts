// Detects Israeli region mentions in a free-text query (Hebrew or English) and maps them to
// router.regions.slug. Used as a ranking boost, not a hard filter: region borders in the data
// are coarse, and "near Jerusalem" should still surface places just outside the polygon.

/** slug → aliases. Longer aliases win over shorter overlapping ones (e.g. "גליל עליון" vs "גליל"). */
export const REGION_ALIASES: Record<string, string[]> = {
  golan_hermon: ["רמת הגולן", "גולן", "חרמון", "golan heights", "golan", "hermon"],
  galil_u: ["גליל עליון", "צפת", "upper galilee", "safed", "tzfat"],
  galil_t: ["גליל תחתון", "כנרת", "טבריה", "lower galilee", "sea of galilee", "kinneret", "tiberias"],
  carmel_emek: ["כרמל", "חיפה", "עמק יזרעאל", "גלבוע", "carmel", "haifa", "jezreel", "gilboa"],
  coast_sharon: ["השרון", "שרון", "תל אביב", "נתניה", "sharon", "tel aviv", "netanya"],
  yehuda: ["יהודה ושומרון", "שומרון", "samaria"],
  jerusalem_gates: ["הרי ירושלים", "ירושלים", "jerusalem hills", "jerusalem"],
  judean_desert: ["מדבר יהודה", "ים המלח", "עין גדי", "מצדה", "judean desert", "dead sea", "ein gedi", "masada"],
  negev: ["מצפה רמון", "מכתש רמון", "באר שבע", "נגב", "mitzpe ramon", "ramon crater", "beer sheva", "beersheba", "negev"],
  paran_eilat: ["אילת", "ערבה", "פארן", "eilat", "arava", "paran"],
};

/** Ambiguous umbrella terms that map to several regions. */
const MULTI_REGION_ALIASES: Record<string, string[]> = {
  "גליל": ["galil_u", "galil_t"],
  "galilee": ["galil_u", "galil_t"],
};

const HEBREW_PREFIXES = "[והבלמשכ]{0,3}"; // ו/ה/ב/ל/מ/ש/כ and combos: "ובגולן", "מהכנרת"
const HEBREW_RE = /[֐-׿]/;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface Matcher {
  alias: string;
  slugs: string[];
  re: RegExp;
}

function buildMatchers(): Matcher[] {
  const entries: { alias: string; slugs: string[] }[] = [];
  for (const [slug, aliases] of Object.entries(REGION_ALIASES)) {
    for (const alias of aliases) entries.push({ alias, slugs: [slug] });
  }
  for (const [alias, slugs] of Object.entries(MULTI_REGION_ALIASES)) entries.push({ alias, slugs });

  // Longest first so the more specific alias claims the text before its substring does.
  entries.sort((a, b) => b.alias.length - a.alias.length);

  return entries.map(({ alias, slugs }) => {
    const body = escapeRegex(alias).replace(/ /g, "\\s+");
    const prefix = HEBREW_RE.test(alias) ? HEBREW_PREFIXES : "";
    // Unicode-aware word boundaries (\b does not work for Hebrew).
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${prefix}${body}(?![\\p{L}\\p{N}])`, "iu");
    return { alias, slugs, re };
  });
}

const MATCHERS = buildMatchers();

export interface RegionDetection {
  slugs: string[];
  matched: string[];
}

export function detectRegions(query: string): RegionDetection {
  let remaining = query;
  const slugs = new Set<string>();
  const matched: string[] = [];

  for (const m of MATCHERS) {
    const hit = m.re.exec(remaining);
    if (!hit) continue;
    m.slugs.forEach((s) => slugs.add(s));
    matched.push(m.alias);
    // Blank out the match so "גליל" doesn't re-match inside an already-claimed "גליל עליון".
    remaining = remaining.slice(0, hit.index) + " ".repeat(hit[0].length) + remaining.slice(hit.index + hit[0].length);
  }

  return { slugs: [...slugs], matched };
}

export function containsHebrew(text: string): boolean {
  return HEBREW_RE.test(text);
}
