"""Batch (greedy vs MILP) + robustness checks. Run from backend/:  python -m pytest -q"""
import os

# Empty (not removed) so a developer's backend/.env cannot switch the tests to the live database.
os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = ""
os.environ["DATABASE_URL"] = ""

from collections import defaultdict

from fastapi.testclient import TestClient

import batch
import match
from inventory import _load_json
from main import app

INV = _load_json()
LOC = {"Lara": (36.853, 30.80), "Konyaalti": (36.88, 30.64), "Belek": (36.86, 31.05)}


def R(i, cat, q, s, e, where):
    lat, lon = LOC[where]
    return {"request_id": f"R{i}", "category": cat, "quantity": q, "start_date": f"2026-11-{s}",
            "end_date": f"2026-11-{e}", "location": {"lat": lat, "lon": lon}}


# Demo scenario: three side events near COP31 compete for the same chairs.
SCENARIO = [R(1, "chairs", 200, 21, 23, "Lara"), R(2, "chairs", 150, 21, 23, "Konyaalti"),
            R(3, "chairs", 100, 22, 24, "Belek")]


def test_milp_covers_what_greedy_cannot():
    g = batch.greedy(SCENARIO, INV["items"], INV["suppliers"])
    m = batch.solve_milp(SCENARIO, INV["items"], INV["suppliers"])
    assert g["summary"]["unmet_units"] == 20 and g["summary"]["covered_requests"] == 2
    assert m["summary"]["unmet_units"] == 0 and m["summary"]["covered_requests"] == 3


def test_no_overbooking_and_supplier_limit():
    for fn in (batch.greedy, batch.solve_milp):
        res = fn(SCENARIO, INV["items"], INV["suppliers"], max_suppliers=2)
        used = defaultdict(int)
        for a, r in zip(res["allocations"], SCENARIO):
            assert len({l["supplier"] for l in a["lines"]}) <= 2
            assert sum(l["quantity"] for l in a["lines"]) + a["unmet"] == r["quantity"]
            for l in a["lines"]:
                used[l["item_id"]] += l["quantity"]
        stock = {i["id"]: max(w["quantity_available"] for w in i["availability"]) for i in INV["items"]}
        assert all(q <= stock[i] for i, q in used.items())


def test_milp_never_worse_than_greedy_in_unmet_units():
    for cat in ("chairs", "tables", "lighting", "staging", "signage"):
        reqs = [R(1, cat, 20, 21, 23, "Lara"), R(2, cat, 20, 21, 23, "Konyaalti"),
                R(3, cat, 25, 23, 25, "Belek")]
        g = batch.greedy(reqs, INV["items"], INV["suppliers"])
        m = batch.solve_milp(reqs, INV["items"], INV["suppliers"])
        assert m["summary"]["unmet_units"] <= g["summary"]["unmet_units"]


def test_impossible_demand_is_reported_not_crashed():
    reqs = [R(1, "chairs", 5000, 21, 23, "Lara")]
    m = batch.solve_milp(reqs, INV["items"], INV["suppliers"])
    assert m["summary"]["unmet_units"] > 0 and m["summary"]["covered_requests"] == 0


def test_no_options_at_all():
    reqs = [{**R(1, "chairs", 10, 21, 23, "Lara"), "start_date": "2027-01-01", "end_date": "2027-01-02"}]
    for fn in (batch.greedy, batch.solve_milp):
        assert fn(reqs, INV["items"], INV["suppliers"])["summary"]["unmet_units"] == 10


