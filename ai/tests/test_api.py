"""End-to-end: parse the demo text, call Atay's real /match (JSON fallback), explain the results."""
from fastapi import FastAPI
from fastapi.testclient import TestClient

from ai.router import router

DEMO = "I need 50 chairs and 2 stage lights near Lara, Antalya, from 21 to 23 November 2026."


def _clients():
    import main as backend                  # backend/main.py, unchanged
    ai_app = FastAPI()
    ai_app.include_router(router)
    return TestClient(ai_app), TestClient(backend.app)


def test_demo_journey_end_to_end():
    ai, be = _clients()
    parsed = ai.post("/parse-request", json={"text": DEMO, "context": {"today": "2026-11-14"}}).json()
    assert parsed["missing_fields"] == []
    for need in parsed["needs"]:
        body = {"category": need["category"], "quantity": need["quantity"],
                "start_date": parsed["start_date"], "end_date": parsed["end_date"],
                "location": {"lat": parsed["location"]["lat"], "lon": parsed["location"]["lon"]}}
        res = be.post("/match", json=body)
        assert res.status_code == 200
        matches = res.json()["matches"]
        assert matches, f"no options for {need['category']}"
        exp = ai.post("/explain", json={"request": {**body, "label": need["label"]}, "matches": matches})
        assert exp.status_code == 200
        ex = exp.json()["explanations"]
        assert [e["item_id"] for e in ex] == [m["item_id"] for m in matches]
        assert all(e["summary"] and e["reasons"] for e in ex)


def test_input_limits():
    ai, _ = _clients()
    assert ai.post("/parse-request", json={"text": ""}).status_code == 422
    assert ai.post("/parse-request", json={"text": "x" * 1001}).status_code == 422
