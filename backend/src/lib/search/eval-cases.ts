// Search evaluation set. Relevance is defined by SQL predicates over router.locations (l) and
// router.regions (r) rather than hand-picked ids, so judgments stay reproducible as data changes.
// Predicates are trusted constants used only by scripts/search-eval.ts — never user input.
//
//  kind "topic": many relevant places → precision@10 (normalized by min(10, #relevant))
//  kind "known": one specific place   → reciprocal rank of the first match within the top 10

export interface EvalCase {
  id: string;
  q: string;
  lang: "he" | "en";
  kind: "topic" | "known";
  relevant: string;
}

const JERUSALEM_25KM =
  "ST_DWithin(l.geom::geography, ST_SetSRID(ST_MakePoint(35.2137, 31.7683), 4326)::geography, 25000)";

const T = {
  golanWaterfalls: "(l.name ~ 'מפל' OR l.description ~ 'מפל') AND r.slug = 'golan_hermon'",
  jerusalemSprings: `(l.category = 'מעיין' OR l.name ~ '^עין ') AND ${JERUSALEM_25KM}`,
  negevViewpoints: "l.category = 'מצפה' AND r.slug = 'negev'",
  accessibleReserves: "l.accessible AND l.category = 'שמורת טבע'",
  challengingDesert: "l.difficulty = 'מאתגר' AND r.slug IN ('negev', 'judean_desert', 'paran_eilat')",
  craters: "(l.name ~ 'מכתש' OR l.description ~ 'מכתש')",
  galileeSprings: "l.category = 'מעיין' AND r.slug IN ('galil_u', 'galil_t')",
  shadedEasy: "l.has_shade AND l.difficulty LIKE 'קל%'",
  ruins: "(l.category = 'אתר היסטורי' OR l.description ~ 'עתיק')",
  deadSea: "(l.name ~ 'ים המלח' OR l.description ~ 'ים המלח')",
  beaches: "l.category = 'חוף'",
  forests: "l.category = 'יער'",
  swimSprings: "l.has_water AND l.category = 'מעיין'",
};

export const EVAL_CASES: EvalCase[] = [
  // ── topic, paired Hebrew / English ──
  { id: "golan-waterfalls-he", q: "מפלים בגולן", lang: "he", kind: "topic", relevant: T.golanWaterfalls },
  { id: "golan-waterfalls-en", q: "waterfall in the Golan", lang: "en", kind: "topic", relevant: T.golanWaterfalls },
  { id: "jlm-springs-he", q: "מעיינות ליד ירושלים", lang: "he", kind: "topic", relevant: T.jerusalemSprings },
  { id: "jlm-springs-en", q: "springs near Jerusalem", lang: "en", kind: "topic", relevant: T.jerusalemSprings },
  { id: "negev-views-he", q: "תצפית בנגב", lang: "he", kind: "topic", relevant: T.negevViewpoints },
  { id: "negev-views-en", q: "viewpoint in the Negev", lang: "en", kind: "topic", relevant: T.negevViewpoints },
  { id: "accessible-he", q: "שמורת טבע נגישה לכיסא גלגלים", lang: "he", kind: "topic", relevant: T.accessibleReserves },
  { id: "accessible-en", q: "wheelchair accessible nature reserve", lang: "en", kind: "topic", relevant: T.accessibleReserves },
  { id: "hard-desert-he", q: "מסלול מאתגר במדבר", lang: "he", kind: "topic", relevant: T.challengingDesert },
  { id: "hard-desert-en", q: "challenging desert hike", lang: "en", kind: "topic", relevant: T.challengingDesert },
  { id: "craters-he", q: "מכתשים", lang: "he", kind: "topic", relevant: T.craters },
  { id: "craters-en", q: "craters", lang: "en", kind: "topic", relevant: T.craters },
  { id: "galilee-springs-he", q: "מעיינות בגליל", lang: "he", kind: "topic", relevant: T.galileeSprings },
  { id: "galilee-springs-en", q: "springs in the Galilee", lang: "en", kind: "topic", relevant: T.galileeSprings },
  { id: "shaded-easy-he", q: "מסלול קל ומוצל למשפחות", lang: "he", kind: "topic", relevant: T.shadedEasy },
  { id: "shaded-easy-en", q: "easy shaded trail for families", lang: "en", kind: "topic", relevant: T.shadedEasy },
  { id: "ruins-he", q: "עתיקות", lang: "he", kind: "topic", relevant: T.ruins },
  { id: "ruins-en", q: "ancient ruins", lang: "en", kind: "topic", relevant: T.ruins },
  { id: "dead-sea-he", q: "ים המלח", lang: "he", kind: "topic", relevant: T.deadSea },
  { id: "dead-sea-en", q: "Dead Sea", lang: "en", kind: "topic", relevant: T.deadSea },
  { id: "beach-he", q: "חוף ים", lang: "he", kind: "topic", relevant: T.beaches },
  { id: "beach-en", q: "beach", lang: "en", kind: "topic", relevant: T.beaches },
  { id: "forest-he", q: "יער לפיקניק", lang: "he", kind: "topic", relevant: T.forests },
  { id: "forest-en", q: "forest for a picnic", lang: "en", kind: "topic", relevant: T.forests },
  { id: "swim-spring-he", q: "מעיין עם מים לרחצה", lang: "he", kind: "topic", relevant: T.swimSprings },
  { id: "swim-spring-en", q: "spring with water to swim in", lang: "en", kind: "topic", relevant: T.swimSprings },

  // ── known-item lookups ──
  { id: "ein-gedi-he", q: "עין גדי", lang: "he", kind: "known", relevant: "l.name = 'עין גדי'" },
  { id: "ein-gedi-en", q: "Ein Gedi", lang: "en", kind: "known", relevant: "l.name = 'עין גדי'" },
  { id: "banias-en", q: "Banias", lang: "en", kind: "known", relevant: "l.name ~ 'בניאס'" },
  { id: "gamla-he", q: "גמלא", lang: "he", kind: "known", relevant: "l.name ~ 'גמלא'" },
  { id: "gamla-en", q: "Gamla", lang: "en", kind: "known", relevant: "l.name ~ 'גמלא'" },
  { id: "masada-en", q: "Masada", lang: "en", kind: "known", relevant: "l.name = 'מצדה'" },
  { id: "amud-he", q: "נחל עמוד", lang: "he", kind: "known", relevant: "l.name = 'נחל עמוד'" },
  { id: "ramon-en", q: "Ramon Crater", lang: "en", kind: "known", relevant: "l.name ~ 'מכתש רמון'" },
  { id: "rosh-hanikra-en", q: "Rosh Hanikra", lang: "en", kind: "known", relevant: "l.name ~ 'ראש הנקרה'" },
  { id: "horshat-tal-he", q: "חורשת טל", lang: "he", kind: "known", relevant: "l.name = 'חורשת טל'" },
];
