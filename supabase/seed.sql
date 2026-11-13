-- Rerunnable demo seed. ALL DATA IS FICTIONAL; no real businesses, no personal data.
-- Generated with fixed UUIDs; safe to run repeatedly (ON CONFLICT DO UPDATE).

insert into suppliers (id, name, city, latitude, longitude, is_demo) values
  ('a0000000-0000-4000-8000-000000000001', 'Demo Lara Event Hall (fictional)', 'Antalya', 36.853, 30.8, true),
  ('a0000000-0000-4000-8000-000000000002', 'Demo Konyaalti Hotel Storage (fictional)', 'Antalya', 36.88, 30.64, true),
  ('a0000000-0000-4000-8000-000000000003', 'Demo Kepez Equipment Depot (fictional)', 'Antalya', 36.93, 30.7, true),
  ('a0000000-0000-4000-8000-000000000004', 'Demo Belek Resort Warehouse (fictional)', 'Serik', 36.86, 31.05, true),
  ('a0000000-0000-4000-8000-000000000005', 'Demo Kemer Community Collective (fictional)', 'Kemer', 36.6, 30.56, true)
on conflict (id) do update set name=excluded.name, city=excluded.city,
  latitude=excluded.latitude, longitude=excluded.longitude, is_demo=excluded.is_demo;

insert into equipment_categories (id, slug, name, unit_label) values
  ('c0000000-0000-4000-8000-000000000001', 'tables', 'Tables', 'table'),
  ('c0000000-0000-4000-8000-000000000002', 'chairs', 'Chairs', 'chair'),
  ('c0000000-0000-4000-8000-000000000003', 'lighting', 'Lighting', 'light'),
  ('c0000000-0000-4000-8000-000000000004', 'signage', 'Signage', 'sign'),
  ('c0000000-0000-4000-8000-000000000005', 'staging', 'Staging', 'platform')
on conflict (id) do update set slug=excluded.slug, name=excluded.name, unit_label=excluded.unit_label;

