alter table public.care_logs
  drop constraint if exists care_logs_task_type_check;

alter table public.care_logs
  add constraint care_logs_task_type_check
  check (
    task_type in (
      'water',
      'fertilize',
      'repot',
      'prune',
      'rotate',
      'mist',
      'note',
      'growth_photo'
    )
  );

create index if not exists care_logs_growth_timeline_idx
  on public.care_logs (user_id, user_plant_id, logged_at desc)
  where task_type = 'growth_photo' and photo_url is not null;
