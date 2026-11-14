"""Several requests competing for the same stock: greedy baseline vs MILP (optimal).

Pure Python (+ scipy). Reuses match.rank for filters and per-unit scores, so a batch result is
always consistent with what /match would show for each request alone.

Stock is shared per (item, availability window): two requests that fall into the same declared
window draw from the same quantity.
"Suppliers" means suppliers (one pickup each), not item lines: two items from the same venue
count as one supplier, and distance is counted once per (request, supplier).

Greedy  = first come, first served: each request, in the order given, takes the best-scored
          units still in stock from at most K suppliers. A big early request can starve a later one.
MILP    = decides all requests at once. Variables: x units per (request, option) (integer),
          y per (request, supplier) (binary, supplier used), u unmet units per request.
          Maximise  sum(score * x) - PENALTY * sum(u)
          s.t.      stock per window, demand per request (sum x + u = quantity),
                    at most K suppliers per request, x <= M * y(supplier of x).
"""
import numpy as np
from scipy.optimize import Bounds, LinearConstraint, milp

import match

PENALTY = 2.0      # cost of one unmet unit; > max per-unit score (1.0), so covering always pays
TIME_LIMIT_S = 10


def _options(requests, inventory, suppliers):
    """Per request: every eligible option with its per-unit score, stock key and distance."""
    out = []
    for r in requests:
        rows, _, _ = match.rank(r, inventory, suppliers, top_n=10 ** 6)
        out.append([{
            "item_id": row["item_id"], "name": row["name"], "supplier": row["supplier"],
            "supplier_id": row["supplier"]["id"],
            "score": row["score"], "distance_km": row["distance_km"],
            "stock": row["available_quantity"],
            "stock_key": (row["item_id"], tuple(row["window_key"])),
        } for row in rows])
    return out


def _summarise(requests, picks, unmet):
    allocs, covered, units_unmet, score_sum, dist = [], 0, 0, 0.0, 0.0
    for r, lines, u in zip(requests, picks, unmet):
        allocs.append({"request_id": r.get("request_id"),
                       "lines": [{"item_id": o["item_id"], "name": o["name"],
                                  "supplier": o["supplier"]["name"], "quantity": q,
                                  "distance_km": o["distance_km"]} for o, q in lines],
                       "unmet": u})
        covered += 1 if u == 0 else 0
        units_unmet += u
        score_sum += sum(o["score"] * q for o, q in lines)
        trips = {o["supplier_id"]: o["distance_km"] for o, _ in lines}   # one trip per supplier
        dist += sum(trips.values())
    return {"allocations": allocs,
            "summary": {"covered_requests": covered, "total_requests": len(requests),
                        "unmet_units": units_unmet, "total_score": round(score_sum, 3),
                        "total_distance_km": round(dist, 1)}}


def greedy(requests, inventory, suppliers, max_suppliers=2):
    stock, picks, unmet = {}, [], []
    for r, opts in zip(requests, _options(requests, inventory, suppliers)):
        need, lines, used = r["quantity"], [], set()
        for o in sorted(opts, key=lambda o: (-o["score"], o["item_id"])):
            if need == 0:
                break
            if o["supplier_id"] not in used and len(used) >= max_suppliers:
                continue
            left = stock.setdefault(o["stock_key"], o["stock"])
            take = min(need, left)
            if take > 0:
                stock[o["stock_key"]] = left - take
                need -= take
                used.add(o["supplier_id"])
                lines.append((o, take))
        picks.append(lines)
        unmet.append(need)
    return _summarise(requests, picks, unmet)


def solve_milp(requests, inventory, suppliers, max_suppliers=2):
    opts_by_req = _options(requests, inventory, suppliers)
    pairs = [(ri, o) for ri, opts in enumerate(opts_by_req) for o in opts]
    if not pairs:
        return _summarise(requests, [[] for _ in requests], [r["quantity"] for r in requests])
    sup_pairs = sorted({(ri, o["supplier_id"]) for ri, o in pairs})
    y_idx = {sp: j for j, sp in enumerate(sup_pairs)}
    nP, nY, nR = len(pairs), len(sup_pairs), len(requests)
    n = nP + nY + nR                         # x[0:nP], y[nP:nP+nY], u[nP+nY:]
    X, Y, U = 0, nP, nP + nY

    c = np.zeros(n)
    for k, (_, o) in enumerate(pairs):
        c[X + k] = -o["score"]
    c[U:] = PENALTY

    rows, lo, hi = [], [], []

    def add(coefs, l, h):
        v = np.zeros(n)
        for idx, val in coefs:
            v[idx] += val
        rows.append(v); lo.append(l); hi.append(h)

    groups = {}
    for k, (_, o) in enumerate(pairs):
        groups.setdefault(o["stock_key"], (o["stock"], []))[1].append(k)
    for cap, ks in groups.values():                                       # stock per window
        add([(X + k, 1) for k in ks], -np.inf, cap)
    for ri, r in enumerate(requests):
        ks = [k for k, (rj, _) in enumerate(pairs) if rj == ri]
        add([(X + k, 1) for k in ks] + [(U + ri, 1)], r["quantity"], r["quantity"])   # demand
        add([(Y + y_idx[sp], 1) for sp in sup_pairs if sp[0] == ri], -np.inf, max_suppliers)
    for k, (ri, o) in enumerate(pairs):                                   # x <= M * y
        big = min(requests[ri]["quantity"], o["stock"])
        add([(X + k, 1), (Y + y_idx[(ri, o["supplier_id"])], -big)], -np.inf, 0)

    ub = np.r_[[min(requests[ri]["quantity"], o["stock"]) for ri, o in pairs],
               np.ones(nY), [r["quantity"] for r in requests]]
    integrality = np.r_[np.ones(nP), np.ones(nY), np.zeros(nR)]
    sol = milp(c, constraints=LinearConstraint(np.array(rows), lo, hi), integrality=integrality,
               bounds=Bounds(np.zeros(n), ub), options={"time_limit": TIME_LIMIT_S})
    if sol.x is None:                                                     # caller falls back
        raise RuntimeError(f"MILP failed: status={sol.status} {sol.message}")

    picks = [[] for _ in requests]
    for k, (ri, o) in enumerate(pairs):
        q = int(round(sol.x[X + k]))
        if q > 0:
            picks[ri].append((o, q))
    unmet = [int(round(sol.x[U + ri])) for ri in range(nR)]
    return _summarise(requests, picks, unmet)


def compare(requests, inventory, suppliers, max_suppliers=2):
    """Greedy baseline and MILP side by side. If MILP fails, say so and return greedy as the plan."""
    g = greedy(requests, inventory, suppliers, max_suppliers)
    try:
        m = solve_milp(requests, inventory, suppliers, max_suppliers)
        note = None
    except Exception as e:                                                # never break the demo
        m, note = g, f"MILP unavailable ({type(e).__name__}); greedy plan returned."
    return {"allocations": m["allocations"], "comparison": {"greedy": g, "milp": m}, "note": note}
