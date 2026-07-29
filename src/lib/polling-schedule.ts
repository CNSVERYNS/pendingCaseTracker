/**
 * Adaptive polling schedule (build brief §5). Pure — decides whether a case
 * is due for another USCIS poll right now. The `poll-cases` Edge Function
 * calls this for every active case on each pg_cron tick instead of hammering
 * everyone on the same fixed interval, since the daily quota is the binding
 * constraint on growth.
 */

import { diffDays } from '@/lib/dates';
import type { CaseState } from '@/lib/database.types';

export interface ProcessingRange {
  lowDays: number;
  highDays: number;
}

export interface PollingScheduleInput {
  state: CaseState;
  filedOn: string;
  /** Most recent case_event.occurred_on across the whole timeline, if any. */
  lastEventOn: string | null;
  lastPolledAt: string | null;
  processingRange: ProcessingRange | null;
  /** Injected clock (ISO datetime), so this stays pure. */
  now: string;
}

const DAILY_INTERVAL_HOURS = 24;
const NORMAL_INTERVAL_HOURS = 24 * 3;

export function isDueForPoll(input: PollingScheduleInput): boolean {
  if (input.state === 'decided') {
    return false;
  }
  if (!input.lastPolledAt) {
    return true;
  }

  const today = input.now.slice(0, 10);
  const caseIsYoung = diffDays(input.filedOn, today) < 30;
  const hasRecentEvent = input.lastEventOn !== null && diffDays(input.lastEventOn, today) <= 7;
  const pastHighRange = input.processingRange !== null && diffDays(input.filedOn, today) > input.processingRange.highDays;

  const intervalHours = caseIsYoung || hasRecentEvent || pastHighRange ? DAILY_INTERVAL_HOURS : NORMAL_INTERVAL_HOURS;
  const hoursSincePoll = (Date.parse(input.now) - Date.parse(input.lastPolledAt)) / (1000 * 60 * 60);

  return hoursSincePoll >= intervalHours;
}
