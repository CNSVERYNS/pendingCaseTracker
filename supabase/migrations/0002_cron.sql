-- Wires pg_cron + pg_net to invoke poll-cases hourly. isDueForPoll() inside
-- the function decides per-case whether this tick actually calls USCIS, so
-- an hourly tick is just resolution, not load — the daily-quota constraint
-- (§5) is enforced by that adaptive check, not by this schedule.
--
-- Before running this migration against a real project:
--   1. Replace <project-ref> below with your Supabase project ref.
--   2. Store the service role key in Vault once:
--        select vault.create_secret('<your-service-role-key>', 'service_role_key');
--      (Supabase Studio's Vault UI can do this instead of raw SQL.)

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'poll-cases-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://tywbbmsdrbixaltjvgus.supabase.co/functions/v1/poll-cases',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
