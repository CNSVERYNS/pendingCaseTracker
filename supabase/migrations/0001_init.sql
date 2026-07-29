-- Pending — initial schema (build brief §4, §11).
-- RLS is scoped to auth.uid() on every user-owned table. The service_role
-- key (used only by Edge Functions / pg_cron, never shipped to the client)
-- bypasses RLS entirely by default in Supabase, so policies below only need
-- to cover the `authenticated` role.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  push_token text,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "users_select_own" on public.users
  for select to authenticated
  using (auth.uid() = id);

create policy "users_update_own" on public.users
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Populate public.users automatically when someone verifies a magic link.
create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- cases
-- ---------------------------------------------------------------------------

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  receipt_number text not null,
  form_type text not null check (form_type in ('I-485', 'I-765', 'I-130', 'N-400', 'I-131', 'I-751')),
  office_code text,
  office_label text,
  filed_on date not null,
  nickname text,
  state text not null default 'active' check (state in ('active', 'decided', 'archived')),
  -- Operational bookkeeping for adaptive polling (build brief §5). Not part
  -- of the public status a user ever sees.
  last_polled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint receipt_number_format check (receipt_number ~ '^[A-Z]{3}[0-9]{10}$'),
  unique (user_id, receipt_number)
);

create index cases_user_id_idx on public.cases (user_id);
create index cases_state_idx on public.cases (state);

alter table public.cases enable row level security;

create policy "cases_all_own" on public.cases
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- case_events — append-only timeline
-- ---------------------------------------------------------------------------

create table public.case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  kind text not null check (
    kind in (
      'filed', 'biometrics_scheduled', 'biometrics',
      'interview_scheduled', 'interview', 'rfe',
      'transferred', 'decision', 'card_mailed', 'other'
    )
  ),
  label text,
  occurred_on date not null,
  occurred_at_time time,
  source text not null check (source in ('manual', 'poll')),
  created_at timestamptz not null default now()
);

create index case_events_case_id_idx on public.case_events (case_id, occurred_on);

alter table public.case_events enable row level security;

create policy "case_events_select_own" on public.case_events
  for select to authenticated
  using (exists (select 1 from public.cases c where c.id = case_events.case_id and c.user_id = auth.uid()));

-- Clients may only ever record their own manual entries; poll-sourced rows
-- are written by the Edge Function via the service role, which bypasses RLS.
create policy "case_events_insert_manual_own" on public.case_events
  for insert to authenticated
  with check (
    source = 'manual'
    and exists (select 1 from public.cases c where c.id = case_events.case_id and c.user_id = auth.uid())
  );

-- No update/delete grants for `authenticated` — the timeline is append-only.
revoke update, delete on public.case_events from authenticated;

-- ---------------------------------------------------------------------------
-- status_snapshots
-- ---------------------------------------------------------------------------

create table public.status_snapshots (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  status_title text not null,
  status_text_hash text not null,
  checked_at timestamptz not null default now()
);

create index status_snapshots_case_id_idx on public.status_snapshots (case_id, checked_at desc);

alter table public.status_snapshots enable row level security;

create policy "status_snapshots_select_own" on public.status_snapshots
  for select to authenticated
  using (exists (select 1 from public.cases c where c.id = status_snapshots.case_id and c.user_id = auth.uid()));

-- Written only by the poll Edge Function (service role) — no client writes.
revoke insert, update, delete on public.status_snapshots from authenticated;

-- ---------------------------------------------------------------------------
-- pending_details — the one-question-at-a-time detail capture cards (§7)
-- ---------------------------------------------------------------------------

create table public.pending_details (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  kind text not null check (
    kind in ('interview_date', 'biometrics_date', 'notice_mailed', 'rfe_deadline', 'office_reresolve')
  ),
  asked_at timestamptz not null default now(),
  answered_at timestamptz,
  dismissed_at timestamptz
);

create index pending_details_case_id_idx on public.pending_details (case_id);

alter table public.pending_details enable row level security;

create policy "pending_details_select_own" on public.pending_details
  for select to authenticated
  using (exists (select 1 from public.cases c where c.id = pending_details.case_id and c.user_id = auth.uid()));

