-- Least-privilege login for the API: reads the 5 ReLoop tables and nothing else.
-- Why: the shared Supabase project also holds other apps' tables (e.g. staff, payroll). The
-- service-role key can read all of them and bypasses RLS; this role cannot.
--
-- The password is NOT set here (never in git). A team member sets it once in the SQL editor:
--   alter role reloop_reader with password '<generate a long random one>';
-- and puts the pooler connection string into the server's DATABASE_URL (see docs/DEPLOY.md).

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'reloop_reader') then
    create role reloop_reader login noinherit nocreatedb nocreaterole;
  end if;
end $$;

-- Read-only by default, short queries only.
alter role reloop_reader set default_transaction_read_only = on;
alter role reloop_reader set statement_timeout = '5s';

grant usage on schema public to reloop_reader;
grant select on suppliers, equipment_categories, inventory_items,
                inventory_availability, impact_assumptions to reloop_reader;

-- RLS is on with no policies (0002), so a plain grant would return 0 rows. Allow SELECT for
-- this role only; anon/authenticated still get nothing.
drop policy if exists reloop_reader_select on suppliers;
create policy reloop_reader_select on suppliers for select to reloop_reader using (true);
drop policy if exists reloop_reader_select on equipment_categories;
create policy reloop_reader_select on equipment_categories for select to reloop_reader using (true);
drop policy if exists reloop_reader_select on inventory_items;
create policy reloop_reader_select on inventory_items for select to reloop_reader using (true);
drop policy if exists reloop_reader_select on inventory_availability;
create policy reloop_reader_select on inventory_availability for select to reloop_reader using (true);
drop policy if exists reloop_reader_select on impact_assumptions;
create policy reloop_reader_select on impact_assumptions for select to reloop_reader using (true);
