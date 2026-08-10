-- Fernly's production-paging state is server-only. The public schema is used
-- for service-role Edge Function access, but RLS and explicit grants deny all
-- browser roles.
create table if not exists public.production_paging_config (
  app_id text primary key check (app_id = 'fernly'),
  enabled boolean not null default false,
  -- Paging is dormant by default. The emergency kill switch remains available
  -- for an explicit operator action, but is not asserted on first deploy.
  kill_switch boolean not null default false,
  cooldown_seconds integer not null default 900
    check (cooldown_seconds between 60 and 86400),
  hourly_limit integer not null default 10
    check (hourly_limit between 1 and 100),
  updated_at timestamptz not null default now()
);
insert into public.production_paging_config (
  app_id,
  enabled,
  kill_switch,
  cooldown_seconds,
  hourly_limit
)
values ('fernly', false, false, 900, 10)
on conflict (app_id) do nothing;
create table if not exists public.production_paging_incidents (
  id uuid primary key default gen_random_uuid(),
  app_id text not null references public.production_paging_config (app_id),
  category text not null check (
    category in (
      'identify_failed',
      'account_delete_failed',
      'revenuecat_webhook_failed',
      'weather_tips_failed',
      'client_primary_action_failed'
    )
  ),
  code text not null check (
    code in (
      'openai_unavailable',
      'missing_openai_key',
      'validation_failed',
      'scan_cache_unavailable',
      'scan_event_unavailable',
      'erasure_queue_failed',
      'erasure_queue_release_failed',
      'storage_cleanup_failed',
      'delete_user_failed',
      'webhook_not_configured',
      'upsert_failed',
      'weather_unavailable',
      'plants_unavailable',
      'function_error',
      'network_unavailable'
    )
  ),
  idempotency_key text not null check (
    idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$'
  ),
  principal_hash text check (principal_hash is null or principal_hash ~ '^[0-9a-f]{64}$'),
  state text not null check (
    state in (
      'received',
      'dormant',
      'killed',
      'provider_unconfigured',
      'cooldown',
      'rate_limited',
      'reserved',
      'delivered',
      'delivery_failed',
      'provider_rejected'
    )
  ),
  provider_nonce uuid,
  delivery_code text check (delivery_code is null or delivery_code ~ '^[a-z0-9_:-]{1,64}$'),
  delivery_attempts integer not null default 0 check (delivery_attempts between 0 and 3),
  occurred_at timestamptz not null,
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (app_id, idempotency_key),
  unique (app_id, provider_nonce)
);
create index if not exists production_paging_incidents_cooldown_idx
  on public.production_paging_incidents (app_id, category, created_at desc)
  where state in ('reserved', 'delivered');
