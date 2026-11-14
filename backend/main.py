"""Thin HTTP layer: load inventory, call match.py / impact.py, return JSON. No matching logic here."""
import json
import os
from pathlib import Path

import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.middleware.cors import CORSMiddleware

import impact
import match
from inventory import load_inventory
from models import (BatchRequest, BatchResponse, MatchRequest, MatchResponse, SummaryRequest,
                    SummaryResponse)

log = logging.getLogger("reloop.api")

app = FastAPI(title="ReLoop API", version="0.1.0")

# Extra allowed origins (e.g. the deployed web app) via CORS_ORIGINS="https://a.app,https://b.app"
EXTRA_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:8081", *EXTRA_ORIGINS],
    allow_origin_regex=r"https://.*\.(vercel\.app|netlify\.app|onrender\.com|web\.app)",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(StarletteHTTPException)
async def http_error(request: Request, exc: StarletteHTTPException):
    # contract: errors other than 422 look like {"error": "message"}
    detail = exc.detail
    msg = detail.get("error") if isinstance(detail, dict) else str(detail)
    return JSONResponse(status_code=exc.status_code, content={"error": msg})


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exc: Exception):
    log.exception("Unhandled error on %s", request.url.path)   # details stay in the server log
    return JSONResponse(status_code=500, content={"error": "internal error"})


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


@app.post("/match/batch", response_model=BatchResponse)
def post_match_batch(req: BatchRequest):
    """Several requests sharing stock: greedy baseline vs MILP. Isolated so /match never depends on it."""
    try:
        import batch                      # lazy: a scipy problem must not take /match down
    except ImportError:
        raise HTTPException(status_code=503, detail={"error": "batch optimiser unavailable"})
    inv = load_inventory()
    reqs = [r.model_dump(mode="json") for r in req.requests]
    return batch.compare(reqs, inv["items"], inv["suppliers"], req.max_suppliers_per_request)


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
        w = match.covering_window(it, s.start_date, s.end_date)
        if w is None or s.quantity > w["quantity_available"] or it["reuse_mode"] not in match.MATCHABLE_MODES:
            raise HTTPException(status_code=400, detail={
                "error": f"item {s.item_id} is not available for {s.quantity} unit(s) on these dates"})
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
