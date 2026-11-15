"""Saved-project re-check and progression rules (docs/PROJECT_PROGRESS_CONTRACT.md).
Run from backend/:  python -m pytest -q"""
import copy
import inspect
import os

os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = ""
os.environ["DATABASE_URL"] = ""
os.environ.update(RATE_LIMIT_PER_MIN="1000000", HEAVY_RATE_LIMIT_PER_MIN="1000000",
                  AI_RATE_LIMIT_PER_MIN="1000000", AI_DAILY_LIMIT="1000000")

from fastapi.testclient import TestClient  # noqa: E402

import progress  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)
LARA = {"preset_id": "lara", "lat": 36.853, "lon": 30.80}
CHAIRS_LARA = "b0000000-0000-4000-8000-000000000001"      # 150 available, 0 km
FOLDING_LARA = "b0000000-0000-4000-8000-000000000002"     # 120 available, 0 km
LIGHTS_KONYAALTI = "b0000000-0000-4000-8000-000000000010"  # 24 available, 14.5 km
FESTOON_BELEK = "b0000000-0000-4000-8000-000000000021"     # 12 available, 22.3 km


def project(**over):
    p = {"schema": "reloop.project/v1", "id": "p1", "name": "Gala", "mode": "live",
         "created_at": "2026-11-15T10:00:00Z", "updated_at": "2026-11-15T10:20:00Z",
         "brief": {"needs": [{"category": "chairs", "quantity": 50, "label": "chairs"},
                             {"category": "lighting", "quantity": 2, "label": "stage lights"}],
                   "start_date": "2026-11-21", "end_date": "2026-11-23", "location": LARA},
         "brief_confirmed_at": "2026-11-15T10:05:00Z", "shortlist": [], "events": []}
    p.update(over)
    return p


def entry(item_id, cat, qty):
    return {"need_category": cat, "item_id": item_id, "quantity": qty}


def ev(t, at, item_id=None):
    e = {"type": t, "at": at}
    if item_id:
        e["item_id"] = item_id
    return e


def evaluate(p):
    r = client.post("/progress/evaluate", json={"project": p})
    assert r.status_code == 200, r.text
    return r.json()


def status(res):
    return {m["id"]: m["status"] for m in res["milestones"]}


FULL = [entry(CHAIRS_LARA, "chairs", 50), entry(LIGHTS_KONYAALTI, "lighting", 2)]


def test_same_state_same_result_and_no_double_award():
    p = project(shortlist=FULL)
    a, b = evaluate(p), evaluate(p)
    assert a == b                                            # idempotent: repeating cannot add anything
    assert a["points"]["earned"] == sum(m["points"] for m in a["milestones"] if m["status"] == "complete")


def test_client_cannot_submit_points_claims_or_rewards():
    for extra in ({"points": 999}, {"balance": 50}, {"milestones": [{"id": "shortlist_complete"}]},
                  {"rewards": [{"id": "relooper_badge", "status": "available"}]}):
        assert client.post("/progress/evaluate", json={"project": project(**extra)}).status_code == 422
        assert client.post("/progress/evaluate", json={"project": project(), **extra}).status_code == 422
    bad_event = project(events=[{"type": "milestone_completed", "at": "2026-11-15T10:00:00Z"}])
    assert client.post("/progress/evaluate", json={"project": bad_event}).status_code == 422


def test_full_shortlist_completes_and_next_step_never_claims_reuse():
    res = evaluate(project(shortlist=FULL))
    s = status(res)
    assert s["brief_reviewed"] == s["shortlist_started"] == s["shortlist_complete"] == "complete"
    assert res["next_step"]["id"] == "next_steps" and "Nothing is reserved" in res["next_step"]["text"]
    text = str(res).lower()
    for forbidden in ("reserved for you", "completed reuse", "saved to your account", "verified carbon"):
        assert forbidden not in text
    assert text.count("guaranteed") == text.count("not guaranteed")      # only ever negated
    assert text.count("reserved") == text.count("not reserved") + text.count("nothing is reserved")


def test_partial_and_unavailable_items_block_completion_and_ask_for_replacement():
    res = evaluate(project(shortlist=[entry(CHAIRS_LARA, "chairs", 400), entry(LIGHTS_KONYAALTI, "lighting", 2)]))
    item = res["shortlist"][0]
    assert item["status"] == "partial" and item["available_quantity"] == 150 and item["missing_quantity"] == 250
    assert status(res)["shortlist_complete"] == "incomplete" and res["next_step"]["id"] == "replace_item"
    jan = project(brief={**project()["brief"], "start_date": "2027-01-10", "end_date": "2027-01-11"}, shortlist=FULL)
    res = evaluate(jan)
    assert {i["status"] for i in res["shortlist"]} == {"unavailable"}
    assert res["estimated_opportunity"]["kgco2e_upper"] is None and res["estimated_opportunity"]["counted_items"] == []


