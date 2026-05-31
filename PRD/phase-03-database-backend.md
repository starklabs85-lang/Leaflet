# Phase 03 — Database & Backend Infrastructure

**Goal:** Set up the full Supabase Postgres schema, row-level security policies, Storage buckets, and Edge Function scaffold — the entire backend the app needs, ready for features to consume.

**Requirements covered:** FR-5 (collection storage), FR-6 (care schedules), FR-7 (care logs), FR-11 (cloud sync). Enables FR-2, FR-4 (Edge Function for OpenAI).

**Depends on:** Phase 02 (auth — users exist in Supabase Auth).

---

## What gets built

### 1. Postgres schema

Run these as Supabase migrations (via MCP or SQL editor).

#### `species` table (cache for AI-generated plant data)
```sql
create table species (
  id uuid primary key default gen_random_uuid(),
  common_name text not null,
  scientific_name text,
  description text,
  care_profile jsonb not null,
  -- care_profile structure:
  -- { light, water, soil, humidity, temperature, feeding, difficulty, toxicity }
  image_url text,
  created_at timestamptz default now()
);
```

#### `user_plants` table
```sql
create table user_plants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  species_id uuid references species(id),
  nickname text,
  location text,
  status text default 'healthy' check (status in ('healthy', 'needs_attention', 'sick')),
  photo_url text,
  date_added timestamptz default now(),
  created_at timestamptz default now()
);
```

#### `care_tasks` table
```sql
create table care_tasks (
  id uuid primary key default gen_random_uuid(),
  user_plant_id uuid references user_plants(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('water', 'fertilize', 'repot', 'prune', 'rotate', 'mist')),
  interval_days integer not null,
  next_due_date date not null,
  is_active boolean default true,
  created_at timestamptz default now()
);
```

#### `care_logs` table
```sql
create table care_logs (
  id uuid primary key default gen_random_uuid(),
  user_plant_id uuid references user_plants(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  task_type text not null,
  note text,
  photo_url text,
  logged_at timestamptz default now()
);
```

#### `diagnoses` table
```sql
create table diagnoses (
  id uuid primary key default gen_random_uuid(),
  user_plant_id uuid references user_plants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade not null,
  condition_name text not null,
  confidence numeric(3,2),
  cause text,
  treatment text,
  prevention text,
  photo_url text,
  follow_up_date date,
  created_at timestamptz default now()
);
```

#### `scan_cache` table (deduplication for OpenAI calls)
```sql
create table scan_cache (
  id uuid primary key default gen_random_uuid(),
  image_hash text unique not null,
  scan_type text not null check (scan_type in ('identify', 'diagnose')),
  result jsonb not null,
  created_at timestamptz default now()
);
```

### 2. Row-Level Security (RLS)

Enable RLS on all user-facing tables. The `species` and `scan_cache` tables are shared/public-read.

```sql
-- user_plants: users only see their own
alter table user_plants enable row level security;
create policy "Users manage own plants"
  on user_plants for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- care_tasks: users only see their own
alter table care_tasks enable row level security;
create policy "Users manage own tasks"
  on care_tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- care_logs: users only see their own
alter table care_logs enable row level security;
create policy "Users manage own logs"
  on care_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- diagnoses: users only see their own
alter table diagnoses enable row level security;
create policy "Users manage own diagnoses"
  on diagnoses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- species: readable by all authenticated users, writable by service role only
alter table species enable row level security;
create policy "Authenticated users can read species"
  on species for select
  using (auth.role() = 'authenticated');

-- scan_cache: readable by all, writable by service role (Edge Functions)
alter table scan_cache enable row level security;
create policy "Authenticated users can read cache"
  on scan_cache for select
  using (auth.role() = 'authenticated');
```

### 3. Storage buckets

- **`plant-photos`** bucket — stores user plant photos and growth images.
  - RLS: users can upload to their own folder (`{user_id}/`), read their own files.
  - Public URL access for displaying images in the app.
- **`scan-uploads`** bucket — temporary storage for photos sent to OpenAI.
  - Short TTL or cleanup policy — these don't need to persist long-term.

### 4. Edge Function scaffold

Create a Supabase Edge Function: `identify-plant`

This function will be fleshed out in Phase 04, but the scaffold includes:
- Deno runtime setup.
- Auth verification (extract user from the JWT).
- CORS headers.
- Accepts a base64 image + scan type (`identify` or `diagnose`).
- Placeholder response structure.
- `OPENAI_API_KEY` stored as an Edge Function secret.

```
supabase/functions/identify-plant/index.ts
```

---

## Acceptance criteria

