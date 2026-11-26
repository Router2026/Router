// "Why is this stop here, at this time?" — one short Hebrew line per stop, built from the plan's
// own facts (slot, category, attributes, drive, wait). Plain code, not the model: it can't invent
// anything and it works when the model is down. Agent 5's prose explains the day as a whole.

import { parseTime } from "@/lib/ai-route/sequence";
import { isHike, type DayPlan, type PlannedStop } from "./planner-agent";

const WATER_CATEGORIES = new Set(["מעיין", "מים"]);
const VIEWPOINTS = new Set(["מצפה", "נוף", "חוף"]);

/** Reasons talk about the stop's real time, not its slot: a "midday" spring can still be first at 09:00. */
function slotReason(s: PlannedStop, plan: Pick<DayPlan, "sunset">): string {
  const p = s.place;
  const arrival = parseTime(s.arrivalTime);
  const isMorning = arrival < 11 * 60;
  const isMidday = arrival >= 11 * 60 && arrival < 15 * 60;
  const water = p.hasWater || WATER_CATEGORIES.has(p.category);
  const shade = p.category === "יער" || p.hasShade;

  if (s.slot === "sunset") {
    return s.waitMinutes > 0 || parseTime(s.departureTime) >= parseTime(plan.sunset)
      ? `נקודת תצפית — שמרתי אותה לסוף כדי לתפוס את השקיעה (${plan.sunset})`
      : "נקודת תצפית לסיום היום";
  }
  if (isHike(p) && isMorning) {
    return p.difficulty === "מאתגר"
      ? "המסלול המאתגר של היום — בבוקר, כשעוד קריר ויש הכי הרבה כוח"
      : "מסלול הליכה — בבוקר, לפני החום";
  }
  if (isMidday && water) return "מים — בשעות החמות של הצהריים";
  if (isMidday && shade) return "מקום מוצל לשעות החמות של הצהריים";
  if (VIEWPOINTS.has(p.category)) return p.category === "חוף" ? "עצירה בחוף בדרך" : "עצירה קצרה לנוף בדרך";
  if (water) return "מקום עם מים, נעים בכל שעה";
  if (shade) return "מקום מוצל ונעים";
  if (isHike(p)) return arrival >= 15 * 60 ? "הליכה קצרה שמתאימה לאחר הצהריים" : "מסלול הליכה";
  return "עצירה רגועה בדרך";
}

function legReason(s: PlannedStop, index: number, hasOrigin: boolean): string | null {
  if (index === 0) return hasOrigin && s.driveMinutesFromPrev > 0 ? `מתחילים כאן — כ-${s.driveMinutesFromPrev} דק' נסיעה מנקודת ההתחלה` : null;
  if (s.driveMinutesFromPrev <= 15) return `רק ${s.driveMinutesFromPrev} דק' נסיעה מהעצירה הקודמת`;
  return null;
}

/** One reason per stop, aligned with `plan.stops`. */
export function stopReasons(plan: Pick<DayPlan, "stops" | "sunset" | "orderStrategy">, hasOrigin = false): string[] {
  return plan.stops.map((s, i) => {
    // When the drive-saving order overrode time of day, a slot reason ("in the morning, before the
    // heat") may not match the actual time, so say why the order is what it is instead.
    const head = plan.orderStrategy === "shortest_drive" && s.slot !== "sunset"
      ? "בסדר שחוסך הכי הרבה נסיעה"
      : slotReason(s, plan);
    return [head, legReason(s, i, hasOrigin)].filter(Boolean).join(". ");
  });
}

/** A one-line, factual "how I built the day", for when the model's why_this_route is empty. */
export function planReason(plan: Pick<DayPlan, "stops" | "orderStrategy" | "totalDriveMinutes" | "sunset">): string {
  const parts: string[] = [];
  if (plan.orderStrategy === "shortest_drive") parts.push("סידרתי את העצירות בסדר שחוסך הכי הרבה נסיעה");
  else parts.push("סידרתי את העצירות לפי שעות היום: הליכות בבוקר, מים וצל בצהריים ותצפיות לקראת השקיעה");
  parts.push(`סה"כ כ-${plan.totalDriveMinutes} דק' נסיעה, וסיום לפני החשכה (שקיעה ב-${plan.sunset})`);
  return parts.join(". ") + ".";
}
