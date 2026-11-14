"""Every figure for the slides and the submission form, computed from the code (never typed by hand).

    python tools/pitch_numbers.py                      # print Markdown
    python tools/pitch_numbers.py --out ../docs/PITCH_NUMBERS.md

Uses the fictional demo inventory (backend/data/inventory.json, identical to supabase/seed.sql), so
the numbers are reproducible offline. Rerun after any backend change and before the pitch.
"""
import argparse
import os
import re
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
BACKEND = HERE.parent
ROOT = BACKEND.parent
sys.path.insert(0, str(BACKEND))
# Reproducible: never the live database, never an LLM.
os.environ.update(SUPABASE_URL="", SUPABASE_SERVICE_ROLE_KEY="", DATABASE_URL="", LLM_PROVIDER="none")

from fastapi.testclient import TestClient  # noqa: E402

import batch  # noqa: E402
import match  # noqa: E402
import main  # noqa: E402
from inventory import _load_json  # noqa: E402

LARA = {"lat": 36.853, "lon": 30.80}
DATES = {"start_date": "2026-11-21", "end_date": "2026-11-23"}
DEMO_TEXT = "I need 50 chairs and 2 stage lights near Lara, Antalya, from 21 to 23 November 2026."
NEEDS = [("chairs", 50), ("lighting", 2)]


def fmt(x, nd=1):
    return "n/a" if x is None else f"{x:,.{nd}f}"


def demo_request(c, out):
    out.append("## 1. Main demo request\n")
    out.append(f"> {DEMO_TEXT}\n")
    out.append("Location preset Lara (36.853, 30.80). Up to 3 options per need, ranked with default weights.\n")
    selections = []
    for cat, qty in NEEDS:
        r = c.post("/match", json={"category": cat, "quantity": qty, "location": LARA, **DATES}).json()
        out.append(f"\n**{cat}: {qty} requested, {r['total_options']} eligible option(s), {len(r['matches'])} shown, "
                   f"{r['days']} days**\n")
        out.append("| # | Item | Supplier | km | Covers | Cost (TRY) | CO2e avoided, kg (conservative to upper) |")
        out.append("|---|---|---|---|---|---|---|")
        for i, m in enumerate(r["matches"], 1):
            imp = m["impact"]
            out.append(f"| {i} | {m['name']} | {m['supplier']['name']} | {m['distance_km']} | "
                       f"{m['quoted_quantity']}/{qty} | {fmt(m['estimated_cost_try'], 0)} | "
                       f"{fmt(imp['avoided_kgco2e_conservative'])} to {fmt(imp['avoided_kgco2e'])} ({imp['status']}) |")
        top = r["matches"][0]
        selections.append({"item_id": top["item_id"], "quantity": top["quoted_quantity"], "location": LARA, **DATES})
    s = c.post("/impact/summary", json={"selections": selections}).json()
    out.append(f"\n**Top option of each need together:** {s['reused_units']} units reused, "
               f"{fmt(s['total_distance_km'])} km, about {fmt(s['estimated_cost_try'], 0)} TRY rental, "
               f"**{fmt(s['avoided_kgco2e_conservative'], 0)} to {fmt(s['avoided_kgco2e'], 0)} kg CO2e avoided "
               f"({s['impact_status']})**, transport {fmt(s['transport_kgco2e'], 2)} kg CO2e.\n")
    out.append("Say: \"estimated\", \"illustrative\", \"in our demo\". The conservative bound assumes a new item "
               "would serve 10 events (our assumption, no source found).\n")


def one_supplier(out):
    by_sup = {}
    inv = _load_json()
    for cat, qty in NEEDS:
        # every eligible option, not only the top 3 the API shows
        allrows, _, _ = match.rank({"category": cat, "quantity": qty, "location": LARA, **DATES},
                                   inv["items"], inv["suppliers"], top_n=10 ** 6)
        for m in allrows:
            if m["covers_quantity"]:
                by_sup.setdefault(m["supplier"]["name"], {})[cat] = (m["name"], m["distance_km"])
    both = {s: v for s, v in by_sup.items() if len(v) == len(NEEDS)}
    out.append("\n## 2. Can one supplier cover the whole demo request?\n")
    if both:
        for s, v in both.items():
            km = next(iter(v.values()))[1]
            out.append(f"- **{s}** ({km} km): " + "; ".join(f"{cat}: {name}" for cat, (name, _) in v.items()))
    else:
        out.append("- No single supplier covers every need.")
    out.append("")


