"""Offers, participation and the Reuse Starter badge (docs/OFFERS_REWARDS_CONTRACT.md).
Run from backend/:  python -m pytest -q"""
import copy
import os

os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = ""
os.environ["DATABASE_URL"] = ""
os.environ.update(RATE_LIMIT_PER_MIN="1000000", HEAVY_RATE_LIMIT_PER_MIN="1000000",
                  AI_RATE_LIMIT_PER_MIN="1000000", AI_DAILY_LIMIT="1000000")

from fastapi.testclient import TestClient  # noqa: E402

import offers  # noqa: E402
from main import app  # noqa: E402
from test_progress import evaluate, project, status  # noqa: E402

client = TestClient(app)
OFFER = {"id": "o1", "category": "chairs", "label": "Folding chairs, white", "quantity": 40,
         "condition": "good", "available_from": "2026-11-20", "available_to": "2026-11-30",
         "location": {"preset_id": "lara", "lat": 36.853, "lon": 30.80}, "created_at": "2026-11-15T12:00:00Z"}


def validate(offer):
    return client.post("/offer/validate", json={"offer": offer})


def test_valid_offer_is_normalised_and_never_published():
    r = validate(OFFER)
    assert r.status_code == 200
    b = r.json()
    assert b["valid"] and b["visibility"] == "this_browser" and "Not visible to others" in b["note"]
    assert b["approx_location"] == {"lat": 36.85, "lon": 30.8, "precision_km": 1.1,
                                    "label": "Lara, Antalya (demo location)"}


def test_server_uses_preset_coordinates_and_rejects_mismatch():
    bad = copy.deepcopy(OFFER)
    bad["location"]["lat"] = 40.0
    assert validate(bad).status_code == 422


def test_bad_offers_are_rejected():
    cases = [
        {"location": {"preset_id": "nowhere", "lat": 36.853, "lon": 30.80}},
        {"label": "call me a@b.com"}, {"label": "see http://x.y"}, {"label": "tel 05551234567"},
        {"quantity": 0}, {"quantity": 100001}, {"category": "speakers"}, {"condition": "new"},
        {"available_from": "2026-12-01", "available_to": "2026-11-20"},
        {"available_from": "2026-01-01", "available_to": "2026-12-31"},
        {"points": 100},                      # unknown field: the schema is strict
    ]
    for c in cases:
        o = {**OFFER, **c}
        assert validate(o).status_code == 422, c


def test_presets_stay_in_sync_with_the_ai_layer():
    try:
        from ai.presets import PRESETS as ai_presets
    except Exception:  # noqa: BLE001 - ai/ is optional in the backend image
        return
    assert set(offers.PRESETS) == set(ai_presets)
    for k, p in offers.PRESETS.items():
        assert (p["lat"], p["lon"]) == (ai_presets[k]["lat"], ai_presets[k]["lon"])


def test_saved_offer_gives_milestone_and_badge_even_without_a_request():
    p = project(brief_confirmed_at=None, offers=[OFFER])
    res = evaluate(p)
    assert status(res)["offer_saved"] == "complete" and status(res)["brief_reviewed"] == "incomplete"
    assert res["points"]["possible"] == 80 and res["rules_version"] == "progress/v1.1"
    assert res["participation"] == {"level": "started", "completed_exchanges": 0,
                                    "note": res["participation"]["note"]}
    starter = next(r for r in res["rewards"] if r["id"] == "reuse_starter")
    assert starter["status"] == "unlocked" and starter["kind"] == "digital_badge"
    assert "no monetary value" in starter["note"].lower() and "not proof" in starter["note"].lower()


def test_one_confirmed_request_unlocks_badge_with_no_shortlist():
    res = evaluate(project())          # confirmed brief, empty shortlist, no offers
    assert res["participation"]["level"] == "started"
    assert next(r for r in res["rewards"] if r["id"] == "reuse_starter")["status"] == "unlocked"
    assert status(res)["offer_saved"] == "incomplete"


def test_nothing_done_keeps_badge_locked():
    res = evaluate(project(brief_confirmed_at=None))
    assert next(r for r in res["rewards"] if r["id"] == "reuse_starter")["status"] == "locked"


def test_repeating_or_duplicating_offers_cannot_add_points():
    one = evaluate(project(offers=[OFFER]))
    twice = evaluate(project(offers=[OFFER, copy.deepcopy(OFFER)]))
    assert one["points"]["earned"] == twice["points"]["earned"]
    assert evaluate(project(offers=[OFFER])) == one            # same state, same result


def test_older_projects_without_offers_still_valid_and_offers_add_no_carbon():
    p = project()
    assert "offers" not in p
    base = evaluate(p)
    with_offer = evaluate(project(offers=[OFFER]))
    assert base["estimated_opportunity"] == with_offer["estimated_opportunity"]


def test_more_than_20_offers_rejected():
    offs = [{**OFFER, "id": f"o{i}"} for i in range(21)]
    r = client.post("/progress/evaluate", json={"project": project(offers=offs)})
    assert r.status_code == 422
