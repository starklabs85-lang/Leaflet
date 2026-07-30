-- AppsFlyer OpenDSR delivery runs outside the account-deletion request so an
-- AppsFlyer outage never blocks Fernly account deletion. Credentials remain in
-- Vault and are resolved only when the cron job executes.
create extension if not exists pg_net
  with schema extensions;

create extension if not exists pg_cron;

do $$
begin
  if not exists (
    select 1
    from vault.secrets
    where name = 'appsflyer_erasure_worker_service_role'
  ) then
    raise exception
      'Missing Vault secret appsflyer_erasure_worker_service_role';
  end if;
end;
$$;

-- Run at minute seven to avoid clustering with hour-boundary maintenance.
-- The function validates the service-role bearer token before reading the
-- server-only queue. No identifier or credential is written to cron.job.
select cron.schedule(
  'process-appsflyer-erasure-hourly',
  '7 * * * *',
  $schedule$
    select net.http_post(
      url := 'https://gnrjqqoidzuwzvhhfggh.supabase.co/functions/v1/process-appsflyer-erasure',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'appsflyer_erasure_worker_service_role'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    ) as request_id;
  $schedule$
)
where not exists (
  select 1
  from cron.job
  where jobname = 'process-appsflyer-erasure-hourly'
);