- [ ] All tables exist in the Supabase Postgres database.
- [ ] RLS is enabled on every table — verified by querying as an authenticated user and confirming they only see their own rows.
- [ ] Inserting a row into `user_plants` with a different `user_id` fails when queried by another user.
- [ ] The `plant-photos` Storage bucket exists and accepts uploads.
- [ ] The Edge Function `identify-plant` deploys and returns a placeholder 200 response when invoked.
- [ ] `OPENAI_API_KEY` is set as a secret on the Edge Function.

---

## Tech notes

- **Migrations**: Use the Supabase MCP or `supabase db push` to apply schema changes. Keep SQL files in `supabase/migrations/` for version control.
- **`care_profile` is JSONB**: Storing the care profile as structured JSON rather than separate columns gives flexibility — the AI may return varying fields per species. Validate the shape in the Edge Function before inserting.
- **`scan_cache`**: Keyed by a hash of the uploaded image. Before calling OpenAI, the Edge Function checks this table — if a match exists, return the cached result. This is the primary cost control mechanism.
- **`species` table is write-once**: When OpenAI identifies a new species, the Edge Function inserts it into `species` with the generated care profile. Subsequent users who scan the same species reuse this row.
- **Storage folder convention**: `plant-photos/{user_id}/{user_plant_id}/{timestamp}.jpg` — keeps things organized and simplifies RLS rules.

---

## Full implementation plan

### Implementation objective
Create the complete Supabase backend foundation for the MVP: schema, row-level security, storage buckets, and an Edge Function scaffold. Later app phases should only consume these backend contracts rather than inventing new persistence paths.

### Ordered build tasks
1. Create versioned Supabase migration files for the tables listed in this phase.
2. Add required extensions and helper defaults, including UUID generation support if not already enabled.
3. Create shared/public tables first, then user-owned tables, then cache/log tables.
4. Add indexes for common access patterns: user plant lists, plant detail lookups, due care tasks, diagnosis history, and image hash cache checks.
5. Enable RLS on every table and add policies exactly matching the intended ownership model.
6. Create the `plant-photos` and `scan-uploads` buckets with folder conventions that can be enforced by policy.
7. Add storage policies for user-owned uploads and reads.
8. Scaffold the `identify-plant` Edge Function with CORS, JWT verification, request parsing, placeholder responses, and secret access.
9. Add typed response contracts in the app or shared TypeScript types so client phases know the expected backend shapes.
10. Record manual dashboard settings that cannot safely live in the repo.

### Expected files and modules
- `supabase/migrations/*.sql` contains schema, indexes, RLS, and storage policy SQL.
- `supabase/functions/identify-plant/index.ts` contains the placeholder Edge Function.
- `types/database.ts` or generated Supabase types should describe table rows for app code.
- `lib/api/identifyPlant.ts` can be introduced as a thin client wrapper for invoking the function later.

### Schema and data-flow notes
- `species` is shared reference data populated by trusted backend code, not directly by clients.
- `user_plants`, `care_tasks`, `care_logs`, and `diagnoses` are user-owned and must always include `user_id`.
- `scan_cache` is a service-managed cache keyed by exact image hash and scan type.
- Storage paths should follow `plant-photos/{user_id}/{user_plant_id}/{timestamp}.jpg` and `scan-uploads/{user_id}/{timestamp}.jpg`.
- Edge Functions should use the caller JWT for user context and service-role access only inside the function runtime.

### Security requirements
- Never expose the service-role key to the Expo app.
- Clients can read only their own user-owned records.
- Clients cannot write shared `species` or `scan_cache` rows directly.
- Storage policies must prevent one user from listing, overwriting, or deleting another user's files.
- Edge Function secrets such as `OPENAI_API_KEY` must be set through Supabase secret management.

### Edge cases and failure handling
- RLS denial should be treated as an authorization failure, not as missing data.
- Duplicate species inserts should be handled by matching on scientific name or a normalized unique key.
- Cache collisions should include scan type in the lookup so identify and diagnose results do not conflict.
- Edge Function placeholder responses should use the same envelope shape expected by future real responses.

### Verification checklist
- Migrations apply cleanly to the target Supabase project.
- Each table exists with expected columns, constraints, and indexes.
- RLS blocks cross-user reads and writes in authenticated test sessions.
- `species` is readable by authenticated users but not client-writable.
- Storage accepts uploads only under the caller's allowed folder.
- `identify-plant` deploys and returns a placeholder 200 response for an authenticated request.
- `OPENAI_API_KEY` is configured as a function secret even if the placeholder does not use it yet.

### Handoff to Phase 04
Phase 04 should flesh out the existing `identify-plant` function instead of creating another backend endpoint. It should reuse `scan_cache`, `species`, and the same response envelope.
