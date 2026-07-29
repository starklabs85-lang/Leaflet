alter table public.care_logs
  drop constraint if exists care_logs_task_type_check;

alter table public.care_logs
  add constraint care_logs_task_type_check
  check (task_type in ('water', 'fertilize', 'repot', 'prune', 'rotate', 'mist', 'note'));
