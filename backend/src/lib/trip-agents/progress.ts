// Short Hebrew progress lines for the live "agents at work" UI: what each agent found, from its
// own result. Only counts and DB names — never model free text.

import type { ConditionsReport } from "./conditions-agent";
import type { TripIntent } from "./intent-agent";
import type { DayPlan } from "./planner-agent";
import type { ReviewResult } from "./review-agent";
import type { SearchResult } from "./search-agent";
import type { TripSummary } from "./summary-agent";

export type AgentStep = "intent" | "search" | "conditions" | "planner" | "review" | "summary";
export type StepListener = (step: AgentStep, phase: "start" | "done", detail?: string) => void;

const plural = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);

export function intentDetail(i: TripIntent): string {
  const parts = [i.date ? `תאריך ${i.date.split("-").reverse().join(".")}` : "", i.start_time ? `מ-${i.start_time}` : "", `עד ${i.max_stops} עצירות`];
  return `הבנתי: ${parts.filter(Boolean).join(" · ")}`;
}

export function searchDetail(s: Pick<SearchResult, "candidates" | "pool">): string {
  return `מצאתי ${plural(s.candidates.length, "מקום אחד מתאים", "מקומות מתאימים")} מתוך ${s.pool.length} שבדקתי`;
}

export function conditionsDetail(c: Pick<ConditionsReport, "approved" | "rejected" | "forecastAvailable" | "sunset">): string {
  const parts = [`${plural(c.approved.length, "מקום אחד עבר", "מקומות עברו")} בדיקת בטיחות`];
  if (c.rejected.length) parts.push(`${plural(c.rejected.length, "אחד נפסל", "נפסלו")} בגלל מזג האוויר`);
  parts.push(c.forecastAvailable ? "התחזית נבדקה" : "אין עדיין תחזית לתאריך");
  if (c.sunset) parts.push(`שקיעה ב-${c.sunset}`);
  return parts.join(" · ");
}

export function plannerDetail(p: Pick<DayPlan, "stops" | "totalDriveMinutes" | "startTime" | "endTime">): string {
  return `${plural(p.stops.length, "עצירה אחת", "עצירות")} · יציאה ב-${p.startTime}, סיום ב-${p.endTime} · ${p.totalDriveMinutes} דק' נסיעה`;
}

export function reviewDetail(r: Pick<ReviewResult, "verdict" | "added" | "removed">): string {
  if (r.verdict === "approve") return "התוכנית עונה לבקשה — אישרתי";
  if (r.verdict === "skipped") return "דילגתי על הבדיקה הפעם";
  const changes = [r.added.length ? `הוספתי ${r.added.length}` : "", r.removed.length ? `הוצאתי ${r.removed.length}` : ""].filter(Boolean);
  return `שיפרתי את התוכנית${changes.length ? ` (${changes.join(", ")})` : ""}`;
}

export function summaryDetail(s: Pick<TripSummary, "title">): string {
  return s.title ? `"${s.title}"` : "כתבתי הסבר וטיפים";
}
