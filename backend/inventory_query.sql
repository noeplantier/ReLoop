-- Whole inventory as ONE JSON document, in the shape inventory.py normalises to.
-- Used by the DATABASE_URL path (read-only role reloop_reader) and by supabase/tests/validate.mjs.
select json_build_object(
  'suppliers', (select coalesce(json_agg(json_build_object(
      'id', s.id, 'name', s.name, 'city', s.city,
      'latitude', s.latitude, 'longitude', s.longitude) order by s.id), '[]'::json)
    from suppliers s),
  'categories', (select coalesce(json_agg(json_build_object(
      'slug', c.slug, 'name', c.name, 'unit_label', c.unit_label) order by c.slug), '[]'::json)
    from equipment_categories c),
  'items', (select coalesce(json_agg(json_build_object(
      'id', i.id, 'supplier_id', i.supplier_id, 'category', c.slug, 'name', i.name,
      'quantity_total', i.quantity_total, 'condition', i.condition, 'reuse_mode', i.reuse_mode,
      'unit_price_per_day_try', i.unit_price_per_day_try, 'weight_kg', i.weight_kg,
      'main_material', i.main_material, 'weight_is_estimate', i.weight_is_estimate,
      'availability', (select coalesce(json_agg(json_build_object(
          'available_from', a.available_from, 'available_until', a.available_until,
          'quantity_available', a.quantity_available) order by a.available_from), '[]'::json)
        from inventory_availability a where a.inventory_item_id = i.id)
    ) order by i.id), '[]'::json)
    from inventory_items i join equipment_categories c on c.id = i.category_id)
) as inventory;
