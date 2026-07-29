/**
 * Deadline engine (build brief §6). Pure, unit-tested, no network. Given a
 * case and its events, computes which reminders should exist right now.
 * Persisting these (and firing pushes at 9am local time, exactly once per
 * case/kind/due_on) is a job for whatever calls this — see
 * supabase/functions/poll-cases.
 *
 * KNOWN GAP: EAD expiry reminders need an EAD end date, which — unlike the
 * RFE deadline — has no capture point described anywhere in §7's detail
 * table (a produced card is explicitly a "never prompt" case). Until a UI
 * exists to enter it (most naturally a manual field, analogous to the RFE
 * deadline), `eadEndOn` will simply never be populated and these reminders
 * won't fire. This function accepts it as an optional input so the rule
 * itself is ready the moment that capture point exists.
 */

import { addDays, diffDays, formatLongDate, isSameOrAfter } from '@/lib/dates';
import type { CaseEventKind, CaseEventSource, CaseState, FormType } from '@/lib/database.types';

export type DeadlineKind = 'rfe_response' | 'interview' | 'biometrics' | 'inquiry_eligibility' | 'ead_expiry';
export type DeadlineSeverity = 'urgent' | 'upcoming' | 'info';

export interface DeadlineEventInput {
  kind: CaseEventKind;
  source: CaseEventSource;
  occurredOn: string;
}

export interface ProcessingRange {
  lowDays: number;
  highDays: number;
}

export interface DeadlineInput {
  formType: FormType;
  filedOn: string;
  state: CaseState;
  events: DeadlineEventInput[];
  processingRange: ProcessingRange | null;
  /** See the EAD gap noted in the module doc above. */
  eadEndOn?: string | null;
  /** Injected rather than read from the clock, so this stays pure. */
  today: string;
}

export interface DeadlineResult {
  kind: DeadlineKind;
  dueOn: string;
  severity: DeadlineSeverity;
  message: string;
}

function severityFromDaysUntil(daysUntil: number): DeadlineSeverity {
  if (daysUntil <= 1) return 'urgent';
  if (daysUntil <= 7) return 'upcoming';
  return 'info';
}

function latestEventDate(
  events: DeadlineEventInput[],
  kind: CaseEventKind,
  source: CaseEventSource,
): string | null {
  const matches = events.filter((e) => e.kind === kind && e.source === source);
  if (matches.length === 0) return null;
  return matches.reduce((latest, e) => (e.occurredOn > latest ? e.occurredOn : latest), matches[0].occurredOn);
}

function thresholdReminders(
  kind: DeadlineKind,
  targetDate: string,
  offsets: number[],
  today: string,
  message: (daysBefore: number, targetDate: string) => string,
): DeadlineResult[] {
  const results: DeadlineResult[] = [];
  for (const offset of offsets) {
    const dueOn = addDays(targetDate, -offset);
    if (!isSameOrAfter(dueOn, today)) continue;
    results.push({
      kind,
      dueOn,
      severity: severityFromDaysUntil(diffDays(today, dueOn)),
      message: message(offset, targetDate),
    });
  }
  return results;
}

function plural(n: number): string {
  return n === 1 ? '' : 's';
}

export function computeDeadlines(input: DeadlineInput): DeadlineResult[] {
  if (input.state !== 'active') {
    return [];
  }

  const results: DeadlineResult[] = [];

  const rfeDeadline = latestEventDate(input.events, 'rfe', 'manual');
  if (rfeDeadline) {
    results.push(
      ...thresholdReminders(
        'rfe_response',
        rfeDeadline,
        [30, 14, 7, 3, 1],
        input.today,
        (days, target) => `RFE response due in ${days} day${plural(days)} — ${formatLongDate(target)}.`,
      ),
    );
  }

  const interviewDate = latestEventDate(input.events, 'interview', 'manual');
  if (interviewDate) {
    results.push(
      ...thresholdReminders(
        'interview',
        interviewDate,
        [7, 1],
        input.today,
        (days, target) => `Interview in ${days} day${plural(days)} — ${formatLongDate(target)}.`,
      ),
    );
  }

  const biometricsDate = latestEventDate(input.events, 'biometrics', 'manual');
  if (biometricsDate) {
    results.push(
      ...thresholdReminders(
        'biometrics',
        biometricsDate,
        [2],
        input.today,
        (days, target) => `Biometrics appointment in ${days} day${plural(days)} — ${formatLongDate(target)}.`,
      ),
    );
  }

  if (input.processingRange) {
    const eligibleOn = addDays(input.filedOn, input.processingRange.highDays);
    if (diffDays(eligibleOn, input.today) > 0) {
      results.push({
        kind: 'inquiry_eligibility',
        dueOn: eligibleOn,
        severity: 'info',
        message: `This case is now outside the posted processing time for ${input.formType} at this office.`,
      });
    }
  }

  if (input.eadEndOn) {
    results.push(
      ...thresholdReminders(
        'ead_expiry',
        input.eadEndOn,
        [180, 90, 30],
        input.today,
        (days, target) => `Your EAD expires in ${days} days — ${formatLongDate(target)}.`,
      ),
    );
  }

  return results;
}
