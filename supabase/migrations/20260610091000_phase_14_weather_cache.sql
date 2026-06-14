-- Phase 14: server-side weather + tip caches for the weather-tips Edge Function.
-- Both tables are service-role only: RLS is enabled with no client policies,
-- matching the scan_events deny convention.

create table public.weather_cache (
  id uuid primary key default gen_random_uuid(),
  latitude numeric(5, 2) not null,
  longitude numeric(5, 2) not null,
  local_date date not null,
  forecast_days smallint not null default 2,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weather_cache_snapshot_is_object check (jsonb_typeof(snapshot) = 'object'),
  constraint weather_cache_coords_key unique (latitude, longitude, local_date, forecast_days)
);

create table public.weather_tip_cache (
  user_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  signature text not null,
  tips jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weather_tip_cache_tips_is_array check (jsonb_typeof(tips) = 'array'),
  primary key (user_id, local_date)
);

create trigger set_weather_cache_updated_at
  before update on public.weather_cache
  for each row execute function public.set_updated_at();

create trigger set_weather_tip_cache_updated_at
  before update on public.weather_tip_cache
  for each row execute function public.set_updated_at();

alter table public.weather_cache enable row level security;
alter table public.weather_tip_cache enable row level security;

create policy "No client access to weather cache"
  on public.weather_cache
  for all
  using (false)
  with check (false);

create policy "No client access to weather tip cache"
  on public.weather_tip_cache
  for all
  using (false)
  with check (false);
