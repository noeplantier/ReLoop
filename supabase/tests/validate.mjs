import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";
// Validates supabase/migrations + seed on a local in-process Postgres (PGlite). No Docker, no network.
// Usage: cd supabase/tests && npm install && npm test
const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const db = new PGlite({ extensions: { btree_gist } });
const read = f => fs.readFileSync(`${R}/supabase/${f}`, "utf8");
let fails = 0;
const ok = (name, cond, extra="") => { console.log((cond ? "PASS " : "FAIL ") + name + (extra ? "  " + extra : "")); if (!cond) fails++; };
const mustFail = async (name, sql) => { try { await db.exec("begin;"+sql); await db.exec("rollback;"); ok(name, false, "statement succeeded but should have failed"); }
  catch (e) { try { await db.exec("rollback;"); } catch {} ok(name, true, "-> " + String(e.message).slice(0,70)); } };

// Simulate Supabase: roles exist and new tables are granted to anon/authenticated by default.
await db.exec(`create role anon; create role authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;`);
// Stand-in for another app's table living in the same shared project (must stay unreadable).
await db.exec(`create table payroll (id int primary key, amount numeric); insert into payroll values (1, 100);`);
for (const f of ["0001_schema.sql","0002_constraints_security.sql","0003_indexes.sql","0004_weight_material.sql","0005_readonly_role.sql"].map(x=>"migrations/"+x)) {
  try { await db.exec(read(f)); ok("migration " + f, true); } catch (e) { ok("migration " + f, false, e.message); }
}
try { await db.exec(read("seed.sql")); ok("seed first run", true); } catch (e) { ok("seed first run", false, e.message); }
try { await db.exec(read("seed.sql")); ok("seed second run (rerunnable)", true); } catch (e) { ok("seed second run", false, e.message); }

const one = async q => (await db.query(q)).rows;
const counts = Object.fromEntries((await one(`select 'suppliers' t, count(*)::int c from suppliers union all select 'cats',count(*)::int from equipment_categories union all select 'items',count(*)::int from inventory_items union all select 'avail',count(*)::int from inventory_availability union all select 'impact',count(*)::int from impact_assumptions`)).map(r=>[r.t,r.c]));
ok("row counts 5/5/30/31/5 (stable after 2 runs)", JSON.stringify(counts)===JSON.stringify({suppliers:5,cats:5,items:30,avail:31,impact:5}), JSON.stringify(counts));
ok("every item has weight+material", (await one(`select count(*)::int c from inventory_items where weight_kg is null or main_material is null`))[0].c===0);
const rls = await one(`select relname, relrowsecurity from pg_class where relname in ('suppliers','equipment_categories','inventory_items','inventory_availability','impact_assumptions')`);
ok("RLS on for all 5 tables", rls.length===5 && rls.every(r=>r.relrowsecurity));
const grants = await one(`select grantee, table_name from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') and table_name in ('suppliers','equipment_categories','inventory_items','inventory_availability','impact_assumptions')`);
ok("no anon/authenticated grants", grants.length===0, grants.length? JSON.stringify(grants.slice(0,3)):"");