def batch_scenario(out):
    inv = _load_json()
    loc = {"Lara": (36.853, 30.80), "Konyaalti": (36.88, 30.64), "Belek": (36.86, 31.05)}
    def R(i, q, s, e, where):
        lat, lon = loc[where]
        return {"request_id": f"Event {i} ({where})", "category": "chairs", "quantity": q,
                "start_date": f"2026-11-{s}", "end_date": f"2026-11-{e}", "location": {"lat": lat, "lon": lon}}
    reqs = [R(1, 200, 21, 23, "Lara"), R(2, 150, 21, 23, "Konyaalti"), R(3, 100, 22, 24, "Belek")]
    gr = batch.greedy(reqs, inv["items"], inv["suppliers"])
    mr = batch.solve_milp(reqs, inv["items"], inv["suppliers"])
    g, m = gr["summary"], mr["summary"]
    out.append("## 3. Three events competing for the same chairs (optimiser)\n")
    out.append("Events: 200 chairs Lara 21-23 Nov, 150 Konyaalti 21-23 Nov, 100 Belek 22-24 Nov; max 2 suppliers each.\n")
    out.append("| | First come, first served | Optimised (MILP) |")
    out.append("|---|---|---|")
    out.append(f"| Events fully covered | {g['covered_requests']}/{g['total_requests']} | {m['covered_requests']}/{m['total_requests']} |")
    out.append(f"| Chairs left unmet | {g['unmet_units']} | {m['unmet_units']} |")
    out.append(f"| Total pickup distance (km) | {g['total_distance_km']} | {m['total_distance_km']} |")
    for label, res in (("First come, first served", gr), ("Optimised (MILP)", mr)):
        out.append(f"\n**{label}:**")
        for a in res["allocations"]:
            lines = "; ".join(f"{l['quantity']} x {l['name']} ({l['supplier']}, {l['distance_km']} km)"
                              for l in a["lines"])
            out.append(f"- {a['request_id']}: {lines or 'nothing'}"
                       + (f"; **{a['unmet']} unmet**" if a["unmet"] else ""))
    out.append("\nSay: \"in our demo scenario\". This is mathematical optimisation, not AI.\n")


def sensitivity(out):
    r = subprocess.run([sys.executable, str(HERE / "sensitivity.py")], capture_output=True, text=True,
                       cwd=BACKEND, timeout=300)
    out.append("## 4. Robustness of the ranking (scoring-weight sensitivity)\n")
    out.append("```\n" + r.stdout.strip() + "\n```\n")


def counts(out):
    out.append("## 5. Tests\n")
    r = subprocess.run([sys.executable, "-m", "pytest", "-q", "--collect-only", "-p", "no:cacheprovider"],
                       capture_output=True, text=True, cwd=BACKEND, timeout=120)
    n = re.search(r"(\d+) tests? collected", r.stdout)
    out.append(f"- Backend automated tests: {n.group(1) if n else 'unknown'}")
    node = shutil.which("node")
    tests_dir = ROOT / "supabase" / "tests"
    if node and (tests_dir / "node_modules").exists():
        r = subprocess.run([node, "validate.mjs"], capture_output=True, text=True, cwd=tests_dir, timeout=120)
        passed = len(re.findall(r"^PASS ", r.stdout, re.M))
        failed = len(re.findall(r"^FAIL ", r.stdout, re.M))
        out.append(f"- Database checks (PGlite): {passed} passed, {failed} failed")
    else:
        out.append("- Database checks: not run here (needs node + `npm install` in supabase/tests)")
    if (ROOT / "ai" / "tests").exists():
        r = subprocess.run([sys.executable, "-m", "pytest", "-q", "--collect-only", "-p", "no:cacheprovider", "ai/tests"],
                           capture_output=True, text=True, cwd=ROOT, timeout=120)
        n = re.search(r"(\d+) tests? collected", r.stdout)
        out.append(f"- AI layer tests: {n.group(1) if n else 'unknown'}")
    out.append("")


def main_():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", help="write Markdown to this file instead of stdout")
    a = ap.parse_args()
    c = TestClient(main.app)
    out = [f"# Pitch numbers (generated {date.today().isoformat()} by backend/tools/pitch_numbers.py)\n",
           "Do not edit by hand: rerun the tool. All inventory is fictional.\n"]
    demo_request(c, out)
    one_supplier(out)
    batch_scenario(out)
    sensitivity(out)
    counts(out)
    text = "\n".join(out) + "\n"
    if a.out:
        Path(a.out).write_text(text, encoding="utf-8")
        print(f"written {a.out}")
    else:
        print(text)


if __name__ == "__main__":
    main_()
