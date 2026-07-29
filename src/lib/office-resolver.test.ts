import { describe, expect, it } from 'vitest';

import {
  isOnlineFilingReceipt,
  resolveOfficeByPrefix,
  resolveOfficeByZip,
} from '@/lib/office-resolver';

describe('resolveOfficeByPrefix', () => {
  it.each([
    ['WAC', 'CSC'],
    ['LIN', 'NSC'],
    ['EAC', 'VSC'],
    ['SRC', 'TSC'],
    ['MSC', 'NBC'],
  ])('maps %s prefix to %s', (prefix, expectedCode) => {
    expect(resolveOfficeByPrefix(`${prefix}2312345678`)?.code).toBe(expectedCode);
  });

  it('is case-insensitive', () => {
    expect(resolveOfficeByPrefix('wac2312345678')?.code).toBe('CSC');
  });

  it('returns null for an unmapped prefix', () => {
    expect(resolveOfficeByPrefix('ZZZ2312345678')).toBeNull();
  });

  it('returns null for IOE receipts — those resolve by ZIP instead', () => {
    expect(resolveOfficeByPrefix('IOE0912345678')).toBeNull();
  });
});

describe('isOnlineFilingReceipt', () => {
  it('flags IOE receipts', () => {
    expect(isOnlineFilingReceipt('IOE0912345678')).toBe(true);
  });

  it('does not flag service-center receipts', () => {
    expect(isOnlineFilingReceipt('WAC2312345678')).toBe(false);
  });
});

describe('resolveOfficeByZip', () => {
  it('resolves a known ZIP prefix', () => {
    expect(resolveOfficeByZip('10001')?.code).toBe('NYC');
  });

  it('ignores non-digit characters', () => {
    expect(resolveOfficeByZip(' 900 21 ')?.code).toBe('LOS');
  });

  it('returns null for an unmapped ZIP', () => {
    expect(resolveOfficeByZip('00501')).toBeNull();
  });

  it.each([
    ['80202', 'DEN'],
    ['37203', 'NAS'],
    ['02903', 'PRO'],
  ])('resolves %s to %s (expanded metro coverage)', (zip, expectedCode) => {
    expect(resolveOfficeByZip(zip)?.code).toBe(expectedCode);
  });

  it('returns null for input too short to be a ZIP', () => {
    expect(resolveOfficeByZip('9')).toBeNull();
  });
});
