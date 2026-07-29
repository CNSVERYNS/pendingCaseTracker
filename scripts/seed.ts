/**
 * Seeds one test user with fake cases covering the states called out in the
 * build brief's quality bar (§16): fresh filing, past typical range,
 * interview scheduled, RFE outstanding, transferred, approved, denied.
 *
 * Uses the admin API (service role key) so it can create both the auth user
 * and rows that RLS would otherwise block from a normal client. Safe to
 * re-run — it looks up the seed user by email instead of creating a
 * duplicate each time.
 *
 * Usage: npm run seed   (reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from .env)
 */
import { createClient } from '@supabase/supabase-js';

import type { CaseEventKind, CaseEventSource, FormType } from '../src/lib/database.types';

// Mirrors NATIONAL_OFFICE_CODE in src/lib/office-resolver.ts. Inlined rather
// than imported so this Node script doesn't need cross-runtime import
// resolution for one constant (see tsconfig.json: scripts/ still type-checks
// under the app's Metro-oriented config, which disallows `.ts`-suffixed
// imports).
const NATIONAL_OFFICE_CODE = 'NATIONAL';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env) before running the seed script.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const SEED_EMAIL = 'seed@pending.test';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function daysFromNow(n: number): string {
  return daysAgo(-n);
}

interface SeedEvent {
  kind: CaseEventKind;
  label?: string;
  occurredOn: string;
  source: CaseEventSource;
}

interface SeedCase {
  receiptNumber: string;
  formType: FormType;
  officeCode: string | null;
  officeLabel: string | null;
  filedOn: string;
  nickname: string;
  state: 'active' | 'decided' | 'archived';
  statusTitle: string;
  events: SeedEvent[];
  pendingDetail?: { kind: 'rfe_deadline' | 'office_reresolve' | 'interview_date' | 'biometrics_date' | 'notice_mailed' };
}

// National-range approximations, researched 2026-07-29 by cross-referencing
// several third-party processing-time trackers (immigrationdirect.com,
// boundless.com, and others aggregating USCIS's published monthly figures —
// USCIS's own live API at egov.uscis.gov/processing-times sits behind bot
// protection that blocked direct fetching this session). Converted from
// the commonly-cited month ranges at 30 days/month. These are still
// approximate and go stale — USCIS republishes monthly — so treat this as
// a reasonable dev/seed baseline, not a production data source; a real
// sync job against the official tool is the eventual replacement.
const PROCESSING_TIMES: { formType: FormType; officeCode: string; lowDays: number; highDays: number }[] = [
  { formType: 'I-485', officeCode: NATIONAL_OFFICE_CODE, lowDays: 360, highDays: 600 }, // ~12-20 months
  { formType: 'I-765', officeCode: NATIONAL_OFFICE_CODE, lowDays: 120, highDays: 240 }, // ~4-8 months
  { formType: 'I-130', officeCode: NATIONAL_OFFICE_CODE, lowDays: 360, highDays: 540 }, // ~12-18 months
  { formType: 'N-400', officeCode: NATIONAL_OFFICE_CODE, lowDays: 240, highDays: 420 }, // ~8-14 months
  { formType: 'I-131', officeCode: NATIONAL_OFFICE_CODE, lowDays: 120, highDays: 360 }, // ~4-12 months
  { formType: 'I-751', officeCode: NATIONAL_OFFICE_CODE, lowDays: 480, highDays: 840 }, // ~16-28 months
  // Office-specific rows for the seed cases below — illustrative variation
  // on the national range, not sourced per-office (that data is even harder
  // to get in bulk than the national figures; see the module note above).
  { formType: 'I-130', officeCode: 'CSC', lowDays: 360, highDays: 540 },
  { formType: 'I-130', officeCode: 'NBC', lowDays: 400, highDays: 580 },
  { formType: 'N-400', officeCode: 'NYC', lowDays: 270, highDays: 450 },
  { formType: 'I-765', officeCode: 'VSC', lowDays: 90, highDays: 200 },
  { formType: 'I-131', officeCode: 'TSC', lowDays: 100, highDays: 300 },
];

