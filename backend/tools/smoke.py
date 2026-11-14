"""Smoke test against a running ReLoop API (local or deployed). Standard library only.

    python tools/smoke.py https://<service>.onrender.com
    python tools/smoke.py http://127.0.0.1:8000 --origin http://localhost:5173   (127.0.0.1: "localhost" adds ~2 s on Windows)

Runs the main demo journey ("50 chairs and 2 stage lights near Lara, 21-23 Nov 2026"),
prints what the frontend would get, and exits non-zero if anything is wrong.
"""
import argparse
import json
import sys
import time
import urllib.error
import urllib.request

LARA = {"lat": 36.853, "lon": 30.80}
DEMO = [("chairs", 50), ("lighting", 2)]
DATES = {"start_date": "2026-11-21", "end_date": "2026-11-23"}

failures = []


def call(base, method, path, body=None, headers=None, timeout=90):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(base.rstrip("/") + path, data=data, method=method,
                                 headers={"Content-Type": "application/json", **(headers or {})})
    t = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.headers, _json(r.read()), time.time() - t
    except urllib.error.HTTPError as e:
        return e.code, e.headers, _json(e.read()), time.time() - t


def _json(raw):
    try:
        return json.loads(raw or b"null")
    except ValueError:                  # e.g. CORS preflight answers in plain text
        return raw.decode(errors="replace")


def check(ok, msg):
    print(("  ok   " if ok else "  FAIL ") + msg)
    if not ok:
        failures.append(msg)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base_url")
    ap.add_argument("--origin", help="frontend origin to test CORS for (e.g. https://reloop.vercel.app)")
    a = ap.parse_args()
    base = a.base_url

    print(f"GET /health  (first call may take ~60 s if a free Render instance is asleep)")
    code, _, h, dt = call(base, "GET", "/health")
    check(code == 200 and h.get("status") == "ok", f"health {code} in {dt:.1f}s: {h}")
    source = h.get("inventory_source") if isinstance(h, dict) else None

    code, _, cats, dt = call(base, "GET", "/categories")
    check(code == 200 and {c["slug"] for c in cats} >= {"chairs", "lighting"},
          f"categories {code}: {[c['slug'] for c in cats] if code == 200 else cats}")

    selections = []
    for cat, qty in DEMO:
        body = {"request_id": f"smoke-{cat}", "category": cat, "quantity": qty,
                "location": LARA, **DATES}
        code, _, r, dt = call(base, "POST", "/match", body)
        check(code == 200, f"/match {cat} x{qty}: HTTP {code} in {dt:.2f}s")
        if code != 200:
            continue
        check(r.get("inventory_source") == source, f"  inventory_source = {r.get('inventory_source')} (health says {source})")
        check(bool(r.get("cost_note")), f"  cost_note present")
        check(len(r["matches"]) >= 1, f"  {len(r['matches'])} option(s) shown of {r['total_options']} eligible")
        for m in r["matches"]:
            print(f"       - {m['name']} | {m['supplier']['name']} | {m['distance_km']} km | "
                  f"{m['quoted_quantity']}/{qty} (missing {m['missing_quantity']}) | "
                  f"{m['estimated_cost_try']} TRY | {m['impact']['avoided_kgco2e']} kgCO2e "
                  f"[{m['impact']['status']}]")
            check(m["missing_quantity"] == qty - m["quoted_quantity"], "    missing_quantity consistent")
            imp = m["impact"]
            check(imp["status"] in ("sourced", "illustrative", "unavailable")
                  and (imp["avoided_kgco2e"] is None or bool(imp["assumptions"])),
                  "    carbon figure carries a status and its assumptions")
        if r["matches"]:
            top = r["matches"][0]
            selections.append({"item_id": top["item_id"], "quantity": top["quoted_quantity"],
                               "location": LARA, **DATES})

    if selections:
        code, _, s, dt = call(base, "POST", "/impact/summary", {"selections": selections})
        summary = {k: v for k, v in s.items() if k != "assumptions"} if code == 200 else s
        check(code == 200, f"/impact/summary {code}: {summary}")

    code, _, e, _ = call(base, "GET", "/does-not-exist")
    check(code == 404 and e == {"error": "Not Found"}, f"error format {code}: {e}")
    code, _, e, _ = call(base, "POST", "/match", {"category": "chairs"})
    check(code == 422, f"invalid request -> {code}")

    if a.origin:
        code, hdr, _, _ = call(base, "OPTIONS", "/match", headers={
            "Origin": a.origin, "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type"})
        allowed = hdr.get("access-control-allow-origin")
        check(allowed == a.origin, f"CORS preflight from {a.origin}: {code}, allow-origin={allowed}")

    print(f"\nInventory source: {source}")
    print("RESULT:", "PASS" if not failures else f"FAIL ({len(failures)})")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
