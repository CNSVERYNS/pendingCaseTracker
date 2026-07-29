-- Wires pg_cron for the reminder pipeline (build brief §6/§8):
--   compute-reminders — daily, keeps the `reminders` table's future schedule
--     current as events/processing-time data change.
--   send-reminders — hourly, fires any reminder whose due_on has reached
--     9am in that user's own timezone (see function body for why hourly
--     cron + a local-time check, rather than one cron per timezone).
--
-- Same placeholders as 0002_cron.sql: replace <project-ref> and ensure the
-- `service_role_key` Vault secret exists before running this migration.

select cron.schedule(
  'compute-reminders-daily',
  '0 3 * * *',
  $$
  select net.http_post(
    url := 'https://tywbbmsdrbixaltjvgus.supabase.co/functions/v1/compute-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'send-reminders-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://tywbbmsdrbixaltjvgus.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
