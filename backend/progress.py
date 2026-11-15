"""Saved-project checks and progression rules. Pure Python: no HTTP, no database writes, no LLM.

Contract: docs/PROJECT_PROGRESS_CONTRACT.md (approved by Noé, 15 Nov 2026).

Everything is DERIVED from the submitted project state plus the current (read-only) inventory:
  - the client cannot submit points, balances, milestone states or rewards (the API schema rejects them);
  - the same project state and inventory always give the same result (no clock, no randomness), so repeating
    a request can never award a milestone twice;
  - a shortlist is not a reservation: nothing is deducted, nothing is guaranteed;
  - carbon is an ESTIMATED OPPORTUNITY of the current shortlist, each item counted once.
"""
import match
import impact

RULES_VERSION = "progress/v1.1"
LOCAL_FIRST_KM = 15.0

MILESTONES = [
    # id, title, points, eligibility (shown to users verbatim)
    ("brief_reviewed", "Brief reviewed", 10,
     "The request was confirmed on the review screen with at least one item, both dates and a location."),
    ("options_compared", "Options compared", 10,
     "Details were opened for at least 2 different options of the same equipment type."),
    ("shortlist_started", "Shortlist started", 10,
     "At least one option is on the shortlist."),
    ("shortlist_complete", "Shortlist covers every item", 20,
     "For every requested item, the shortlisted options cover the full quantity, and the latest availability "
     "re-check finds them available for the dates."),
    ("local_first", "Local first", 10,
     f"The shortlist is not empty and every shortlisted supplier is within {LOCAL_FIRST_KM:g} km of the event."),
    ("returned_and_updated", "Came back and updated", 10,
     "The project was reopened and then changed (shortlist or request) after reopening."),
    ("offer_saved", "Equipment offer saved", 10,
     "At least one valid equipment offer is saved in this project (in this browser only, not published)."),
]

REWARDS = [
    ("relooper_badge", "Relooper badge"),
    ("local_first_badge", "Local-first organiser badge"),
]
PARTICIPATION_NOTE = ("Participation means you used the app. No exchange is tracked or verified in this "
                      "prototype.")
STARTER_NOTE = ("Digital participation badge with no monetary value. Not proof of reuse or verified impact; "
                "no prize, voucher or redemption.")
REWARD_NOTE = "Concept — not redeemable. No real reward, prize or redemption exists in this prototype."
SHORTLIST_NOTE = "Shortlist only, not reserved. Availability re-checked, not guaranteed."
OPPORTUNITY_NOTE = ("Estimated opportunity of the current shortlist, each item counted once. Not saved, "
                    "measured, verified or achieved carbon.")


def _days(brief):
    return (match._d(brief["end_date"]) - match._d(brief["start_date"])).days + 1


def check_shortlist(brief, shortlist, inventory, suppliers, factors):
    """Re-check every shortlisted entry against the current inventory. Read-only; never reserves."""
    by_id = {i["id"]: i for i in inventory}
    loc, days = brief["location"], _days(brief)
    out = []
    for e in shortlist:
        it = by_id.get(e["item_id"])
        if it is None:
            out.append({"item_id": e["item_id"], "need_category": e["need_category"], "status": "unknown_item",
                        "requested_quantity": e["quantity"], "available_quantity": 0,
                        "missing_quantity": e["quantity"], "current": None,
                        "note": "This option no longer exists in the inventory."})
            continue
        sup = suppliers[it["supplier_id"]]
        km = round(match.haversine_km(loc["lat"], loc["lon"], sup["latitude"], sup["longitude"]), 1)
        w = match.covering_window(it, brief["start_date"], brief["end_date"])
        avail = w["quantity_available"] if (w and it["reuse_mode"] in match.MATCHABLE_MODES) else 0
        if it["category"] != e["need_category"]:
            status, note = "unavailable", "This option is not of the requested equipment type."
            avail = 0
        elif avail >= e["quantity"]:
            status, note = "available", SHORTLIST_NOTE
        elif avail > 0:
            status, note = "partial", f"Only {avail} available for these dates. {SHORTLIST_NOTE}"
        else:
            status, note = "unavailable", "Not available for the whole date range any more."
        usable = min(e["quantity"], avail)
        price = it["unit_price_per_day_try"]
        out.append({
            "item_id": it["id"], "need_category": e["need_category"], "status": status,
            "requested_quantity": e["quantity"], "available_quantity": avail,
            "missing_quantity": e["quantity"] - usable,
            "current": {"name": it["name"], "supplier": {"id": sup["id"], "name": sup["name"]},
                        "distance_km": km, "condition": it["condition"],
                        "estimated_cost_try": None if not price or not usable else round(price * usable * days, 2)},
            "note": note,
            "_usable": usable, "_item": it,          # internal, stripped before returning
        })
    return out


def public_items(checked):
    return [{k: v for k, v in c.items() if not k.startswith("_")} for c in checked]


