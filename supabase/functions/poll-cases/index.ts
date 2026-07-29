// Deno Edge Function — invoked on a schedule by pg_cron (see
// supabase/migrations/0002_cron.sql). Polls every active case whose adaptive
// schedule (build brief §5) says it's due, records any status change, and
// creates the one detail-capture question a change might trigger (§7).
//
// Imports the same TypeScript modules the app is unit-tested against
// (src/lib/*) rather than re-implementing this logic in Deno — those files
// have no React Native dependency, so they run unmodified here. NOTE: a
// couple of them carry `import type` references to `@/lib/database.types`
// via the app's path alias, which Deno cannot resolve as a real path; this
// is safe because type-only imports are erased before execution and Deno's
// edge runtime transpiles rather than type-checks, but verify with
// `supabase functions serve poll-cases` before relying on it in production.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { createUscisClient, type UscisApiCallEvent } from '../../../src/lib/uscis.ts';
import { classifyStatusChange } from '../../../src/lib/status-classifier.ts';
import { isDueForPoll, type ProcessingRange } from '../../../src/lib/polling-schedule.ts';
import { sha256Hex } from '../_shared/hash.ts';
import { sendExpoPush } from '../_shared/expo-push.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const USCIS_BASE_URL = Deno.env.get('USCIS_BASE_URL')!;
const USCIS_CLIENT_ID = Deno.env.get('USCIS_CLIENT_ID')!;
const USCIS_CLIENT_SECRET = Deno.env.get('USCIS_CLIENT_SECRET')!;

const NATIONAL_OFFICE_CODE = 'NATIONAL';

interface CaseRow {
  id: string;
  user_id: string;
  receipt_number: string;
  form_type: 'I-485' | 'I-765' | 'I-130' | 'N-400' | 'I-131' | 'I-751';
  office_code: string | null;
  filed_on: string;
  state: 'active' | 'decided' | 'archived';
  last_polled_at: string | null;
}

const ANNOUNCE_BY_KIND: Record<string, string> = {
  interview_scheduled: 'Your interview was scheduled.',
  biometrics_scheduled: 'Your biometrics appointment was scheduled.',
  rfe: 'USCIS requested additional evidence.',
  transferred: 'Your case was transferred to a new office.',
  card_mailed: 'Your card was mailed.',
};

const FOLLOW_UP_BY_PENDING_KIND: Record<string, string> = {
  interview_date: 'Add the date so we can remind you.',
  biometrics_date: 'Add the date so we can remind you.',
  rfe_deadline: 'Add the response deadline so we can remind you.',
  office_reresolve: 'Update your ZIP so we can show the right range.',
  notice_mailed: 'Tell us which notice so we can track it.',
};

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const uscis = createUscisClient({
    baseUrl: USCIS_BASE_URL,
    clientId: USCIS_CLIENT_ID,
    clientSecret: USCIS_CLIENT_SECRET,
    onApiCall: (event: UscisApiCallEvent) => {
      // Fire-and-forget quota log — never blocks the poll on logging failure.
      void supabase.from('uscis_api_calls').insert({
        endpoint: event.endpoint,
        status_code: event.statusCode,
        ok: event.ok,
        attempt: event.attempt,
        called_at: event.calledAt,
      });
    },
  });

  const { data: cases, error: casesError } = await supabase
    .from('cases')
    .select('id, user_id, receipt_number, form_type, office_code, filed_on, state, last_polled_at')
    .eq('state', 'active')
    .returns<CaseRow[]>();

  if (casesError || !cases) {
    return new Response(JSON.stringify({ error: casesError?.message ?? 'failed to load cases' }), { status: 500 });
  }

  const now = new Date().toISOString();
  const results: Array<{ caseId: string; polled: boolean; changed?: boolean; error?: string }> = [];

  for (const c of cases) {
    const { data: lastEvent } = await supabase
      .from('case_events')
      .select('occurred_on')
      .eq('case_id', c.id)
      .order('occurred_on', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: processingTime } = await supabase
      .from('processing_times')
      .select('low_days, high_days')
      .eq('form_type', c.form_type)
      .eq('office_code', c.office_code ?? NATIONAL_OFFICE_CODE)
      .maybeSingle();

    const processingRange: ProcessingRange | null = processingTime
      ? { lowDays: processingTime.low_days, highDays: processingTime.high_days }
      : null;

    const due = isDueForPoll({
      state: c.state,
      filedOn: c.filed_on,
      lastEventOn: lastEvent?.occurred_on ?? null,
      lastPolledAt: c.last_polled_at,
      processingRange,
      now,
    });

    if (!due) {
      results.push({ caseId: c.id, polled: false });
      continue;
    }

    try {
      const status = await uscis.fetchCaseStatus(c.receipt_number);
      const statusTextHash = await sha256Hex(status.statusText);

      const { data: latestSnapshot } = await supabase
        .from('status_snapshots')
        .select('status_title, status_text_hash')
        .eq('case_id', c.id)
        .order('checked_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const changed =
        !latestSnapshot ||
        latestSnapshot.status_title !== status.statusTitle ||
        latestSnapshot.status_text_hash !== statusTextHash;

      await supabase.from('status_snapshots').insert({
        case_id: c.id,
        status_title: status.statusTitle,
        status_text_hash: statusTextHash,
        checked_at: now,
      });

      if (changed) {
        const classification = classifyStatusChange(status.statusTitle, status.statusText);
        const today = now.slice(0, 10);

        await supabase.from('case_events').insert({
          case_id: c.id,
          kind: classification.eventKind,
          label: status.statusTitle,
          occurred_on: today,
          source: 'poll',
        });

        if (classification.isDecision) {
          await supabase.from('cases').update({ state: 'decided' }).eq('id', c.id);
        }

        if (classification.eventKind === 'transferred') {
          // The old office's range is no longer valid — fall back to the
          // national range until the re-resolve prompt is answered (§8).
          await supabase.from('cases').update({ office_code: null, office_label: null }).eq('id', c.id);
        }

        if (classification.pendingDetailKind) {
          await supabase.from('pending_details').insert({
            case_id: c.id,
            kind: classification.pendingDetailKind,
            asked_at: now,
          });
        }

        const { data: user } = await supabase.from('users').select('push_token').eq('id', c.user_id).maybeSingle();
        if (user?.push_token) {
          const announce = ANNOUNCE_BY_KIND[classification.eventKind] ?? `Your case status changed: ${status.statusTitle}.`;
          const followUp = classification.pendingDetailKind
            ? FOLLOW_UP_BY_PENDING_KIND[classification.pendingDetailKind]
            : undefined;
          await sendExpoPush(
            user.push_token,
            'Pending',
            followUp ? `${announce} ${followUp}` : announce,
            { caseId: c.id },
          );
        }
      }

      await supabase.from('cases').update({ last_polled_at: now }).eq('id', c.id);
      results.push({ caseId: c.id, polled: true, changed });
    } catch (err) {
      // A failed poll never touches status_snapshots/case_events — the
      // previous snapshot survives untouched. We still bump last_polled_at
      // so a persistently failing case retries on the same adaptive cadence
      // as everyone else, instead of hammering it every cron tick.
      await supabase.from('cases').update({ last_polled_at: now }).eq('id', c.id);
      results.push({ caseId: c.id, polled: true, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return new Response(JSON.stringify({ checked: cases.length, results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
