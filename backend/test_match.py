"""Engine + API checks. Run from backend/:  python -m pytest -q
Uses the offline JSON inventory (no Supabase, no network needed)."""
import os

# Empty (not removed) so a developer's backend/.env cannot switch the tests to the live database.
os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = ""
os.environ["DATABASE_URL"] = ""

from fastapi.testclient import TestClient

import match
from inventory import _load_json
from main import app

INV = _load_json()
LARA = {"lat": 36.853, "lon": 30.80}


def req(**kw):
    base = {"category": "chairs", "quantity": 50, "start_date": "2026-11-21",
            "end_date": "2026-11-23", "location": LARA}
    base.update(kw)
    return base


def run(r):
    return match.rank(r, INV["items"], INV["suppliers"])


def test_top3_and_only_loan_rental():
    top, total, days = run(req())
    assert len(top) == 3 and days == 3 and total >= 3
    assert all(m["reuse_mode"] in ("loan", "rental") for m in top)
    assert all(m["covers_quantity"] for m in top)
    assert [m["score"] for m in top] == sorted((m["score"] for m in top), reverse=True)


def test_donation_and_resale_never_returned():
    names = {m["name"] for m in run(req(quantity=1))[0]}
    top_all, _, _ = match.rank(req(quantity=1), INV["items"], INV["suppliers"], top_n=100)
    assert "Lounge armchairs" not in {m["name"] for m in top_all}   # donation
    assert names  # sanity


def test_window_must_cover_whole_range():
    # LED uplighters are only available 20-22 Nov, so 21-23 must not return them.
    top, _, _ = match.rank(req(category="lighting", quantity=1), INV["items"], INV["suppliers"], top_n=100)
    assert "LED uplighters (battery)" not in {m["name"] for m in top}
    # Solar lanterns have two adjacent windows; v1 rule = ONE window must cover the range.
    top2, _, _ = match.rank(req(category="lighting", quantity=1, start_date="2026-11-21",
                                end_date="2026-11-24"), INV["items"], INV["suppliers"], top_n=100)
    assert "Solar lantern set" not in {m["name"] for m in top2}


def test_zero_stock_excluded():
    top, _, _ = match.rank(req(category="staging", quantity=1), INV["items"], INV["suppliers"], top_n=100)
    assert "Lectern with microphone stand" not in {m["name"] for m in top}


def test_distance_and_condition_filters():
    r = req(requirements={"max_distance_km": 5})
    for m in run(r)[0]:
        assert m["distance_km"] <= 5
    r = req(requirements={"min_condition": "excellent"})
    assert all(m["condition"] == "excellent" for m in run(r)[0])


def test_partial_stock_ranks_after_full_coverage():
    top, _, _ = match.rank(req(quantity=100), INV["items"], INV["suppliers"], top_n=100)
    flags = [m["covers_quantity"] for m in top]
    assert flags == sorted(flags, reverse=True)
    assert any(not f for f in flags)


def test_deterministic():
    assert run(req()) == run(req())


def test_whatif_shift_date():
    r = req(category="lighting", quantity=2, start_date="2026-11-21", end_date="2026-11-23")
    _, total, _ = run(r)
    s = match.suggestions(r, INV["items"], INV["suppliers"], total)
    assert any(x["type"] == "shift_date" for x in s)


client = TestClient(app)


def test_api_health_uses_fallback():
    assert client.get("/health").json() == {"status": "ok", "inventory_source": "json_fallback"}


def test_api_match_contract_and_no_invented_impact():
    r = client.post("/match", json=req(request_id="req-1"))
    assert r.status_code == 200
    body = r.json()
    assert body["request_id"] == "req-1" and len(body["matches"]) == 3
    m = body["matches"][0]
    assert m["explanation"] is None
    assert m["impact"]["status"] == "illustrative"      # weights are demo estimates
    assert m["impact"]["avoided_kgco2e"] > 0 and m["impact"]["assumptions"]


def test_api_validation():
    assert client.post("/match", json=req(start_date="2026-11-24")).status_code == 422
    assert client.post("/match", json=req(quantity=0)).status_code == 422
    assert client.post("/match", json=req(category="boats")).status_code == 422


def test_impact_hand_calculation():
    import json
    from pathlib import Path
    import impact
    f = json.loads((Path(__file__).parent / "impact_factors.json").read_text(encoding="utf-8"))
    item = {"weight_kg": 5.0, "main_material": "metals", "weight_is_estimate": True}
    e = impact.estimate(item, 50, f, distance_km=10)
    # embodied = 0.25 t x 3824.09335 = 956.0233 ; transport = 0.19748 x 0.25 x 10 = 0.4937
    assert e["avoided_kgco2e"] == 955.53 and e["status"] == "illustrative"
    assert impact.estimate({"weight_kg": None, "main_material": None}, 5, f)["status"] == "unavailable"
    real = impact.estimate({**item, "weight_is_estimate": False}, 50, f, distance_km=10)
    assert real["status"] == "sourced"


def test_api_empty_result_is_200():
    r = client.post("/match", json=req(start_date="2026-12-01", end_date="2026-12-02"))
    assert r.status_code == 200 and r.json()["matches"] == []


def test_api_impact_summary():
    top = client.post("/match", json=req()).json()["matches"][0]
    r = client.post("/impact/summary", json={"selections": [{
        "item_id": top["item_id"], "quantity": 50, "start_date": "2026-11-21",
        "end_date": "2026-11-23", "location": LARA}]})
    assert r.status_code == 200
    j = r.json()
    assert j["reused_units"] == 50 and j["impact_status"] == "illustrative" and j["avoided_kgco2e"] > 0
    bad = client.post("/impact/summary", json={"selections": [{
        "item_id": "nope", "quantity": 1, "start_date": "2026-11-21",
        "end_date": "2026-11-23", "location": LARA}]})
    assert bad.status_code == 404
