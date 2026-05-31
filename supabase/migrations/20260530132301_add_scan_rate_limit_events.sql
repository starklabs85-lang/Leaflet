create table if not exists public.scan_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  image_hash text not null,
  scan_type text not null,
  cache_hit boolean not null default false,
  created_at timestamptz not null default now(),
  constraint scan_events_image_hash_not_blank check (length(btrim(image_hash)) > 0),
  constraint scan_events_scan_type_check check (scan_type in ('identify'))
);

alter table public.scan_events enable row level security;

create index if not exists scan_events_user_id_created_at_idx
  on public.scan_events (user_id, created_at desc);

grant all on public.scan_events to service_role;
revoke all on public.scan_events from anon, authenticated;
