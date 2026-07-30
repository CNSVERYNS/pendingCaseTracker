import { describe, expect, it } from 'vitest';

import { findPriorEventForInterval, formatStageEstimate, formatTypicalEstimate, MIN_SAMPLE_SIZE } from '@/lib/stage-estimate';

describe('findPriorEventForInterval', () => {
  it('finds the most recent different-kind prior event and computes the day gap', () => {
    const result = findPriorEventForInterval(
      [
        { kind: 'filed', occurredOn: '2026-01-01' },
        { kind: 'biometrics_scheduled', occurredOn: '2026-02-01' },
      ],
      { kind: 'biometrics', occurredOn: '2026-02-15' },
    );
    expect(result).toEqual({ fromKind: 'biometrics_scheduled', days: 14 });
  });

  it('ignores events of the same kind as the new event', () => {
    const result = findPriorEventForInterval(
      [
        { kind: 'filed', occurredOn: '2026-01-01' },
        { kind: 'interview', occurredOn: '2026-01-10' },
      ],
      { kind: 'interview', occurredOn: '2026-02-15' },
    );
    expect(result).toEqual({ fromKind: 'filed', days: 45 });
  });

  it('picks the closest prior event when several exist', () => {
    const result = findPriorEventForInterval(
      [
        { kind: 'filed', occurredOn: '2026-01-01' },
        { kind: 'biometrics_scheduled', occurredOn: '2026-01-20' },
      ],
      { kind: 'biometrics', occurredOn: '2026-02-01' },
    );
    expect(result).toEqual({ fromKind: 'biometrics_scheduled', days: 12 });
  });

  it('returns null when there is no prior event', () => {
    expect(findPriorEventForInterval([], { kind: 'filed', occurredOn: '2026-01-01' })).toBeNull();
  });

  it('returns null when every prior event shares the new event\'s kind', () => {
    const result = findPriorEventForInterval(
      [{ kind: 'rfe', occurredOn: '2026-01-01' }],
      { kind: 'rfe', occurredOn: '2026-02-01' },
    );
    expect(result).toBeNull();
  });

  it('ignores events that occurred after the new event', () => {
    const result = findPriorEventForInterval(
      [{ kind: 'decision', occurredOn: '2026-06-01' }],
      { kind: 'interview', occurredOn: '2026-02-01' },
    );
    expect(result).toBeNull();
  });
});

describe('formatStageEstimate', () => {
  it('returns null when the sample size is below the minimum', () => {
    const result = formatStageEstimate({ sampleSize: MIN_SAMPLE_SIZE - 1, medianDays: 30 }, '2026-01-01');
    expect(result).toBeNull();
  });

  it('returns null when the median is unavailable', () => {
    const result = formatStageEstimate({ sampleSize: 50, medianDays: null }, '2026-01-01');
    expect(result).toBeNull();
  });

  it('returns null for a missing estimate', () => {
    expect(formatStageEstimate(null, '2026-01-01')).toBeNull();
    expect(formatStageEstimate(undefined, '2026-01-01')).toBeNull();
  });

  it('adds the rounded median days to the since-date once the sample size clears the minimum', () => {
    const result = formatStageEstimate({ sampleSize: MIN_SAMPLE_SIZE, medianDays: 42.6 }, '2026-01-01');
    expect(result).toEqual({ confidence: 'personalized', estimatedDate: '2026-02-13', sampleSize: MIN_SAMPLE_SIZE });
  });
});

describe('formatTypicalEstimate', () => {
  it('anchors on filed date + the high end of the range, regardless of how much time has already elapsed', () => {
    const result = formatTypicalEstimate({ lowDays: 150, highDays: 250 }, '2026-01-01', '2026-06-01');
    expect(result).toEqual({ confidence: 'typical', estimatedDate: '2026-09-08' });
  });

  it("doesn't go negative just because elapsed time has already passed the midpoint of the range", () => {
    // filed 2026-01-01, "today" is 230 days later — past the 200-day midpoint
    // of a 150-250 range, but not yet past the 250-day high end.
    const result = formatTypicalEstimate({ lowDays: 150, highDays: 250 }, '2026-01-01', '2026-08-19');
    expect(result).not.toBeNull();
    expect(result?.estimatedDate).toBe('2026-09-08');
  });

  it('returns null once the case has already passed the whole published range', () => {
    const result = formatTypicalEstimate({ lowDays: 150, highDays: 250 }, '2026-01-01', '2026-09-10');
    expect(result).toBeNull();
  });

  it('returns null exactly at the high-end boundary, not just after it', () => {
    // elapsed === highDays: the range is over as of today, not still-remaining.
    const result = formatTypicalEstimate({ lowDays: 150, highDays: 250 }, '2026-01-01', '2026-09-08');
    expect(result).toBeNull();
  });
});
