"""Export real API responses for the web app's demo mode, so it never disagrees with the backend.

    python tools/export_demo_fixtures.py                     # writes backend/fixtures/*.json
    python tools/export_demo_fixtures.py --ai ../            # also /parse-request + /explain (needs ai/)

Two files (fictional demo inventory, LLM off, so they are reproducible):

  fixtures/demo_scenarios.json  Full, unmodified responses for the scenarios we demo: the main
                                request, a partial match, no options, a priority switch, plus
                                /impact/summary and /impact/methodology. Demo mode can show these as is.
  fixtures/match_golden.json    Compact key numbers of /match for a grid of requests (category x
                                location preset x dates x quantity). A parity test for any other
                                implementation: same inputs must give these outputs.

Regenerate after any change to match.py, impact.py, impact_factors.json or the inventory; the
backend test suite fails when a fixture is out of date.
"""
import argparse
import itertools
import json
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
BACKEND = HERE.parent
OUT = BACKEND / "fixtures"
sys.path.insert(0, str(BACKEND))
os.environ.update(SUPABASE_URL="", SUPABASE_SERVICE_ROLE_KEY="", DATABASE_URL="", LLM_PROVIDER="none")

# Same presets as the AI layer (ai/presets.py): labelled demo points, not addresses.
PRESETS = {
    "lara": (36.853, 30.80), "konyaalti": (36.88, 30.64), "kepez": (36.93, 30.70),
    "belek": (36.86, 31.05), "kemer": (36.60, 30.56), "antalya": (36.8969, 30.7133),
}
CATEGORIES = ["chairs", "tables", "lighting", "staging", "signage"]
DATE_RANGES = [("2026-11-21", "2026-11-23"), ("2026-11-20", "2026-11-22"),
               ("2026-11-23", "2026-11-25"), ("2026-11-22", "2026-11-22")]
QUANTITIES = [1, 10, 50, 200]


def loc(p):
    lat, lon = PRESETS[p]
    return {"lat": lat, "lon": lon}


def body(cat, qty, place, start="2026-11-21", end="2026-11-23", **extra):
    return {"category": cat, "quantity": qty, "start_date": start, "end_date": end,
            "location": loc(place), **extra}


SCENARIOS = [
    ("main_demo_chairs", "50 chairs near Lara, 21-23 Nov (main demo, need 1)", body("chairs", 50, "lara")),
    ("main_demo_lighting", "2 stage lights near Lara, 21-23 Nov (main demo, need 2)", body("lighting", 2, "lara")),
    ("big_order_konyaalti", "200 chairs near Konyaalti, 21-23 Nov", body("chairs", 200, "konyaalti")),
    ("partial_match", "400 chairs near Lara: no single option covers it", body("chairs", 400, "lara")),
    ("no_options", "10 chairs near Lara in January: nothing available",
     body("chairs", 10, "lara", "2027-01-10", "2027-01-11")),
    ("priority_cheapest", "50 chairs near Lara, priority = cheapest", body("chairs", 50, "lara", priority="cheapest")),
    ("tables_belek", "10 tables near Belek, 21-23 Nov", body("tables", 10, "belek")),
    ("filters", "60 chairs near Lara, good condition or better, within 20 km",
     body("chairs", 60, "lara", requirements={"min_condition": "good", "max_distance_km": 20})),
]
DEMO_TEXT = "I need 50 chairs and 2 stage lights near Lara, Antalya, from 21 to 23 November 2026."


def compact(resp):
    """Key numbers only: what a parity test must reproduce."""
    return {
        "total_options": resp["total_options"], "days": resp["days"],
        "suggestions": [s["type"] for s in resp["suggestions"]],
        "matches": [{
            "item_id": m["item_id"], "quoted_quantity": m["quoted_quantity"],
            "missing_quantity": m["missing_quantity"], "covers_quantity": m["covers_quantity"],
            "distance_km": m["distance_km"], "estimated_cost_try": m["estimated_cost_try"],
            "score": m["score"],
            "avoided_kgco2e": m["impact"]["avoided_kgco2e"],
            "avoided_kgco2e_conservative": m["impact"]["avoided_kgco2e_conservative"],
            "transport_kgco2e": m["impact"]["transport_kgco2e"],
            "impact_status": m["impact"]["status"],
        } for m in resp["matches"]],
    }


