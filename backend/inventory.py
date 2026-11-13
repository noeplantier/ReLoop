"""Inventory loader: Supabase first, offline JSON fallback so the demo never depends on the network.

Both sources are normalised to the same shape:
  suppliers : {supplier_id: {id, name, city, latitude, longitude}}
  items     : [{id, supplier_id, category (slug), name, quantity_total, condition, reuse_mode,
                unit_price_per_day_try, availability: [{available_from, available_until, quantity_available}]}]
  categories: [{slug, name, unit_label}]
"""
import json
import logging
import os
import time
from pathlib import Path

from dotenv import load_dotenv

log = logging.getLogger("reloop.inventory")
load_dotenv()

FALLBACK = Path(__file__).parent / "data" / "inventory.json"
CACHE_SECONDS = 30
_cache = {"t": 0.0, "data": None}


def _load_json():
    raw = json.loads(FALLBACK.read_text(encoding="utf-8"))
    return {
        "suppliers": {s["id"]: s for s in raw["suppliers"]},
        "items": raw["items"],
        "categories": raw["categories"],
        "source": "json_fallback",
    }


def _load_supabase():
    from supabase import create_client   # imported lazily: not needed for the fallback

    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set")
    sb = create_client(url, key)
    sups = sb.table("suppliers").select("*").execute().data
    cats = sb.table("equipment_categories").select("*").execute().data
    rows = sb.table("inventory_items").select(
        "*, equipment_categories(slug), inventory_availability(*)").execute().data
    items = []
    for r in rows:
        items.append({
            "id": r["id"], "supplier_id": r["supplier_id"],
            "category": r["equipment_categories"]["slug"],
            "name": r["name"], "quantity_total": r["quantity_total"],
            "condition": r["condition"], "reuse_mode": r["reuse_mode"],
            "unit_price_per_day_try": None if r["unit_price_per_day_try"] is None
            else float(r["unit_price_per_day_try"]),
            "availability": [{"available_from": a["available_from"],
                              "available_until": a["available_until"],
                              "quantity_available": a["quantity_available"]}
                             for a in r["inventory_availability"]],
        })
    return {
        "suppliers": {s["id"]: s for s in sups},
        "items": items,
        "categories": [{"slug": c["slug"], "name": c["name"], "unit_label": c["unit_label"]} for c in cats],
        "source": "supabase",
    }


def load_inventory(force_refresh=False):
    now = time.time()
    if not force_refresh and _cache["data"] and now - _cache["t"] < CACHE_SECONDS:
        return _cache["data"]
    try:
        data = _load_supabase()
        if not data["items"]:
            raise RuntimeError("Supabase returned no inventory rows")
    except Exception as e:   # any failure -> offline fallback, never crash the demo
        log.warning("Supabase unavailable (%s); using JSON fallback", type(e).__name__)
        data = _load_json()
    log.info("Inventory source: %s (%d items)", data["source"], len(data["items"]))
    _cache.update(t=now, data=data)
    return data