create table if not exists public.production_paging_rate_windows (
  app_id text not null references public.production_paging_config (app_id),
  category text not null,
  window_started_at timestamptz not null,
  event_count integer not null default 0 check (event_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (app_id, category, window_started_at)
);
alter table public.production_paging_config enable row level security;
alter table public.production_paging_incidents enable row level security;
alter table public.production_paging_rate_windows enable row level security;
revoke all on table public.production_paging_config from public, anon, authenticated;
revoke all on table public.production_paging_incidents from public, anon, authenticated;
revoke all on table public.production_paging_rate_windows from public, anon, authenticated;
grant select, insert, update, delete on table public.production_paging_config to service_role;
grant select, insert, update, delete on table public.production_paging_incidents to service_role;
grant select, insert, update, delete on table public.production_paging_rate_windows to service_role;
create or replace function public.reserve_fernly_paging_delivery(
  p_app_id text,
  p_category text,
  p_code text,
  p_idempotency_key text,
  p_principal_hash text,
  p_occurred_at timestamptz,
  p_provider_configured boolean
)
returns table (
  incident_id uuid,
  state text,
  provider_nonce uuid,
  occurred_at timestamptz
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_config public.production_paging_config%rowtype;
  v_incident_id uuid;
  v_existing public.production_paging_incidents%rowtype;
  v_cooldown_id uuid;
  v_nonce uuid;
  v_window_started_at timestamptz;
  v_rate_count integer;
begin
  if p_app_id <> 'fernly' then
    raise exception 'invalid app_id' using errcode = '22023';
  end if;

  select *
  into v_config
  from public.production_paging_config
  where app_id = p_app_id
  for update;

  if not found then
    raise exception 'paging config missing' using errcode = 'P0001';
  end if;

  insert into public.production_paging_incidents (
    app_id,
    category,
    code,
    idempotency_key,
    principal_hash,
    state,
    occurred_at
  )
  values (
    p_app_id,
    p_category,
    p_code,
    p_idempotency_key,
    p_principal_hash,
    'received',
    p_occurred_at
  )
  on conflict (app_id, idempotency_key) do nothing
  returning id into v_incident_id;

  if v_incident_id is null then
    select *
    into v_existing
    from public.production_paging_incidents
    where app_id = p_app_id
      and idempotency_key = p_idempotency_key;

    return query select v_existing.id, 'duplicate'::text, v_existing.provider_nonce, v_existing.occurred_at;
    return;
  end if;

  if v_config.kill_switch then
    update public.production_paging_incidents
    set state = 'killed', updated_at = now()
    where id = v_incident_id;

    return query select v_incident_id, 'killed'::text, null::uuid, p_occurred_at;
    return;
  end if;

  if not v_config.enabled then
    update public.production_paging_incidents
    set state = 'dormant', updated_at = now()
    where id = v_incident_id;

    return query select v_incident_id, 'dormant'::text, null::uuid, p_occurred_at;
    return;
  end if;

  if not p_provider_configured then
    update public.production_paging_incidents
    set state = 'provider_unconfigured', updated_at = now()
    where id = v_incident_id;

    return query select v_incident_id, 'provider_unconfigured'::text, null::uuid, p_occurred_at;
    return;
  end if;

  select id
  into v_cooldown_id
  from public.production_paging_incidents
  where app_id = p_app_id
    and category = p_category
    and id <> v_incident_id
    and state in ('reserved', 'delivered')
    and created_at > now() - make_interval(secs => v_config.cooldown_seconds)
  order by created_at desc
  limit 1;

  if v_cooldown_id is not null then
    update public.production_paging_incidents
    set state = 'cooldown', updated_at = now()
    where id = v_incident_id;

    return query select v_incident_id, 'cooldown'::text, null::uuid, p_occurred_at;
    return;
  end if;

  v_window_started_at := date_trunc('hour', now());

  insert into public.production_paging_rate_windows (
    app_id,
    category,
    window_started_at,
    event_count
  )
  values (p_app_id, p_category, v_window_started_at, 1)
  on conflict (app_id, category, window_started_at) do update
    set event_count = public.production_paging_rate_windows.event_count + 1,
        updated_at = now()
    where public.production_paging_rate_windows.event_count < v_config.hourly_limit
  returning event_count into v_rate_count;

  if v_rate_count is null then
    update public.production_paging_incidents
    set state = 'rate_limited', updated_at = now()
    where id = v_incident_id;

    return query select v_incident_id, 'rate_limited'::text, null::uuid, p_occurred_at;
    return;
  end if;

  v_nonce := gen_random_uuid();

  update public.production_paging_incidents
  set state = 'reserved',
      provider_nonce = v_nonce,
      updated_at = now()
  where id = v_incident_id;

  return query select v_incident_id, 'reserved'::text, v_nonce, p_occurred_at;
end;
$$;
create or replace function public.record_fernly_paging_delivery(
  p_app_id text,
  p_incident_id uuid,
  p_state text,
  p_delivery_code text,
  p_attempt_count integer
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if p_app_id <> 'fernly' then
    raise exception 'invalid app_id' using errcode = '22023';
  end if;

  if p_state not in ('delivered', 'delivery_failed', 'provider_rejected') then
    raise exception 'invalid delivery state' using errcode = '22023';
  end if;

  if p_attempt_count not between 1 and 3 then
    raise exception 'invalid delivery attempt count' using errcode = '22023';
  end if;

  update public.production_paging_incidents
  set state = p_state,
      delivery_code = p_delivery_code,
      delivery_attempts = p_attempt_count,
      last_attempt_at = now(),
      delivered_at = case when p_state = 'delivered' then now() else delivered_at end,
      updated_at = now()
  where id = p_incident_id
    and app_id = p_app_id
    and state = 'reserved';

  if not found then
    raise exception 'reserved incident not found' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public.reserve_fernly_paging_delivery(text, text, text, text, text, timestamptz, boolean) from public, anon, authenticated;
revoke all on function public.record_fernly_paging_delivery(text, uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.reserve_fernly_paging_delivery(text, text, text, text, text, timestamptz, boolean) to service_role;
grant execute on function public.record_fernly_paging_delivery(text, uuid, text, text, integer) to service_role;
