-- Harden Fernly production paging without deleting existing incident history.
-- The migration is intentionally dormant: paging disabled, kill switch enabled.

create extension if not exists pgcrypto;

drop function if exists public.reserve_fernly_paging_delivery(
  text, text, text, text, text, timestamptz, boolean
);
drop function if exists public.record_fernly_paging_delivery(
  text, uuid, text, text, integer
);

alter table public.production_paging_config
  add column if not exists threshold_count integer not null default 1
    check (threshold_count between 1 and 10);

update public.production_paging_config
set enabled = false,
    kill_switch = true,
    threshold_count = greatest(threshold_count, 1),
    updated_at = now()
where app_id = 'fernly';

alter table public.production_paging_incidents
  drop constraint if exists production_paging_incidents_category_code_pair_check;
alter table public.production_paging_incidents
  drop constraint if exists production_paging_incidents_category_check;
alter table public.production_paging_incidents
  drop constraint if exists production_paging_incidents_code_check;

alter table public.production_paging_incidents
  add constraint production_paging_incidents_category_check
  check (
    category in (
      'identify_failed',
      'account_delete_failed',
      'revenuecat_webhook_failed',
      'weather_tips_failed',
      'client_primary_action_failed',
      'production_canary'
    )
  );

alter table public.production_paging_incidents
  add constraint production_paging_incidents_code_check
  check (
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
      'network_unavailable',
      'controlled_test'
    )
  );

alter table public.production_paging_incidents
  add constraint production_paging_incidents_category_code_pair_check
  check (
    (category = 'identify_failed' and code in (
      'missing_openai_key',
      'openai_unavailable',
      'validation_failed',
      'scan_cache_unavailable',
      'scan_event_unavailable'
    ))
    or (category = 'account_delete_failed' and code in (
      'erasure_queue_failed',
      'erasure_queue_release_failed',
      'storage_cleanup_failed',
      'delete_user_failed'
    ))
    or (category = 'revenuecat_webhook_failed' and code in (
      'webhook_not_configured',
      'upsert_failed'
    ))
    or (category = 'weather_tips_failed' and code in (
      'weather_unavailable',
      'plants_unavailable'
    ))
    or (category = 'client_primary_action_failed' and code in (
      'function_error',
      'network_unavailable'
    ))
    or (category = 'production_canary' and code = 'controlled_test')
  );

alter table public.production_paging_incidents
  add column if not exists environment text not null default 'production'
    check (environment = 'production'),
  add column if not exists severity text not null default 'critical'
    check (severity = 'critical'),
  add column if not exists request_nonce text,
  add column if not exists canonical_digest text,
  add column if not exists dedupe_label text,
  add column if not exists occurrence_count integer not null default 1
    check (occurrence_count between 1 and 2147483647),
  add column if not exists provider_state text,
  add column if not exists jira_state text,
  add column if not exists provider_delivery_key text,
  add column if not exists jira_delivery_key text,
  add column if not exists provider_attempts integer not null default 0
    check (provider_attempts between 0 and 3),
  add column if not exists jira_attempts integer not null default 0
    check (jira_attempts between 0 and 3),
  add column if not exists provider_lease_until timestamptz,
  add column if not exists jira_lease_until timestamptz,
  add column if not exists jira_delivered_at timestamptz;

update public.production_paging_incidents
set canonical_digest = coalesce(
      canonical_digest,
      encode(digest(app_id || ':' || idempotency_key, 'sha256'), 'hex')
    ),
    request_nonce = coalesce(
      request_nonce,
      replace(provider_nonce::text, '-', ''),
      substring(encode(digest(app_id || ':nonce:' || idempotency_key, 'sha256'), 'hex') for 32)
    )
where canonical_digest is null
   or request_nonce is null;

update public.production_paging_incidents
set dedupe_label = coalesce(
      dedupe_label,
      'fernly-incident-' || substring(canonical_digest for 24)
    ),
    provider_state = coalesce(
      provider_state,
      case
        when state = 'delivered' then 'delivered'
        when state = 'reserved' then 'pending'
        when state in ('delivery_failed', 'provider_rejected') then 'failed'
        else 'suppressed'
      end
    ),
    jira_state = coalesce(jira_state, 'suppressed')
where dedupe_label is null
   or provider_state is null
   or jira_state is null;

update public.production_paging_incidents
set provider_delivery_key = coalesce(provider_delivery_key, dedupe_label),
    jira_delivery_key = coalesce(
      jira_delivery_key,
      dedupe_label || '-' || lpad(occurrence_count::text, 8, '0')
    )
