import { describe, it, expect } from 'vitest';
import { roundToThousands } from './helper';

describe('roundToThousands', () => {
  it('returns 0 for 0', () => {
    expect(roundToThousands(0)).toBe(0);
  });

  it('returns 0 for values below 1000', () => {
    expect(roundToThousands(999)).toBe(0);
    expect(roundToThousands(500)).toBe(0);
    expect(roundToThousands(1)).toBe(0);
  });

  it('returns exact value for multiples of 1000', () => {
    expect(roundToThousands(1000)).toBe(1000);
    expect(roundToThousands(5000)).toBe(5000);
  });

  it('floors to nearest thousand for large numbers', () => {
    expect(roundToThousands(1500)).toBe(1000);
    expect(roundToThousands(9999)).toBe(9000);
    expect(roundToThousands(12345)).toBe(12000);
  });
});
