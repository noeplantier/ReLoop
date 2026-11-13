"""Avoided-emissions estimate. Pure Python, reads a factors dict (impact_factors.json).

avoided_kgco2e = factor_per_unit * quantity  -  transport emissions (when a transport factor exists)

Honesty rules: a missing factor gives status 'unavailable' (never a made-up number);
a factor without a source is 'illustrative' and must be labelled so in the UI.
"""


def estimate(category, quantity, factors, weight_kg=None, distance_km=None):
    f = factors["per_category_avoided_kgco2e_per_unit"].get(category) or {}
    value = f.get("value")
    if value is None:
        return {"avoided_kgco2e": None, "status": "unavailable",
                "assumptions": ["No emission factor loaded for this category yet."]}
    assumptions = [f"Baseline: a new item is bought instead of reusing one ({value} kgCO2e per unit)."]
    status = "sourced" if f.get("source") and f.get("status") == "sourced" else "illustrative"
    if f.get("source"):
        assumptions.append(f"Factor source: {f['source']}")
    avoided = value * quantity
    t = factors["transport_kgco2e_per_tonne_km"].get("value")
    if t is not None and weight_kg is not None and distance_km is not None:
        transport = t * (weight_kg * quantity / 1000.0) * distance_km
        avoided -= transport
        assumptions.append(f"Transport deducted: {transport:.2f} kgCO2e.")
    else:
        assumptions.append("Transport emissions NOT deducted (no sourced transport factor or weight).")
    return {"avoided_kgco2e": round(max(avoided, 0.0), 2), "status": status,
            "assumptions": assumptions}