-- The client only ever flips answered_at/dismissed_at on a card it was shown.
-- Rows are created by the poll Edge Function when a status change triggers a question.
create policy "pending_details_update_own" on public.pending_details
  for update to authenticated
  using (exists (select 1 from public.cases c where c.id = pending_details.case_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.cases c where c.id = pending_details.case_id and c.user_id = auth.uid()));

revoke insert, delete, update on public.pending_details from authenticated;
grant update (answered_at, dismissed_at) on public.pending_details to authenticated;

-- ---------------------------------------------------------------------------
-- processing_times — reference data, one row per (form_type, office_code).
-- office_code = 'NATIONAL' is the fallback range shown before an office is
-- resolved (§8). Populated by an offline sync against USCIS's published
-- processing-time pages — not by app users.
-- ---------------------------------------------------------------------------

create table public.processing_times (
  form_type text not null check (form_type in ('I-485', 'I-765', 'I-130', 'N-400', 'I-131', 'I-751')),
  office_code text not null,
  low_days integer not null,
  high_days integer not null,
  updated_at timestamptz not null default now(),
  primary key (form_type, office_code)
);

alter table public.processing_times enable row level security;

create policy "processing_times_select_all" on public.processing_times
  for select to authenticated
  using (true);

revoke insert, update, delete on public.processing_times from authenticated;

-- ---------------------------------------------------------------------------
-- reminders — computed by lib/deadlines.ts, persisted so pg_cron can fire
-- pushes at 9am local time exactly once per (case, kind, due_on).
-- ---------------------------------------------------------------------------

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  kind text not null check (
    kind in ('rfe_response', 'interview', 'biometrics', 'inquiry_eligibility', 'ead_expiry')
  ),
  due_on date not null,
  fired_at timestamptz,
  created_at timestamptz not null default now(),
  unique (case_id, kind, due_on)
);

create index reminders_due_on_idx on public.reminders (due_on) where fired_at is null;

alter table public.reminders enable row level security;

create policy "reminders_select_own" on public.reminders
  for select to authenticated
  using (exists (select 1 from public.cases c where c.id = reminders.case_id and c.user_id = auth.uid()));

revoke insert, update, delete on public.reminders from authenticated;

-- ---------------------------------------------------------------------------
-- intervals — the anonymous "scheduled → appointment" moat (§7). No user_id,
-- no case_id, ever. RLS denies the `authenticated` role entirely; the only
-- way in is the SECURITY DEFINER function below, which by construction can
-- never accept a user or case reference.
-- ---------------------------------------------------------------------------

create table public.intervals (
  id uuid primary key default gen_random_uuid(),
  form_type text not null,
  office_code text not null,
  from_kind text not null,
  to_kind text not null,
  days integer not null,
  created_at timestamptz not null default now()
);

alter table public.intervals enable row level security;
-- Intentionally no policies: authenticated/anon have zero direct access.

create function public.record_interval(
  p_form_type text,
  p_office_code text,
  p_from_kind text,
  p_to_kind text,
  p_days integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_days < 0 or p_days > 3650 then
    return;
  end if;
  insert into public.intervals (form_type, office_code, from_kind, to_kind, days)
  values (p_form_type, p_office_code, p_from_kind, p_to_kind, p_days);
end;
$$;

grant execute on function public.record_interval(text, text, text, text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- uscis_api_calls — quota accounting log (§5). Operational only; not part of
-- the product data model, never exposed to clients.
-- ---------------------------------------------------------------------------

create table public.uscis_api_calls (
  id bigint generated always as identity primary key,
  case_id uuid references public.cases (id) on delete set null,
  endpoint text not null check (endpoint in ('token', 'case-status')),
  status_code integer,
  ok boolean not null,
  attempt integer not null,
  called_at timestamptz not null default now()
);

create index uscis_api_calls_called_at_idx on public.uscis_api_calls (called_at);

alter table public.uscis_api_calls enable row level security;
-- Intentionally no policies: service role (quota dashboards, ops) only.
