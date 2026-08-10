\set ON_ERROR_STOP on

do $$
declare
  v_enabled boolean;
  v_kill_switch boolean;
begin
  select enabled, kill_switch
  into v_enabled, v_kill_switch
  from public.production_paging_config
  where app_id = 'fernly';

  if not found then
    raise exception 'fernly paging config missing';
  end if;

  if v_enabled or not v_kill_switch then
    raise exception 'fernly paging is not dormant';
  end if;

  if to_regprocedure(
    'public.reserve_fernly_production_incident(text,text,text,text,text,text,text,text,timestamp with time zone,boolean,boolean)'
  ) is null then
    raise exception 'fernly reservation RPC missing';
  end if;

  if has_function_privilege(
    'anon',
    'public.reserve_fernly_production_incident(text,text,text,text,text,text,text,text,timestamp with time zone,boolean,boolean)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.reserve_fernly_production_incident(text,text,text,text,text,text,text,text,timestamp with time zone,boolean,boolean)',
    'EXECUTE'
  ) then
    raise exception 'client role can execute fernly reservation RPC';
  end if;
end;
$$;

select
  app_id,
  enabled,
  kill_switch,
  threshold_count,
  cooldown_seconds,
  hourly_limit
from public.production_paging_config
where app_id = 'fernly';

select
  count(*) as incident_count,
  count(*) filter (where provider_state in ('pending', 'leased')) as provider_open_count,
  count(*) filter (where jira_state in ('pending', 'leased')) as jira_open_count
from public.production_paging_incidents
where app_id = 'fernly';
