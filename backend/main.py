"""Thin HTTP layer: load inventory, call match.py / impact.py, return JSON. No matching logic here."""
import json
import os
import sys
from pathlib import Path

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.middleware.cors import CORSMiddleware

import impact
import match
import inventory
import progress
import ratelimit
from inventory import load_inventory
from models import (BatchRequest, BatchResponse, MatchRequest, MatchResponse, ProgressRequest,
                    ShortlistCheckRequest, SummaryRequest, SummaryResponse)

log = logging.getLogger("reloop.api")

@asynccontextmanager
async def lifespan(app):
    # Warm start: load the inventory once at boot (the database is far away and the free host
    # sleeps), so the first search of a demo does not wait for it.
    try:
        load_inventory()
    except Exception as e:  # noqa: BLE001 - never block startup
        log.warning("Warm-up failed (%s); first request will load", type(e).__name__)
    yield


app = FastAPI(title="ReLoop API", version="0.1.0", lifespan=lifespan)

LIMITS = ratelimit.Limits()


# Added BEFORE CORS on purpose: the CORS middleware wraps it, so a browser can read a 429 too.
@app.middleware("http")
async def request_limits(request: Request, call_next):
    if request.method == "POST":
        size = request.headers.get("content-length")
        if size and size.isdigit() and int(size) > LIMITS.max_body:
            return JSONResponse(status_code=413, content={"error": "Request body too large."})
        denied = LIMITS.check(request.url.path, ratelimit.client_ip(request))
        if denied:
            return JSONResponse(status_code=denied[0], content={"error": denied[1]},
                                headers={"Retry-After": "60"})
    return await call_next(request)

# Extra allowed origins (e.g. the deployed web app) via CORS_ORIGINS="https://a.app,https://b.app"
EXTRA_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:8081", *EXTRA_ORIGINS],
    allow_origin_regex=r"https://.*\.(vercel\.app|netlify\.app|onrender\.com|web\.app)",
    allow_methods=["*"],
    allow_headers=["*"],
)

# AI layer (Sueda's `ai/` package at the repo root): POST /parse-request and POST /explain.
# Optional on purpose: if the package is missing or fails to import, the matching API still starts
# and those two routes simply do not exist. The LLM key is read inside ai/ from server env only.
sys.path.append(str(Path(__file__).resolve().parent.parent))
try:
    from ai.router import router as ai_router
    app.include_router(ai_router)
    AI_LAYER = True
except Exception as e:  # noqa: BLE001 - never let the AI layer take /match down
    log.warning("AI layer not loaded (%s); /parse-request and /explain unavailable", type(e).__name__)
    AI_LAYER = False


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


# The inventory has rental prices only; nothing else is known, so nothing else is estimated.
COST_NOTE = ("Rental price only (unit price x quantity x days). Delivery, deposit, setup and "
             "taxes are not included.")

FACTORS = json.loads((Path(__file__).parent / "impact_factors.json").read_text(encoding="utf-8"))


def _llm_enabled():
    """True only if the AI layer is loaded AND configured to call an LLM (else rules/templates)."""
    if not AI_LAYER:
        return False
    try:
        from ai import llm
        return bool(llm.enabled())
    except Exception:  # noqa: BLE001
        return False


@app.get("/health")
def health():
    load_inventory()
    st = inventory.status()
    commit = os.getenv("RENDER_GIT_COMMIT") or None
    return {"status": "ok", "inventory_source": st["source"], "inventory_age_s": st["age_s"],
            "ai_layer": AI_LAYER, "llm_enabled": _llm_enabled(),
            "commit": commit[:7] if commit else None,
            "ai_requests_today": LIMITS.ai_used_today(), "ai_daily_limit": LIMITS.ai_per_day}


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
            "matches": top, "suggestions": sugg, "inventory_source": inv["source"],
            "cost_note": COST_NOTE}


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


@app.get("/impact/methodology")
def impact_methodology():
    """How the carbon range is calculated, with every factor, source and assumption (for a
    "How we calculate" screen). Numbers come only from impact_factors.json."""
    return impact.methodology(FACTORS)


@app.post("/shortlist/check")
def shortlist_check(req: ShortlistCheckRequest):
    """Re-check a saved shortlist against the current inventory (e.g. when a project is reopened).
    Read-only and stateless: nothing is reserved, deducted or stored."""
    inv = load_inventory()
    d = req.model_dump(mode="json")
    checked = progress.check_shortlist(d["brief"], d["shortlist"], inv["items"], inv["suppliers"], FACTORS)
    return {"inventory_source": inv["source"], "note": progress.SHORTLIST_NOTE,
            "items": progress.public_items(checked)}


@app.post("/progress/evaluate")
def progress_evaluate(req: ProgressRequest):
    """Milestones, points, next step and reward concepts DERIVED from the submitted project state.
    Deterministic, stateless, no database writes, no LLM. Clients cannot submit points or claims."""
    inv = load_inventory()
    project = req.model_dump(mode="json", by_alias=True)["project"]
    return {"inventory_source": inv["source"],
            **progress.evaluate(project, inv["items"], inv["suppliers"], FACTORS)}


@app.post("/impact/summary", response_model=SummaryResponse)
def impact_summary(req: SummaryRequest):
    inv = load_inventory()
    by_id = {i["id"]: i for i in inv["items"]}
    units, dist, cost, avoided, avoided_low, transport = 0, 0.0, 0.0, 0.0, 0.0, 0.0
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
            avoided_low += e["avoided_kgco2e_conservative"]
            transport += e["transport_kgco2e"] or 0.0
            any_avoided = True
    # Weakest evidence wins: one illustrative or unavailable line makes the whole total so.
    status = ("unavailable" if "unavailable" in statuses
              else "illustrative" if "illustrative" in statuses else "sourced")
    return {"reused_units": units, "total_distance_km": round(dist, 1),
            "estimated_cost_try": round(cost, 2) if any_cost else None,
            "avoided_kgco2e": round(avoided, 2) if any_avoided and status != "unavailable" else None,
            "avoided_kgco2e_conservative": round(avoided_low, 2) if any_avoided and status != "unavailable" else None,
            "transport_kgco2e": round(transport, 2) if any_avoided and status != "unavailable" else None,
            "impact_status": status, "assumptions": assumptions,
            "inventory_source": inv["source"]}
