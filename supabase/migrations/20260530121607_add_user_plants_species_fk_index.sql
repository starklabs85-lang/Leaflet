create index user_plants_species_id_idx
  on public.user_plants (species_id)
  where species_id is not null;
