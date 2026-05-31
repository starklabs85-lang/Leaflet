alter table public.diagnoses
  add column if not exists category text not null default 'unknown',
  add column if not exists severity text not null default 'mild',
  add column if not exists is_healthy boolean not null default false,
  add column if not exists follow_up_days integer not null default 7,
  add column if not exists treatment_steps jsonb not null default '[]'::jsonb;

alter table public.diagnoses
  drop constraint if exists diagnoses_category_check,
  add constraint diagnoses_category_check
  check (
    category in (
      'disease',
      'pest',
      'nutrient_deficiency',
      'environmental',
      'unknown'
    )
  );

alter table public.diagnoses
  drop constraint if exists diagnoses_severity_check,
  add constraint diagnoses_severity_check
  check (severity in ('mild', 'moderate', 'severe'));

alter table public.diagnoses
  drop constraint if exists diagnoses_follow_up_days_check,
  add constraint diagnoses_follow_up_days_check
  check (follow_up_days between 1 and 60);

alter table public.diagnoses
  drop constraint if exists diagnoses_treatment_steps_is_array,
  add constraint diagnoses_treatment_steps_is_array
  check (jsonb_typeof(treatment_steps) = 'array');

alter table public.scan_events
  drop constraint if exists scan_events_scan_type_check;

alter table public.scan_events
  add constraint scan_events_scan_type_check
  check (scan_type in ('identify', 'diagnose'));

alter table public.care_tasks
  drop constraint if exists care_tasks_type_check;

alter table public.care_tasks
  add constraint care_tasks_type_check
  check (
    type in (
      'water',
      'fertilize',
      'repot',
      'prune',
      'rotate',
      'mist',
      'check_diagnosis'
    )
  );

create index if not exists diagnoses_user_plant_follow_up_idx
  on public.diagnoses (user_plant_id, follow_up_date)
  where user_plant_id is not null and follow_up_date is not null;
