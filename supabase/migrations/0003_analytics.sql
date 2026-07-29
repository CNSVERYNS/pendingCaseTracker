-- First-party product analytics (build brief §11). Exactly four event
-- names, no case content, no third-party SDK. Clients may only insert their
-- own events — reading back is an admin/service-role concern.

create table public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  event_name text not null check (
    event_name in ('case_added', 'notifications_enabled', 'detail_prompt_answered', 'share_card_exported')
  ),
  created_at timestamptz not null default now()
);

create index analytics_events_event_name_idx on public.analytics_events (event_name, created_at);

alter table public.analytics_events enable row level security;

create policy "analytics_events_insert_own" on public.analytics_events
  for insert to authenticated
  with check (auth.uid() = user_id);

-- No select/update/delete for clients — counts are pulled by an admin
-- dashboard using the service role, not by the app itself.
revoke select, update, delete on public.analytics_events from authenticated;
