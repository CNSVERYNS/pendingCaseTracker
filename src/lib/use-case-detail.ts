import { useQuery } from '@tanstack/react-query';

import { todayISO } from '@/lib/dates';
import { NATIONAL_OFFICE_CODE } from '@/lib/office-resolver';
import { formatStageEstimate, formatTypicalEstimate, type StageEstimateDisplay } from '@/lib/stage-estimate';
import { supabase } from '@/lib/supabase';
import type { CaseEventRow, CaseRow, PendingDetailRow, ProcessingTimeRow, StatusSnapshotRow } from '@/lib/database.types';

export interface CaseDetail {
  case: CaseRow;
  events: CaseEventRow[];
  snapshot: StatusSnapshotRow | null;
  processingTime: ProcessingTimeRow | null;
  pendingDetails: PendingDetailRow[];
  stageEstimate: StageEstimateDisplay | null;
}

async function fetchCaseDetail(caseId: string): Promise<CaseDetail> {
  const [{ data: caseRow, error: caseError }, { data: events }, { data: snapshot }, { data: pendingDetails }] =
    await Promise.all([
      supabase.from('cases').select('*').eq('id', caseId).single(),
      supabase.from('case_events').select('*').eq('case_id', caseId).order('occurred_on', { ascending: true }),
      supabase
        .from('status_snapshots')
        .select('*')
        .eq('case_id', caseId)
        .order('checked_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('pending_details').select('*').eq('case_id', caseId).is('answered_at', null),
    ]);

  if (caseError || !caseRow) {
    throw new Error(caseError?.message ?? 'Case not found');
  }

  const { data: processingTime } = await supabase
    .from('processing_times')
    .select('*')
    .eq('form_type', caseRow.form_type)
    .eq('office_code', caseRow.office_code ?? NATIONAL_OFFICE_CODE)
    .maybeSingle();

  const stageEstimate = await fetchStageEstimate(caseRow, events ?? [], processingTime ?? null);

  return {
    case: caseRow,
    events: events ?? [],
    snapshot: snapshot ?? null,
    processingTime: processingTime ?? null,
    pendingDetails: pendingDetails ?? [],
    stageEstimate,
  };
}

/**
 * "How much longer for people like you" (build brief follow-up,
 * 2026-07-30) — the paid-tier differentiator. Looks up the case's current
 * stage (its most recent already-happened event) and asks
 * get_stage_estimate how long similar anonymous cases took to reach a
 * decision from there. Null once a case is already decided.
 *
 * Two tiers, in order: a real personalized estimate once enough anonymous
 * cases exist (formatStageEstimate); otherwise a fallback anchored on
 * USCIS's own published range for this form+office (formatTypicalEstimate)
 * — which itself returns null once the case is already past that whole
 * range, deferring to the Ruler's own past-range message rather than
 * showing a second, possibly negative, "estimate."
 */
async function fetchStageEstimate(
  caseRow: CaseRow,
  events: CaseEventRow[],
  processingTime: ProcessingTimeRow | null,
): Promise<StageEstimateDisplay | null> {
  if (caseRow.state === 'decided') return null;

  const today = todayISO();
  const currentStage = [...events]
    .filter((e) => e.occurred_on <= today)
    .sort((a, b) => (a.occurred_on < b.occurred_on ? -1 : 1))
    .at(-1);
  if (!currentStage || currentStage.kind === 'decision') return null;

  const { data } = await supabase
    .rpc('get_stage_estimate', {
      p_form_type: caseRow.form_type,
      p_office_code: caseRow.office_code ?? NATIONAL_OFFICE_CODE,
      p_from_kind: currentStage.kind,
      p_to_kind: 'decision',
    })
    .maybeSingle();

  const personalized = formatStageEstimate(
    data ? { sampleSize: data.sample_size, medianDays: data.median_days } : null,
    currentStage.occurred_on,
  );
  if (personalized) return personalized;

  if (!processingTime) return null;
  return formatTypicalEstimate(
    { lowDays: processingTime.low_days, highDays: processingTime.high_days },
    caseRow.filed_on,
    today,
  );
}

export function useCaseDetail(caseId: string | undefined) {
  return useQuery({
    queryKey: ['case-detail', caseId],
    queryFn: () => fetchCaseDetail(caseId as string),
    enabled: Boolean(caseId),
  });
}
