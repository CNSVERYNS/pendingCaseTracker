/**
 * Reduces the Home timeline to the compact leader-dot rows on the share card
 * (build brief §10). The full future-dated timeline doesn't belong on a
 * shareable summary — only what's already known, plus one final row for
 * where the case stands relative to a decision.
 */

import type { TimelineRow } from '@/lib/timeline';

export interface ShareMilestoneRow {
  label: string;
  value: string;
  amber: boolean;
}

export function buildShareMilestones(rows: TimelineRow[], isDecided: boolean, days: number): ShareMilestoneRow[] {
  const known: ShareMilestoneRow[] = rows
    .filter((r) => r.status !== 'future')
    .map((r) => ({ label: r.title, value: r.dateDisplay, amber: false }));

  if (isDecided) {
    if (known.length > 0) {
      known[known.length - 1] = { ...known[known.length - 1], amber: true };
    }
    return known;
  }

  return [...known, { label: 'Decision', value: `pending · ${days} days`, amber: true }];
}
