"""Batch (greedy vs MILP) + robustness checks. Run from backend/:  python -m pytest -q"""
import os

os.environ.pop("SUPABASE_URL", None)
os.environ.pop("SUPABASE_SERVICE_ROLE_KEY", None)

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
            assert len(a["lines"]) <= 2
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