insert into inventory_items (id, supplier_id, category_id, name, description, quantity_total, condition, reuse_mode, unit_price_per_day_try, weight_kg, main_material, weight_is_estimate, is_demo) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'Stackable banquet chairs', 'Fictional demo item.', 200, 'excellent', 'rental', 12, 5.0, 'metals', true, true),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'Folding chairs, white', 'Fictional demo item.', 120, 'good', 'rental', 8, 4.0, 'metals', true, true),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Round banquet tables, 180 cm', 'Fictional demo item.', 24, 'good', 'rental', 90, 30.0, 'wood', true, true),
  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 'LED uplighters (battery)', 'Fictional demo item.', 30, 'excellent', 'rental', 55, 2.5, 'electrical_small', true, true),
  ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000004', 'Roll-up banners', 'Fictional demo item.', 15, 'good', 'loan', null, 3.0, 'metals', true, true),
  ('b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000005', 'Modular stage decks 1x2 m', 'Fictional demo item.', 16, 'fair', 'rental', 140, 25.0, 'wood', true, true),
  ('b0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'Conference chairs, upholstered', 'Fictional demo item.', 80, 'excellent', 'rental', 20, 9.0, 'metals', true, true),
  ('b0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'Cocktail tables', 'Fictional demo item.', 30, 'good', 'rental', 45, 12.0, 'metals', true, true),
  ('b0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'Boardroom tables', 'Fictional demo item.', 10, 'excellent', 'rental', 120, 45.0, 'wood', true, true),
  ('b0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003', 'Stage par lights LED', 'Fictional demo item.', 24, 'good', 'rental', 70, 3.0, 'electrical_small', true, true),
  ('b0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000004', 'Directional floor signs', 'Fictional demo item.', 40, 'good', 'loan', null, 2.0, 'plastics_rigid', true, true),
  ('b0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000005', 'Lectern with microphone stand', 'Fictional demo item.', 4, 'excellent', 'rental', 160, 12.0, 'wood', true, true),
  ('b0000000-0000-4000-8000-000000000013', 'a0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', 'Plastic stacking chairs', 'Fictional demo item.', 300, 'fair', 'rental', 5, 3.0, 'plastics_rigid', true, true),
  ('b0000000-0000-4000-8000-000000000014', 'a0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', 'Bar stools', 'Fictional demo item.', 40, 'good', 'rental', 18, 6.0, 'metals', true, true),
  ('b0000000-0000-4000-8000-000000000015', 'a0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'Trestle tables 2 m', 'Fictional demo item.', 60, 'fair', 'rental', 25, 15.0, 'wood', true, true),
  ('b0000000-0000-4000-8000-000000000016', 'a0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000003', 'Moving head spots', 'Fictional demo item.', 8, 'good', 'rental', 250, 12.0, 'electrical_large', true, true),
  ('b0000000-0000-4000-8000-000000000017', 'a0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000004', 'A-frame boards', 'Fictional demo item.', 25, 'fair', 'loan', null, 6.0, 'wood', true, true),
  ('b0000000-0000-4000-8000-000000000018', 'a0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000005', 'Truss kit 6 m', 'Fictional demo item.', 3, 'good', 'rental', 400, 30.0, 'metals', true, true),
  ('b0000000-0000-4000-8000-000000000019', 'a0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000002', 'Chiavari chairs, gold', 'Fictional demo item.', 150, 'excellent', 'rental', 30, 4.5, 'wood', true, true),
  ('b0000000-0000-4000-8000-000000000020', 'a0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'Long banquet tables 240 cm', 'Fictional demo item.', 20, 'excellent', 'rental', 110, 22.0, 'wood', true, true),
  ('b0000000-0000-4000-8000-000000000021', 'a0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000003', 'String festoon lights 20 m', 'Fictional demo item.', 12, 'good', 'rental', 80, 4.0, 'electrical_small', true, true),
  ('b0000000-0000-4000-8000-000000000022', 'a0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000004', 'Illuminated entrance arch', 'Fictional demo item.', 2, 'excellent', 'rental', 500, 40.0, 'metals', true, true),
  ('b0000000-0000-4000-8000-000000000023', 'a0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000005', 'Stage riser 4x3 m with skirt', 'Fictional demo item.', 4, 'excellent', 'rental', 600, 150.0, 'wood', true, true),
  ('b0000000-0000-4000-8000-000000000024', 'a0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000002', 'Lounge armchairs', 'Fictional demo item.', 20, 'good', 'donation', 0, 14.0, 'wood', true, true),
  ('b0000000-0000-4000-8000-000000000025', 'a0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000002', 'Wooden folding chairs', 'Fictional demo item.', 70, 'fair', 'loan', null, 5.0, 'wood', true, true),
  ('b0000000-0000-4000-8000-000000000026', 'a0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', 'Community picnic tables', 'Fictional demo item.', 14, 'fair', 'loan', null, 35.0, 'wood', true, true),
  ('b0000000-0000-4000-8000-000000000027', 'a0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000003', 'Solar lantern set', 'Fictional demo item.', 40, 'good', 'loan', null, 1.0, 'plastics_rigid', true, true),
  ('b0000000-0000-4000-8000-000000000028', 'a0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000004', 'Hand-painted wooden signs', 'Fictional demo item.', 18, 'good', 'donation', 0, 5.0, 'wood', true, true),
  ('b0000000-0000-4000-8000-000000000029', 'a0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000005', 'Pallet stage platforms', 'Fictional demo item.', 10, 'fair', 'loan', null, 20.0, 'wood', true, true),
  ('b0000000-0000-4000-8000-000000000030', 'a0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', 'Standing bar tables (resale)', 'Fictional demo item.', 8, 'good', 'resale', 0, 14.0, 'metals', true, true)
on conflict (id) do update set supplier_id=excluded.supplier_id, category_id=excluded.category_id,
  name=excluded.name, description=excluded.description, quantity_total=excluded.quantity_total,
  condition=excluded.condition, reuse_mode=excluded.reuse_mode,
  unit_price_per_day_try=excluded.unit_price_per_day_try, weight_kg=excluded.weight_kg,
  main_material=excluded.main_material, weight_is_estimate=excluded.weight_is_estimate,
  is_demo=excluded.is_demo;

insert into inventory_availability (id, inventory_item_id, available_from, available_until, quantity_available) values
  ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', '2026-11-20', '2026-11-25', 150),
  ('d0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', '2026-11-20', '2026-11-25', 120),
  ('d0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000003', '2026-11-20', '2026-11-25', 20),
  ('d0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000004', '2026-11-20', '2026-11-22', 30),
  ('d0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000005', '2026-11-20', '2026-11-25', 15),
  ('d0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000006', '2026-11-21', '2026-11-25', 16),
  ('d0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000007', '2026-11-20', '2026-11-25', 60),
  ('d0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000008', '2026-11-20', '2026-11-25', 30),
  ('d0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000009', '2026-11-23', '2026-11-25', 10),
  ('d0000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000010', '2026-11-20', '2026-11-25', 24),
  ('d0000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000011', '2026-11-20', '2026-11-25', 40),
  ('d0000000-0000-4000-8000-000000000012', 'b0000000-0000-4000-8000-000000000012', '2026-11-20', '2026-11-25', 0),
  ('d0000000-0000-4000-8000-000000000013', 'b0000000-0000-4000-8000-000000000013', '2026-11-20', '2026-11-25', 300),
  ('d0000000-0000-4000-8000-000000000014', 'b0000000-0000-4000-8000-000000000014', '2026-11-20', '2026-11-25', 25),
  ('d0000000-0000-4000-8000-000000000015', 'b0000000-0000-4000-8000-000000000015', '2026-11-20', '2026-11-25', 60),
  ('d0000000-0000-4000-8000-000000000016', 'b0000000-0000-4000-8000-000000000016', '2026-11-22', '2026-11-25', 8),
  ('d0000000-0000-4000-8000-000000000017', 'b0000000-0000-4000-8000-000000000017', '2026-11-20', '2026-11-25', 25),
  ('d0000000-0000-4000-8000-000000000018', 'b0000000-0000-4000-8000-000000000018', '2026-11-20', '2026-11-25', 2),
  ('d0000000-0000-4000-8000-000000000019', 'b0000000-0000-4000-8000-000000000019', '2026-11-21', '2026-11-24', 150),
  ('d0000000-0000-4000-8000-000000000020', 'b0000000-0000-4000-8000-000000000020', '2026-11-20', '2026-11-25', 18),
  ('d0000000-0000-4000-8000-000000000021', 'b0000000-0000-4000-8000-000000000021', '2026-11-20', '2026-11-25', 12),
  ('d0000000-0000-4000-8000-000000000022', 'b0000000-0000-4000-8000-000000000022', '2026-11-20', '2026-11-25', 0),
  ('d0000000-0000-4000-8000-000000000023', 'b0000000-0000-4000-8000-000000000023', '2026-11-20', '2026-11-25', 4),
  ('d0000000-0000-4000-8000-000000000024', 'b0000000-0000-4000-8000-000000000024', '2026-11-20', '2026-11-25', 20),
  ('d0000000-0000-4000-8000-000000000025', 'b0000000-0000-4000-8000-000000000025', '2026-11-20', '2026-11-25', 70),
  ('d0000000-0000-4000-8000-000000000026', 'b0000000-0000-4000-8000-000000000026', '2026-11-20', '2026-11-25', 14),
  ('d0000000-0000-4000-8000-000000000027', 'b0000000-0000-4000-8000-000000000027', '2026-11-20', '2026-11-22', 40),
  ('d0000000-0000-4000-8000-000000000028', 'b0000000-0000-4000-8000-000000000027', '2026-11-23', '2026-11-25', 25),
  ('d0000000-0000-4000-8000-000000000029', 'b0000000-0000-4000-8000-000000000028', '2026-11-20', '2026-11-25', 18),
  ('d0000000-0000-4000-8000-000000000030', 'b0000000-0000-4000-8000-000000000029', '2026-11-20', '2026-11-25', 10),
  ('d0000000-0000-4000-8000-000000000031', 'b0000000-0000-4000-8000-000000000030', '2026-11-20', '2026-11-25', 8)
on conflict (id) do update set inventory_item_id=excluded.inventory_item_id,
  available_from=excluded.available_from, available_until=excluded.available_until,
  quantity_available=excluded.quantity_available;

-- Impact assumptions: NO numeric factors and NO source references are invented here.
-- avoided_kgco2e_per_unit stays NULL until a published factor is entered (then set status 'sourced').
insert into impact_assumptions (id, category_id, baseline_description, avoided_kgco2e_per_unit, source_reference, methodology_note, assumption_status, is_demo) values
  ('e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Baseline: buying a new table for a single event instead of reusing an existing one.', null, null, 'Placeholder. Factor not yet sourced; do not present as a verified impact claim.', 'illustrative', true),
  ('e0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'Baseline: buying a new chair for a single event instead of reusing an existing one.', null, null, 'Placeholder. Factor not yet sourced; do not present as a verified impact claim.', 'illustrative', true),
  ('e0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000003', 'Baseline: buying a new light for a single event instead of reusing an existing one.', null, null, 'Placeholder. Factor not yet sourced; do not present as a verified impact claim.', 'illustrative', true),
  ('e0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000004', 'Baseline: buying a new sign for a single event instead of reusing an existing one.', null, null, 'Placeholder. Factor not yet sourced; do not present as a verified impact claim.', 'illustrative', true),
  ('e0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000005', 'Baseline: buying a new platform for a single event instead of reusing an existing one.', null, null, 'Placeholder. Factor not yet sourced; do not present as a verified impact claim.', 'illustrative', true)
on conflict (id) do update set category_id=excluded.category_id,
  baseline_description=excluded.baseline_description,
  avoided_kgco2e_per_unit=excluded.avoided_kgco2e_per_unit,
  source_reference=excluded.source_reference, methodology_note=excluded.methodology_note,
  assumption_status=excluded.assumption_status, is_demo=excluded.is_demo;
