"""Thin HTTP layer: load inventory, call match.py / impact.py, return JSON. No matching logic here."""
import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import impact
import match
from inventory import load_inventory
from models import (MatchRequest, MatchResponse, SummaryRequest, SummaryResponse)

app = FastAPI(title="ReLoop API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:8081"],
    allow_origin_regex=r"https://.*\.(vercel\.app|netlify\.app|onrender\.com|web\.app)",
    allow_methods=["*"],
    allow_headers=["*"],
)

FACTORS = json.loads((Path(__file__).parent / "impact_factors.json").read_text(encoding="utf-8"))


@app.get("/health")
def health():
    return {"status": "ok", "inventory_source": load_inventory()["source"]}


@app.get("/categories")
def categories():
    return load_inventory()["categories"]


@app.post("/match", response_model=MatchResponse)
def post_match(req: MatchRequest):
    inv = load_inventory()
    r = req.model_dump(mode="json")
    top, total, days = match.rank(r, inv["items"], inv["suppliers"])
    by_id = {i["id"]: i for i in inv["items"]}
    for m in top:
        m["impact"] = impact.estimate(by_id[m["item_id"]], m["quoted_quantity"], FACTORS, m["distance_km"])
        m.pop("category")
    sugg = match.suggestions(r, inv["items"], inv["suppliers"], total)
    return {"request_id": req.request_id, "days": days, "total_options": total,
            "matches": top, "suggestions": sugg}


@app.post("/impact/summary", response_model=SummaryResponse)
def impact_summary(req: SummaryRequest):
    inv = load_inventory()
    by_id = {i["id"]: i for i in inv["items"]}
    units, dist, cost, avoided = 0, 0.0, 0.0, 0.0
    any_cost = False
    statuses, assumptions, any_avoided = [], [], False
    for s in req.selections:
        it = by_id.get(s.item_id)
        if it is None:
            raise HTTPException(status_code=404, detail={"error": f"unknown item_id {s.item_id}"})
        sup = inv["suppliers"][it["supplier_id"]]
        km = match.haversine_km(s.location.lat, s.location.lon, sup["latitude"], sup["longitude"])
        days = (s.end_date - s.start_date).days + 1
        units += s.quantity
        dist += km
        if it["unit_price_per_day_try"]:
            cost += it["unit_price_per_day_try"] * s.quantity * days
            any_cost = True
        e = impact.estimate(it, s.quantity, FACTORS, km)
        statuses.append(e["status"])
        for a in e["assumptions"]:
            if a not in assumptions:
                assumptions.append(a)
        if e["avoided_kgco2e"] is not None:
            avoided += e["avoided_kgco2e"]
            any_avoided = True
    # Weakest evidence wins: one illustrative or unavailable line makes the whole total so.
    status = ("unavailable" if "unavailable" in statuses
              else "illustrative" if "illustrative" in statuses else "sourced")
    return {"reused_units": units, "total_distance_km": round(dist, 1),
            "estimated_cost_try": round(cost, 2) if any_cost else None,
            "avoided_kgco2e": round(avoided, 2) if any_avoided and status != "unavailable" else None,
            "impact_status": status, "assumptions": assumptions}
