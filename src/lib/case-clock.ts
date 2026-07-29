/**
 * When a case is transferred, the office changes and the processing clock
 * restarts against the new office (build brief §8, §13) — the day counter
 * and ruler should measure from the transfer date, not the original filing
 * date, once one has happened.
 */

import { diffDays } from '@/lib/dates';

export interface ClockEventInput {
  kind: string;
  occurredOn: string;
}

export function computeClockStart(events: ClockEventInput[], filedOn: string): string {
  const transfers = events.filter((e) => e.kind === 'transferred').map((e) => e.occurredOn);
  if (transfers.length === 0) return filedOn;
  return transfers.reduce((latest, d) => (d > latest ? d : latest), transfers[0]);
}

export function computeDaysWaiting(events: ClockEventInput[], filedOn: string, today: string): number {
  return diffDays(computeClockStart(events, filedOn), today);
}
