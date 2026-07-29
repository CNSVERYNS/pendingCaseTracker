import { describe, expect, it } from 'vitest';

import { isValidReceiptNumber, maskReceiptNumber, normalizeReceiptNumber, receiptPrefix } from '@/lib/receipt';

describe('normalizeReceiptNumber', () => {
  it('trims whitespace and upcases', () => {
    expect(normalizeReceiptNumber(' ioe0912345678 ')).toBe('IOE0912345678');
  });
});

describe('isValidReceiptNumber', () => {
  it('accepts a well-formed receipt number', () => {
    expect(isValidReceiptNumber('IOE0912345678')).toBe(true);
  });

  it('accepts lowercase input', () => {
    expect(isValidReceiptNumber('ioe0912345678')).toBe(true);
  });

  it.each([
    ['too short', 'IOE091234567'],
    ['too long', 'IOE09123456789'],
    ['non-letter prefix', 'IO30912345678'],
    ['non-digit body', 'IOE091234567A'],
    ['empty string', ''],
  ])('rejects %s', (_label, value) => {
    expect(isValidReceiptNumber(value)).toBe(false);
  });
});

describe('receiptPrefix', () => {
  it('extracts the 3-letter service center prefix', () => {
    expect(receiptPrefix('WAC2312345678')).toBe('WAC');
  });
});

describe('maskReceiptNumber', () => {
  it('keeps first 7 and last 3 characters, fixed 5-bullet middle', () => {
    expect(maskReceiptNumber('IOE0912345678')).toBe('IOE0912•••••678');
  });

  it('normalizes before masking', () => {
    expect(maskReceiptNumber('ioe0912345678')).toBe('IOE0912•••••678');
  });
});
