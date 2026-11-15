"""Smoke test against a running ReLoop API (local or deployed). Standard library only.

    python tools/smoke.py https://<service>.onrender.com --origin https://<app>.vercel.app \
        --expect-source supabase --expect-commit 076354f
    python tools/smoke.py http://127.0.0.1:8000 --origin http://localhost:5173   ("localhost" adds ~2 s on Windows)

Checks, in the order a user meets them: health and deployed commit, live vs offline inventory, the text ->
review -> matching -> details journey, missing quantities, unavailable items, priority changes, invalid
input, CORS, slow responses, and that NO LLM is called while AI is disabled. `--check-limits` also proves
the per-minute rate limit (uses up to 11 of the day's AI requests).

Prints a report with BLOCKERS separated from NON-BLOCKING findings; exit code 1 only if a blocker failed.
"""
import argparse
import json
import sys
import time
import urllib.error
import urllib.request

LARA = {"lat": 36.853, "lon": 30.80}
DATES = {"start_date": "2026-11-21", "end_date": "2026-11-23"}
DEMO_TEXT = "I need 50 chairs and 2 stage lights near Lara, Antalya, from 21 to 23 November 2026."
SLOW_S = 10          # a warm request slower than this is reported (non-blocking)

blockers, minor = [], []


def call(base, method, path, body=None, headers=None, timeout=90, raw=None):
    data = raw if raw is not None else (None if body is None else json.dumps(body).encode())
    req = urllib.request.Request(base.rstrip("/") + path, data=data, method=method,
                                 headers={"Content-Type": "application/json", **(headers or {})})
    t = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.headers, _json(r.read()), time.time() - t
    except urllib.error.HTTPError as e:
        return e.code, e.headers, _json(e.read()), time.time() - t
    except (urllib.error.URLError, TimeoutError) as e:
        return None, {}, str(getattr(e, "reason", e)), time.time() - t


def _json(raw):
    try:
        return json.loads(raw or b"null")
    except ValueError:                  # e.g. CORS preflight answers in plain text
        return raw.decode(errors="replace")


def check(ok, msg, blocker=True):
    print(("  ok   " if ok else ("  FAIL " if blocker else "  WARN ")) + msg)
    if not ok:
        (blockers if blocker else minor).append(msg)
    return ok


def section(title):
    print(f"\n== {title}")


