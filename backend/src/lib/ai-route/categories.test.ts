import { describe, it, expect } from "vitest";
import {
  resolveCategories, defaultVisitMinutes, isTripStyle,
  DEFAULT_CATEGORIES, LOCATION_CATEGORIES,
} from "./categories";

describe("resolveCategories", () => {
  it("maps water to Hebrew spring/stream categories", () => {
    expect(resolveCategories(["water"])).toEqual(["מעיין", "נחל", "מים"]);
  });

  it("de-duplicates and keeps the order of the selected styles", () => {
    expect(resolveCategories(["water", "hiking"])).toEqual(["מעיין", "נחל", "מים", "מסלול", "שמורת טבע"]);
  });

  it("uses the viewpoint categories that exist in the DB for photo", () => {
    const cats = resolveCategories(["photo"]);
    expect(cats).toContain("מצפה");
    expect(cats).toContain("נוף");
    expect(cats).not.toContain("תצפית");
  });

  it("never selects food", () => {
    const all = resolveCategories(["history", "water", "photo", "nature", "hiking", "beach", "geology", "wine", "village", "family_activities"]);
    expect(all).not.toContain("אוכל");
  });

  it("falls back to defaults for empty or unknown styles", () => {
    expect(resolveCategories([])).toEqual([...DEFAULT_CATEGORIES]);
    expect(resolveCategories(["bogus", 42, null])).toEqual([...DEFAULT_CATEGORIES]);
  });

  it("never returns an English category", () => {
    const all = resolveCategories(["history", "water", "photo", "nature", "hiking", "beach", "geology", "wine", "village", "family_activities"]);
    for (const cat of all) {
      expect(LOCATION_CATEGORIES as readonly string[]).toContain(cat);
    }
  });
});

describe("defaultVisitMinutes / isTripStyle", () => {
  it("returns a per-category default and 60 for unknown categories", () => {
    expect(defaultVisitMinutes("מצפה")).toBe(30);
    expect(defaultVisitMinutes("לא קיים")).toBe(60);
  });

  it("narrows only known style ids", () => {
    expect(isTripStyle("water")).toBe(true);
    expect(isTripStyle("WATER")).toBe(false);
    expect(isTripStyle(undefined)).toBe(false);
  });
});
