-- Adds phone sign-in alongside email (build brief follow-up, 2026-07-29):
-- a user can now exist with an email, a phone, or both, so public.users.email
-- can no longer be not-null, and a phone column mirrors auth.users.phone the
-- same way email already does.

alter table public.users
  alter column email drop not null;

alter table public.users
  add column phone text;

alter table public.users
  add constraint users_email_or_phone_check
  check (email is not null or phone is not null);

-- Replaces the email-only version from 0001_init.sql.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, phone)
  values (new.id, new.email, new.phone)
  on conflict (id) do nothing;
  return new;
end;
$$;
