-- Keep the persisted allowlist as strict as the Edge Function parser: a valid
-- code must belong to its declared incident category, even for service-role
-- callers.
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
  );
