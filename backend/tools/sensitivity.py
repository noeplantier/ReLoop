"""How much do the (placeholder) scoring weights change the ranking?

Runs every category x 3 locations x 2 date ranges on the fictional inventory, for every weight
vector on a 0.1 grid (distance + condition + price = 1), and compares with the default weights.
Run from backend/:  python tools/sensitivity.py
"""
import itertools
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import match                                   # noqa: E402
from inventory import _load_json               # noqa: E402

INV = _load_json()
DEFAULT = dict(match.WEIGHTS)
LOCS = {"Lara": (36.853, 30.80), "Konyaalti": (36.88, 30.64), "Belek": (36.86, 31.05)}
DATES = [("2026-11-21", "2026-11-23"), ("2026-11-23", "2026-11-25")]


def requests():
    for cat in ("tables", "chairs", "lighting", "signage", "staging"):
        for (lat, lon), (s, e) in itertools.product(LOCS.values(), DATES):
            yield {"category": cat, "quantity": 1, "start_date": s, "end_date": e,
                   "location": {"lat": lat, "lon": lon}}


def top(req, w, n=3):
    match.WEIGHTS.update(w)
    rows, total, _ = match.rank(req, INV["items"], INV["suppliers"], top_n=n)
    return [r["item_id"] for r in rows], total


grid = [{"distance": d / 10, "condition": c / 10, "price": (10 - d - c) / 10}
        for d in range(11) for c in range(11 - d)]
near = [w for w in grid if max(abs(w[k] - DEFAULT[k]) for k in w) <= 0.1001]

reqs = [r for r in requests() if top(r, DEFAULT)[1] >= 2]   # only requests with a real choice
base = {i: top(r, DEFAULT)[0] for i, r in enumerate(reqs)}


def stability(weights):
    same1 = same3 = 0
    for i, r in enumerate(reqs):
        t, _ = top(r, weights)
        same1 += t[0] == base[i][0]
        same3 += set(t) == set(base[i])
    return same1, same3


print(f"{len(reqs)} requests with at least 2 options; {len(grid)} weight vectors ({len(near)} within +/-0.1 of default)")
for label, ws in (("within +/-0.1 of default", near), ("whole grid", grid)):
    s1 = s3 = 0
    for w in ws:
        a, b = stability(w)
        s1 += a; s3 += b
    tot = len(ws) * len(reqs)
    print(f"{label:26s}: top-1 unchanged {100 * s1 / tot:5.1f}%   top-3 set unchanged {100 * s3 / tot:5.1f}%")
for name, w in (("distance only", {"distance": 1, "condition": 0, "price": 0}),
                ("condition only", {"distance": 0, "condition": 1, "price": 0}),
                ("price only", {"distance": 0, "condition": 0, "price": 1}),
                ("equal weights", {"distance": 1 / 3, "condition": 1 / 3, "price": 1 / 3})):
    a, b = stability(w)
    print(f"{name:26s}: top-1 same as default in {a}/{len(reqs)} requests, top-3 set in {b}/{len(reqs)}")
match.WEIGHTS.update(DEFAULT)
