-- Phase 12/13 — monetization backbone.
--
-- 1. scan_events: allow scan_type = 'diagnose'. The identify-plant function
--    already inserts diagnose events, but the original check constraint only
--    allowed 'identify', so those inserts have been failing silently. The
--    3/day diagnosis cap needs these rows as its count source.
alter table public.scan_events
  drop constraint scan_events_scan_type_check;

alter table public.scan_events
  add constraint scan_events_scan_type_check
  check (scan_type in ('identify', 'diagnose'));

-- 2. subscriptions: durable entitlement record. Written exclusively by the
--    revenuecat-webhook edge function (service_role); the client may read its
--    own row but can never write entitlement.
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique not null,
  plan text not null default 'free' check (plan in ('free', 'premium')),
  entitlement text,
  platform text check (platform in ('ios', 'android')),
  store_transaction_id text,
  rc_app_user_id text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "Users can read own subscription"
  on public.subscriptions
  for select
  using (auth.uid() = user_id);

grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;

-- 3. Daily scan usage for the client-side limit UX. scan_events is deny-all
--    to authenticated (see 20260530132543), so expose only the two counters
--    the paywall needs. The UTC-day window matches the edge function's
--    enforcement window.
create or replace function public.get_daily_scan_usage()
returns table (identify_count bigint, diagnose_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select
    count(*) filter (where scan_type = 'identify') as identify_count,
    count(*) filter (where scan_type = 'diagnose') as diagnose_count
  from public.scan_events
  where user_id = auth.uid()
    and created_at >= date_trunc('day', now());
$$;

revoke all on function public.get_daily_scan_usage() from public, anon;
grant execute on function public.get_daily_scan_usage() to authenticated;
