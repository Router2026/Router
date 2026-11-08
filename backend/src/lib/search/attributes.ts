// Detects structured-attribute intent in a query ("accessible", "shaded", "water", "challenging")
// and maps it to boolean columns. Embeddings capture topics well but not yes/no properties:
// before this, the eval scored 0.0 on accessible-reserve queries in Hebrew.
//
// "Easy" is deliberately absent: ~90% of locations are difficulty 'קל', so it doesn't discriminate.

export type AttributeKey = "accessible" | "shade" | "water" | "challenging";

/** Fixed SQL per attribute (over alias `l` = router.locations). Never built from user text. */
export const ATTRIBUTE_SQL: Record<AttributeKey, string> = {
  accessible: "l.accessible = TRUE",
  shade: "l.has_shade = TRUE",
  water: "l.has_water = TRUE",
  challenging: "l.difficulty = 'מאתגר'",
};

const TERMS: Record<AttributeKey, { he: string[]; en: string[] }> = {
  accessible: {
    he: ["נגיש", "נגישה", "נגישים", "נגישות", "כיסא גלגלים", "כסא גלגלים", "כיסאות גלגלים"],
    en: ["accessible", "accessibility", "wheelchair", "wheelchairs"],
  },
  shade: {
    he: ["מוצל", "מוצלת", "מוצלים", "מוצלות", "צל"],
    en: ["shade", "shaded", "shady"],
  },
  water: {
    he: ["מים", "רטוב", "רטובה", "רטובים", "רחצה", "לטבול", "טבילה"],
    en: ["water", "wet", "swim", "swimming", "dip"],
  },
  challenging: {
    he: ["מאתגר", "מאתגרת", "מאתגרים", "קשה", "קשים"],
    en: ["challenging", "difficult", "strenuous", "hard"],
  },
};

const HEBREW_PREFIXES = "[והבלמשכ]{0,3}";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const MATCHERS: { key: AttributeKey; re: RegExp }[] = (Object.keys(TERMS) as AttributeKey[]).map((key) => {
  const he = TERMS[key].he.map((t) => HEBREW_PREFIXES + escapeRegex(t).replace(/ /g, "\\s+"));
  const en = TERMS[key].en.map((t) => escapeRegex(t));
  // Unicode-aware boundaries: "water" must not match "waterfall", "צל" must not match "צלול".
  return { key, re: new RegExp(`(?<![\\p{L}\\p{N}])(?:${[...he, ...en].join("|")})(?![\\p{L}\\p{N}])`, "iu") };
});

/** Union of attributes found in any of the given texts (e.g. original query + its translation). */
export function detectAttributes(...texts: (string | null | undefined)[]): AttributeKey[] {
  const found = new Set<AttributeKey>();
  for (const text of texts) {
    if (!text) continue;
    for (const m of MATCHERS) if (m.re.test(text)) found.add(m.key);
  }
  return [...found].sort();
}
