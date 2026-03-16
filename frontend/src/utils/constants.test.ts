import { describe, it, expect } from 'vitest';
import { CATEGORIES } from './constants';

const EXPECTED_CATEGORY_IDS = ['טבע', 'מים', 'היסטוריה', 'נוף', 'חוף', 'מחנאות', 'אוכל', 'אחר'];

describe('CATEGORIES', () => {
  it('contains all expected category ids', () => {
    const ids = CATEGORIES.map((c) => c.id);
    for (const id of EXPECTED_CATEGORY_IDS) {
      expect(ids).toContain(id);
    }
  });

  it('each category has id, icon, and label', () => {
    for (const cat of CATEGORIES) {
      expect(cat.id).toBeTruthy();
      expect(cat.icon).toBeTruthy();
      expect(cat.label).toBeTruthy();
    }
  });

  it('has 8 categories', () => {
    expect(CATEGORIES).toHaveLength(8);
  });
});
