begin;

create extension if not exists pgtap;

select plan(29);

create or replace function pg_temp.reserve_incident(
  p_app_id text,
  p_environment text,
  p_category text,
  p_code text,
  p_idempotency_key text,
  p_nonce text,
  p_digest text
)
returns jsonb
language plpgsql
as $$
declare
  v_result jsonb;
begin
  execute $query$
    select to_jsonb(reservation)
    from public.reserve_fernly_production_incident(
      $1, $2, $3, $4, 'critical', $5, $6, $7, now(), true, true
    ) as reservation
  $query$
  into v_result
  using p_app_id, p_environment, p_category, p_code, p_idempotency_key, p_nonce, p_digest;

  return coalesce(v_result, '{}'::jsonb);
exception
  when undefined_function then
    return jsonb_build_object('status', 'missing_function');
end;
$$;

create or replace function pg_temp.lease_delivery(
  p_incident_id uuid,
  p_channel text,
  p_delivery_key text
)
returns integer
language plpgsql
as $$
declare
  v_result integer;
begin
  execute $query$
    select public.lease_fernly_production_delivery(
      'fernly', $1, $2, $3, 60
    )
  $query$
  into v_result
  using p_incident_id, p_channel, p_delivery_key;

  return coalesce(v_result, 0);
exception
  when undefined_function or raise_exception or datatype_mismatch or invalid_text_representation then
    return 0;
end;
$$;

create or replace function pg_temp.complete_delivery(
  p_incident_id uuid,
  p_channel text,
  p_delivery_key text
)
returns boolean
language plpgsql
as $$
begin
  execute $query$
    select public.complete_fernly_production_delivery(
      'fernly', $1, $2, $3, 'delivered', 'accepted', 1
    )
  $query$
  using p_incident_id, p_channel, p_delivery_key;

  return true;
exception
  when undefined_function or raise_exception then
    return false;
end;
$$;

create or replace function pg_temp.incident_occurrence_count()
returns integer
language plpgsql
as $$
declare
  v_result integer;
begin
  execute 'select occurrence_count from public.production_paging_incidents limit 1'
  into v_result;
  return v_result;
exception
  when undefined_column then
    return -1;
end;
$$;

create or replace function pg_temp.role_cannot_reserve(p_role text)
returns boolean
language plpgsql
as $$
declare
  v_result boolean;
begin
  execute 'select not has_function_privilege($1, $2, ''EXECUTE'')'
  into v_result
  using
    p_role,
    'public.reserve_fernly_production_incident(text,text,text,text,text,text,text,text,timestamp with time zone,boolean,boolean)';
  return v_result;
exception
  when undefined_function then
    return false;
end;
$$;

create temporary table test_results (
  name text primary key,
  value jsonb not null
);

select has_function(
  'public',
  'reserve_fernly_production_incident',
  array[
    'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text',
    'timestamp with time zone', 'boolean', 'boolean'
  ],
  'transactional Fernly reservation RPC exists'
);

select is(
  (select kill_switch from public.production_paging_config where app_id = 'fernly'),
  true,
  'the Fernly kill switch defaults to enabled'
);

select has_column(
  'public',
  'production_paging_incidents',
  'dedupe_label',
  'incidents persist the exact Jira dedupe label'
);

select has_column(
  'public',
  'production_paging_incidents',
  'request_nonce',
  'incidents persist an app-scoped request nonce'
);

select hasnt_column(
  'public',
  'production_paging_incidents',
  'principal_hash',
  'paging incidents do not retain a user-derived principal hash'
);

insert into test_results (name, value)
values (
  'disabled',
  pg_temp.reserve_incident(
    'fernly',
    'production',
    'production_canary',
    'controlled_test',
    '00000000000000000000000000000001',
    '10000000000000000000000000000001',
    repeat('1', 64)
  )
);

select is(
  (select value->>'status' from test_results where name = 'disabled'),
  'disabled',
  'kill switch rejects a valid reservation before delivery state is created'
);

select is(
  (select count(*) from public.production_paging_incidents),
  0::bigint,
  'kill-switch rejection creates no incident or provider/Jira activity'
);

update public.production_paging_config
set enabled = true,
    kill_switch = false,
    cooldown_seconds = 900,
    hourly_limit = 10
where app_id = 'fernly';

insert into test_results (name, value)
values (
  'first',
  pg_temp.reserve_incident(
    'fernly',
    'production',
    'production_canary',
    'controlled_test',
    '00000000000000000000000000000001',
    '10000000000000000000000000000001',
    repeat('1', 64)
  )
);

select is(
  (select value->>'status' from test_results where name = 'first'),
  'reserved',
  'first enabled event reserves delivery'
);

select matches(
  (select value->>'dedupe_label' from test_results where name = 'first'),
  '^fernly-incident-[a-f0-9]{24}$',
  'reservation creates an exact Fernly 24-hex Jira label'
);

select ok(
  (select (value->>'send_provider')::boolean and (value->>'send_jira')::boolean
   from test_results where name = 'first'),
  'first event independently schedules provider and Jira delivery'
);