def match(base, cat, qty, **extra):
    return call(base, "POST", "/match", {"category": cat, "quantity": qty, "location": LARA, **DATES, **extra})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base_url")
    ap.add_argument("--origin", help="real frontend origin to test CORS for (e.g. https://reloop.vercel.app)")
    ap.add_argument("--expect-source", choices=["supabase", "json_fallback"],
                    help="fail if /health reports another inventory source")
    ap.add_argument("--expect-commit", help="fail if /health reports another deployed commit (prefix)")
    ap.add_argument("--expect-llm", choices=["off", "on"], default="off",
                    help="off (default): fail if any LLM path is enabled or used")
    ap.add_argument("--check-limits", action="store_true",
                    help="send 11 quick /parse-request calls and expect a 429 (uses up to 11 AI requests of the day)")
    a = ap.parse_args()
    base = a.base_url

    # ---------------------------------------------------------------- health
    section("Health, deployed commit, inventory source")
    print("  (first call can take ~60 s if a free Render instance is asleep)")
    code, _, h, dt = call(base, "GET", "/health")
    if not check(code == 200 and isinstance(h, dict) and h.get("status") == "ok", f"/health {code} in {dt:.1f}s"):
        print(f"       {h}")
        return report(None)
    check(dt < 75, f"first response time {dt:.1f}s (cold start)", blocker=False)
    print(f"       {h}")
    source = h.get("inventory_source")
    if a.expect_source:
        check(source == a.expect_source, f"inventory_source = {source} (expected {a.expect_source})")
    else:
        check(source == "supabase", f"inventory_source = {source} (live database)", blocker=False)
    if a.expect_commit:
        check((h.get("commit") or "").startswith(a.expect_commit[:7]),
              f"deployed commit {h.get('commit')} (expected {a.expect_commit[:7]})")
    ai_layer, llm_on = bool(h.get("ai_layer")), bool(h.get("llm_enabled"))
    if a.expect_llm == "off":
        check(not llm_on, f"llm_enabled = {llm_on} (AI budget is zero: must be false)")

    # ---------------------------------------------------------------- journey
    section("Journey: text -> review -> matching -> details")
    needs = [("chairs", 50, "chairs"), ("lighting", 2, "stage lights")]
    if ai_layer:
        code, _, p, dt = call(base, "POST", "/parse-request", {"text": DEMO_TEXT, "context": {"today": "2026-11-14"}})
        got = [(n["category"], n["quantity"]) for n in p.get("needs", [])] if code == 200 else None
        check(code == 200 and got == [("chairs", 50), ("lighting", 2)]
              and p.get("start_date") == DATES["start_date"] and p.get("end_date") == DATES["end_date"]
              and (p.get("location") or {}).get("preset_id") == "lara",
              f"/parse-request {code} in {dt:.2f}s -> needs {got}, parser={p.get('parser') if code == 200 else p}")
        if a.expect_llm == "off" and code == 200:
            check(p.get("parser") == "rules", f"parser = {p.get('parser')} (no LLM call while AI is off)")
    else:
        check(False, "AI layer not mounted: /parse-request and /explain unavailable (manual form only)", blocker=False)

    selections = []
    for cat, qty, label in needs:
        code, _, r, dt = match(base, cat, qty, request_id=f"smoke-{cat}")
        if not check(code == 200, f"/match {cat} x{qty}: HTTP {code} in {dt:.2f}s"):
            continue
        check(dt < SLOW_S, f"  /match latency {dt:.2f}s", blocker=False)
        check(r.get("inventory_source") == source, f"  inventory_source = {r.get('inventory_source')} (same as /health)")
        check(bool(r.get("cost_note")), "  cost_note present")
        check(1 <= len(r["matches"]) <= 3, f"  {len(r['matches'])} option(s) shown of {r['total_options']} eligible")
        for m in r["matches"]:
            imp = m["impact"]
            print(f"       - {m['name']} | {m['supplier']['name']} | {m['distance_km']} km | "
                  f"{m['quoted_quantity']}/{qty} | {m['estimated_cost_try']} TRY | "
                  f"{imp.get('avoided_kgco2e_conservative')}-{imp['avoided_kgco2e']} kgCO2e [{imp['status']}]")
            check(m["missing_quantity"] == qty - m["quoted_quantity"], "    missing_quantity consistent")
            check(imp["avoided_kgco2e"] is None or (imp.get("avoided_kgco2e_conservative") is not None
                  and imp["avoided_kgco2e_conservative"] <= imp["avoided_kgco2e"] and imp["assumptions"]),
                  "    carbon is a range with assumptions")
        if r["matches"]:
            top = r["matches"][0]
            selections.append({"item_id": top["item_id"], "quantity": top["quoted_quantity"], "location": LARA, **DATES})
            if ai_layer:
                code, _, e, dt = call(base, "POST", "/explain", {
                    "request": {"category": cat, "quantity": qty, **DATES, "label": label}, "matches": r["matches"]})
                check(code == 200 and len(e.get("explanations", [])) == len(r["matches"]),
                      f"  /explain {code} in {dt:.2f}s, explainer={e.get('explainer') if code == 200 else e}")
                if a.expect_llm == "off" and code == 200:
                    check(e.get("explainer") == "template", f"  explainer = {e.get('explainer')} (no LLM call while AI is off)")

    if selections:
        code, _, s, _ = call(base, "POST", "/impact/summary", {"selections": selections})
        if check(code == 200, f"/impact/summary {code}"):
            lo, hi = s.get("avoided_kgco2e_conservative"), s.get("avoided_kgco2e")
            check(lo is not None and hi is not None and lo <= hi,
                  f"  carbon range {lo} to {hi} kgCO2e ({s['impact_status']})")
    code, _, meth, _ = call(base, "GET", "/impact/methodology")
    check(code == 200 and bool(meth.get("factors")) and bool(meth.get("assumptions")),
          f"/impact/methodology {code} ('How we calculate')")

    # ---------------------------------------------------------------- edge cases
    section("Missing quantities, unavailable items, priority changes")
    code, _, r, _ = match(base, "chairs", 400)
    check(code == 200 and r["matches"] and all(not m["covers_quantity"] and m["missing_quantity"] > 0 for m in r["matches"]),
          f"400 chairs -> every option partial with missing units: "
          f"{[m['missing_quantity'] for m in r['matches']] if code == 200 else r}")
    code, _, r, _ = call(base, "POST", "/match", {"category": "chairs", "quantity": 10, "location": LARA,
                                                   "start_date": "2027-01-10", "end_date": "2027-01-11"})
    check(code == 200 and r["matches"] == [] and r["total_options"] == 0,
          f"nothing available (January) -> 200 with 0 options ({code})")
    code, _, d, _ = match(base, "chairs", 50)
    code2, _, c, _ = match(base, "chairs", 50, priority="cheapest")
    if check(code == 200 and code2 == 200, f"priority request accepted ({code2})"):
        check(c["matches"][0]["breakdown"]["weights"]["price"] == 0.6
              and [m["item_id"] for m in c["matches"]] != [m["item_id"] for m in d["matches"]],
              "  priority=cheapest changes the ranking and reports its weights")

    # ---------------------------------------------------------------- errors
    section("Invalid input and error format")
    code, _, e, _ = call(base, "GET", "/does-not-exist")
    check(code == 404 and e == {"error": "Not Found"}, f"unknown route -> {code} {e}")
    code, _, _, _ = call(base, "POST", "/match", {"category": "chairs"})
    check(code == 422, f"missing fields -> {code}")
    code, _, _, _ = match(base, "boats", 5)
    check(code == 422, f"unknown category -> {code}")
    code, _, _, _ = call(base, "POST", "/match", {"category": "chairs", "quantity": 5, "location": LARA,
                                                   "start_date": "2026-11-23", "end_date": "2026-11-21"})
    check(code == 422, f"end date before start -> {code}")
    code, _, _, _ = call(base, "POST", "/match", raw=b"not json")
    check(code == 422, f"malformed JSON -> {code}")
    code, _, e, _ = call(base, "POST", "/match", raw=json.dumps({"pad": "x" * 70000}).encode())
    check(code == 413, f"70 KB body -> {code} {e if code == 413 else ''}")

    # ---------------------------------------------------------------- CORS
    section("CORS")
    if a.origin:
        code, hdr, _, _ = call(base, "OPTIONS", "/match", headers={
            "Origin": a.origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"})
        check(hdr.get("access-control-allow-origin") == a.origin,
              f"preflight from {a.origin}: {code}, allow-origin={hdr.get('access-control-allow-origin')}")
    else:
        check(False, "no --origin given: the real frontend origin was not tested", blocker=False)
    code, hdr, _, _ = call(base, "OPTIONS", "/match", headers={
        "Origin": "https://not-ours.example.com", "Access-Control-Request-Method": "POST"})
    check(hdr.get("access-control-allow-origin") is None, "unknown origin is refused", blocker=False)

    # ---------------------------------------------------------------- limits
    if a.check_limits and ai_layer:
        section("Rate limit (uses up to 11 AI requests of today's budget)")
        got429 = None
        for i in range(11):
            code, hdr, e, _ = call(base, "POST", "/parse-request", {"text": "10 chairs in Lara on 21 Nov"},
                                   headers={"X-Forwarded-For": "203.0.113.250"})
            if code == 429:
                got429 = (i + 1, hdr.get("retry-after"), e)
                break
        check(got429 is not None and got429[1] == "60" and "error" in (got429[2] or {}),
              f"per-minute AI limit -> 429 after {got429[0] if got429 else '>11'} calls, Retry-After={got429[1] if got429 else None}")
        print("       note: behind Render's proxy X-Forwarded-For may be overwritten; then the limit applies to this machine")

    return report(source)


def report(source):
    print("\n" + "=" * 60)
    print(f"Inventory source: {source}")
    print(f"BLOCKERS ({len(blockers)}):" + ("" if blockers else " none"))
    for b in blockers:
        print(f"  - {b}")
    print(f"NON-BLOCKING ({len(minor)}):" + ("" if minor else " none"))
    for m in minor:
        print(f"  - {m}")
    print("RESULT:", "PASS" if not blockers else "FAIL")
    sys.exit(1 if blockers else 0)


if __name__ == "__main__":
    main()
