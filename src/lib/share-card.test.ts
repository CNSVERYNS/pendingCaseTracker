import { describe, expect, it } from 'vitest';

import { buildShareMilestones } from '@/lib/share-card';
import type { TimelineRow } from '@/lib/timeline';

function row(overrides: Partial<TimelineRow> & Pick<TimelineRow, 'key' | 'status'>): TimelineRow {
  return { title: 'Title', dateDisplay: 'Jan 1', timeDisplay: null, countdownLabel: '', ...overrides };
}

describe('buildShareMilestones', () => {
  it('appends a "Decision · pending · N days" row in amber while still waiting', () => {
    const rows = [row({ key: '1', status: 'completed', title: 'Case filed' })];
    const result = buildShareMilestones(rows, false, 187);
    expect(result).toEqual([
      { label: 'Case filed', value: 'Jan 1', amber: false },
      { label: 'Decision', value: 'pending · 187 days', amber: true },
    ]);
  });

  it('marks the final known row amber once decided, without adding a synthetic row', () => {
    const rows = [
      row({ key: '1', status: 'completed', title: 'Case filed' }),
      row({ key: '2', status: 'current', title: 'Case Was Approved', dateDisplay: 'Aug 14' }),
    ];
    const result = buildShareMilestones(rows, true, 210);
    expect(result).toEqual([
      { label: 'Case filed', value: 'Jan 1', amber: false },
      { label: 'Case Was Approved', value: 'Aug 14', amber: true },
    ]);
  });

  it('drops future-dated rows — only what already happened belongs on the card', () => {
    const rows = [
      row({ key: '1', status: 'completed', title: 'Case filed' }),
      row({ key: '2', status: 'current', title: 'Interview scheduled' }),
      row({ key: '3', status: 'future', title: 'Interview' }),
    ];
    const result = buildShareMilestones(rows, false, 100);
    expect(result.map((r) => r.label)).toEqual(['Case filed', 'Interview scheduled', 'Decision']);
  });
});
