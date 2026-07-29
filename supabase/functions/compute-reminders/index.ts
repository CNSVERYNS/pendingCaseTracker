// Deno Edge Function — persists lib/deadlines.ts's output into the
// `reminders` table (build brief §8/§6 build order). Run daily by pg_cron.
//
// computeDeadlines() returns every not-yet-passed threshold for a deadline
// in one call (e.g. an RFE deadline 40 days out already yields all five
// 30/14/7/3/1-day rows), so a single run captures the full future schedule;
// running it daily just keeps that schedule current as events change and
// keeps this idempotent (upsert, ignoreDuplicates) rather than fragile.
//
// KNOWN LIMITATION: if a manually-entered deadline is later corrected to an
// earlier date, the reminder rows computed against the old date are never
// deleted — only new/missing rows are added. A stale extra reminder could
// still fire. Acceptable for v1; revisit if deadline correction turns out
// to be common.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { computeDeadlines } from '../../../src/lib/deadlines.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const NATIONAL_OFFICE_CODE = 'NATIONAL';

interface CaseRow {
  id: string;
  form_type: 'I-485' | 'I-765' | 'I-130' | 'N-400' | 'I-131' | 'I-751';
  office_code: string | null;
  filed_on: string;
  state: 'active' | 'decided' | 'archived';
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const today = new Date().toISOString().slice(0, 10);

  const { data: cases, error } = await supabase
    .from('cases')
    .select('id, form_type, office_code, filed_on, state')
    .eq('state', 'active')
    .returns<CaseRow[]>();

  if (error || !cases) {
    return new Response(JSON.stringify({ error: error?.message ?? 'failed to load cases' }), { status: 500 });
  }

  let remindersConsidered = 0;

  for (const c of cases) {
    const { data: events } = await supabase.from('case_events').select('kind, source, occurred_on').eq('case_id', c.id);

    const { data: processingTime } = await supabase
      .from('processing_times')
      .select('low_days, high_days')
      .eq('form_type', c.form_type)
      .eq('office_code', c.office_code ?? NATIONAL_OFFICE_CODE)
      .maybeSingle();

    const results = computeDeadlines({
      formType: c.form_type,
      filedOn: c.filed_on,
      state: c.state,
      events: (events ?? []).map((e) => ({ kind: e.kind, source: e.source, occurredOn: e.occurred_on })),
      processingRange: processingTime ? { lowDays: processingTime.low_days, highDays: processingTime.high_days } : null,
      eadEndOn: null,
      today,
    });

    if (results.length === 0) continue;

    await supabase.from('reminders').upsert(
      results.map((r) => ({ case_id: c.id, kind: r.kind, due_on: r.dueOn })),
      { onConflict: 'case_id,kind,due_on', ignoreDuplicates: true },
    );
    remindersConsidered += results.length;
  }

  return new Response(JSON.stringify({ casesChecked: cases.length, remindersConsidered }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