const SEED_CASES: SeedCase[] = [
  {
    receiptNumber: 'IOE0900000001',
    formType: 'I-485',
    officeCode: null,
    officeLabel: null,
    filedOn: daysAgo(9),
    nickname: 'Fresh filing',
    state: 'active',
    statusTitle: 'Case Was Received',
    events: [{ kind: 'filed', occurredOn: daysAgo(9), source: 'manual' }],
  },
  {
    receiptNumber: 'WAC0900000002',
    formType: 'I-130',
    officeCode: 'CSC',
    officeLabel: 'California Service Center',
    filedOn: daysAgo(600), // past the CSC I-130 range's high end (540 days)
    nickname: 'Past typical range',
    state: 'active',
    statusTitle: 'Case Is Taking Longer Than Usual',
    events: [
      { kind: 'filed', occurredOn: daysAgo(600), source: 'manual' },
      { kind: 'other', label: 'Case Is Taking Longer Than Usual', occurredOn: daysAgo(2), source: 'poll' },
    ],
  },
  {
    receiptNumber: 'IOE0900000003',
    formType: 'N-400',
    officeCode: 'NYC',
    officeLabel: 'New York City Field Office',
    filedOn: daysAgo(180),
    nickname: 'Interview scheduled',
    state: 'active',
    statusTitle: 'Interview Was Scheduled',
    events: [
      { kind: 'filed', occurredOn: daysAgo(180), source: 'manual' },
      { kind: 'biometrics_scheduled', label: 'Biometrics Appointment Was Scheduled', occurredOn: daysAgo(150), source: 'poll' },
      { kind: 'biometrics', occurredOn: daysAgo(130), source: 'manual' },
      { kind: 'interview_scheduled', label: 'Interview Was Scheduled', occurredOn: daysAgo(5), source: 'poll' },
      { kind: 'interview', occurredOn: daysFromNow(17), source: 'manual' },
    ],
  },
  {
    receiptNumber: 'EAC0900000004',
    formType: 'I-765',
    officeCode: 'VSC',
    officeLabel: 'Vermont Service Center',
    filedOn: daysAgo(45),
    nickname: 'RFE outstanding',
    state: 'active',
    statusTitle: 'Request for Evidence Was Sent',
    events: [
      { kind: 'filed', occurredOn: daysAgo(45), source: 'manual' },
      { kind: 'rfe', label: 'Request for Evidence Was Sent', occurredOn: daysAgo(6), source: 'poll' },
    ],
    pendingDetail: { kind: 'rfe_deadline' },
  },
  {
    receiptNumber: 'LIN0900000005',
    formType: 'I-751',
    officeCode: null,
    officeLabel: null,
    filedOn: daysAgo(210),
    nickname: 'Transferred',
    state: 'active',
    statusTitle: 'Case Was Transferred And A New Office Has Jurisdiction',
    events: [
      { kind: 'filed', occurredOn: daysAgo(210), source: 'manual' },
      {
        kind: 'transferred',
        label: 'Case Was Transferred And A New Office Has Jurisdiction',
        occurredOn: daysAgo(3),
        source: 'poll',
      },
    ],
    pendingDetail: { kind: 'office_reresolve' },
  },
  {
    receiptNumber: 'SRC0900000006',
    formType: 'I-131',
    officeCode: 'TSC',
    officeLabel: 'Texas Service Center',
    filedOn: daysAgo(95),
    nickname: 'Approved',
    state: 'decided',
    statusTitle: 'Case Was Approved',
    events: [
      { kind: 'filed', occurredOn: daysAgo(95), source: 'manual' },
      { kind: 'decision', label: 'Case Was Approved', occurredOn: daysAgo(1), source: 'poll' },
    ],
  },
  {
    receiptNumber: 'MSC0900000007',
    formType: 'I-130',
    officeCode: 'NBC',
    officeLabel: 'National Benefits Center',
    filedOn: daysAgo(410),
    nickname: 'Denied',
    state: 'decided',
    statusTitle: 'Case Was Denied',
    events: [
      { kind: 'filed', occurredOn: daysAgo(410), source: 'manual' },
      { kind: 'decision', label: 'Case Was Denied', occurredOn: daysAgo(4), source: 'poll' },
    ],
  },
];

async function getOrCreateSeedUser(): Promise<string> {
  const { data: existing } = await supabase.auth.admin.listUsers();
  const found = existing?.users.find((u) => u.email === SEED_EMAIL);
  if (found) return found.id;

  const { data, error } = await supabase.auth.admin.createUser({
    email: SEED_EMAIL,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`Failed to create seed user: ${error?.message}`);
  }
  return data.user.id;
}

async function main() {
  const userId = await getOrCreateSeedUser();
  await supabase.from('users').upsert({ id: userId, email: SEED_EMAIL, timezone: 'America/New_York' });

  for (const row of PROCESSING_TIMES) {
    await supabase.from('processing_times').upsert({
      form_type: row.formType,
      office_code: row.officeCode,
      low_days: row.lowDays,
      high_days: row.highDays,
    });
  }

  for (const seedCase of SEED_CASES) {
    const { data: existingCase } = await supabase
      .from('cases')
      .select('id')
      .eq('user_id', userId)
      .eq('receipt_number', seedCase.receiptNumber)
      .maybeSingle();

    const caseId =
      existingCase?.id ??
      (
        await supabase
          .from('cases')
          .insert({
            user_id: userId,
            receipt_number: seedCase.receiptNumber,
            form_type: seedCase.formType,
            office_code: seedCase.officeCode,
            office_label: seedCase.officeLabel,
            filed_on: seedCase.filedOn,
            nickname: seedCase.nickname,
            state: seedCase.state,
            last_polled_at: new Date().toISOString(),
          })
          .select('id')
          .single()
      ).data?.id;

    if (!caseId) {
      console.error(`Failed to create case ${seedCase.receiptNumber}`);
      continue;
    }

    await supabase.from('case_events').delete().eq('case_id', caseId);
    await supabase.from('case_events').insert(
      seedCase.events.map((e) => ({
        case_id: caseId,
        kind: e.kind,
        label: e.label ?? null,
        occurred_on: e.occurredOn,
        source: e.source,
      })),
    );

    await supabase.from('status_snapshots').delete().eq('case_id', caseId);
    await supabase.from('status_snapshots').insert({
      case_id: caseId,
      status_title: seedCase.statusTitle,
      status_text_hash: 'seed-data-not-hashed',
      checked_at: new Date().toISOString(),
    });

    await supabase.from('pending_details').delete().eq('case_id', caseId);
    if (seedCase.pendingDetail) {
      await supabase.from('pending_details').insert({
        case_id: caseId,
        kind: seedCase.pendingDetail.kind,
        asked_at: new Date().toISOString(),
      });
    }

    console.log(`Seeded ${seedCase.nickname} (${seedCase.receiptNumber})`);
  }

  console.log(`\nDone. Sign in as ${SEED_EMAIL} (magic link — check your Supabase Auth logs for the link in local dev).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
