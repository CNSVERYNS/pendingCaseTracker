import { describe, expect, it } from 'vitest';

import { detectFormType } from '@/lib/form-type';

describe('detectFormType', () => {
  it('detects a known form code mentioned in status text', () => {
    expect(detectFormType('On January 1 we received your Form I-485, Application to Register...')).toBe('I-485');
  });

  it('is case-insensitive', () => {
    expect(detectFormType('received your form i-765 application')).toBe('I-765');
  });

  it('returns null when no known form code is mentioned', () => {
    expect(detectFormType('We received your application and will begin processing.')).toBeNull();
  });
});
