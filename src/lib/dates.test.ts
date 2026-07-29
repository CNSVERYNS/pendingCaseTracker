import { describe, expect, it } from 'vitest';

import { addDays, diffDays, formatLongDate, formatShortDate, formatTime12h, isBefore, isSameOrAfter, maxDate } from '@/lib/dates';

describe('addDays', () => {
  it('adds days across a month boundary', () => {
    expect(addDays('2026-01-30', 5)).toBe('2026-02-04');
  });

  it('subtracts days with a negative offset', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('handles a leap-year February', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('diffDays', () => {
  it('is positive when `to` is later', () => {
    expect(diffDays('2026-01-01', '2026-01-11')).toBe(10);
  });

  it('is negative when `to` is earlier', () => {
    expect(diffDays('2026-01-11', '2026-01-01')).toBe(-10);
  });

  it('is zero for the same date', () => {
    expect(diffDays('2026-01-01', '2026-01-01')).toBe(0);
  });
});

describe('isBefore / isSameOrAfter', () => {
  it('compares dates correctly', () => {
    expect(isBefore('2026-01-01', '2026-01-02')).toBe(true);
    expect(isBefore('2026-01-02', '2026-01-01')).toBe(false);
    expect(isSameOrAfter('2026-01-01', '2026-01-01')).toBe(true);
    expect(isSameOrAfter('2026-01-01', '2026-01-02')).toBe(false);
  });
});

describe('maxDate', () => {
  it('returns the later of two dates', () => {
    expect(maxDate('2026-01-01', '2026-02-01')).toBe('2026-02-01');
    expect(maxDate('2026-05-01', '2026-02-01')).toBe('2026-05-01');
  });
});

describe('formatLongDate', () => {
  it('formats as "Month D, YYYY"', () => {
    expect(formatLongDate('2026-08-14')).toBe('August 14, 2026');
  });

  it('does not zero-pad the day', () => {
    expect(formatLongDate('2026-01-05')).toBe('January 5, 2026');
  });
});

describe('formatShortDate', () => {
  it('formats as "Mon D"', () => {
    expect(formatShortDate('2026-08-14')).toBe('Aug 14');
  });
});

describe('formatTime12h', () => {
  it('formats morning times', () => {
    expect(formatTime12h('09:20')).toBe('9:20 AM');
  });

  it('formats afternoon times', () => {
    expect(formatTime12h('14:05')).toBe('2:05 PM');
  });

  it('formats noon as 12 PM', () => {
    expect(formatTime12h('12:00')).toBe('12:00 PM');
  });

  it('formats midnight as 12 AM', () => {
    expect(formatTime12h('00:00')).toBe('12:00 AM');
  });

  it('handles an HH:MM:SS input', () => {
    expect(formatTime12h('09:20:00')).toBe('9:20 AM');
  });
});
