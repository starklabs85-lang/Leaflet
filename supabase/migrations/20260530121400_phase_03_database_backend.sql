create extension if not exists pgcrypto with schema extensions;

create table public.species (
  id uuid primary key default gen_random_uuid(),
  common_name text not null,
  scientific_name text,
  description text,
  care_profile jsonb not null,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint species_common_name_not_blank check (length(btrim(common_name)) > 0),
  constraint species_scientific_name_not_blank check (
    scientific_name is null or length(btrim(scientific_name)) > 0
  ),
  constraint species_care_profile_is_object check (jsonb_typeof(care_profile) = 'object')
);

create table public.user_plants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  species_id uuid references public.species(id) on delete set null,
  nickname text,
  location text,
  status text not null default 'healthy',
  photo_url text,
  date_added timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_plants_status_check check (
    status in ('healthy', 'needs_attention', 'sick')
  ),
  constraint user_plants_nickname_not_blank check (
    nickname is null or length(btrim(nickname)) > 0
  )
);

create table public.care_tasks (
  id uuid primary key default gen_random_uuid(),
  user_plant_id uuid not null references public.user_plants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  interval_days integer not null,
  next_due_date date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint care_tasks_type_check check (
    type in ('water', 'fertilize', 'repot', 'prune', 'rotate', 'mist')
  ),
  constraint care_tasks_interval_days_positive check (interval_days > 0)
);

create table public.care_logs (
  id uuid primary key default gen_random_uuid(),
  user_plant_id uuid not null references public.user_plants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_type text not null,
  note text,
  photo_url text,
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint care_logs_task_type_check check (
    task_type in ('water', 'fertilize', 'repot', 'prune', 'rotate', 'mist')
  ),
  constraint care_logs_note_not_blank check (
    note is null or length(btrim(note)) > 0
  )
);

create table public.diagnoses (
  id uuid primary key default gen_random_uuid(),
  user_plant_id uuid references public.user_plants(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  condition_name text not null,
  confidence numeric(3,2),
  cause text,
  treatment text,
  prevention text,
  photo_url text,
  follow_up_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diagnoses_condition_name_not_blank check (length(btrim(condition_name)) > 0),
  constraint diagnoses_confidence_range check (
    confidence is null or (confidence >= 0 and confidence <= 1)
  )
);

create table public.scan_cache (
  id uuid primary key default gen_random_uuid(),
  image_hash text not null,
  scan_type text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  constraint scan_cache_image_hash_not_blank check (length(btrim(image_hash)) > 0),
  constraint scan_cache_scan_type_check check (scan_type in ('identify', 'diagnose')),
  constraint scan_cache_result_is_object check (jsonb_typeof(result) = 'object'),
  constraint scan_cache_image_hash_scan_type_key unique (image_hash, scan_type)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;

create trigger set_species_updated_at
  before update on public.species
  for each row execute function public.set_updated_at();

create trigger set_user_plants_updated_at
  before update on public.user_plants
  for each row execute function public.set_updated_at();

create trigger set_care_tasks_updated_at
  before update on public.care_tasks
  for each row execute function public.set_updated_at();

create trigger set_diagnoses_updated_at
  before update on public.diagnoses
  for each row execute function public.set_updated_at();

create unique index species_scientific_name_unique_idx
  on public.species (lower(scientific_name))
  where scientific_name is not null;

create index species_common_name_idx on public.species (common_name);
create index user_plants_user_id_date_added_idx on public.user_plants (user_id, date_added desc);
create index user_plants_user_id_species_id_idx on public.user_plants (user_id, species_id);
create index care_tasks_user_plant_id_idx on public.care_tasks (user_plant_id);
create index care_tasks_user_id_due_idx on public.care_tasks (user_id, next_due_date)
  where is_active = true;
create index care_logs_user_plant_logged_at_idx on public.care_logs (user_plant_id, logged_at desc);
create index care_logs_user_logged_at_idx on public.care_logs (user_id, logged_at desc);
create index diagnoses_user_plant_created_at_idx on public.diagnoses (user_plant_id, created_at desc);
create index diagnoses_user_created_at_idx on public.diagnoses (user_id, created_at desc);
create index diagnoses_user_follow_up_idx on public.diagnoses (user_id, follow_up_date)
  where follow_up_date is not null;
create index scan_cache_created_at_idx on public.scan_cache (created_at desc);

alter table public.species enable row level security;
alter table public.user_plants enable row level security;
alter table public.care_tasks enable row level security;
alter table public.care_logs enable row level security;
alter table public.diagnoses enable row level security;
alter table public.scan_cache enable row level security;

grant usage on schema public to authenticated;
grant select on public.species, public.scan_cache to authenticated;
grant select, insert, update, delete
  on public.user_plants, public.care_tasks, public.care_logs, public.diagnoses
  to authenticated;
grant all
  on public.species, public.user_plants, public.care_tasks, public.care_logs,
     public.diagnoses, public.scan_cache
  to service_role;

revoke all
  on public.species, public.user_plants, public.care_tasks, public.care_logs,
     public.diagnoses, public.scan_cache
  from anon;
revoke insert, update, delete on public.species, public.scan_cache from authenticated;

create policy "Authenticated users can read species"
  on public.species
  for select
  to authenticated
  using (true);

create policy "Users can select own plants"
  on public.user_plants
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own plants"
  on public.user_plants
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own plants"
  on public.user_plants
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own plants"
  on public.user_plants
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can select own care tasks"
  on public.care_tasks
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own care tasks"
  on public.care_tasks
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.user_plants
      where user_plants.id = care_tasks.user_plant_id
        and user_plants.user_id = (select auth.uid())
    )
  );