where provider_delivery_key is null
   or jira_delivery_key is null;

alter table public.production_paging_incidents
  alter column request_nonce set not null,
  alter column canonical_digest set not null,
  alter column dedupe_label set not null,
  alter column provider_state set not null,
  alter column jira_state set not null,
  alter column provider_delivery_key set not null,
  alter column jira_delivery_key set not null;

alter table public.production_paging_incidents
  add constraint production_paging_incidents_request_nonce_check
    check (request_nonce ~ '^[a-f0-9]{32}$'),
  add constraint production_paging_incidents_canonical_digest_check
    check (canonical_digest ~ '^[a-f0-9]{64}$'),
  add constraint production_paging_incidents_dedupe_label_check
    check (dedupe_label ~ '^fernly-incident-[a-f0-9]{24}$'),
  add constraint production_paging_incidents_provider_state_check
    check (provider_state in ('pending', 'leased', 'delivered', 'failed', 'rejected', 'suppressed')),
  add constraint production_paging_incidents_jira_state_check
    check (jira_state in ('pending', 'leased', 'delivered', 'failed', 'rejected', 'suppressed'));

create unique index if not exists production_paging_incidents_nonce_uidx
  on public.production_paging_incidents (app_id, request_nonce);
create unique index if not exists production_paging_incidents_dedupe_label_uidx
  on public.production_paging_incidents (app_id, dedupe_label);

alter table public.production_paging_incidents
  drop column if exists principal_hash;

create table if not exists public.production_paging_replay_nonces (
  app_id text not null references public.production_paging_config (app_id),
  request_nonce text not null check (request_nonce ~ '^[a-f0-9]{32}$'),
  idempotency_key text not null check (idempotency_key ~ '^[a-f0-9]{32}$'),
  canonical_digest text not null check (canonical_digest ~ '^[a-f0-9]{64}$'),
  first_seen_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  primary key (app_id, request_nonce)
);

create table if not exists public.production_paging_deliveries (
  id uuid primary key default gen_random_uuid(),
  app_id text not null references public.production_paging_config (app_id),
  incident_id uuid not null references public.production_paging_incidents (id) on delete cascade,
  channel text not null check (channel in ('provider', 'jira')),
  delivery_key text not null check (delivery_key ~ '^[a-z0-9:-]{16,96}$'),
  state text not null check (
    state in ('pending', 'leased', 'delivered', 'failed', 'rejected', 'suppressed')
  ),
  attempts integer not null default 0 check (attempts between 0 and 3),
  lease_until timestamptz,
  delivery_code text check (delivery_code is null or delivery_code ~ '^[a-z0-9_:-]{1,64}$'),
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (app_id, channel, delivery_key)
);

insert into public.production_paging_deliveries (
  app_id,
  incident_id,
  channel,
  delivery_key,
  state,
  attempts,
  lease_until,
  delivery_code,
  delivered_at,
  created_at,
  updated_at
)
select
  incident.app_id,
  incident.id,
  'provider',
  incident.provider_delivery_key,
  incident.provider_state,
  incident.provider_attempts,
  incident.provider_lease_until,
  incident.delivery_code,
  incident.delivered_at,
  incident.created_at,
  incident.updated_at
from public.production_paging_incidents as incident
on conflict (app_id, channel, delivery_key) do nothing;

insert into public.production_paging_deliveries (
  app_id,
  incident_id,
  channel,
  delivery_key,
  state,
  attempts,
  lease_until,
  delivered_at,
  created_at,
  updated_at
)
select
  incident.app_id,
  incident.id,
  'jira',
  incident.jira_delivery_key,
  incident.jira_state,
  incident.jira_attempts,
  incident.jira_lease_until,
  incident.jira_delivered_at,
  incident.created_at,
  incident.updated_at
from public.production_paging_incidents as incident
on conflict (app_id, channel, delivery_key) do nothing;

alter table public.production_paging_replay_nonces enable row level security;
alter table public.production_paging_deliveries enable row level security;
revoke all on table public.production_paging_replay_nonces from public, anon, authenticated;
revoke all on table public.production_paging_deliveries from public, anon, authenticated;
grant select, insert, update, delete on table public.production_paging_replay_nonces to service_role;
grant select, insert, update, delete on table public.production_paging_deliveries to service_role;

