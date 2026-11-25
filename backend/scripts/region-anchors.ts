// Anchor points for splitting overloaded regions (step 2 of the region repair).
// A split region's boundary is kept; inside it, every point goes to the region of its nearest
// anchor (Voronoi in EPSG:2039). Move or add anchors here to reshape a border, then re-run.
// Coordinates are approximate town / site locations — a few hundred metres off is fine.

export interface Anchor { name: string; lat: number; lng: number }

export interface RegionSpec {
  slug: string;
  name: string;
  nameEn: string;
  /** Existing slugs whose area this region is carved from (or keeps, for an existing region). */
  parents: string[];
  color?: string;
  isNew: boolean;
  anchors: Anchor[];
}

export const SPLIT_SPECS: RegionSpec[] = [
  // ── Galilee ───────────────────────────────────────────────────────────────
  { slug: "galil_u", name: "גליל עליון", nameEn: "Upper Galilee", parents: ["galil_u"], isNew: false, anchors: [
    { name: "צפת", lat: 32.965, lng: 35.496 }, { name: "ראש פינה", lat: 32.969, lng: 35.543 },
    { name: "קריית שמונה", lat: 33.207, lng: 35.570 }, { name: "מטולה", lat: 33.278, lng: 35.578 },
    { name: "עמק החולה", lat: 33.060, lng: 35.610 }, { name: "הר מירון", lat: 32.997, lng: 35.410 },
    { name: "תל דן", lat: 33.248, lng: 35.652 }, { name: "פקיעין", lat: 32.976, lng: 35.330 },
  ] },
  { slug: "galil_w", name: "גליל מערבי", nameEn: "Western Galilee", parents: ["galil_u"], isNew: true, color: "#0ea5a4", anchors: [
    { name: "נהריה", lat: 33.006, lng: 35.095 }, { name: "ראש הנקרה", lat: 33.093, lng: 35.105 },
    { name: "עכו", lat: 32.927, lng: 35.082 }, { name: "מבצר מונפור", lat: 33.044, lng: 35.226 },
    { name: "אכזיב", lat: 33.048, lng: 35.102 }, { name: "שלומי", lat: 33.078, lng: 35.145 },
    { name: "מעלות", lat: 33.016, lng: 35.272 },
  ] },
  // ── Carmel / valleys ──────────────────────────────────────────────────────
  { slug: "carmel_emek", name: "כרמל", nameEn: "Carmel", parents: ["carmel_emek"], isNew: false, anchors: [
    { name: "חיפה", lat: 32.794, lng: 34.989 }, { name: "דלית אל-כרמל", lat: 32.693, lng: 35.050 },
    { name: "עין הוד", lat: 32.700, lng: 34.982 }, { name: "זכרון יעקב", lat: 32.571, lng: 34.953 },
    { name: "עתלית", lat: 32.688, lng: 34.940 }, { name: "רמת הנדיב", lat: 32.555, lng: 34.945 },
  ] },
  { slug: "emek", name: "עמקים והגלבוע", nameEn: "Valleys and Gilboa", parents: ["carmel_emek"], isNew: true, color: "#a855f7", anchors: [
    { name: "עפולה", lat: 32.607, lng: 35.289 }, { name: "הר הגלבוע", lat: 32.470, lng: 35.430 },
    { name: "בית שאן", lat: 32.497, lng: 35.497 }, { name: "גן השלושה", lat: 32.503, lng: 35.447 },
    { name: "מגידו", lat: 32.585, lng: 35.184 }, { name: "רמת דוד", lat: 32.670, lng: 35.200 },
    { name: "עין חרוד", lat: 32.555, lng: 35.390 },
  ] },
  // ── Judea / Samaria / Jerusalem / Shephelah ──────────────────────────────
  { slug: "yehuda", name: "יהודה", nameEn: "Judea", parents: ["yehuda"], isNew: false, anchors: [
    { name: "גוש עציון", lat: 31.655, lng: 35.118 }, { name: "חברון", lat: 31.532, lng: 35.095 },
    { name: "הרודיון", lat: 31.666, lng: 35.241 }, { name: "קריית ארבע", lat: 31.534, lng: 35.122 },
    { name: "סוסיא", lat: 31.393, lng: 35.112 }, { name: "אפרת", lat: 31.653, lng: 35.152 },
  ] },
  { slug: "shomron", name: "שומרון", nameEn: "Samaria", parents: ["yehuda"], isNew: true, color: "#b45309", anchors: [
    { name: "אריאל", lat: 32.105, lng: 35.170 }, { name: "סבסטיה", lat: 32.276, lng: 35.193 },
    { name: "שילה", lat: 32.054, lng: 35.290 }, { name: "קדומים", lat: 32.210, lng: 35.160 },
    { name: "איתמר", lat: 32.170, lng: 35.310 }, { name: "מעלה אפרים", lat: 32.070, lng: 35.400 },
    { name: "מחולה", lat: 32.357, lng: 35.505 }, { name: "עפרה", lat: 31.960, lng: 35.260 },
    { name: "בית אל", lat: 31.940, lng: 35.220 },
  ] },
  // Jerusalem city lies inside the old "yehuda" boundary, so its anchors also compete there.
  { slug: "jerusalem_gates", name: "ירושלים והסביבה", nameEn: "Jerusalem and Surroundings", parents: ["jerusalem_gates", "yehuda"], isNew: false, anchors: [
    { name: "ירושלים", lat: 31.778, lng: 35.229 }, { name: "העיר העתיקה", lat: 31.776, lng: 35.234 },
    { name: "הר הצופים", lat: 31.792, lng: 35.244 }, { name: "מעלה אדומים", lat: 31.774, lng: 35.300 }, { name: "עין כרם", lat: 31.768, lng: 35.160 },
    { name: "אבו גוש", lat: 31.806, lng: 35.106 }, { name: "סטף", lat: 31.770, lng: 35.130 },
    { name: "מבשרת ציון", lat: 31.800, lng: 35.150 }, { name: "צובה", lat: 31.790, lng: 35.120 },
    { name: "נבי סמואל", lat: 31.833, lng: 35.183 },
  ] },
  { slug: "shfela", name: "שפלה", nameEn: "Shephelah", parents: ["jerusalem_gates", "yehuda", "coast_sharon", "negev"], isNew: true, color: "#84cc16", anchors: [
    { name: "בית שמש", lat: 31.747, lng: 34.988 }, { name: "בית גוברין", lat: 31.610, lng: 34.896 },
    { name: "לכיש", lat: 31.565, lng: 34.849 }, { name: "לטרון", lat: 31.838, lng: 34.979 },
    { name: "מודיעין", lat: 31.899, lng: 35.010 }, { name: "קריית גת", lat: 31.610, lng: 34.770 },
    { name: "תל עזקה", lat: 31.700, lng: 34.935 }, { name: "תל גזר", lat: 31.859, lng: 34.919 },
    { name: "עדולם", lat: 31.680, lng: 34.980 },
  ] },
  { slug: "coast_sharon", name: "חוף והשרון", nameEn: "Coast and Sharon", parents: ["coast_sharon"], isNew: false, anchors: [
    { name: "תל אביב", lat: 32.080, lng: 34.780 }, { name: "נתניה", lat: 32.330, lng: 34.860 },
    { name: "חדרה", lat: 32.440, lng: 34.920 }, { name: "קיסריה", lat: 32.500, lng: 34.890 },
    { name: "הרצליה", lat: 32.165, lng: 34.844 }, { name: "כפר סבא", lat: 32.175, lng: 34.907 },
    { name: "ראשון לציון", lat: 31.964, lng: 34.804 }, { name: "אשדוד", lat: 31.800, lng: 34.650 },
    { name: "פלמחים", lat: 31.930, lng: 34.700 }, { name: "אשקלון", lat: 31.669, lng: 34.571 },
    { name: "ניצנים", lat: 31.730, lng: 34.620 }, { name: "מקורות הירקון", lat: 32.105, lng: 34.930 },
  ] },
  // ── Negev ────────────────────────────────────────────────────────────────
  { slug: "negev", name: "נגב", nameEn: "Negev", parents: ["negev"], isNew: false, anchors: [
    { name: "באר שבע", lat: 31.252, lng: 34.791 }, { name: "דימונה", lat: 31.069, lng: 35.033 },
    { name: "ירוחם", lat: 30.988, lng: 34.929 }, { name: "שדה בוקר", lat: 30.874, lng: 34.787 },
    { name: "מצפה רמון", lat: 30.610, lng: 34.800 }, { name: "ניצנה", lat: 30.880, lng: 34.430 },
    { name: "עבדת", lat: 30.794, lng: 34.773 }, { name: "ממשית", lat: 31.025, lng: 35.064 },
    { name: "ערד", lat: 31.260, lng: 35.210 },
  ] },
  { slug: "negev_w", name: "נגב מערבי", nameEn: "Western Negev", parents: ["negev"], isNew: true, color: "#e11d48", anchors: [
    { name: "אופקים", lat: 31.313, lng: 34.620 }, { name: "בארי", lat: 31.425, lng: 34.493 },
    { name: "שדרות", lat: 31.525, lng: 34.596 }, { name: "נתיבות", lat: 31.421, lng: 34.588 },
    { name: "גן לאומי אשכול", lat: 31.300, lng: 34.440 }, { name: "כיסופים", lat: 31.370, lng: 34.400 },
    { name: "אורים", lat: 31.300, lng: 34.520 }, { name: "רעים", lat: 31.390, lng: 34.460 },
  ] },
];
