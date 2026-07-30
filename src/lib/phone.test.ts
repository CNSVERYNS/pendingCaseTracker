import { describe, expect, it } from 'vitest';

import { isValidOtpCode, isValidPhoneNumber, normalizePhoneNumber } from '@/lib/phone';

describe('normalizePhoneNumber', () => {
  it('strips spaces, hyphens, and parentheses', () => {
    expect(normalizePhoneNumber(' +1 (555) 010-1234 ')).toBe('+15550101234');
  });
});

describe('isValidPhoneNumber', () => {
  it('accepts a well-formed E.164 number', () => {
    expect(isValidPhoneNumber('+15550101234')).toBe(true);
  });

  it('accepts a formatted number with spaces/parens/hyphens', () => {
    expect(isValidPhoneNumber('+1 (555) 010-1234')).toBe(true);
  });

  it.each([
    ['missing +', '15550101234'],
    ['leading zero after +', '+05550101234'],
    ['too short', '+1555010'],
    ['too long', '+1555010123456789'],
    ['contains letters', '+1555abc1234'],
    ['empty string', ''],
  ])('rejects %s', (_label, value) => {
    expect(isValidPhoneNumber(value)).toBe(false);
  });
});

describe('isValidOtpCode', () => {
  it('accepts a 6-digit code', () => {
    expect(isValidOtpCode('123456')).toBe(true);
  });

  it('trims surrounding whitespace before checking', () => {
    expect(isValidOtpCode(' 123456 ')).toBe(true);
  });

  it.each([
    ['too short', '12345'],
    ['too long', '1234567'],
    ['contains a letter', '12345a'],
    ['empty string', ''],
  ])('rejects %s', (_label, value) => {
    expect(isValidOtpCode(value)).toBe(false);
  });
});