create or replace function public.reserve_fernly_production_incident(
  p_app_id text,
  p_environment text,
  p_category text,
  p_code text,
  p_severity text,
  p_idempotency_key text,
  p_request_nonce text,
  p_canonical_digest text,
  p_occurred_at timestamptz,
  p_provider_configured boolean,
  p_jira_configured boolean
)
returns table (
  incident_id uuid,
  status text,
  dedupe_label text,
  occurrence_count integer,
  provider_delivery_key text,
  jira_delivery_key text,
  send_provider boolean,
  send_jira boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_config public.production_paging_config%rowtype;
  v_nonce public.production_paging_replay_nonces%rowtype;
  v_incident public.production_paging_incidents%rowtype;
  v_rate_count integer;
  v_window_started_at timestamptz;
  v_dedupe_label text;
begin
  if p_app_id <> 'fernly' then
    raise exception 'invalid app_id' using errcode = '22023';
  end if;

  if p_environment <> 'production' then
    raise exception 'invalid environment' using errcode = '22023';
  end if;

  if p_severity <> 'critical'
     or p_idempotency_key !~ '^[a-f0-9]{32}$'
     or p_request_nonce !~ '^[a-f0-9]{32}$'
     or p_canonical_digest !~ '^[a-f0-9]{64}$'
     or p_occurred_at is null then
    raise exception 'invalid incident fields' using errcode = '22023';
  end if;

  if not (
    (p_category = 'identify_failed' and p_code in (
      'missing_openai_key', 'openai_unavailable', 'validation_failed',
      'scan_cache_unavailable', 'scan_event_unavailable'
    ))
    or (p_category = 'account_delete_failed' and p_code in (
      'erasure_queue_failed', 'erasure_queue_release_failed',
      'storage_cleanup_failed', 'delete_user_failed'
    ))
    or (p_category = 'revenuecat_webhook_failed' and p_code in (
      'webhook_not_configured', 'upsert_failed'
    ))
    or (p_category = 'weather_tips_failed' and p_code in (
      'weather_unavailable', 'plants_unavailable'
    ))
    or (p_category = 'client_primary_action_failed' and p_code in (
      'function_error', 'network_unavailable'
    ))
    or (p_category = 'production_canary' and p_code = 'controlled_test')
  ) then
    raise exception 'invalid category/code pair' using errcode = '22023';
  end if;

  select config.*
  into v_config
  from public.production_paging_config as config
  where config.app_id = p_app_id
  for update;

  if not found then
    raise exception 'paging config missing' using errcode = 'P0001';
  end if;

  if v_config.kill_switch then
    return query select
      null::uuid, 'disabled'::text, null::text, 0, null::text, null::text, false, false;
    return;
  end if;

  if not v_config.enabled then
    return query select
      null::uuid, 'dormant'::text, null::text, 0, null::text, null::text, false, false;
    return;
  end if;

  if not p_provider_configured or not p_jira_configured then
    return query select
      null::uuid, 'not_configured'::text, null::text, 0, null::text, null::text, false, false;
    return;
  end if;

  insert into public.production_paging_replay_nonces (
    app_id,
    request_nonce,
    idempotency_key,
    canonical_digest
  )
  values (
    p_app_id,
    p_request_nonce,
    p_idempotency_key,
    p_canonical_digest
  )
  on conflict (app_id, request_nonce) do nothing;

  if not found then
    select nonce_state.*
    into v_nonce
    from public.production_paging_replay_nonces as nonce_state
    where nonce_state.app_id = p_app_id
      and nonce_state.request_nonce = p_request_nonce
    for update;

    if v_nonce.canonical_digest <> p_canonical_digest
       or v_nonce.idempotency_key <> p_idempotency_key then
      return query select
        null::uuid, 'replay_conflict'::text, null::text, 0,
        null::text, null::text, false, false;
      return;
    end if;
  end if;

  select incident.*
  into v_incident
  from public.production_paging_incidents as incident
  where incident.app_id = p_app_id
    and incident.idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_incident.canonical_digest <> p_canonical_digest then
      return query select
        null::uuid, 'idempotency_conflict'::text, null::text, 0,
        null::text, null::text, false, false;
      return;
    end if;

    update public.production_paging_incidents as incident
    set occurrence_count = incident.occurrence_count + 1,
        jira_state = 'pending',
        jira_attempts = 0,
        jira_lease_until = null,
        jira_delivery_key = incident.dedupe_label || '-' ||
          lpad((incident.occurrence_count + 1)::text, 8, '0'),
        updated_at = now()
    where incident.id = v_incident.id
    returning incident.* into v_incident;

    insert into public.production_paging_deliveries (
      app_id, incident_id, channel, delivery_key, state
    )
    values (
      p_app_id, v_incident.id, 'jira', v_incident.jira_delivery_key, 'pending'
    )
    on conflict (app_id, channel, delivery_key) do nothing;

    return query select
      v_incident.id,
      'duplicate'::text,
      v_incident.dedupe_label,
      v_incident.occurrence_count,
      v_incident.provider_delivery_key,
      v_incident.jira_delivery_key,
      false,
      true;
    return;
  end if;

  select incident.*
  into v_incident
  from public.production_paging_incidents as incident
  where incident.app_id = p_app_id
    and incident.category = p_category
    and incident.code = p_code
    and incident.created_at > now() - make_interval(secs => v_config.cooldown_seconds)
    and incident.provider_state in ('pending', 'leased', 'delivered')
  order by incident.created_at desc
  limit 1
  for update;

  if found then
    update public.production_paging_incidents as incident
    set occurrence_count = incident.occurrence_count + 1,
        jira_state = 'pending',
        jira_attempts = 0,
        jira_lease_until = null,
        jira_delivery_key = incident.dedupe_label || '-' ||
          lpad((incident.occurrence_count + 1)::text, 8, '0'),
        updated_at = now()
    where incident.id = v_incident.id
    returning incident.* into v_incident;

    insert into public.production_paging_deliveries (
      app_id, incident_id, channel, delivery_key, state
    )
    values (
      p_app_id, v_incident.id, 'jira', v_incident.jira_delivery_key, 'pending'
    )
    on conflict (app_id, channel, delivery_key) do nothing;

    return query select
      v_incident.id,
      'cooldown'::text,
      v_incident.dedupe_label,
      v_incident.occurrence_count,
      v_incident.provider_delivery_key,
      v_incident.jira_delivery_key,
      false,
      true;
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
    return query select
      null::uuid, 'rate_limited'::text, null::text, 0,
      null::text, null::text, false, false;
    return;
  end if;

  if v_rate_count < v_config.threshold_count then
    return query select
      null::uuid, 'threshold'::text, null::text, v_rate_count,
      null::text, null::text, false, false;
    return;
  end if;

  v_dedupe_label := 'fernly-incident-' || substring(p_canonical_digest for 24);

  insert into public.production_paging_incidents (
    app_id,
    environment,
    category,
    code,
    severity,
    idempotency_key,
    request_nonce,
    canonical_digest,
    dedupe_label,
    state,
    provider_nonce,
    provider_state,
    jira_state,
    provider_delivery_key,
    jira_delivery_key,
    occurred_at
  )
  values (
    p_app_id,
    p_environment,
    p_category,
    p_code,
    p_severity,
    p_idempotency_key,
    p_request_nonce,
    p_canonical_digest,
    v_dedupe_label,
    'reserved',
    gen_random_uuid(),
    'pending',
    'pending',
    v_dedupe_label,
    v_dedupe_label || '-00000001',
    p_occurred_at
  )
  returning * into v_incident;

  insert into public.production_paging_deliveries (
    app_id, incident_id, channel, delivery_key, state
  )
  values
    (p_app_id, v_incident.id, 'provider', v_incident.provider_delivery_key, 'pending'),
    (p_app_id, v_incident.id, 'jira', v_incident.jira_delivery_key, 'pending');

  return query select
    v_incident.id,
    'reserved'::text,
    v_incident.dedupe_label,
    v_incident.occurrence_count,
    v_incident.provider_delivery_key,
    v_incident.jira_delivery_key,
    true,
    true;
end;
$$;

create or replace function public.lease_fernly_production_delivery(
  p_app_id text,
  p_incident_id uuid,
  p_channel text,
  p_delivery_key text,
  p_lease_seconds integer
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_attempt integer;
begin
  if p_app_id <> 'fernly'
     or p_channel not in ('provider', 'jira')
     or p_delivery_key is null
     or p_lease_seconds not between 5 and 300 then
    raise exception 'invalid delivery lease' using errcode = '22023';
  end if;

  update public.production_paging_deliveries as delivery
  set state = 'leased',
      attempts = delivery.attempts + 1,
      lease_until = now() + make_interval(secs => p_lease_seconds),
      updated_at = now()
  where delivery.app_id = p_app_id
    and delivery.incident_id = p_incident_id
    and delivery.channel = p_channel
    and delivery.delivery_key = p_delivery_key
    and delivery.state in ('pending', 'failed')
    and delivery.attempts < 3
    and (delivery.lease_until is null or delivery.lease_until <= now())
  returning delivery.attempts into v_attempt;

  if v_attempt is null then
    return 0;
  end if;

  if p_channel = 'provider' then
    update public.production_paging_incidents as incident
    set provider_state = 'leased',
        provider_attempts = delivery.attempts,
        provider_lease_until = delivery.lease_until,
        last_attempt_at = now(),
        updated_at = now()
    from public.production_paging_deliveries as delivery
    where incident.id = p_incident_id
      and incident.app_id = p_app_id
      and incident.provider_delivery_key = p_delivery_key
      and delivery.app_id = p_app_id
      and delivery.incident_id = p_incident_id
      and delivery.channel = 'provider'
      and delivery.delivery_key = p_delivery_key;
  else
    update public.production_paging_incidents as incident
    set jira_state = 'leased',
        jira_attempts = delivery.attempts,
        jira_lease_until = delivery.lease_until,
        updated_at = now()
    from public.production_paging_deliveries as delivery
    where incident.id = p_incident_id
      and incident.app_id = p_app_id
      and incident.jira_delivery_key = p_delivery_key
      and delivery.app_id = p_app_id
      and delivery.incident_id = p_incident_id
      and delivery.channel = 'jira'
      and delivery.delivery_key = p_delivery_key;
  end if;

  return v_attempt;
end;
$$;

create or replace function public.complete_fernly_production_delivery(
  p_app_id text,
  p_incident_id uuid,
  p_channel text,
  p_delivery_key text,
  p_state text,
  p_delivery_code text,
  p_attempt_count integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rows integer := 0;
begin
  if p_app_id <> 'fernly'
     or p_channel not in ('provider', 'jira')
     or p_state not in ('delivered', 'failed', 'rejected')
     or p_delivery_code !~ '^[a-z0-9_:-]{1,64}$'
     or p_attempt_count not between 1 and 3 then
    raise exception 'invalid delivery completion' using errcode = '22023';
  end if;

  update public.production_paging_deliveries as delivery
  set state = p_state,
      lease_until = null,
      delivery_code = p_delivery_code,
      delivered_at = case when p_state = 'delivered' then now() else delivery.delivered_at end,
      updated_at = now()
  where delivery.app_id = p_app_id
    and delivery.incident_id = p_incident_id
    and delivery.channel = p_channel
    and delivery.delivery_key = p_delivery_key
    and delivery.state = 'leased'
    and delivery.attempts = p_attempt_count;

  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    raise exception 'leased delivery not found' using errcode = 'P0001';
  end if;

  if p_channel = 'provider' then
    update public.production_paging_incidents as incident
    set provider_state = p_state,
        provider_lease_until = null,
        delivery_code = p_delivery_code,
        delivery_attempts = p_attempt_count,
        delivered_at = case when p_state = 'delivered' then now() else incident.delivered_at end,
        updated_at = now()
    where incident.id = p_incident_id
      and incident.app_id = p_app_id
      and incident.provider_delivery_key = p_delivery_key;
  else
    update public.production_paging_incidents as incident
    set jira_state = p_state,
        jira_lease_until = null,
        jira_delivered_at = case when p_state = 'delivered' then now() else incident.jira_delivered_at end,
        updated_at = now()
    where incident.id = p_incident_id
      and incident.app_id = p_app_id
      and incident.jira_delivery_key = p_delivery_key;
  end if;
end;
$$;

create or replace function public.fernly_production_health()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.production_paging_config
    where app_id = 'fernly'
  );
$$;

revoke all on function public.reserve_fernly_production_incident(
  text, text, text, text, text, text, text, text, timestamptz, boolean, boolean
) from public, anon, authenticated;
revoke all on function public.lease_fernly_production_delivery(
  text, uuid, text, text, integer
) from public, anon, authenticated;
revoke all on function public.complete_fernly_production_delivery(
  text, uuid, text, text, text, text, integer
) from public, anon, authenticated;
revoke all on function public.fernly_production_health()
  from public, anon, authenticated;

grant execute on function public.reserve_fernly_production_incident(
  text, text, text, text, text, text, text, text, timestamptz, boolean, boolean
) to service_role;
grant execute on function public.lease_fernly_production_delivery(
  text, uuid, text, text, integer
) to service_role;
grant execute on function public.complete_fernly_production_delivery(
  text, uuid, text, text, text, text, integer
) to service_role;
grant execute on function public.fernly_production_health()
  to service_role;
