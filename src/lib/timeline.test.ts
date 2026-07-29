import { describe, expect, it } from 'vitest';

import { buildTimeline, type TimelineEventInput } from '@/lib/timeline';

const TODAY = '2026-06-01';

function event(overrides: Partial<TimelineEventInput> & Pick<TimelineEventInput, 'id' | 'kind' | 'occurredOn'>): TimelineEventInput {
  return { source: 'poll', label: null, occurredAtTime: null, ...overrides };
}

describe('buildTimeline', () => {
  it('returns an empty timeline with no events', () => {
    expect(buildTimeline([], TODAY)).toEqual([]);
  });

  it('marks the only past event as current, not completed', () => {
    const events = [event({ id: '1', kind: 'filed', occurredOn: '2026-01-01' })];
    const rows = buildTimeline(events, TODAY);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('current');
  });

  it('marks everything before the latest past event as completed', () => {
    const events = [
      event({ id: '1', kind: 'filed', occurredOn: '2026-01-01' }),
      event({ id: '2', kind: 'biometrics_scheduled', occurredOn: '2026-02-01' }),
      event({ id: '3', kind: 'biometrics', occurredOn: '2026-03-01', source: 'manual' }),
    ];
    const rows = buildTimeline(events, TODAY);
    expect(rows.map((r) => r.status)).toEqual(['completed', 'completed', 'current']);
  });

  it('treats a future-dated milestone as current, ahead of past events', () => {
    const events = [
      event({ id: '1', kind: 'filed', occurredOn: '2026-01-01' }),
      event({ id: '2', kind: 'interview_scheduled', occurredOn: '2026-05-20' }),
      event({ id: '3', kind: 'interview', occurredOn: '2026-06-15', source: 'manual' }), // future
    ];
    const rows = buildTimeline(events, TODAY);
    expect(rows.map((r) => r.status)).toEqual(['completed', 'completed', 'current']);
    expect(rows[2].countdownLabel).toBe('in 14 days');
  });

  it('puts any additional future milestones after the current one as "future"', () => {
    const events = [
      event({ id: '1', kind: 'filed', occurredOn: '2026-01-01' }),
      event({ id: '2', kind: 'interview', occurredOn: '2026-06-10', source: 'manual' }),
      event({ id: '3', kind: 'other', label: 'Some later step', occurredOn: '2026-07-01', source: 'manual' }),
    ];
    const rows = buildTimeline(events, TODAY);
    expect(rows.map((r) => r.status)).toEqual(['completed', 'current', 'future']);
  });

  it('treats an event occurring today as part of the completed/current past group, not future', () => {
    const events = [event({ id: '1', kind: 'filed', occurredOn: TODAY })];
    const rows = buildTimeline(events, TODAY);
    expect(rows[0].status).toBe('current');
    expect(rows[0].countdownLabel).toBe('today');
  });

  it('prefers the stored label over the generic kind label', () => {
    const events = [event({ id: '1', kind: 'decision', label: 'Case Was Approved', occurredOn: TODAY })];
    const rows = buildTimeline(events, TODAY);
    expect(rows[0].title).toBe('Case Was Approved');
  });

  it('falls back to a generic label per kind when none is stored', () => {
    const events = [event({ id: '1', kind: 'filed', occurredOn: TODAY })];
    expect(buildTimeline(events, TODAY)[0].title).toBe('Case filed');
  });

  it('distinguishes a manual RFE deadline from a poll-sourced RFE notice', () => {
    const manual = buildTimeline([event({ id: '1', kind: 'rfe', occurredOn: TODAY, source: 'manual' })], TODAY);
    const poll = buildTimeline([event({ id: '1', kind: 'rfe', occurredOn: TODAY, source: 'poll' })], TODAY);
    expect(manual[0].title).toBe('RFE response due');
    expect(poll[0].title).toBe('Request for evidence');
  });

  it('includes a formatted time when occurredAtTime is present', () => {
    const events = [event({ id: '1', kind: 'interview', occurredOn: TODAY, occurredAtTime: '09:20:00' })];
    expect(buildTimeline(events, TODAY)[0].timeDisplay).toBe('9:20 AM');
  });

  it('sorts events chronologically regardless of input order', () => {
    const events = [
      event({ id: '2', kind: 'biometrics', occurredOn: '2026-02-01' }),
      event({ id: '1', kind: 'filed', occurredOn: '2026-01-01' }),
    ];
    const rows = buildTimeline(events, TODAY);
    expect(rows.map((r) => r.key)).toEqual(['1', '2']);
  });
});
