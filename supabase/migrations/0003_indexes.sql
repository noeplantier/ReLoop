-- Foreign-key indexes + the one real query pattern:
-- "items of category X whose single availability window covers [start, end] with enough stock".
-- (The exclusion constraint already creates a GiST index on (inventory_item_id, daterange).)

create index if not exists inventory_items_category_idx on inventory_items (category_id);
create index if not exists inventory_items_supplier_idx on inventory_items (supplier_id);
create index if not exists impact_assumptions_category_idx on impact_assumptions (category_id);
