// Deno Edge Function — the only place a case row is actually created
// (build brief §10 final step). Runs the same first status_snapshot +
// case_event + pending_details flow poll-cases uses, so day one looks the
// same as any later poll, but never touches status_snapshots from the
// client directly (that table stays server-write-only by design).
import { createClient } from 'npm:@supabase/supabase-js@2';

import { createUscisClient } from '../../../src/lib/uscis.ts';
import { classifyStatusChange } from '../../../src/lib/status-classifier.ts';
import { isValidReceiptNumber, normalizeReceiptNumber } from '../../../src/lib/receipt.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { sha256Hex } from '../_shared/hash.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const USCIS_BASE_URL = Deno.env.get('USCIS_BASE_URL')!;
const USCIS_CLIENT_ID = Deno.env.get('USCIS_CLIENT_ID')!;
const USCIS_CLIENT_SECRET = Deno.env.get('USCIS_CLIENT_SECRET')!;

const FORM_TYPES = ['I-485', 'I-765', 'I-130', 'N-400', 'I-131', 'I-751'];
const MILESTONE_KINDS = ['biometrics', 'interview_scheduled', 'interview', 'rfe'];

interface Milestone {
  kind: string;
  occurredOn: string;
  occurredAtTime?: string | null;
}

interface CreateCasePayload {
  receiptNumber: string;
  formType: string;
  officeCode: string | null;
  officeLabel: string | null;
  filedOn: string;
  milestones: Milestone[];
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabaseAsUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userError,
  } = await supabaseAsUser.auth.getUser();
  if (userError || !user) {
    return json({ error: 'unauthorized' }, 401);
  }

  let payload: CreateCasePayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid_payload' }, 400);
  }

  const receiptNumber = normalizeReceiptNumber(payload.receiptNumber ?? '');
  if (!isValidReceiptNumber(receiptNumber)) {
    return json({ error: 'invalid_receipt' }, 400);
  }
  if (!FORM_TYPES.includes(payload.formType)) {
    return json({ error: 'invalid_form_type' }, 400);
  }
  if (!payload.filedOn || !/^\d{4}-\d{2}-\d{2}$/.test(payload.filedOn)) {
    return json({ error: 'invalid_filed_on' }, 400);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: existing } = await admin
    .from('cases')
    .select('id')
    .eq('user_id', user.id)
    .eq('receipt_number', receiptNumber)
    .maybeSingle();
  if (existing) {
    return json({ caseId: existing.id, duplicate: true });
  }

  const { data: newCase, error: insertError } = await admin
    .from('cases')
    .insert({
      user_id: user.id,
      receipt_number: receiptNumber,
      form_type: payload.formType,
      office_code: payload.officeCode ?? null,
      office_label: payload.officeLabel ?? null,
      filed_on: payload.filedOn,
    })
    .select('id')
    .single();

  if (insertError || !newCase) {
    return json({ error: 'insert_failed' }, 500);
  }

  const milestones = (payload.milestones ?? []).filter((m) => MILESTONE_KINDS.includes(m.kind));
  await admin.from('case_events').insert([
    { case_id: newCase.id, kind: 'filed', occurred_on: payload.filedOn, source: 'manual' },
    ...milestones.map((m) => ({
      case_id: newCase.id,
      kind: m.kind,
      occurred_on: m.occurredOn,
      occurred_at_time: m.occurredAtTime ?? null,
      source: 'manual',
    })),
  ]);

  // Best-effort initial status fetch — a USCIS outage never blocks case
  // creation (§10). If this fails, poll-cases picks the case up on its next
  // tick anyway, since last_polled_at is still null.
  try {
    const uscis = createUscisClient({
      baseUrl: USCIS_BASE_URL,
      clientId: USCIS_CLIENT_ID,
      clientSecret: USCIS_CLIENT_SECRET,
    });
    const status = await uscis.fetchCaseStatus(receiptNumber);
    const statusTextHash = await sha256Hex(status.statusText);
    const now = new Date().toISOString();

    await admin.from('status_snapshots').insert({
      case_id: newCase.id,
      status_title: status.statusTitle,
      status_text_hash: statusTextHash,
      checked_at: now,
    });
    await admin.from('cases').update({ last_polled_at: now }).eq('id', newCase.id);

    const classification = classifyStatusChange(status.statusTitle, status.statusText);
    const alreadyProvided = milestones.some((m) => m.kind === classification.eventKind);
    const currentOccurredOn = now.slice(0, 10);

    await admin.from('case_events').insert({
      case_id: newCase.id,
      kind: classification.eventKind,
      label: status.statusTitle,
      occurred_on: currentOccurredOn,
      source: 'poll',
    });

    // Backfill the receipt's real history (build brief follow-up, 2026-07-29):
    // hist_case_status is the full milestone trail to date, already present
    // on this very first lookup — not something Pending has to accumulate
    // over future polls. Skip the entry that's just a restatement of the
    // "current status" row inserted above (same day, same classified kind —
    // USCIS's own history list ends with the case's current status).
    const historyEvents = status.history
      .filter((h) => !(h.occurredOn === currentOccurredOn && classifyStatusChange('', h.label).eventKind === classification.eventKind))
      .map((h) => ({
        case_id: newCase.id,
        kind: classifyStatusChange('', h.label).eventKind,
        label: h.label,
        occurred_on: h.occurredOn,
        source: 'uscis_history' as const,
      }));
    if (historyEvents.length > 0) {
      await admin.from('case_events').insert(historyEvents);
    }

    if (classification.isDecision) {
      await admin.from('cases').update({ state: 'decided' }).eq('id', newCase.id);
    }
    if (classification.pendingDetailKind && !alreadyProvided) {
      await admin.from('pending_details').insert({
        case_id: newCase.id,
        kind: classification.pendingDetailKind,
        asked_at: now,
      });
    }
  } catch {
    // See comment above — silent by design.
  }

  return json({ caseId: newCase.id });
});
