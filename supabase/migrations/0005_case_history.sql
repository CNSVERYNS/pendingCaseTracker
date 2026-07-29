-- Allows case_events to carry USCIS's own hist_case_status milestones,
-- backfilled once at case-creation time (see supabase/functions/create-case)
-- so a case's timeline reflects its real history immediately instead of only
-- changes detected after the user added it to Pending.

alter table public.case_events
  drop constraint case_events_source_check;

alter table public.case_events
  add constraint case_events_source_check
  check (source in ('manual', 'poll', 'uscis_history'));
