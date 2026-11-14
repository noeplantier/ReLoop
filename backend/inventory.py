"""Inventory loader: Supabase first, offline JSON fallback so the demo never depends on the network.

Supabase is read in one of two ways (first one configured wins):
  1. DATABASE_URL  -> Postgres login of the read-only role `reloop_reader` (migration 0005): it can
                      read the 5 ReLoop tables and nothing else. Preferred.
  2. SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY -> supabase-py. Works, but that key can read every
                      table in the shared project; keep it only as a fallback.
Both report source "supabase".

Both sources are normalised to the same shape:
  suppliers : {supplier_id: {id, name, city, latitude, longitude}}
  items     : [{id, supplier_id, category (slug), name, quantity_total, condition, reuse_mode,
                unit_price_per_day_try, availability: [{available_from, available_until, quantity_available}]}]
  categories: [{slug, name, unit_label}]
"""
import json
import logging
import os
import threading
import time
from pathlib import Path

from dotenv import load_dotenv

log = logging.getLogger("reloop.inventory")
# Explicit path: backend/.env, whatever the working directory. Existing env vars win (override=False),
# so tests and hosting platforms can force values.
load_dotenv(Path(__file__).parent / ".env")

FALLBACK = Path(__file__).parent / "data" / "inventory.json"
CACHE_SECONDS = 300          # demo inventory changes rarely; stale copies are refreshed in the background
SUPABASE_TIMEOUT_S = 5
# t = last refresh attempt, loaded_at = when `data` was actually loaded
_cache = {"t": 0.0, "loaded_at": 0.0, "data": None}
_lock = threading.Lock()


def _load_json():
    raw = json.loads(FALLBACK.read_text(encoding="utf-8"))
    return {
        "suppliers": {s["id"]: s for s in raw["suppliers"]},
        "items": raw["items"],
        "categories": raw["categories"],
        "source": "json_fallback",
    }


QUERY = (Path(__file__).parent / "inventory_query.sql").read_text(encoding="utf-8")


def _from_query_json(doc):
    """Normalise the JSON document returned by inventory_query.sql."""
    def num(v):
        return None if v is None else float(v)
    items = [{**i, "unit_price_per_day_try": num(i["unit_price_per_day_try"]),
              "weight_kg": num(i["weight_kg"])} for i in doc["items"]]
    return {"suppliers": {s["id"]: s for s in doc["suppliers"]}, "items": items,
            "categories": doc["categories"], "source": "supabase"}


def _load_postgres(dsn):
    import psycopg   # lazy: not needed for the fallback

    # prepare_threshold=None: works through Supabase's transaction pooler (port 6543) too.
    with psycopg.connect(dsn, connect_timeout=SUPABASE_TIMEOUT_S, prepare_threshold=None) as conn:
        doc = conn.execute(QUERY).fetchone()[0]
    return _from_query_json(doc)


def _load_supabase():
    dsn = os.getenv("DATABASE_URL")
    if dsn:
        return _load_postgres(dsn)
    from supabase import ClientOptions, create_client   # lazy: not needed for the fallback

    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("DATABASE_URL or SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set")
    # Short timeout: if Supabase hangs, fall back to JSON quickly instead of freezing the demo.
    sb = create_client(url, key, options=ClientOptions(postgrest_client_timeout=SUPABASE_TIMEOUT_S))
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
            "weight_kg": None if r.get("weight_kg") is None else float(r["weight_kg"]),
            "main_material": r.get("main_material"),
            "weight_is_estimate": r.get("weight_is_estimate", True),
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


def _refresh():
    """Load once and store. A Supabase failure keeps the last good live copy (if any) instead of
    dropping to the JSON fallback, so a short network blip never changes what the demo shows."""
    try:
        data = _load_supabase()
        if not data["items"]:
            raise RuntimeError("Supabase returned no inventory rows")
    except Exception as e:   # any failure -> keep last live copy, else offline fallback
        prev = _cache["data"]
        if prev is not None and prev["source"] == "supabase":
            log.warning("Supabase refresh failed (%s); keeping last live copy", type(e).__name__)
            _cache["t"] = time.time()          # retry after the next TTL, not on every request
            return prev
        log.warning("Supabase unavailable (%s); using JSON fallback", type(e).__name__)
        data = _load_json()
    log.info("Inventory source: %s (%d items)", data["source"], len(data["items"]))
    _cache.update(t=time.time(), loaded_at=time.time(), data=data)
    return data


def _refresh_in_background():
    if not _lock.acquire(blocking=False):      # a refresh is already running
        return
    def run():
        try:
            _refresh()
        finally:
            _lock.release()
    threading.Thread(target=run, daemon=True).start()


def load_inventory(force_refresh=False):
    """Fresh copy -> return it. Stale copy -> return it now and refresh in the background
    (requests never wait on the database once something is loaded). Nothing yet -> load now."""
    data = _cache["data"]
    if data is not None and not force_refresh:
        if time.time() - _cache["t"] >= CACHE_SECONDS:
            _refresh_in_background()
        return data
    with _lock:
        return _refresh()


def status():
    """For /health: where the current copy came from and how old it is (seconds)."""
    data = _cache["data"]
    if data is None:
        return {"source": None, "age_s": None}
    return {"source": data["source"], "age_s": round(time.time() - _cache["loaded_at"], 1)}
