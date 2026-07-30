/**
 * Personalized processing-time predictions (build brief follow-up,
 * 2026-07-30) — the paid-tier differentiator: instead of the Ruler's single
 * static filed-to-decision range for a form+office, this answers "given
 * people at *my* form, office, AND current stage, how much longer until a
 * decision?" using real anonymous data contributed by every case (see
 * `intervals` table, migration 0007's `get_stage_estimate`).
 *
 * Two independent halves, deliberately decoupled:
 *   - Recording (this file's `findPriorEventForInterval`): purely
 *     descriptive — whenever any case gets a new dated event, log the gap
 *     from whatever real event preceded it. No assumptions about which
 *     stage "should" come next, so it works the same for every form type
 *     without a maintained per-form sequence.
 *   - Reading (`formatStageEstimate`): turns a raw aggregate (sample size +
 *     median days) into a display-ready prediction, or null if there isn't
 *     enough data yet to say anything with a straight face.
 */

import { addDays, diffDays } from '@/lib/dates';

export interface EventForInterval {
  kind: string;
  occurredOn: string;
}

export interface PriorInterval {
  fromKind: string;
  days: number;
}

/**
 * Given a case's existing events and a newly-added one, finds the most
 * recent *different-kind* prior event and returns the day gap — the raw
 * material for an anonymous `record_interval` call. Returns null if there's
 * no usable prior event (first event on the case, or the only earlier
 * events share the new event's own kind).
 */
export function findPriorEventForInterval(
  existingEvents: EventForInterval[],
  newEvent: EventForInterval,
): PriorInterval | null {
  let best: EventForInterval | null = null;

  for (const event of existingEvents) {
    if (event.kind === newEvent.kind) continue;
    if (event.occurredOn > newEvent.occurredOn) continue;
    if (!best || event.occurredOn > best.occurredOn) {
      best = event;
    }
  }

  if (!best) return null;

  const days = diffDays(best.occurredOn, newEvent.occurredOn);
  if (days < 0) return null;

  return { fromKind: best.kind, days };
}

export interface StageEstimateRaw {
  sampleSize: number;
  medianDays: number | null;
}

export interface PersonalizedEstimate {
  confidence: 'personalized';
  estimatedDate: string;
  sampleSize: number;
}

export interface TypicalEstimate {
  confidence: 'typical';
  estimatedDate: string;
}

export type StageEstimateDisplay = PersonalizedEstimate | TypicalEstimate;

/** Below this, a "median" is just noise dressed up as a number. */
export const MIN_SAMPLE_SIZE = 5;

/** `sinceDate` is the date of the case's current (most recent) stage. */
export function formatStageEstimate(
  raw: StageEstimateRaw | null | undefined,
  sinceDate: string,
): PersonalizedEstimate | null {
  if (!raw || raw.medianDays == null || raw.sampleSize < MIN_SAMPLE_SIZE) return null;

  return {
    confidence: 'personalized',
    estimatedDate: addDays(sinceDate, Math.round(raw.medianDays)),
    sampleSize: raw.sampleSize,
  };
}

export interface ProcessingRangeInput {
  lowDays: number;
  highDays: number;
}

/**
 * The fallback tier, used until enough real cases exist for
 * `formatStageEstimate` to say anything (see MIN_SAMPLE_SIZE). Anchors on
 * the *high* end of USCIS's own published range rather than an average —
 * that's always a non-negative "how much longer" from today for as long as
 * the case is still genuinely within the range, with no per-form guess
 * about how much earlier a given stage "should" finish. Once the case has
 * already passed the whole published range, this deliberately returns null
 * rather than a negative or falsely-precise date — the Ruler's own
 * past-range message is the right (and only) thing to show at that point.
 */
export function formatTypicalEstimate(range: ProcessingRangeInput, filedOn: string, today: string): TypicalEstimate | null {
  const elapsed = diffDays(filedOn, today);
  if (elapsed >= range.highDays) return null;

  return {
    confidence: 'typical',
    estimatedDate: addDays(filedOn, range.highDays),
  };
}
