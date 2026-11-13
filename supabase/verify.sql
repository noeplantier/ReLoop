-- Verification + example query. Run in the Supabase SQL editor (or psql) AFTER migrations and seed.

-- 1) Row counts (expect: 5 suppliers, 5 categories, 30 items, 31 availability windows, 5 assumptions)
select 'suppliers' t, count(*) from suppliers union all
select 'equipment_categories', count(*) from equipment_categories union all
select 'inventory_items', count(*) from inventory_items union all
select 'inventory_availability', count(*) from inventory_availability union all
select 'impact_assumptions', count(*) from impact_assumptions;

-- 1b) Every item has a weight and material (expect 0 rows)
select id, name from inventory_items where weight_kg is null or main_material is null;

-- 2) RLS enabled on every table (expect all true)
select relname, relrowsecurity from pg_class
where relname in ('suppliers','equipment_categories','inventory_items','inventory_availability','impact_assumptions')
order by relname;

-- 3) No anon/authenticated privileges (expect 0 rows)
select grantee, table_name, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon','authenticated')
  and table_name in ('suppliers','equipment_categories','inventory_items','inventory_availability','impact_assumptions');

-- 4) Constraints that must REJECT bad data. Each statement below should fail; they are
--    wrapped in a rolled-back transaction so nothing persists. Run one at a time.
-- begin;
--   -- overlap: item 1 already has 20-25 Nov
--   insert into inventory_availability (inventory_item_id, available_from, available_until, quantity_available)
--   values ('b0000000-0000-4000-8000-000000000001', '2026-11-24', '2026-11-26', 1);   -- exclusion violation
-- rollback;
-- begin;
--   -- stock above total (item 1 total = 200)
--   update inventory_availability set quantity_available = 999
--   where inventory_item_id = 'b0000000-0000-4000-8000-000000000001';                 -- check_violation
-- rollback;
-- begin;
--   -- lowering total below declared availability (150)
--   update inventory_items set quantity_total = 100 where id = 'b0000000-0000-4000-8000-000000000001';  -- check_violation
-- rollback;

-- 5) EXAMPLE matching query: category 'chairs', whole event 21-23 Nov, need 50 units,
--    only loan/rental, one window must cover the entire range, enough declared stock.
select i.id, i.name, s.name as supplier, i.condition, i.reuse_mode, i.unit_price_per_day_try,
       a.quantity_available
from inventory_items i
join equipment_categories c on c.id = i.category_id
join suppliers s            on s.id = i.supplier_id
join inventory_availability a on a.inventory_item_id = i.id
where c.slug = 'chairs'
  and i.reuse_mode in ('loan','rental')
  and a.available_from <= date '2026-11-21'
  and a.available_until >= date '2026-11-23'
  and a.quantity_available >= 50;
