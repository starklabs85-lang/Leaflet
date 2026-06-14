-- Phase 14: structured placement signals for weather-aware care.
-- `placement` is the field the tip engine reads; the free-text
-- `user_plants.location` stays as a human label ("kitchen sill").
-- `unknown` is treated as indoor by the engine (safe default).

alter table public.user_plants
  add column placement text not null default 'unknown',
  add column light_exposure text not null default 'unknown';

alter table public.user_plants
  add constraint user_plants_placement_check
    check (placement in ('indoor', 'outdoor', 'balcony', 'unknown')),
  add constraint user_plants_light_exposure_check
    check (light_exposure in ('low', 'medium', 'bright', 'unknown'));