create policy "Users can update own care tasks"
  on public.care_tasks
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.user_plants
      where user_plants.id = care_tasks.user_plant_id
        and user_plants.user_id = (select auth.uid())
    )
  );

create policy "Users can delete own care tasks"
  on public.care_tasks
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can select own care logs"
  on public.care_logs
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own care logs"
  on public.care_logs
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.user_plants
      where user_plants.id = care_logs.user_plant_id
        and user_plants.user_id = (select auth.uid())
    )
  );

create policy "Users can update own care logs"
  on public.care_logs
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.user_plants
      where user_plants.id = care_logs.user_plant_id
        and user_plants.user_id = (select auth.uid())
    )
  );

create policy "Users can delete own care logs"
  on public.care_logs
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can select own diagnoses"
  on public.diagnoses
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own diagnoses"
  on public.diagnoses
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      user_plant_id is null
      or exists (
        select 1
        from public.user_plants
        where user_plants.id = diagnoses.user_plant_id
          and user_plants.user_id = (select auth.uid())
      )
    )
  );

create policy "Users can update own diagnoses"
  on public.diagnoses
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      user_plant_id is null
      or exists (
        select 1
        from public.user_plants
        where user_plants.id = diagnoses.user_plant_id
          and user_plants.user_id = (select auth.uid())
      )
    )
  );

create policy "Users can delete own diagnoses"
  on public.diagnoses
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Authenticated users can read scan cache"
  on public.scan_cache
  for select
  to authenticated
  using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'plant-photos',
    'plant-photos',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'scan-uploads',
    'scan-uploads',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can read own plant photos"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'plant-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can upload own plant photos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'plant-photos'
    and array_length(storage.foldername(name), 1) >= 2
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can update own plant photos"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'plant-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'plant-photos'
    and array_length(storage.foldername(name), 1) >= 2
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can delete own plant photos"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'plant-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can read own scan uploads"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'scan-uploads'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can upload own scan uploads"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'scan-uploads'
    and array_length(storage.foldername(name), 1) >= 1
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can update own scan uploads"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'scan-uploads'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'scan-uploads'
    and array_length(storage.foldername(name), 1) >= 1
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can delete own scan uploads"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'scan-uploads'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
