import { describe, expect, it } from 'vitest';

import { computeDeadlines, type DeadlineEventInput } from '@/lib/deadlines';

const baseCase = {
  formType: 'I-485' as const,
  filedOn: '2026-01-01',
  state: 'active' as const,
  processingRange: null,
  today: '2026-01-01',
};

describe('computeDeadlines — inactive cases', () => {
  it('returns nothing for a decided case, even with a live RFE deadline', () => {
    const events: DeadlineEventInput[] = [{ kind: 'rfe', source: 'manual', occurredOn: '2026-01-10' }];
    const result = computeDeadlines({ ...baseCase, state: 'decided', events, today: '2026-01-01' });
    expect(result).toEqual([]);
  });

  it('returns nothing for an archived case', () => {
    const result = computeDeadlines({ ...baseCase, state: 'archived', events: [] });
    expect(result).toEqual([]);
  });
});

describe('computeDeadlines — RFE response', () => {
  const events: DeadlineEventInput[] = [{ kind: 'rfe', source: 'manual', occurredOn: '2026-02-01' }];

  it('emits all five thresholds when today is far before the deadline', () => {
    const result = computeDeadlines({ ...baseCase, events, today: '2025-12-01' });
    const dueDates = result.filter((r) => r.kind === 'rfe_response').map((r) => r.dueOn);
    expect(dueDates).toEqual(['2026-01-02', '2026-01-18', '2026-01-25', '2026-01-29', '2026-01-31']);
  });

  it('drops thresholds that have already passed', () => {
    const result = computeDeadlines({ ...baseCase, events, today: '2026-01-26' });
    const dueDates = result.filter((r) => r.kind === 'rfe_response').map((r) => r.dueOn);
    expect(dueDates).toEqual(['2026-01-29', '2026-01-31']);
  });

  it('produces no reminders once every threshold is in the past', () => {
    const result = computeDeadlines({ ...baseCase, events, today: '2026-02-02' });
    expect(result.filter((r) => r.kind === 'rfe_response')).toEqual([]);
  });

  it('ignores a poll-sourced rfe event — only the manual deadline entry counts', () => {
    const pollOnly: DeadlineEventInput[] = [{ kind: 'rfe', source: 'poll', occurredOn: '2026-02-01' }];
    const result = computeDeadlines({ ...baseCase, events: pollOnly, today: '2025-12-01' });
    expect(result).toEqual([]);
  });

  it('picks the latest manual entry when the deadline was corrected', () => {
    const corrected: DeadlineEventInput[] = [
      { kind: 'rfe', source: 'manual', occurredOn: '2026-02-01' },
      { kind: 'rfe', source: 'manual', occurredOn: '2026-02-15' },
    ];
    const result = computeDeadlines({ ...baseCase, events: corrected, today: '2026-02-14' });
    expect(result.find((r) => r.kind === 'rfe_response')?.dueOn).toBe('2026-02-14');
    expect(result.find((r) => r.kind === 'rfe_response')?.message).toContain('February 15, 2026');
  });

  it('assigns urgent/upcoming/info severity by proximity', () => {
    const result = computeDeadlines({ ...baseCase, events, today: '2026-01-29' });
    const byDate = Object.fromEntries(result.filter((r) => r.kind === 'rfe_response').map((r) => [r.dueOn, r.severity]));
    expect(byDate['2026-01-29']).toBe('urgent'); // due today
    expect(byDate['2026-01-31']).toBe('upcoming'); // 2 days out
  });
});

describe('computeDeadlines — interview', () => {
  it('reminds 7 and 1 days before', () => {
    const events: DeadlineEventInput[] = [{ kind: 'interview', source: 'manual', occurredOn: '2026-03-15' }];
    const result = computeDeadlines({ ...baseCase, events, today: '2026-03-01' });
    const dueDates = result.filter((r) => r.kind === 'interview').map((r) => r.dueOn);
    expect(dueDates).toEqual(['2026-03-08', '2026-03-14']);
  });
});

describe('computeDeadlines — biometrics', () => {
  it('reminds 2 days before', () => {
    const events: DeadlineEventInput[] = [{ kind: 'biometrics', source: 'manual', occurredOn: '2026-03-15' }];
    const result = computeDeadlines({ ...baseCase, events, today: '2026-03-01' });
    expect(result.filter((r) => r.kind === 'biometrics').map((r) => r.dueOn)).toEqual(['2026-03-13']);
  });
});

describe('computeDeadlines — inquiry eligibility', () => {
  it('does not surface before the high end of the processing range', () => {
    const result = computeDeadlines({
      ...baseCase,
      events: [],
      processingRange: { lowDays: 200, highDays: 300 },
      today: '2026-01-01', // day 0 since filing
    });
    expect(result.filter((r) => r.kind === 'inquiry_eligibility')).toEqual([]);
  });

  it('surfaces once the case passes the high end of the range', () => {
    const result = computeDeadlines({
      ...baseCase,
      events: [],
      processingRange: { lowDays: 200, highDays: 300 },
      today: '2026-11-01', // well past filedOn + 300 days
    });
    const hit = result.find((r) => r.kind === 'inquiry_eligibility');
    expect(hit).toBeDefined();
    expect(hit?.severity).toBe('info');
    expect(hit?.message).not.toMatch(/should|file an inquiry|advice/i);
  });

  it('is absent with no processing-time data', () => {
    const result = computeDeadlines({ ...baseCase, events: [], processingRange: null, today: '2027-01-01' });
    expect(result.filter((r) => r.kind === 'inquiry_eligibility')).toEqual([]);
  });
});

describe('computeDeadlines — EAD expiry', () => {
  it('reminds at 180/90/30 days before the end date when known', () => {
    const result = computeDeadlines({
      ...baseCase,
      events: [],
      eadEndOn: '2027-01-01',
      today: '2026-01-01',
    });
    const dueDates = result.filter((r) => r.kind === 'ead_expiry').map((r) => r.dueOn);
    expect(dueDates).toEqual(['2026-07-05', '2026-10-03', '2026-12-02']);
  });

  it('produces nothing when the end date is unknown', () => {
    const result = computeDeadlines({ ...baseCase, events: [], eadEndOn: null });
    expect(result.filter((r) => r.kind === 'ead_expiry')).toEqual([]);
  });
});

describe('computeDeadlines — messages never advise', () => {
  it('states dates rather than recommending action', () => {
    const events: DeadlineEventInput[] = [{ kind: 'rfe', source: 'manual', occurredOn: '2026-02-01' }];
    const result = computeDeadlines({ ...baseCase, events, today: '2026-01-31' });
    for (const r of result) {
      expect(r.message).not.toMatch(/should|must|advice|recommend/i);
    }
  });
});