def _opportunity(checked, brief, suppliers, factors):
    """Carbon range of the current shortlist; each item_id counted ONCE (largest usable quantity)."""
    best = {}
    for c in checked:
        if c.get("_usable"):
            if c["item_id"] not in best or c["_usable"] > best[c["item_id"]]["_usable"]:
                best[c["item_id"]] = c
    lo = hi = 0.0
    statuses = []
    for c in best.values():
        e = impact.estimate(c["_item"], c["_usable"], factors, c["current"]["distance_km"])
        statuses.append(e["status"])
        if e["avoided_kgco2e"] is not None:
            lo += e["avoided_kgco2e_conservative"]
            hi += e["avoided_kgco2e"]
    if not best:
        status = None
    else:
        status = ("unavailable" if "unavailable" in statuses
                  else "illustrative" if "illustrative" in statuses else "sourced")
    has_value = bool(best) and status != "unavailable"
    return {"kgco2e_conservative": round(lo, 2) if has_value else None,
            "kgco2e_upper": round(hi, 2) if has_value else None,
            "status": status, "counted_items": sorted(best), "note": OPPORTUNITY_NOTE}


def evaluate(project, inventory, suppliers, factors):
    """Milestones, points, next step, reward concepts and estimated opportunity, derived from state only."""
    brief, shortlist, events = project["brief"], project["shortlist"], project["events"]
    evidence = "demo" if project["mode"] == "demo" else "user_reported"
    checked = check_shortlist(brief, shortlist, inventory, suppliers, factors)
    cat_of = {i["id"]: i["category"] for i in inventory}

    # --- rule inputs (all derived) ---
    brief_ok = bool(project.get("brief_confirmed_at")) and bool(brief["needs"]) \
        and bool(brief.get("start_date")) and bool(brief.get("end_date")) and brief.get("location") is not None
    viewed = {}
    for ev in events:
        if ev["type"] == "details_viewed" and ev.get("item_id") in cat_of:
            viewed.setdefault(cat_of[ev["item_id"]], set()).add(ev["item_id"])
    compared = any(len(v) >= 2 for v in viewed.values())
    covered = {n["category"]: 0 for n in brief["needs"]}
    for c in checked:
        if c["status"] in ("available", "partial") and c["need_category"] in covered:
            covered[c["need_category"]] += c["_usable"]
    missing = {n["category"]: n["quantity"] - covered[n["category"]] for n in brief["needs"]
               if covered[n["category"]] < n["quantity"]}
    problems = [c for c in checked if c["status"] != "available"]
    complete = bool(shortlist) and not missing and not problems
    local = bool(checked) and all(c["current"] and c["current"]["distance_km"] <= LOCAL_FIRST_KM for c in checked)
    reopened = [ev["at"] for ev in events if ev["type"] == "project_reopened"]
    updated = bool(reopened) and any(ev["type"] in ("shortlist_added", "shortlist_removed", "brief_changed")
                                     and ev["at"] > min(reopened) for ev in events)
    done = {"brief_reviewed": brief_ok, "options_compared": compared, "shortlist_started": bool(shortlist),
            "shortlist_complete": complete, "local_first": local, "returned_and_updated": updated,
            "offer_saved": bool(project.get("offers"))}
    # participation: one valid confirmed request OR one saved offer, even with no matches
    started = brief_ok or done["offer_saved"]

    milestones = [{"id": mid, "title": title, "status": "complete" if done[mid] else "incomplete",
                   "eligibility": rule, "evidence": evidence, "points": pts}
                  for mid, title, pts, rule in MILESTONES]
    earned = sum(m["points"] for m in milestones if m["status"] == "complete")

    # --- next step: first rule that applies ---
    if not brief_ok:
        step = {"id": "review_brief", "text": "Review and confirm your request."}
    elif problems:
        c = problems[0]
        name = c["current"]["name"] if c["current"] else "a shortlisted option"
        step = {"id": "replace_item", "text": f"Replace {name}: availability changed ({c['status']})."}
    elif missing:
        cat, qty = next(iter(missing.items()))
        step = {"id": "complete_shortlist", "text": f"Choose an option for {cat} ({qty} more needed)."}
    else:
        step = {"id": "next_steps", "text": "Your shortlist is ready. Next steps: contact the suppliers "
                                            "(not part of this prototype). Nothing is reserved yet."}

    return {
        "rules_version": RULES_VERSION,
        "evidence": evidence,
        "milestones": milestones,
        "points": {"earned": earned, "possible": sum(m[2] for m in MILESTONES),
                   "note": "Product progress points. Not money, not exchangeable, not redeemable."},
        "next_step": step,
        "participation": {"level": "started" if started else "none", "completed_exchanges": 0,
                          "note": PARTICIPATION_NOTE},
        "rewards": [{"id": "reuse_starter", "title": "Reuse Starter badge", "kind": "digital_badge",
                     "status": "unlocked" if started else "locked", "note": STARTER_NOTE}]
                   + [{"id": rid, "title": t, "status": "concept", "note": REWARD_NOTE} for rid, t in REWARDS],
        "estimated_opportunity": _opportunity(checked, brief, suppliers, factors),
        "shortlist": public_items(checked),
    }
