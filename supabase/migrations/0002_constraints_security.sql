-- 1) quantity_available must never exceed quantity_total, on both sides.

create or replace function check_availability_vs_total() returns trigger
language plpgsql as $$
declare total integer;
begin
  select quantity_total into total from inventory_items where id = new.inventory_item_id;
  if new.quantity_available > total then
    raise exception 'quantity_available (%) exceeds quantity_total (%) for item %',
      new.quantity_available, total, new.inventory_item_id
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists trg_availability_vs_total on inventory_availability;
create trigger trg_availability_vs_total
  before insert or update of quantity_available, inventory_item_id on inventory_availability
  for each row execute function check_availability_vs_total();

-- When quantity_total is lowered, reject if any declared window would exceed it.
create or replace function check_total_vs_availability() returns trigger
language plpgsql as $$
begin
  if new.quantity_total < old.quantity_total
     and exists (select 1 from inventory_availability
                 where inventory_item_id = new.id and quantity_available > new.quantity_total) then
    raise exception 'quantity_total (%) is below an existing availability window for item %',
      new.quantity_total, new.id using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists trg_total_vs_availability on inventory_items;
create trigger trg_total_vs_availability
  before update of quantity_total on inventory_items
  for each row execute function check_total_vs_availability();

-- 2) Security: backend-only. RLS on, no policies, no grants to anon/authenticated.
-- The FastAPI server uses the service-role key, which BYPASSES RLS. That key must never be
-- embedded in a client app, committed, or logged. RLS here is a safety net, not a substitute
-- for access control in the API itself.

alter table suppliers              enable row level security;
alter table equipment_categories   enable row level security;
alter table inventory_items        enable row level security;
alter table inventory_availability enable row level security;
alter table impact_assumptions     enable row level security;

revoke all on suppliers, equipment_categories, inventory_items,
              inventory_availability, impact_assumptions from anon, authenticated;