await mustFail("overlapping availability window rejected", `insert into inventory_availability (inventory_item_id, available_from, available_until, quantity_available) values ('b0000000-0000-4000-8000-000000000001','2026-11-24','2026-11-26',1);`);
await mustFail("quantity_available > quantity_total rejected (insert)", `insert into inventory_availability (inventory_item_id, available_from, available_until, quantity_available) values ('b0000000-0000-4000-8000-000000000005','2026-12-01','2026-12-02',999);`);
await mustFail("quantity_available > quantity_total rejected (update)", `update inventory_availability set quantity_available=999 where inventory_item_id='b0000000-0000-4000-8000-000000000001';`);
await mustFail("lowering quantity_total below availability rejected", `update inventory_items set quantity_total=100 where id='b0000000-0000-4000-8000-000000000001';`);
await mustFail("available_until before available_from rejected", `insert into inventory_availability (inventory_item_id, available_from, available_until, quantity_available) values ('b0000000-0000-4000-8000-000000000001','2026-12-05','2026-12-01',1);`);
await mustFail("invalid latitude rejected", `insert into suppliers (name,city,latitude,longitude) values ('x','y',99,0);`);
await mustFail("bad condition value rejected", `update inventory_items set condition='mint' where id='b0000000-0000-4000-8000-000000000001';`);
await mustFail("'sourced' impact without value/source rejected", `insert into impact_assumptions (category_id,baseline_description,methodology_note,assumption_status) select id,'x','y','sourced' from equipment_categories limit 1;`);
await mustFail("negative price rejected", `update inventory_items set unit_price_per_day_try=-1 where id='b0000000-0000-4000-8000-000000000001';`);
// adjacent (non-overlapping) windows must still be allowed
try { await db.exec(`begin; insert into inventory_availability (inventory_item_id, available_from, available_until, quantity_available) values ('b0000000-0000-4000-8000-000000000001','2026-11-26','2026-11-27',10); rollback;`); ok("adjacent non-overlapping window accepted", true); } catch(e){ try{await db.exec("rollback;")}catch{}; ok("adjacent window accepted", false, e.message); }
// raising quantity_total must be allowed
try { await db.exec(`begin; update inventory_items set quantity_total=500 where id='b0000000-0000-4000-8000-000000000001'; rollback;`); ok("raising quantity_total accepted", true); } catch(e){ try{await db.exec("rollback;")}catch{}; ok("raising total accepted", false, e.message); }

const ex = await one(`select i.name, s.name as supplier, a.quantity_available from inventory_items i join equipment_categories c on c.id=i.category_id join suppliers s on s.id=i.supplier_id join inventory_availability a on a.inventory_item_id=i.id where c.slug='chairs' and i.reuse_mode in ('loan','rental') and a.available_from<=date '2026-11-21' and a.available_until>=date '2026-11-23' and a.quantity_available>=50`);
ok("example matching query returns rows", ex.length>0, ex.length+" rows");

// --- read-only API role (0005) ---
try { await db.exec(read("migrations/0005_readonly_role.sql")); ok("0005 rerunnable", true); } catch (e) { ok("0005 rerunnable", false, e.message); }
const q = fs.readFileSync(`${R}/backend/inventory_query.sql`, "utf8");
await db.exec("set role reloop_reader;");
try {
  const inv = (await db.query(q)).rows[0].inventory;
  const nAvail = inv.items.reduce((n, i) => n + i.availability.length, 0);
  ok("reloop_reader: inventory query sees 5 suppliers / 5 categories / 30 items / 31 windows",
     inv.suppliers.length===5 && inv.categories.length===5 && inv.items.length===30 && nAvail===31,
     `${inv.suppliers.length}/${inv.categories.length}/${inv.items.length}/${nAvail}`);
  ok("reloop_reader: query output has slug + weight fields", inv.items.every(i => i.category && "weight_kg" in i && "main_material" in i));
} catch (e) { ok("reloop_reader: inventory query", false, e.message); }
const asReader = async (name, sql) => { try { await db.exec(sql); ok(name, false, "succeeded but should have failed"); } catch (e) { ok(name, true, "-> " + String(e.message).slice(0,60)); } };
await asReader("reloop_reader cannot read other apps' tables", "select * from payroll;");
await asReader("reloop_reader cannot insert", "insert into suppliers (name,city,latitude,longitude) values ('x','y',0,0);");
await asReader("reloop_reader cannot update", "update inventory_items set name='x';");
await asReader("reloop_reader cannot delete", "delete from inventory_availability;");
await db.exec("reset role;");
await db.exec("set role anon;");
ok("anon still sees no ReLoop rows", await (async () => { try { return (await db.query("select count(*)::int c from suppliers")).rows[0].c === 0; } catch { return true; } })());
await db.exec("reset role;");
process.exitCode = fails ? 1 : 0;
console.log(fails? `\n${fails} FAILURE(S)` : "\nALL CHECKS PASSED");