def test_unknown_and_wrong_category_items():
    res = evaluate(project(shortlist=[entry("does-not-exist", "chairs", 5), entry(CHAIRS_LARA, "lighting", 2)]))
    assert [i["status"] for i in res["shortlist"]] == ["unknown_item", "unavailable"]
    assert status(res)["shortlist_complete"] == "incomplete"


def test_carbon_counted_once_per_item_and_labelled_as_opportunity():
    once = evaluate(project(shortlist=FULL))["estimated_opportunity"]
    twice = evaluate(project(shortlist=FULL + [entry(CHAIRS_LARA, "chairs", 50)]))["estimated_opportunity"]
    assert once == twice                                     # re-selecting the same item adds nothing
    assert once["counted_items"] == sorted([CHAIRS_LARA, LIGHTS_KONYAALTI])
    assert 0 < once["kgco2e_conservative"] < once["kgco2e_upper"] and once["status"] == "illustrative"
    assert "Not saved, measured, verified or achieved" in once["note"]


def test_demo_mode_evidence_and_no_verified_milestones():
    live = evaluate(project(shortlist=FULL))
    demo = evaluate(project(mode="demo", shortlist=FULL))
    assert {m["evidence"] for m in live["milestones"]} == {"user_reported"}
    assert {m["evidence"] for m in demo["milestones"]} == {"demo"}
    assert all(m["evidence"] != "verified" for m in live["milestones"] + demo["milestones"])


def test_options_compared_needs_two_items_of_the_same_type():
    one = evaluate(project(events=[ev("details_viewed", "2026-11-15T10:06:00Z", CHAIRS_LARA)]))
    mixed = evaluate(project(events=[ev("details_viewed", "2026-11-15T10:06:00Z", CHAIRS_LARA),
                                     ev("details_viewed", "2026-11-15T10:07:00Z", LIGHTS_KONYAALTI)]))
    two = evaluate(project(events=[ev("details_viewed", "2026-11-15T10:06:00Z", CHAIRS_LARA),
                                   ev("details_viewed", "2026-11-15T10:07:00Z", FOLDING_LARA)]))
    assert status(one)["options_compared"] == status(mixed)["options_compared"] == "incomplete"
    assert status(two)["options_compared"] == "complete"


def test_returned_and_updated_requires_a_change_after_reopening():
    before = evaluate(project(events=[ev("shortlist_added", "2026-11-15T10:10:00Z", CHAIRS_LARA),
                                      ev("project_reopened", "2026-11-15T12:00:00Z")]))
    after = evaluate(project(events=[ev("project_reopened", "2026-11-15T12:00:00Z"),
                                     ev("shortlist_added", "2026-11-15T12:05:00Z", CHAIRS_LARA)]))
    assert status(before)["returned_and_updated"] == "incomplete"
    assert status(after)["returned_and_updated"] == "complete"


def test_local_first_uses_server_distances():
    near = evaluate(project(shortlist=FULL))                                    # 0 and 14.5 km
    far = evaluate(project(shortlist=[entry(CHAIRS_LARA, "chairs", 50), entry(FESTOON_BELEK, "lighting", 2)]))
    assert status(near)["local_first"] == "complete" and status(far)["local_first"] == "incomplete"
    spoofed = project(shortlist=[{**entry(FESTOON_BELEK, "lighting", 2), "snapshot": {"distance_km": 0.1}}])
    assert status(evaluate(spoofed))["local_first"] == "incomplete"            # client snapshot is ignored


def test_unconfirmed_brief_and_rewards_are_concepts_only():
    res = evaluate(project(brief_confirmed_at=None))
    assert status(res)["brief_reviewed"] == "incomplete" and res["next_step"]["id"] == "review_brief"
    assert res["rewards"] and all(r["status"] == "concept" and "not redeemable" in r["note"] for r in res["rewards"])
    assert "not redeemable" in res["points"]["note"]


def test_rules_have_no_llm_dependency():
    src = inspect.getsource(progress)
    assert "llm" not in src.split('"""', 2)[2].lower() or "no llm" in src.lower()
    assert "import ai" not in src and "from ai" not in src


def test_shortlist_check_endpoint():
    brief = project()["brief"]
    r = client.post("/shortlist/check", json={"brief": brief, "shortlist": FULL})
    assert r.status_code == 200
    j = r.json()
    assert j["inventory_source"] == "json_fallback" and "not reserved" in j["note"].lower()
    assert [i["status"] for i in j["items"]] == ["available", "available"]
    assert all(not k.startswith("_") for i in j["items"] for k in i)
    too_many = {"brief": brief, "shortlist": [entry(CHAIRS_LARA, "chairs", 1)] * 21}
    assert client.post("/shortlist/check", json=too_many).status_code == 422
    dup_needs = copy.deepcopy(brief)
    dup_needs["needs"].append({"category": "chairs", "quantity": 5})
    assert client.post("/shortlist/check", json={"brief": dup_needs, "shortlist": FULL}).status_code == 422
