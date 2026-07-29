import { describe, expect, it } from 'vitest';

import { computeClockStart, computeDaysWaiting } from '@/lib/case-clock';

describe('computeClockStart', () => {
  it('uses filedOn when there was never a transfer', () => {
    expect(computeClockStart([{ kind: 'filed', occurredOn: '2026-01-01' }], '2026-01-01')).toBe('2026-01-01');
  });

  it('uses the transfer date once transferred', () => {
    const events = [
      { kind: 'filed', occurredOn: '2026-01-01' },
      { kind: 'transferred', occurredOn: '2026-03-01' },
    ];
    expect(computeClockStart(events, '2026-01-01')).toBe('2026-03-01');
  });

  it('uses the latest transfer if a case was transferred more than once', () => {
    const events = [
      { kind: 'transferred', occurredOn: '2026-03-01' },
      { kind: 'transferred', occurredOn: '2026-06-01' },
    ];
    expect(computeClockStart(events, '2026-01-01')).toBe('2026-06-01');
  });
});

describe('computeDaysWaiting', () => {
  it('counts from filing when there is no transfer', () => {
    expect(computeDaysWaiting([], '2026-01-01', '2026-04-11')).toBe(100);
  });

  it('restarts the count from the transfer date', () => {
    const events = [{ kind: 'transferred', occurredOn: '2026-03-01' }];
    expect(computeDaysWaiting(events, '2026-01-01', '2026-03-11')).toBe(10);
  });
});
