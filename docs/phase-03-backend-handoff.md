# Phase 03 Backend Handoff

This handoff is scoped to `PRD/phase-03-database-backend.md` only.

## Target Project

- Supabase URL: `https://gnrjqqoidzuwzvhhfggh.supabase.co`
- Project ref: `gnrjqqoidzuwzvhhfggh`

## Repo Artifacts

- Migration: `supabase/migrations/20260530163230_phase_03_database_backend.sql`
- Edge Function: `supabase/functions/identify-plant/index.ts`
- Function config: `supabase/config.toml`
- Database types: `types/database.ts`
- App wrapper: `lib/api/identifyPlant.ts`
- Verification SQL: `supabase/verification/phase_03_checks.sql`

## Apply Through Supabase MCP

When the connected Supabase MCP account can access the Leaflet project:

1. Apply the migration named `phase_03_database_backend` using the migration SQL file.
2. Deploy `identify-plant` with JWT verification enabled.
3. Generate TypeScript database types from the live project and replace `types/database.ts` if the generated output differs.
4. Run security and performance advisors.
5. Run the verification queries in `supabase/verification/phase_03_checks.sql`.

## Apply Through Supabase CLI

Use this only if MCP access is unavailable but CLI access is available.

```powershell
npx supabase login
npx supabase link --project-ref gnrjqqoidzuwzvhhfggh
npx supabase db push
npx supabase functions deploy identify-plant
npx supabase gen types typescript --project-id gnrjqqoidzuwzvhhfggh --schema public > types/database.ts
```

Then run advisors:

```powershell
npx supabase db advisors --type security
npx supabase db advisors --type performance
```

## Manual Secrets

Set `OPENAI_API_KEY` in Supabase Edge Function secrets before Phase 04 begins. Do not put it in `.env`, Expo public env vars, or committed files.

CLI option:

```powershell
npx supabase secrets set OPENAI_API_KEY=your_openai_api_key --project-ref gnrjqqoidzuwzvhhfggh
```

Dashboard option:

1. Open Supabase Dashboard.
2. Select project `gnrjqqoidzuwzvhhfggh`.
3. Go to Edge Functions secrets.
4. Add `OPENAI_API_KEY`.

## Required Authenticated Verification

Use two real Supabase Auth users after Phase 02 provider setup is working:

1. User A inserts a `user_plants` row with `user_id = User A id`; it should succeed.
2. User B selects `user_plants`; User A's row should not appear.
3. User B inserts a `user_plants` row with `user_id = User A id`; it should fail RLS.
4. Authenticated users can select `species` and `scan_cache`.
5. Authenticated users cannot insert, update, or delete `species` or `scan_cache`.
6. User A uploads `plant-photos/{user_a}/{user_plant_id}/{timestamp}.jpg`; it should succeed.
7. User B cannot list, overwrite, or delete User A's storage objects.
8. An authenticated POST to `identify-plant` with `imageBase64` and `scanType` returns the placeholder response.

## Current Blocker

The connected Supabase MCP account cannot access `gnrjqqoidzuwzvhhfggh`. Project calls currently return `You do not have permission to perform this action`, and the project does not appear in the MCP project list.
