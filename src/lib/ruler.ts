/**
 * Pure position math for the Home screen ruler (build brief §10): a
 * 0-400 day scale with a filled typical-range band and a "YOU" marker.
 * Rendering hides the ruler entirely when there's no processing-time data
 * (§13) — this module assumes a range is already known.
 */

import { strings } from '@/constants/strings';

export const RULER_SCALE_MAX_DAYS = 400;

export interface ProcessingRangeInput {
  lowDays: number;
  highDays: number;
}

export interface RulerGeometry {
  /** 0-100, clamped — how far along the 0-400 scale the "YOU" marker sits. */
  youPercent: number;
  bandStartPercent: number;
  bandEndPercent: number;
  isPastRange: boolean;
  accessibilityLabel: string;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function computeRulerGeometry(days: number, range: ProcessingRangeInput): RulerGeometry {
  const youPercent = clampPercent((Math.min(days, RULER_SCALE_MAX_DAYS) / RULER_SCALE_MAX_DAYS) * 100);
  const bandStartPercent = clampPercent((range.lowDays / RULER_SCALE_MAX_DAYS) * 100);
  const bandEndPercent = clampPercent((range.highDays / RULER_SCALE_MAX_DAYS) * 100);
  const isPastRange = days > range.highDays;

  const accessibilityLabel = strings.home.rulerAccessibilityLabel
    .replace('{days}', String(days))
    .replace('{low}', String(range.lowDays))
    .replace('{high}', String(range.highDays));

  return { youPercent, bandStartPercent, bandEndPercent, isPastRange, accessibilityLabel };
}
