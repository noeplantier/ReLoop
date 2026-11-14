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
    h = client.get("/health").json()
    assert h["status"] == "ok" and h["inventory_source"] == "json_fallback"
    # additive fields (14 Nov): age of the loaded copy, AI layer state, deployed commit
    assert isinstance(h["inventory_age_s"], float) and h["inventory_age_s"] >= 0
    assert isinstance(h["ai_layer"], bool) and h["llm_enabled"] is False
    assert "commit" in h


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
    # embodied = 0.25 t x 3824.09335 = 956.0233
    # transport (there and back) = 0.19748 x 0.25 t x 10 km x 2 = 0.9874
    # upper = 956.0233 - 0.9874 = 955.0359 ; conservative = 956.0233 / 10 uses - 0.9874 = 94.6149
    assert e["avoided_kgco2e"] == 955.04 and e["status"] == "illustrative"
    assert e["avoided_kgco2e_conservative"] == 94.61 and e["transport_kgco2e"] == 0.99
    assert e["basis"]["upper"] and "assumption" in e["basis"]["conservative"]
    assert any("ASSUMPTION" in a for a in e["assumptions"])           # never hidden
    missing = impact.estimate({"weight_kg": None, "main_material": None}, 5, f)
    assert missing["status"] == "unavailable" and missing["avoided_kgco2e_conservative"] is None
    real = impact.estimate({**item, "weight_is_estimate": False}, 50, f, distance_km=10)
    assert real["status"] == "sourced"


def test_impact_conservative_floors_at_zero_and_follows_the_assumption():
    import json
    from pathlib import Path
    import impact
    f = json.loads((Path(__file__).parent / "impact_factors.json").read_text(encoding="utf-8"))
    # light wooden item far away: 0.01 t x 269.50416 = 2.695 ; /10 = 0.2695 ; transport = 0.39496
    far = impact.estimate({"weight_kg": 10.0, "main_material": "wood"}, 1, f, distance_km=100)
    assert far["avoided_kgco2e_conservative"] == 0.0 and far["avoided_kgco2e"] == 2.3
    # the range is driven only by the JSON assumption: 1 use -> both bounds equal
    one = json.loads(json.dumps(f))
    one["counterfactual"]["assumed_uses_per_new_item"]["value"] = 1
    e = impact.estimate({"weight_kg": 5.0, "main_material": "metals"}, 50, one, distance_km=10)
    assert e["avoided_kgco2e"] == e["avoided_kgco2e_conservative"] == 955.04
    # no distance -> nothing deducted, transport reported as unknown
    nd = impact.estimate({"weight_kg": 5.0, "main_material": "metals"}, 50, f)
    assert nd["transport_kgco2e"] is None and nd["avoided_kgco2e"] == 956.02


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
    assert 0 <= j["avoided_kgco2e_conservative"] < j["avoided_kgco2e"]          # a real range
    assert j["avoided_kgco2e"] == top["impact"]["avoided_kgco2e"]                 # summary = sum of lines
    assert j["avoided_kgco2e_conservative"] == top["impact"]["avoided_kgco2e_conservative"]
    bad = client.post("/impact/summary", json={"selections": [{
        "item_id": "nope", "quantity": 1, "start_date": "2026-11-21",
        "end_date": "2026-11-23", "location": LARA}]})
    assert bad.status_code == 404
