import { useQuery } from '@tanstack/react-query';

import { computeDaysWaiting } from '@/lib/case-clock';
import type { FormType } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { buildTimeline } from '@/lib/timeline';

export interface CaseListItem {
  id: string;
  formType: FormType;
  nickname: string | null;
  days: number;
  currentStepTitle: string;
}

async function fetchCasesList(): Promise<CaseListItem[]> {
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('cases')
    .select('id, form_type, nickname, filed_on, case_events(id, kind, source, label, occurred_on, occurred_at_time)')
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((c) => {
    const events = c.case_events.map((e) => ({ kind: e.kind, occurredOn: e.occurred_on }));
    const days = computeDaysWaiting(events, c.filed_on, today);

    const rows = buildTimeline(
      c.case_events.map((e) => ({
        id: e.id,
        kind: e.kind,
        source: e.source,
        label: e.label,
        occurredOn: e.occurred_on,
        occurredAtTime: e.occurred_at_time,
      })),
      today,
    );
    const current = rows.find((r) => r.status === 'current');

    return {
      id: c.id,
      formType: c.form_type,
      nickname: c.nickname,
      days,
      currentStepTitle: current?.title ?? '—',
    };
  });
}

export function useCasesList() {
  return useQuery({
    queryKey: ['cases-list'],
    queryFn: fetchCasesList,
  });
}
