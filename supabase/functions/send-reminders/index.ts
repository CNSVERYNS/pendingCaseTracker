// Deno Edge Function — fires the reminders build brief §6 promises, once
// each, at 9am in the user's own timezone. Run hourly by pg_cron; the local
// 9am check (not the cron cadence) is what makes the timing exact per user.
//
// The `reminders` table only stores kind + due_on (§4's schema has no
// message/severity column), so the exact copy is regenerated here by
// re-running computeDeadlines with today = due_on — the same deterministic
// function that created the row in the first place, avoiding any duplicated
// or drifting copy between compute time and send time.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { computeDeadlines, type DeadlineEventInput, type DeadlineKind } from '../../../src/lib/deadlines.ts';
import { sendExpoPush } from '../_shared/expo-push.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const NATIONAL_OFFICE_CODE = 'NATIONAL';
const LOCAL_SEND_HOUR = 9;

interface ReminderRow {
  id: string;
  case_id: string;
  kind: DeadlineKind;
  due_on: string;
  cases: {
    form_type: 'I-485' | 'I-765' | 'I-130' | 'N-400' | 'I-131' | 'I-751';
    office_code: string | null;
    filed_on: string;
    state: 'active' | 'decided' | 'archived';
    user_id: string;
    users: { timezone: string; push_token: string | null };
  };
}

function localDateAndHour(nowUtc: Date, timeZone: string): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(nowUtc);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return { date: `${map.year}-${map.month}-${map.day}`, hour: Number(map.hour) };
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const nowUtc = new Date();
  // Generous UTC prefilter (timezones run up to UTC+14) — the precise,
  // per-user check happens below using each user's actual timezone.
  const utcSlack = new Date(nowUtc.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: reminders, error } = await supabase
    .from('reminders')
    .select(
      'id, case_id, kind, due_on, cases!inner(form_type, office_code, filed_on, state, user_id, users!inner(timezone, push_token))',
    )
    .is('fired_at', null)
    .lte('due_on', utcSlack)
    // Once a case is decided, reminders stop (§13) — rows for it are simply
    // never considered again rather than needing explicit cleanup.
    .eq('cases.state', 'active')
    .returns<ReminderRow[]>();

  if (error || !reminders) {
    return new Response(JSON.stringify({ error: error?.message ?? 'failed to load reminders' }), { status: 500 });
  }

  const eventsByCaseId = new Map<string, DeadlineEventInput[]>();
  const rangeByCaseId = new Map<string, { lowDays: number; highDays: number } | null>();
  let fired = 0;

  for (const r of reminders) {
    const { date: localDate, hour: localHour } = localDateAndHour(nowUtc, r.cases.users.timezone);
    const isDue = localDate > r.due_on || (localDate === r.due_on && localHour >= LOCAL_SEND_HOUR);
    if (!isDue || !r.cases.users.push_token) continue;

    if (!eventsByCaseId.has(r.case_id)) {
      const { data: events } = await supabase
        .from('case_events')
        .select('kind, source, occurred_on')
        .eq('case_id', r.case_id);
      eventsByCaseId.set(
        r.case_id,
        (events ?? []).map((e) => ({ kind: e.kind, source: e.source, occurredOn: e.occurred_on }) as DeadlineEventInput),
      );

      const { data: processingTime } = await supabase
        .from('processing_times')
        .select('low_days, high_days')
        .eq('form_type', r.cases.form_type)
        .eq('office_code', r.cases.office_code ?? NATIONAL_OFFICE_CODE)
        .maybeSingle();
      rangeByCaseId.set(
        r.case_id,
        processingTime ? { lowDays: processingTime.low_days, highDays: processingTime.high_days } : null,
      );
    }

    const results = computeDeadlines({
      formType: r.cases.form_type,
      filedOn: r.cases.filed_on,
      state: r.cases.state,
      events: eventsByCaseId.get(r.case_id) ?? [],
      processingRange: rangeByCaseId.get(r.case_id) ?? null,
      eadEndOn: null,
      today: r.due_on,
    });

    const match = results.find((res) => res.kind === r.kind && res.dueOn === r.due_on);
    if (!match) continue;

    await sendExpoPush(r.cases.users.push_token, 'Pending', match.message, { caseId: r.case_id });
    await supabase.from('reminders').update({ fired_at: new Date().toISOString() }).eq('id', r.id);
    fired += 1;
  }

  return new Response(JSON.stringify({ considered: reminders.length, fired }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
