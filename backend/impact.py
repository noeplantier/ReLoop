"""Avoided-emissions estimate. Pure Python, reads a factors dict (impact_factors.json).

avoided_kgco2e = embodied emissions of making the NEW item we avoid buying
                 - transport emissions of delivering the REUSED item

  embodied  = (weight_kg / 1000) * quantity * material_factor      [kgCO2e per tonne, DEFRA 2025]
  transport = transport_factor * (weight_kg / 1000) * quantity * distance_km   [kgCO2e per tonne-km]

Honesty rules: missing weight/material/factor -> status 'unavailable' (never a made-up number);
a weight flagged as an estimate -> status 'illustrative' (UI must label it, never a verified claim).
Simplifications (stated in `assumptions`): one-way delivery; the avoided new item would also have been
delivered (not subtracted); UK DEFRA factors used as a proxy; use-phase and end-of-life ignored.
"""


def estimate(item, quantity, factors, distance_km=None):
    w, mat = item.get("weight_kg"), item.get("main_material")
    mf = factors["material_kgco2e_per_tonne_primary_production"].get(mat) if mat else None
    if not w or not mf or mf.get("value") is None:
        return {"avoided_kgco2e": None, "status": "unavailable",
                "assumptions": ["Weight, material or emission factor missing for this item."]}

    tonnes = w / 1000.0 * quantity
    embodied = tonnes * mf["value"]
    assumptions = [
        f"Avoided: producing {quantity} new unit(s) of {mat.replace('_', ' ')}, about {w} kg each "
        f"= {tonnes:.3f} t x {mf['value']} kgCO2e/t = {embodied:.1f} kgCO2e.",
        f"Factor source: {mf['source']}",
    ]
    t = factors["transport_kgco2e_per_tonne_km"]
    transport = 0.0
    if t.get("value") is not None and distance_km is not None:
        transport = t["value"] * tonnes * distance_km
        assumptions.append(f"Delivery deducted: {t['value']} kgCO2e/t-km x {tonnes:.3f} t x "
                           f"{distance_km:.1f} km = {transport:.2f} kgCO2e (one-way, rigid diesel truck).")
    else:
        assumptions.append("Delivery emissions NOT deducted (distance or transport factor missing).")
    avoided = max(embodied - transport, 0.0)

    is_estimate = item.get("weight_is_estimate", True)
    if is_estimate:
        assumptions.append("Item weight and material are rough estimates for demo data.")
    assumptions.append("Proxy: UK Defra 2025 factors, not Turkey-specific; use phase and end-of-life ignored.")
    status = "illustrative" if is_estimate or mf.get("status") != "sourced" else "sourced"
    return {"avoided_kgco2e": round(avoided, 2), "status": status, "assumptions": assumptions}
