-- Adds what the avoided-emissions estimate needs: weight per unit and the main material.
-- Estimate = (weight_kg / 1000) * material factor (kgCO2e per tonne, DEFRA 2025) * quantity,
-- minus delivery transport. Material and weight are assumptions unless weight_is_estimate = false.

alter table inventory_items
  add column if not exists weight_kg numeric(8,2) check (weight_kg is null or weight_kg > 0),
  add column if not exists main_material text
    check (main_material is null or main_material in
      ('wood','metals','plastics_rigid','electrical_small','electrical_large')),
  add column if not exists weight_is_estimate boolean not null default true;

comment on column inventory_items.weight_kg is 'Weight of ONE unit in kg.';
comment on column inventory_items.weight_is_estimate is
  'true = rough guess (demo data); impact derived from it must be labelled illustrative.';
