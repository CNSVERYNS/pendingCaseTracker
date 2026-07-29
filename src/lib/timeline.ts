/**
 * Builds the Home screen timeline rows from the raw case_events ledger
 * (build brief §10). Pure — no network, no Date.now().
 *
 * "Current" is not simply "the most recent event": if a future-dated
 * milestone is already known (e.g. an interview date captured via §7), that
 * becomes the highlighted current row — the countdown ("in 17 days") is the
 * whole point of the amber ring and breathing dot (§9 motion spec). Only
 * when nothing is scheduled ahead does "current" fall back to the latest
 * thing that already happened.
 */

import { diffDays, formatShortDate, formatTime12h, isBefore } from '@/lib/dates';
import type { CaseEventKind, CaseEventSource } from '@/lib/database.types';
import { strings } from '@/constants/strings';

export type TimelineRowStatus = 'completed' | 'current' | 'future';

export interface TimelineEventInput {
  id: string;
  kind: CaseEventKind;
  source: CaseEventSource;
  label: string | null;
  occurredOn: string;
  occurredAtTime: string | null;
}

export interface TimelineRow {
  key: string;
  status: TimelineRowStatus;
  title: string;
  dateDisplay: string;
  timeDisplay: string | null;
  countdownLabel: string;
}

function titleFor(event: TimelineEventInput): string {
  if (event.label) return event.label;
  if (event.kind === 'rfe' && event.source === 'manual') return strings.timeline.kindLabels.rfe_manual;
  return strings.timeline.kindLabels[event.kind] ?? strings.timeline.kindLabels.other;
}

function countdownFor(occurredOn: string, today: string): string {
  const diff = diffDays(today, occurredOn);
  if (diff > 1) return strings.timeline.inDays.replace('{days}', String(diff));
  if (diff === 1) return strings.timeline.inOneDay;
  if (diff === 0) return strings.timeline.today;
  if (diff === -1) return strings.timeline.oneDayAgo;
  return strings.timeline.daysAgo.replace('{days}', String(Math.abs(diff)));
}

function toRow(event: TimelineEventInput, status: TimelineRowStatus, today: string): TimelineRow {
  return {
    key: event.id,
    status,
    title: titleFor(event),
    dateDisplay: formatShortDate(event.occurredOn),
    timeDisplay: event.occurredAtTime ? formatTime12h(event.occurredAtTime) : null,
    countdownLabel: countdownFor(event.occurredOn, today),
  };
}

function sortEvents(events: TimelineEventInput[]): TimelineEventInput[] {
  return [...events].sort((a, b) => {
    if (a.occurredOn !== b.occurredOn) return a.occurredOn < b.occurredOn ? -1 : 1;
    const at = a.occurredAtTime ?? '';
    const bt = b.occurredAtTime ?? '';
    if (at !== bt) return at < bt ? -1 : 1;
    return 0;
  });
}

export function buildTimeline(events: TimelineEventInput[], today: string): TimelineRow[] {
  const sorted = sortEvents(events);
  const future = sorted.filter((e) => isBefore(today, e.occurredOn));
  const pastOrToday = sorted.filter((e) => !isBefore(today, e.occurredOn));

  if (future.length > 0) {
    const [current, ...remainingFuture] = future;
    return [
      ...pastOrToday.map((e) => toRow(e, 'completed', today)),
      toRow(current, 'current', today),
      ...remainingFuture.map((e) => toRow(e, 'future', today)),
    ];
  }

  if (pastOrToday.length === 0) {
    return [];
  }

  const current = pastOrToday[pastOrToday.length - 1];
  const completed = pastOrToday.slice(0, -1);
  return [...completed.map((e) => toRow(e, 'completed', today)), toRow(current, 'current', today)];
}
