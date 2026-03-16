import { describe, it, expect } from 'vitest';
import { HEBREW } from './translations';

describe('HEBREW translations', () => {
  it('has required common keys', () => {
    const requiredKeys = ['loading', 'search', 'back', 'next', 'submit', 'save', 'cancel'];
    for (const key of requiredKeys) {
      expect(HEBREW.common[key as keyof typeof HEBREW.common]).toBeTypeOf('string');
    }
  });

  it('has required nav keys', () => {
    const requiredKeys = ['home', 'map', 'planner', 'videos', 'reports', 'profile'];
    for (const key of requiredKeys) {
      expect(HEBREW.nav[key as keyof typeof HEBREW.nav]).toBeTypeOf('string');
    }
  });

  it('home section has title and subtitle', () => {
    expect(HEBREW.home.title).toBeTypeOf('string');
    expect(HEBREW.home.subtitle).toBeTypeOf('string');
  });

  it('planner section has generate key', () => {
    expect(HEBREW.planner.generate).toBeTypeOf('string');
  });

  it('all string values are non-empty', () => {
    function checkStrings(obj: unknown): void {
      if (typeof obj === 'string') {
        expect(obj.length).toBeGreaterThan(0);
      } else if (typeof obj === 'object' && obj !== null) {
        for (const val of Object.values(obj)) {
          checkStrings(val);
        }
      }
    }
    checkStrings(HEBREW);
  });
});
