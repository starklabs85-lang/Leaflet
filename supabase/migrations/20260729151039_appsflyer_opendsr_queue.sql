-- Durable handoff for AppsFlyer OpenDSR erasure. This table is intentionally
-- not tied to auth.users because it must survive deletion of the Fernly user.
create table public.appsflyer_erasure_requests (
  id uuid primary key default gen_random_uuid(),
  subject_request_id uuid not null default gen_random_uuid() unique,
  customer_user_id uuid,
  appsflyer_uid text,
  status text not null default 'held'
    check (
      status in (
        'held',
        'queued',
        'retry',
        'submitted',
        'pending',
        'in_progress',
        'completed',
        'failed'
      )
    ),
  provider_status text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  requested_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  submitted_at timestamptz,
  completed_at timestamptz,
  deadline_at timestamptz not null default (now() + interval '10 days'),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (customer_user_id is not null or status = 'completed')
);

create unique index appsflyer_erasure_requests_active_customer_uid_idx
  on public.appsflyer_erasure_requests (customer_user_id)
  where customer_user_id is not null;

create index appsflyer_erasure_requests_worker_idx
  on public.appsflyer_erasure_requests (next_attempt_at, status)
  where status in ('queued', 'retry', 'submitted', 'pending', 'in_progress');

create index appsflyer_erasure_requests_deadline_idx
  on public.appsflyer_erasure_requests (deadline_at)
  where status not in ('completed', 'failed');

create trigger set_appsflyer_erasure_requests_updated_at
  before update on public.appsflyer_erasure_requests
  for each row execute function public.set_updated_at();

alter table public.appsflyer_erasure_requests enable row level security;

revoke all on table public.appsflyer_erasure_requests
  from public, anon, authenticated;
grant select, insert, update on table public.appsflyer_erasure_requests
  to service_role;

comment on table public.appsflyer_erasure_requests is
  'Server-only AppsFlyer OpenDSR erasure queue. Provider identifiers are nulled after completion.';
