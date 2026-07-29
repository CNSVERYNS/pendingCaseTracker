import { describe, expect, it } from 'vitest';

import { computeRulerGeometry } from '@/lib/ruler';

describe('computeRulerGeometry', () => {
  it('positions the marker proportionally on the 0-400 scale', () => {
    const g = computeRulerGeometry(200, { lowDays: 205, highDays: 300 });
    expect(g.youPercent).toBe(50);
    expect(g.bandStartPercent).toBeCloseTo(51.25, 5);
    expect(g.bandEndPercent).toBe(75);
  });

  it('clamps the marker at 100% for a day count beyond the scale', () => {
    const g = computeRulerGeometry(500, { lowDays: 205, highDays: 300 });
    expect(g.youPercent).toBe(100);
  });

  it('flags when the case has passed the high end of its range', () => {
    expect(computeRulerGeometry(187, { lowDays: 205, highDays: 300 }).isPastRange).toBe(false);
    expect(computeRulerGeometry(310, { lowDays: 205, highDays: 300 }).isPastRange).toBe(true);
  });

  it('builds the accessibility label with the exact wording from §14', () => {
    const g = computeRulerGeometry(187, { lowDays: 205, highDays: 300 });
    expect(g.accessibilityLabel).toBe('187 days, typical range 205 to 300 days');
  });
});
