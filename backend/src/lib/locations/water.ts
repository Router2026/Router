// Water reliability helpers (locations.water_seasonal, migration 0012).

/**
 * Phrases that say the water is unreliable. Kept specific on purpose: "מלא מים רוב השנה"
 * (full of water most of the year) must NOT match, so bare "רוב השנה" is not a pattern.
 */
export const DRY_PATTERNS: RegExp[] = [
  /אין\s+(?:בו\s+|כאן\s+|במקום\s+)?מים\s+(?:ב)?רוב\s+(?:ימות\s+)?השנה/,
  /יבש(?:ה|ים|ות)?\s+(?:ב)?רוב\s+(?:ימות\s+)?השנה/,
  /יבש(?:ה|ים|ות)?\s+בקיץ/,
  /מתייבש(?:ת|ים|ות)?\s+בקיץ/,
  /בעונה\s+הגשומה\s+בלבד/,
  /(?:רק|בעיקר)\s+(?:ב)?עונה\s+הגשומה/,
  /(?:רק|אך ורק)\s+(?:ב)?חורף/,
  /(?:רק|בעיקר)\s+(?:לאחר|אחרי)\s+(?:גשמים|שיטפונות|גשם)/,
  /זורם(?:ת)?\s+רק/,
  /אכזב/,
  // one word may sit in between ("מעיין שכבה עונתי"); bare "עונתי" would catch "פריחה עונתית"
  /(?:נביעה|מעיין|נחל|זרימה|בריכה|גב)\s+(?:\S+\s+)?עונתי(?:ת)?/,
  /(?:יבש|מתייבש(?:ת)?)\s+לע(?:י)?תים\s+קרובות/,
  /אין\s+מים\s+נראים/,
  /ייבשו/,
];

export function dryReason(description: string | null | undefined): string | null {
  if (!description) return null;
  for (const re of DRY_PATTERNS) {
    const m = re.exec(description);
    if (m) return m[0];
  }
  return null;
}

/** "מים" shown to users / used for water-themed planning only when the water is reliable. */
export function hasReliableWater(p: { has_water?: boolean | null; water_seasonal?: boolean | null }): boolean {
  return !!p.has_water && !p.water_seasonal;
}
