create policy "No client access to scan events"
  on public.scan_events
  for all
  to anon, authenticated
  using (false)
  with check (false);