insert into test_results (name, value)
values (
  'replay',
  pg_temp.reserve_incident(
    'fernly',
    'production',
    'production_canary',
    'controlled_test',
    '00000000000000000000000000000001',
    '10000000000000000000000000000001',
    repeat('1', 64)
  )
);

select is(
  (select value->>'status' from test_results where name = 'replay'),
  'duplicate',
  'exact replay is recognized as a duplicate'
);

select is(
  (select (value->>'send_provider')::boolean from test_results where name = 'replay'),
  false,
  'exact replay cannot send a second provider email'
);

select is(
  (select (value->>'send_jira')::boolean from test_results where name = 'replay'),
  true,
  'exact replay schedules the Jira update branch'
);

select is(
  (select count(*) from public.production_paging_incidents),
  1::bigint,
  'exact replay keeps one incident row'
);

select is(
  pg_temp.incident_occurrence_count(),
  2,
  'exact replay increments occurrence count on the existing incident'
);

select is(
  pg_temp.lease_delivery(
    (select (value->>'incident_id')::uuid from test_results where name = 'replay'),
    'jira',
    (select value->>'jira_delivery_key' from test_results where name = 'replay')
  ),
  1,
  'Jira replay delivery acquires an independent lease'
);

insert into test_results (name, value)
values (
  'nonce_conflict',
  pg_temp.reserve_incident(
    'fernly',
    'production',
    'production_canary',
    'controlled_test',
    '00000000000000000000000000000002',
    '10000000000000000000000000000001',
    repeat('2', 64)
  )
);

select is(
  (select value->>'status' from test_results where name = 'nonce_conflict'),
  'replay_conflict',
  'a reused nonce with a different canonical digest is rejected'
);

select is(
  (select count(*) from public.production_paging_incidents),
  1::bigint,
  'nonce conflict creates no additional incident row'
);

insert into test_results (name, value)
values (
  'cooldown',
  pg_temp.reserve_incident(
    'fernly',
    'production',
    'production_canary',
    'controlled_test',
    '00000000000000000000000000000003',
    '10000000000000000000000000000003',
    repeat('3', 64)
  )
);

select is(
  (select value->>'status' from test_results where name = 'cooldown'),
  'cooldown',
  'same operational pair inside cooldown updates the existing incident'
);

select ok(
  (select not (value->>'send_provider')::boolean and (value->>'send_jira')::boolean
   from test_results where name = 'cooldown'),
  'cooldown suppresses email while preserving the Jira update'
);

select ok(
  pg_temp.complete_delivery(
    (select (value->>'incident_id')::uuid from test_results where name = 'replay'),
    'jira',
    (select value->>'jira_delivery_key' from test_results where name = 'replay')
  ),
  'a later cooldown occurrence cannot invalidate the leased Jira replay'
);

select is(
  pg_temp.lease_delivery(
    (select (value->>'incident_id')::uuid from test_results where name = 'cooldown'),
    'jira',
    (select value->>'jira_delivery_key' from test_results where name = 'cooldown')
  ),
  1,
  'cooldown Jira update keeps its own pending outbox lease'
);

update public.production_paging_config
set cooldown_seconds = 60,
    hourly_limit = 1
where app_id = 'fernly';

insert into test_results (name, value)
values (
  'quota_first',
  pg_temp.reserve_incident(
    'fernly',
    'production',
    'identify_failed',
    'openai_unavailable',
    '00000000000000000000000000000004',
    '10000000000000000000000000000004',
    repeat('4', 64)
  )
), (
  'quota_second',
  pg_temp.reserve_incident(
    'fernly',
    'production',
    'identify_failed',
    'validation_failed',
    '00000000000000000000000000000005',
    '10000000000000000000000000000005',
    repeat('5', 64)
  )
);

select is(
  (select value->>'status' from test_results where name = 'quota_second'),
  'rate_limited',
  'the second same-category delivery is rejected at the hourly quota'
);

select is(
  pg_temp.lease_delivery(
    (select (value->>'incident_id')::uuid from test_results where name = 'first'),
    'provider',
    (select value->>'provider_delivery_key' from test_results where name = 'first')
  ),
  1,
  'pending provider delivery can acquire one bounded lease'
);

select is(
  pg_temp.lease_delivery(
    (select (value->>'incident_id')::uuid from test_results where name = 'first'),
    'provider',
    (select value->>'provider_delivery_key' from test_results where name = 'first')
  ),
  0,
  'an active provider lease cannot be acquired twice'
);

select ok(
  pg_temp.complete_delivery(
    (select (value->>'incident_id')::uuid from test_results where name = 'first'),
    'provider',
    (select value->>'provider_delivery_key' from test_results where name = 'first')
  ),
  'leased provider delivery can be completed'
);

select is(
  pg_temp.lease_delivery(
    (select (value->>'incident_id')::uuid from test_results where name = 'first'),
    'provider',
    (select value->>'provider_delivery_key' from test_results where name = 'first')
  ),
  0,
  'completed provider delivery cannot be leased again'
);

select ok(
  pg_temp.role_cannot_reserve('anon'),
  'anonymous clients cannot execute the reservation RPC'
);

select ok(
  pg_temp.role_cannot_reserve('authenticated'),
  'authenticated clients cannot execute the reservation RPC directly'
);

select * from finish();

rollback;
