import { describe, expect, it } from 'vitest';

import { isPendingDetailDue } from '@/lib/pending-details';

const ASKED_AT = '2026-01-01T09:00:00.000Z';

describe('isPendingDetailDue', () => {
  it('is due immediately when never dismissed or answered', () => {
    expect(isPendingDetailDue({ askedAt: ASKED_AT, answeredAt: null, dismissedAt: null }, '2026-01-01T09:05:00.000Z')).toBe(
      true,
    );
  });

  it('is never due once answered', () => {
    expect(
      isPendingDetailDue(
        { askedAt: ASKED_AT, answeredAt: '2026-01-01T10:00:00.000Z', dismissedAt: null },
        '2026-01-10T09:00:00.000Z',
      ),
    ).toBe(false);
  });

  it('is not due right after an early dismissal', () => {
    const dismissedAt = '2026-01-01T09:10:00.000Z';
    expect(isPendingDetailDue({ askedAt: ASKED_AT, answeredAt: null, dismissedAt }, '2026-01-02T09:00:00.000Z')).toBe(
      false,
    );
  });

  it('re-surfaces once 3 days have passed since the original ask', () => {
    const dismissedAt = '2026-01-01T09:10:00.000Z'; // dismissed early
    expect(isPendingDetailDue({ askedAt: ASKED_AT, answeredAt: null, dismissedAt }, '2026-01-04T09:00:00.000Z')).toBe(
      true,
    );
  });

  it('stops for good once dismissed again at or after the 3-day re-ask', () => {
    const dismissedAt = '2026-01-04T09:30:00.000Z'; // dismissed after the re-ask window opened
    expect(isPendingDetailDue({ askedAt: ASKED_AT, answeredAt: null, dismissedAt }, '2026-01-10T09:00:00.000Z')).toBe(
      false,
    );
  });

  it('never nags before the 3-day mark even much later the same day', () => {
    const dismissedAt = '2026-01-01T09:10:00.000Z';
    expect(isPendingDetailDue({ askedAt: ASKED_AT, answeredAt: null, dismissedAt }, '2026-01-03T23:59:00.000Z')).toBe(
      false,
    );
  });
});
