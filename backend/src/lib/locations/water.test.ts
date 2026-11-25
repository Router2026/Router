import { describe, it, expect } from 'vitest'
import { dryReason, hasReliableWater } from './water'

describe('dryReason', () => {
  it.each([
    'משטח סלעי המכיל כמה מעיינות קטנים, סביר להניח שאין מים רוב השנה.',
    'אין כאן מים רוב השנה',
    'הגב יבש רוב השנה',
    'המעיין יבש בקיץ',
    'זורם בעונה הגשומה בלבד',
    'מעיין שכבה אכזב.',
    'מעיין שכבה עונתי קטן בתוך בור',
    'נביעה עונתית עם זרימה בחורפים גשומים',
    'מעיין קטן בעומק של כ־20 ס״מ. יבש לעתים קרובות.',
    'נביעה קטנטנה שמתייבשת לעיתים קרובות.',
    'מעיין שרט״ג ייבשו בגלל סרטן פולש',
    'אין מים נראים לעין חוץ מהצמחייה',
    'הנחל זורם רק אחרי גשמים',
  ])('marks "%s" as dry', (d) => {
    expect(dryReason(d)).not.toBeNull()
  })

  it.each([
    'מעיין וגב גדול שמלא מים רוב השנה.',
    'בריכה רדודה שמלאה מים נקיים רוב הזמן.',
    'מעיין זורם כל השנה עם בריכה לטבילה',
    'בחורף יש פריחה עונתית יפה ליד המעיין',
    '',
  ])('does not mark "%s"', (d) => {
    expect(dryReason(d)).toBeNull()
  })
})

describe('hasReliableWater', () => {
  it('is true only for water sites that are not seasonal', () => {
    expect(hasReliableWater({ has_water: true, water_seasonal: false })).toBe(true)
    expect(hasReliableWater({ has_water: true, water_seasonal: true })).toBe(false)
    expect(hasReliableWater({ has_water: false })).toBe(false)
  })
})
