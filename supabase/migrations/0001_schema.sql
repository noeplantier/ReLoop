-- ReLoop schema (backend-only MVP). All demo data is fictional.
-- Apply in order: 0001_schema.sql, 0002_constraints_security.sql, 0003_indexes.sql.

-- btree_gist is needed ONLY for the no-overlap exclusion constraint on availability windows.
create extension if not exists btree_gist;

create table if not exists suppliers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  city        text not null,
  latitude    double precision not null check (latitude between -90 and 90),
  longitude   double precision not null check (longitude between -180 and 180),
  is_demo     boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists equipment_categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug in ('tables','chairs','lighting','signage','staging')),
  name        text not null,
  unit_label  text not null,
  created_at  timestamptz not null default now()
);

create table if not exists inventory_items (
  id                      uuid primary key default gen_random_uuid(),
  supplier_id             uuid not null references suppliers(id) on delete restrict,
  category_id             uuid not null references equipment_categories(id) on delete restrict,
  name                    text not null check (length(trim(name)) > 0),
  description             text,
  quantity_total          integer not null check (quantity_total > 0),
  condition               text not null check (condition in ('excellent','good','fair')),
  reuse_mode              text not null check (reuse_mode in ('loan','rental','donation','resale')),
  unit_price_per_day_try  numeric(10,2) check (unit_price_per_day_try is null or unit_price_per_day_try >= 0),
  is_demo                 boolean not null default true,
  created_at              timestamptz not null default now()
);
comment on column inventory_items.reuse_mode is
  'MVP matching quotes only loan and rental. donation/resale are stored but excluded from bundles.';

-- Declared availability, NOT confirmed reservations.
create table if not exists inventory_availability (
  id                  uuid primary key default gen_random_uuid(),
  inventory_item_id   uuid not null references inventory_items(id) on delete cascade,
  available_from      date not null,
  available_until     date not null,
  quantity_available  integer not null check (quantity_available >= 0),
  created_at          timestamptz not null default now(),
  check (available_until >= available_from),
  -- Rule: windows of the same item must not overlap (inclusive of both end dates).
  -- Enforced by Postgres itself, so no application or race-condition can bypass it.
  constraint inventory_availability_no_overlap
    exclude using gist (
      inventory_item_id with =,
      daterange(available_from, available_until, '[]') with &&
    )
);

create table if not exists impact_assumptions (
  id                        uuid primary key default gen_random_uuid(),
  category_id               uuid not null references equipment_categories(id) on delete cascade,
  baseline_description      text not null,
  avoided_kgco2e_per_unit   numeric(12,4) check (avoided_kgco2e_per_unit is null or avoided_kgco2e_per_unit >= 0),
  source_reference          text,
  methodology_note          text not null,
  assumption_status         text not null check (assumption_status in ('illustrative','sourced')),
  is_demo                   boolean not null default true,
  created_at                timestamptz not null default now(),
  -- A 'sourced' factor must carry a value and a source; never the other way round by accident.
  check (assumption_status <> 'sourced'
         or (avoided_kgco2e_per_unit is not null and source_reference is not null))
);
