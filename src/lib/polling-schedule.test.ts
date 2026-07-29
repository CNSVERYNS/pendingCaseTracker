import { describe, expect, it } from 'vitest';

import { isDueForPoll } from '@/lib/polling-schedule';

const NOW = '2026-06-01T09:00:00.000Z';

describe('isDueForPoll', () => {
  it('is always due when never polled before', () => {
    expect(
      isDueForPoll({
        state: 'active',
        filedOn: '2026-01-01',
        lastEventOn: null,
        lastPolledAt: null,
        processingRange: null,
        now: NOW,
      }),
    ).toBe(true);
  });

  it('is never due once decided, regardless of how long since the last poll', () => {
    expect(
      isDueForPoll({
        state: 'decided',
        filedOn: '2020-01-01',
        lastEventOn: null,
        lastPolledAt: '2020-01-02T09:00:00.000Z',
        processingRange: null,
        now: NOW,
      }),
    ).toBe(false);
  });

  it('polls daily for a case younger than 30 days', () => {
    const filedOn = '2026-05-20'; // 12 days before NOW
    const notYetDue = isDueForPoll({
      state: 'active',
      filedOn,
      lastEventOn: null,
      lastPolledAt: '2026-05-31T10:00:00.000Z', // 23 hours ago
      processingRange: null,
      now: NOW,
    });
    const due = isDueForPoll({
      state: 'active',
      filedOn,
      lastEventOn: null,
      lastPolledAt: '2026-05-31T08:00:00.000Z', // 25 hours ago
      processingRange: null,
      now: NOW,
    });
    expect(notYetDue).toBe(false);
    expect(due).toBe(true);
  });

  it('polls every 3 days for a normal, older case with no recent events', () => {
    const filedOn = '2025-01-01'; // well past 30 days
    const notYetDue = isDueForPoll({
      state: 'active',
      filedOn,
      lastEventOn: null,
      lastPolledAt: '2026-05-30T09:00:00.000Z', // 2 days ago
      processingRange: null,
      now: NOW,
    });
    const due = isDueForPoll({
      state: 'active',
      filedOn,
      lastEventOn: null,
      lastPolledAt: '2026-05-29T08:00:00.000Z', // just over 3 days ago
      processingRange: null,
      now: NOW,
    });
    expect(notYetDue).toBe(false);
    expect(due).toBe(true);
  });

  it('polls daily when there was an event in the last 7 days, even on an old case', () => {
    const due = isDueForPoll({
      state: 'active',
      filedOn: '2025-01-01',
      lastEventOn: '2026-05-28', // 4 days before NOW's date
      lastPolledAt: '2026-05-31T08:00:00.000Z', // 25 hours ago
      processingRange: null,
      now: NOW,
    });
    expect(due).toBe(true);
  });

  it('polls daily once the case is past the high end of its processing range', () => {
    const due = isDueForPoll({
      state: 'active',
      filedOn: '2025-01-01', // far in the past
      lastEventOn: null,
      lastPolledAt: '2026-05-31T08:00:00.000Z', // 25 hours ago
      processingRange: { lowDays: 200, highDays: 300 },
      now: NOW,
    });
    expect(due).toBe(true);
  });
});
