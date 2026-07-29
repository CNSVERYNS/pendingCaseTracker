# Pending

A calm, well-designed place to watch your USCIS case — a mobile app (Expo/React Native + Supabase) that tells you what your waiting time actually means and never lets you miss a deadline.

Pending is not affiliated with USCIS or any government agency, and is not a law firm.

## Stack

- **App:** Expo (React Native) + TypeScript, expo-router, TanStack Query
- **Backend:** Supabase — Postgres, Auth (email magic link), Edge Functions, pg_cron
- **Push:** expo-notifications
- **Tests:** Vitest, covering `src/lib/*` (USCIS client, deadline engine, office resolver, timeline logic, etc.)

The client never talks to USCIS directly — all external calls happen in Supabase Edge Functions (`supabase/functions/`).

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your Supabase project URL/anon key (app) and service role key (seed script only — never shipped to the client).

3. Apply the database schema: run the SQL files in `supabase/migrations/` against your Supabase project (in order), or use the Supabase CLI:

   ```bash
   supabase db push
   ```

4. Deploy the Edge Functions in `supabase/functions/` (`poll-cases`, `lookup-case`, `create-case`, `compute-reminders`, `send-reminders`, `delete-account`), and set their secrets from `supabase/functions/.env.example` (USCIS sandbox credentials included).

5. Start the app:

   ```bash
   npx expo start
   ```

## Scripts

- `npm run test` — run the Vitest suite once
- `npm run test:watch` — watch mode
- `npm run lint` — Expo/ESLint
- `npm run seed` — seed a test user with fake cases covering every major case state (fresh filing, past typical range, interview scheduled, RFE outstanding, transferred, approved, denied). Requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`.

## Project layout

```
src/app/            expo-router screens (auth, onboarding, case detail, cases list, settings)
src/components/      UI components, organized by screen area (home/, share/)
src/lib/             business logic — pure, unit-tested modules plus Supabase/notifications glue
src/constants/       design tokens (theme.ts) and all user-facing copy (strings.ts)
supabase/migrations/ SQL schema + RLS policies
supabase/functions/  Edge Functions (Deno) — the only code that talks to USCIS or has service-role access
scripts/seed.ts      test-data seeding script
```
