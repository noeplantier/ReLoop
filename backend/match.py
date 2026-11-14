"""Deterministic matching engine. Pure Python: no HTTP, no database.

Input  : plain dicts (see inventory.py for the inventory shape, API_CONTRACT.md for the request).
Output : plain dicts, ranked best first.

Why deterministic first: every score is a visible formula, so the AI layer can explain a match
using only `breakdown` and cannot invent reasons.
"""
import math
from datetime import date, timedelta

CONDITION_RANK = {"fair": 0, "good": 1, "excellent": 2}
CONDITION_SCORE = {"fair": 0.4, "good": 0.7, "excellent": 1.0}
MATCHABLE_MODES = ("loan", "rental")   # donation/resale are stored but not quoted in the MVP
WEIGHTS = {"distance": 0.5, "condition": 0.3, "price": 0.2}   # placeholders, tune with the team
DISTANCE_SCALE_KM = 50.0
TOP_N = 3


def haversine_km(lat1, lon1, lat2, lon2):
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def _d(s):
    return date.fromisoformat(s) if isinstance(s, str) else s


def covering_window(item, start, end):
    """The ONE availability window that covers the whole event range with stock > 0, or None."""
    start, end = _d(start), _d(end)
    for w in item["availability"]:
        if _d(w["available_from"]) <= start and _d(w["available_until"]) >= end \
                and w["quantity_available"] > 0:
            return w
    return None


def eligible(request, inventory, suppliers):
    """Hard filters. Returns a list of candidate dicts (item + window + distance)."""
    req = request.get("requirements") or {}
    min_cond = CONDITION_RANK[req["min_condition"]] if req.get("min_condition") else None
    max_km = req.get("max_distance_km")
    loc = request["location"]
    out = []
    for it in inventory:
        if it["category"] != request["category"] or it["reuse_mode"] not in MATCHABLE_MODES:
            continue
        w = covering_window(it, request["start_date"], request["end_date"])
        if w is None:
            continue
        if min_cond is not None and CONDITION_RANK[it["condition"]] < min_cond:
            continue
        sup = suppliers[it["supplier_id"]]
        km = haversine_km(loc["lat"], loc["lon"], sup["latitude"], sup["longitude"])
        if max_km is not None and km > max_km:
            continue
        out.append({"item": it, "window": w, "supplier": sup, "distance_km": km})
    return out


def _price_scores(cands):
    """Cheaper is better, scaled between the cheapest (1.0) and the priciest (0.0) candidate.
    Free loans (null price) count as price 0, so a paid option never ties with a free one."""
    prices = [c["item"]["unit_price_per_day_try"] or 0.0 for c in cands]
    if not prices:
        return []
    lo, hi = min(prices), max(prices)
    if hi == lo:
        return [1.0] * len(prices)
    return [1.0 - (p - lo) / (hi - lo) for p in prices]


def rank(request, inventory, suppliers, top_n=TOP_N):
    cands = eligible(request, inventory, suppliers)
    pscores = _price_scores(cands)
    days = (_d(request["end_date"]) - _d(request["start_date"])).days + 1
    qty = request["quantity"]
    rows = []
    for c, ps in zip(cands, pscores):
        it, w = c["item"], c["window"]
        dist_s = math.exp(-c["distance_km"] / DISTANCE_SCALE_KM)
        cond_s = CONDITION_SCORE[it["condition"]]
        score = (WEIGHTS["distance"] * dist_s + WEIGHTS["condition"] * cond_s
                 + WEIGHTS["price"] * ps)
        quoted = min(qty, w["quantity_available"])
        price = it["unit_price_per_day_try"]
        rows.append({
            "item_id": it["id"],
            "name": it["name"],
            "category": it["category"],
            "supplier": {"id": c["supplier"]["id"], "name": c["supplier"]["name"],
                         "city": c["supplier"]["city"]},
            "reuse_mode": it["reuse_mode"],
            "condition": it["condition"],
            "available_quantity": w["quantity_available"],
            "quoted_quantity": quoted,
            "covers_quantity": w["quantity_available"] >= qty,
            "distance_km": round(c["distance_km"], 1),
            "unit_price_per_day_try": price,
            "estimated_cost_try": None if not price else round(price * quoted * days, 2),
            "score": round(score, 3),
            "breakdown": {"distance_score": round(dist_s, 3), "condition_score": cond_s,
                          "price_score": round(ps, 3), "weights": dict(WEIGHTS)},
            "explanation": None,
            # internal: which stock window was used (the batch solver shares stock per window)
            "window_key": [w["available_from"], w["available_until"]],
        })
    # Options that cover the full quantity come first; then score; item_id breaks ties deterministically.
    rows.sort(key=lambda r: (not r["covers_quantity"], -r["score"], r["item_id"]))
    return rows[:top_n], len(rows), days


def suggestions(request, inventory, suppliers, base_count):
    """What-if: re-run with relaxed constraints and report only what really improves."""
    out = []
    for delta in (-1, 1):
        r = dict(request)
        r["start_date"] = (_d(request["start_date"]) + timedelta(days=delta)).isoformat()
        r["end_date"] = (_d(request["end_date"]) + timedelta(days=delta)).isoformat()
        n = len(eligible(r, inventory, suppliers))
        if n > base_count:
            word = "earlier" if delta < 0 else "later"
            out.append({"type": "shift_date",
                        "detail": f"Moving the event 1 day {word} gives {n - base_count} more option(s).",
                        "gain": n - base_count})
    req = request.get("requirements") or {}
    if req.get("max_distance_km"):
        r = dict(request)
        r["requirements"] = {**req, "max_distance_km": req["max_distance_km"] * 1.5}
        n = len(eligible(r, inventory, suppliers))
        if n > base_count:
            out.append({"type": "widen_radius",
                        "detail": f"Widening the radius to {round(req['max_distance_km'] * 1.5)} km gives {n - base_count} more option(s).",
                        "gain": n - base_count})
    if req.get("min_condition") == "excellent" or req.get("min_condition") == "good":
        r = dict(request)
        lower = "fair" if req["min_condition"] == "good" else "good"
        r["requirements"] = {**req, "min_condition": lower}
        n = len(eligible(r, inventory, suppliers))
        if n > base_count:
            out.append({"type": "relax_condition",
                        "detail": f"Accepting '{lower}' condition gives {n - base_count} more option(s).",
                        "gain": n - base_count})
    out.sort(key=lambda s: -s["gain"])
    for s in out:
        s.pop("gain")
    return out[:3]
