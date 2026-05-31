-- Phase 03 structural verification.
-- Run after applying supabase/migrations/20260530163230_phase_03_database_backend.sql.

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'species',
    'user_plants',
    'care_tasks',
    'care_logs',
    'diagnoses',
    'scan_cache'
  )
order by table_name;

select
  relname as table_name,
  relrowsecurity as rls_enabled
from pg_class
where oid in (
  'public.species'::regclass,
  'public.user_plants'::regclass,
  'public.care_tasks'::regclass,
  'public.care_logs'::regclass,
  'public.diagnoses'::regclass,
  'public.scan_cache'::regclass
)
order by relname;

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'species',
    'user_plants',
    'care_tasks',
    'care_logs',
    'diagnoses',
    'scan_cache'
  )
order by tablename, policyname;

select
  schemaname,
  tablename,
  indexname
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'species',
    'user_plants',
    'care_tasks',
    'care_logs',
    'diagnoses',
    'scan_cache'
  )
order by tablename, indexname;

select
  grantee,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'species',
    'user_plants',
    'care_tasks',
    'care_logs',
    'diagnoses',
    'scan_cache'
  )
  and grantee in ('anon', 'authenticated', 'service_role')
order by grantee, table_name, privilege_type;

select
  table_name,
  constraint_name,
  constraint_type
from information_schema.table_constraints
where table_schema = 'public'
  and table_name in (
    'species',
    'user_plants',
    'care_tasks',
    'care_logs',
    'diagnoses',
    'scan_cache'
  )
order by table_name, constraint_type, constraint_name;

select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id in ('plant-photos', 'scan-uploads')
order by id;

select
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname in (
    'Users can read own plant photos',
    'Users can upload own plant photos',
    'Users can update own plant photos',
    'Users can delete own plant photos',
    'Users can read own scan uploads',
    'Users can upload own scan uploads',
    'Users can update own scan uploads',
    'Users can delete own scan uploads'
  )
order by policyname;

-- Authenticated-session RLS checks require two real users and should be run
-- through the Supabase client using each user's access token:
--
-- 1. User A inserts a user_plants row with user_id = User A id: should succeed.
-- 2. User B selects user_plants: should not see User A's row.
-- 3. User B inserts user_plants with user_id = User A id: should fail RLS.
-- 4. Authenticated users select species and scan_cache: should succeed.
-- 5. Authenticated users insert/update/delete species or scan_cache: should fail.
-- 6. User A uploads plant-photos/{user_a}/{plant_id}/{timestamp}.jpg: should succeed.
-- 7. User B lists or mutates plant-photos/{user_a}/...: should fail or return no rows.
