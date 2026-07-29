import { useQuery } from '@tanstack/react-query';

import { NATIONAL_OFFICE_CODE } from '@/lib/office-resolver';
import { supabase } from '@/lib/supabase';
import type { CaseEventRow, CaseRow, PendingDetailRow, ProcessingTimeRow, StatusSnapshotRow } from '@/lib/database.types';

export interface CaseDetail {
  case: CaseRow;
  events: CaseEventRow[];
  snapshot: StatusSnapshotRow | null;
  processingTime: ProcessingTimeRow | null;
  pendingDetails: PendingDetailRow[];
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

  return {
    case: caseRow,
    events: events ?? [],
    snapshot: snapshot ?? null,
    processingTime: processingTime ?? null,
    pendingDetails: pendingDetails ?? [],
  };
}

export function useCaseDetail(caseId: string | undefined) {
  return useQuery({
    queryKey: ['case-detail', caseId],
    queryFn: () => fetchCaseDetail(caseId as string),
    enabled: Boolean(caseId),
  });
}