def test_milp_failure_falls_back_to_greedy(monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("solver exploded")
    monkeypatch.setattr(batch, "solve_milp", boom)
    out = batch.compare(SCENARIO, INV["items"], INV["suppliers"])
    assert out["note"] and out["comparison"]["milp"] == out["comparison"]["greedy"]


client = TestClient(app, raise_server_exceptions=False)


def test_api_batch():
    r = client.post("/match/batch", json={"requests": SCENARIO, "max_suppliers_per_request": 2})
    assert r.status_code == 200
    b = r.json()
    assert b["comparison"]["greedy"]["summary"]["unmet_units"] == 20
    assert b["comparison"]["milp"]["summary"]["unmet_units"] == 0
    assert b["allocations"] == b["comparison"]["milp"]["allocations"] and b["note"] is None


def test_api_batch_validation():
    assert client.post("/match/batch", json={"requests": []}).status_code == 422
    dup = [SCENARIO[0], {**SCENARIO[1], "request_id": "R1"}]
    assert client.post("/match/batch", json={"requests": dup}).status_code == 422
    assert client.post("/match/batch", json={"requests": SCENARIO * 4}).status_code == 422
    assert client.post("/match/batch", json={"requests": SCENARIO, "max_suppliers_per_request": 0}).status_code == 422


def test_api_batch_fills_missing_ids():
    reqs = [{k: v for k, v in r.items() if k != "request_id"} for r in SCENARIO]
    ids = [a["request_id"] for a in client.post("/match/batch", json={"requests": reqs}).json()["allocations"]]
    assert ids == ["req-1", "req-2", "req-3"]


def test_api_robustness():
    base = {"category": "chairs", "quantity": 5, "start_date": "2026-11-21", "end_date": "2026-11-23",
            "location": {"lat": 36.8, "lon": 30.7}}
    assert client.post("/match", json={**base, "location": {"lat": 999, "lon": 0}}).status_code == 422
    assert client.post("/match", json={**base, "quantity": 10 ** 9}).status_code == 422
    assert client.post("/match", json={**base, "end_date": "2027-06-01"}).status_code == 422
    assert client.post("/match", json={**base, "requirements": {"min_condition": "mint"}}).status_code == 422
    assert client.post("/match", data="not json", headers={"Content-Type": "application/json"}).status_code == 422
    assert client.post("/match", json={**base, "category": "'; drop table inventory_items;--"}).status_code == 422
    r = client.post("/impact/summary", json={"selections": [{"item_id": "x", "quantity": 1,
                    "start_date": "2026-11-21", "end_date": "2026-11-22", "location": {"lat": 1, "lon": 1}}]})
    assert r.status_code == 404 and r.json() == {"error": "unknown item_id x"}
    assert client.get("/nope").json() == {"error": "Not Found"}


def test_unexpected_error_hides_details(monkeypatch):
    import main
    monkeypatch.setattr(main, "load_inventory", lambda: (_ for _ in ()).throw(ValueError("secret path /x")))
    r = client.get("/categories")
    assert r.status_code == 500 and r.json() == {"error": "internal error"}


# --- regression tests for review fixes ---

def test_paid_option_never_ties_with_free_loan():
    cands = [{"item": {"unit_price_per_day_try": None}}, {"item": {"unit_price_per_day_try": 12.0}}]
    assert match._price_scores(cands) == [1.0, 0.0]
    assert match._price_scores([{"item": {"unit_price_per_day_try": 5.0}}] * 2) == [1.0, 1.0]
    assert match._price_scores([]) == []


def test_supplier_limit_counts_suppliers_not_item_lines():
    # R1 needs 200 chairs; the Lara hall alone has 150 + 120. With K=1 it must still be coverable.
    reqs = [R(1, "chairs", 200, 21, 23, "Lara")]
    for fn in (batch.greedy, batch.solve_milp):
        a = fn(reqs, INV["items"], INV["suppliers"], max_suppliers=1)["allocations"][0]
        assert a["unmet"] == 0 and len({l["supplier"] for l in a["lines"]}) == 1


def test_distance_counted_once_per_supplier():
    reqs = [{**R(1, "chairs", 200, 21, 23, "Lara"), "location": {"lat": 36.87, "lon": 30.83}}]  # near Lara
    res = batch.greedy(reqs, INV["items"], INV["suppliers"], max_suppliers=1)
    a = res["allocations"][0]
    assert len(a["lines"]) == 2                      # two Lara items, one trip
    assert len({l["supplier"] for l in a["lines"]}) == 1
    assert res["summary"]["total_distance_km"] == a["lines"][0]["distance_km"] > 0


def test_impact_summary_rejects_unavailable_selection():
    top = client.post("/match", json={**R(1, "chairs", 50, 21, 23, "Lara")}).json()["matches"][0]
    sel = {"item_id": top["item_id"], "quantity": 10 ** 4, "start_date": "2026-11-21",
           "end_date": "2026-11-23", "location": {"lat": 36.85, "lon": 30.8}}
    r = client.post("/impact/summary", json={"selections": [sel]})
    assert r.status_code == 400 and "not available" in r.json()["error"]
    r = client.post("/impact/summary", json={"selections": [{**sel, "quantity": 5, "start_date": "2027-01-01", "end_date": "2027-01-02"}]})
    assert r.status_code == 400


def test_tests_never_use_live_database():
    import inventory
    inventory._cache.update(t=0.0, data=None)
    assert inventory.load_inventory(force_refresh=True)["source"] == "json_fallback"


def test_match_reports_source_missing_quantity_and_cost_note():
    # Noé's demo request: 50 chairs near Lara, 21-23 Nov
    r = client.post("/match", json=R(1, "chairs", 50, 21, 23, "Lara")).json()
    assert r["inventory_source"] == "json_fallback"          # tests never touch the live database
    assert "Delivery" in r["cost_note"] and "not included" in r["cost_note"]
    assert all(m["missing_quantity"] == 0 and m["covers_quantity"] for m in r["matches"])
    # more than any single item holds: every option is partial and says how much is missing
    big = client.post("/match", json=R(2, "chairs", 400, 21, 23, "Lara")).json()
    assert big["matches"] and all(not m["covers_quantity"] for m in big["matches"])
    assert all(m["missing_quantity"] == 400 - m["quoted_quantity"] > 0 for m in big["matches"])


def test_database_url_takes_priority_and_is_normalised(monkeypatch):
    import inventory
    j = _load_json()
    doc = {"suppliers": list(j["suppliers"].values()), "categories": j["categories"],
           "items": [{**i, "unit_price_per_day_try": None if i["unit_price_per_day_try"] is None
                      else str(i["unit_price_per_day_try"])} for i in j["items"]]}   # numeric -> str like Postgres
    monkeypatch.setenv("DATABASE_URL", "postgresql://reloop_reader@example.invalid/postgres")
    monkeypatch.setattr(inventory, "_load_postgres", lambda dsn: inventory._from_query_json(doc))
    inventory._cache.update(t=0.0, data=None)
    inv = inventory.load_inventory(force_refresh=True)
    assert inv["source"] == "supabase" and len(inv["items"]) == len(j["items"])
    assert all(isinstance(i["unit_price_per_day_try"], (float, type(None))) for i in inv["items"])
    inventory._cache.update(t=0.0, data=None)


def test_unreachable_database_url_falls_back_to_json(monkeypatch):
    import inventory
    monkeypatch.setenv("DATABASE_URL", "postgresql://reloop_reader:x@127.0.0.1:1/postgres")
    inventory._cache.update(t=0.0, data=None)
    assert inventory.load_inventory(force_refresh=True)["source"] == "json_fallback"
    inventory._cache.update(t=0.0, data=None)


def test_impact_summary_reports_inventory_source():
    top = client.post("/match", json=R(1, "chairs", 50, 21, 23, "Lara")).json()["matches"][0]
    sel = {"item_id": top["item_id"], "quantity": 50, "start_date": "2026-11-21",
           "end_date": "2026-11-23", "location": {"lat": 36.853, "lon": 30.80}}
    assert client.post("/impact/summary", json={"selections": [sel]}).json()["inventory_source"] == "json_fallback"


# --- warm start / stale-while-revalidate cache (roadmap 0.2) ---

def _live_copy():
    return {**_load_json(), "source": "supabase"}


def test_stale_copy_served_immediately_and_refreshed_in_background(monkeypatch):
    import inventory, time
    calls = []
    def slow_load():
        calls.append(1)
        time.sleep(0.3)
        return _live_copy()
    monkeypatch.setattr(inventory, "_load_supabase", slow_load)
    inventory._cache.update(t=0.0, loaded_at=0.0, data=None)
    assert inventory.load_inventory()["source"] == "supabase"          # first load waits
    inventory._cache["t"] = time.time() - inventory.CACHE_SECONDS - 1     # make it stale
    t0 = time.time()
    assert inventory.load_inventory()["source"] == "supabase"
    assert time.time() - t0 < 0.1                                         # did NOT wait for the DB
    time.sleep(0.5)
    assert len(calls) == 2                                                # background refresh ran
    inventory._cache.update(t=0.0, loaded_at=0.0, data=None)


def test_failed_refresh_keeps_last_live_copy(monkeypatch):
    import inventory
    monkeypatch.setattr(inventory, "_load_supabase", _live_copy)
    inventory._cache.update(t=0.0, loaded_at=0.0, data=None)
    assert inventory.load_inventory()["source"] == "supabase"
    def down():
        raise RuntimeError("network")
    monkeypatch.setattr(inventory, "_load_supabase", down)
    assert inventory.load_inventory(force_refresh=True)["source"] == "supabase"   # not json_fallback
    inventory._cache.update(t=0.0, loaded_at=0.0, data=None)
    assert inventory.load_inventory()["source"] == "json_fallback"    # nothing live yet -> fallback
    inventory._cache.update(t=0.0, loaded_at=0.0, data=None)


def test_startup_warms_the_cache():
    import inventory
    inventory._cache.update(t=0.0, loaded_at=0.0, data=None)
    with TestClient(app) as c:                     # `with` runs the lifespan (startup)
        assert inventory._cache["data"] is not None
        assert c.get("/health").json()["inventory_age_s"] is not None
    inventory._cache.update(t=0.0, loaded_at=0.0, data=None)
