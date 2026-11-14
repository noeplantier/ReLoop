"""Grounded explanations for match results.

template_explanation() builds text only from engine fields (always available, no LLM).
check_grounded() rejects LLM text that contains any number not present in the engine output.
"""
import re

from .schemas import ExplainRequestCtx, Explanation, MatchFacts

BASE_CHECKS = ["deposit", "damage responsibility", "return conditions", "pickup or delivery"]

_NUM = re.compile(r"\d[\d,]*(?:\.\d+)?")  # "96–956" yields 96 and 956 (en dash is not part of a number)


def days_of(req: ExplainRequestCtx) -> int:
    return (req.end_date - req.start_date).days + 1


def fmt_num(x: float) -> str:
    """1800.0 -> '1,800'; 12.4 -> '12.4'; 956.02 -> '956'."""
    if x is None:
        return ""
    if abs(x) >= 100 or float(x).is_integer():
        return f"{round(x):,}"
    return f"{x:.1f}"


def things_to_check(m: MatchFacts, req: ExplainRequestCtx) -> list[str]:
    checks = list(BASE_CHECKS)
    if not m.covers_quantity:
        checks.append("where to get the missing units")
    if m.estimated_cost_try is None:
        checks.append("whether the loan is really free of charge")
    return checks


def template_explanation(m: MatchFacts, req: ExplainRequestCtx) -> Explanation:
    label = req.label or req.category
    days = days_of(req)
    missing = req.quantity - m.quoted_quantity
    if m.covers_quantity:
        summary = (f"{m.name} from {m.supplier.name} covers all {req.quantity} {label} "
                   f"for your {days}-day event.")
    else:
        summary = (f"{m.name} from {m.supplier.name} covers {m.quoted_quantity} of {req.quantity} {label}; "
                   f"{missing} are still missing.")

    reasons = []
    if m.distance_km < 0.5:
        reasons.append("It is at your selected location (under 1 km away).")
    else:
        reasons.append(f"It is about {fmt_num(m.distance_km)} km from your location.")
    reasons.append(f"Condition is rated {m.condition}; it is offered as a {m.reuse_mode}.")
    if m.covers_quantity:
        reasons.append(f"{m.available_quantity} units are free for all your dates, "
                       f"so your {req.quantity} are covered.")
    else:
        reasons.append(f"Only {m.available_quantity} units are free for your dates.")
    if m.estimated_cost_try is not None:
        reasons.append(f"Estimated rental: {fmt_num(m.estimated_cost_try)} TRY for {days} days "
                       "(delivery and deposit not included).")
    else:
        reasons.append("No rental price is listed for this item.")
    if m.impact.avoided_kgco2e is not None:
        word = "Illustrative estimate" if m.impact.status == "illustrative" else "Estimate"
        reasons.append(f"{word}: {co2_range(m)} kgCO2e avoided compared with buying new (see assumptions).")

    return Explanation(item_id=m.item_id, summary=summary, reasons=reasons,
                       things_to_check=things_to_check(m, req),
                       avoided_kgco2e=m.impact.avoided_kgco2e,
                       avoided_kgco2e_conservative=m.impact.avoided_kgco2e_conservative,
                       impact_status=m.impact.status, source="template")


def co2_range(m: MatchFacts) -> str:
    """'96–956' when the engine gives both bounds, else 'about 956'. Never shows the upper bound alone
    when a conservative bound exists (that would overstate the impact)."""
    hi, lo = m.impact.avoided_kgco2e, m.impact.avoided_kgco2e_conservative
    if lo is not None and fmt_num(lo) != fmt_num(hi):
        return f"{fmt_num(lo)}–{fmt_num(hi)}"
    return f"about {fmt_num(hi)}"


def allowed_numbers(m: MatchFacts, req: ExplainRequestCtx) -> set[str]:
    """Every number the explanation may mention, in the spellings we accept."""
    vals = [req.quantity, days_of(req), req.start_date.day, req.end_date.day, req.start_date.year,
            m.available_quantity, m.quoted_quantity, m.distance_km, req.quantity - m.quoted_quantity,
            m.unit_price_per_day_try, m.estimated_cost_try, m.impact.avoided_kgco2e,
            m.impact.avoided_kgco2e_conservative, m.impact.transport_kgco2e, m.score]
    vals += [v for v in m.breakdown.values() if isinstance(v, (int, float))]
    vals += [v for v in (m.breakdown.get("weights") or {}).values() if isinstance(v, (int, float))]
    out = {"2", "0"}  # "CO2", "kgCO2e"; zero is harmless
    for v in vals:
        if v is None:
            continue
        f = float(v)
        for s in (fmt_num(f), f"{f:g}", f"{f:.1f}", f"{f:.2f}", str(round(f)), f"{round(f):,}"):
            out.add(s.replace(",", ""))
    # Numbers inside item / supplier names ("20 m", "Demo Supplier 2") are facts too.
    for s in (m.name, m.supplier.name):
        out.update(n.replace(",", "") for n in _NUM.findall(s))
    return out


def check_grounded(text: str, m: MatchFacts, req: ExplainRequestCtx) -> bool:
    low = text.lower()
    # Carbon must always be framed as an estimate, and only when the engine gave a number.
    if "co2" in low or "carbon" in low or "emission" in low:
        if m.impact.avoided_kgco2e is None or not ("estimat" in low or "illustrative" in low):
            return False
        # With a range available, the conservative bound must be stated too (upper alone overstates).
        lo = m.impact.avoided_kgco2e_conservative
        if lo is not None and not any(s in text.replace(",", "")
                                      for s in {fmt_num(lo).replace(",", ""), f"{lo:g}", str(round(lo))}):
            return False
    if any(w in low for w in ("guarantee", "certified", "verified", "measured")):
        return False
    if "%" in text or "percent" in low:      # the engine never returns percentages
        return False
    allowed = allowed_numbers(m, req)
    for n in _NUM.findall(text):
        n = n.replace(",", "").rstrip(".")
        if n not in allowed and n.rstrip("0").rstrip(".") not in allowed:
            return False
    return True