def golden_requests():
    for cat, place, (s, e), q in itertools.product(CATEGORIES, PRESETS, DATE_RANGES, QUANTITIES):
        yield {"key": f"{cat}|{place}|{s}|{e}|{q}", "request": body(cat, q, place, s, e)}


def build(ai_root=None):
    if ai_root:
        sys.path.insert(0, str(Path(ai_root).resolve()))
    from fastapi.testclient import TestClient
    import main
    c = TestClient(main.app)

    def ok(r):
        assert r.status_code == 200, (r.status_code, r.text[:200])
        return r.json()

    commit = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True,
                            cwd=BACKEND).stdout.strip() or None
    meta = {"generated_by": "backend/tools/export_demo_fixtures.py", "backend_commit": commit,
            "inventory": "fictional demo inventory (backend/data/inventory.json = supabase/seed.sql)",
            "llm": "off (deterministic)", "presets": {k: {"lat": v[0], "lon": v[1]} for k, v in PRESETS.items()}}

    scenarios = {}
    for sid, label, req in SCENARIOS:
        resp = ok(c.post("/match", json=req))
        entry = {"label": label, "request": req, "response": resp}
        if main.AI_LAYER and resp["matches"]:
            entry["explain"] = ok(c.post("/explain", json={
                "request": {k: req[k] for k in ("category", "quantity", "start_date", "end_date")} | {"label": req["category"]},
                "matches": resp["matches"]}))
        scenarios[sid] = entry
    picks = [{"item_id": scenarios[s]["response"]["matches"][0]["item_id"],
              "quantity": scenarios[s]["response"]["matches"][0]["quoted_quantity"],
              "start_date": "2026-11-21", "end_date": "2026-11-23", "location": loc("lara")}
             for s in ("main_demo_chairs", "main_demo_lighting")]
    extra = {
        "main_demo_summary": {"request": {"selections": picks},
                              "response": ok(c.post("/impact/summary", json={"selections": picks}))},
        "methodology": ok(c.get("/impact/methodology")),
    }
    if main.AI_LAYER:
        extra["main_demo_parse"] = {"text": DEMO_TEXT, "response": ok(c.post(
            "/parse-request", json={"text": DEMO_TEXT, "context": {"today": "2026-11-14"}}))}

    golden = {g["key"]: compact(ok(c.post("/match", json=g["request"]))) for g in golden_requests()}
    return ({"meta": meta, "scenarios": scenarios, **extra},
            {"meta": {**meta, "grid": {"categories": CATEGORIES, "presets": list(PRESETS),
                                       "date_ranges": DATE_RANGES, "quantities": QUANTITIES},
                      "key": "category|preset|start_date|end_date|quantity"},
             "cases": golden})


def write(scen, gold, out=OUT):
    out.mkdir(exist_ok=True)
    (out / "demo_scenarios.json").write_text(json.dumps(scen, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    (out / "match_golden.json").write_text(json.dumps(gold, separators=(",", ":"), ensure_ascii=False) + "\n",
                                           encoding="utf-8")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--ai", help="repo root that contains ai/ (adds /parse-request and /explain outputs)")
    a = ap.parse_args()
    scen, gold = build(a.ai)
    write(scen, gold)
    for f in ("demo_scenarios.json", "match_golden.json"):
        print(f"wrote fixtures/{f}: {(OUT / f).stat().st_size / 1024:.0f} KB")
    print(f"{len(scen['scenarios'])} scenarios, {len(gold['cases'])} golden cases, commit {scen['meta']['backend_commit']}")
