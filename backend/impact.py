"""Avoided-emissions estimate as a RANGE. Pure Python, reads a factors dict (impact_factors.json).

  embodied   = (weight_kg / 1000) * quantity * material_factor          [kgCO2e per tonne, DEFRA 2025]
  transport  = transport_factor * (weight_kg / 1000) * quantity * distance_km * legs   [kgCO2e per tonne-km]
               (legs = 2: delivery to the event and return to the supplier)

  upper        (avoided_kgco2e)              = embodied            - transport
               counterfactual: without ReLoop the organiser buys NEW items for this event alone.
  conservative (avoided_kgco2e_conservative) = embodied / uses     - transport
               counterfactual: the new items would have served `uses` events, so this event is
               credited only with its share of their production emissions.

Both are floored at 0. Honesty rules: missing weight/material/factor -> status 'unavailable' (never a
made-up number); an estimated weight or an unsourced assumption -> 'illustrative' (UI must label it,
never a verified claim). `uses` is an ASSUMPTION (see impact_factors.json), so a conservative figure
is always illustrative. Not counted: use phase, end of life, the new item's own delivery.
"""


def _cf(factors):
    cf = factors.get("counterfactual", {})
    uses = cf.get("assumed_uses_per_new_item", {}).get("value") or 1
    legs = cf.get("transport_legs", {}).get("value") or 1
    return max(int(uses), 1), max(int(legs), 1)


def estimate(item, quantity, factors, distance_km=None):
    w, mat = item.get("weight_kg"), item.get("main_material")
    mf = factors["material_kgco2e_per_tonne_primary_production"].get(mat) if mat else None
    if not w or not mf or mf.get("value") is None:
        return {"avoided_kgco2e": None, "avoided_kgco2e_conservative": None, "transport_kgco2e": None,
                "status": "unavailable", "basis": None,
                "assumptions": ["Weight, material or emission factor missing for this item."]}

    uses, legs = _cf(factors)
    tonnes = w / 1000.0 * quantity
    embodied = tonnes * mf["value"]
    assumptions = [
        f"Upper bound: producing {quantity} new unit(s) of {mat.replace('_', ' ')}, about {w} kg each "
        f"= {tonnes:.3f} t x {mf['value']} kgCO2e/t = {embodied:.1f} kgCO2e is avoided.",
        f"Factor source: {mf['source']}",
        f"Conservative bound: a new item would serve {uses} events (ASSUMPTION, not sourced), so this "
        f"event avoids 1/{uses} of that: {embodied / uses:.1f} kgCO2e.",
    ]
    t = factors["transport_kgco2e_per_tonne_km"]
    transport = None
    if t.get("value") is not None and distance_km is not None:
        transport = t["value"] * tonnes * distance_km * legs
        assumptions.append(f"Transport deducted from both: {t['value']} kgCO2e/t-km x {tonnes:.3f} t x "
                           f"{distance_km:.1f} km x {legs} legs (there and back) = {transport:.2f} kgCO2e "
                           f"(rigid diesel truck).")
    else:
        assumptions.append("Transport emissions NOT deducted (distance or transport factor missing).")
    tr = transport or 0.0
    upper = max(embodied - tr, 0.0)
    conservative = max(embodied / uses - tr, 0.0)

    is_estimate = item.get("weight_is_estimate", True)
    if is_estimate:
        assumptions.append("Item weight and material are rough estimates for demo data.")
    assumptions.append("Proxy: UK Defra 2025 factors, not Turkey-specific; use phase, end of life and "
                       "the new item's own delivery are not counted.")
    status = "illustrative" if is_estimate or mf.get("status") != "sourced" else "sourced"
    return {
        "avoided_kgco2e": round(upper, 2),
        "avoided_kgco2e_conservative": round(conservative, 2),
        "transport_kgco2e": None if transport is None else round(transport, 2),
        "status": status,
        "basis": {
            "upper": "New items bought for this event alone.",
            "conservative": f"New items would serve {uses} events; this event gets 1/{uses} (assumption).",
        },
        "assumptions": assumptions,
    }


MATERIAL_LABELS = {"wood": "Wood", "metals": "Metals", "plastics_rigid": "Rigid plastics",
                   "electrical_small": "Small electrical items", "electrical_large": "Large electrical items"}


def methodology(factors):
    """Everything a reader needs to check the carbon numbers. Every number comes from `factors`
    (impact_factors.json); only the explanatory sentences live here."""
    ds = factors["source_dataset"]
    t = factors["transport_kgco2e_per_tonne_km"]
    mats = factors["material_kgco2e_per_tonne_primary_production"]
    cf = factors.get("counterfactual", {})
    uses, legs = _cf(factors)
    return {
        "summary": ("Reusing an item avoids the emissions of making a new one. We estimate that from the item's "
                    "weight and main material, subtract the emissions of moving it there and back, and give a "
                    "range: an upper bound and a conservative bound."),
        "formula": {
            "upper": "weight (t) x quantity x material factor (kgCO2e/t) - transport",
            "conservative": f"weight (t) x quantity x material factor / {uses} uses - transport",
            "transport": f"transport factor (kgCO2e/t-km) x weight (t) x quantity x distance (km) x {legs} legs",
            "floor": "Both bounds are floored at 0.",
        },
        "dataset": {k: ds[k] for k in ("name", "published", "url", "licence", "caveat") if k in ds},
        "factors": [
            {"id": "transport", "label": "Road freight, rigid diesel truck", "value": t["value"],
             "unit": "kgCO2e per tonne-km", "status": t.get("status"), "source": t.get("source")},
            *[{"id": k, "label": MATERIAL_LABELS.get(k, k), "value": v["value"],
               "unit": "kgCO2e per tonne (primary production)", "status": v.get("status"),
               "source": v.get("source")}
              for k, v in mats.items() if not k.startswith("_")],
        ],
        "assumptions": [
            {"id": k, "value": v.get("value"), "status": v.get("status"), "note": v.get("note")}
            for k, v in cf.items() if not k.startswith("_")
        ] + [
            {"id": "item_weights_and_materials", "value": None, "status": "illustrative",
             "note": "Each item's weight and main material are rough estimates for fictional demo data."},
        ],
        "status_labels": {
            "sourced": "Every input is from a published source (no demo estimates).",
            "illustrative": "At least one input is an estimate or an assumption: show as an estimate, never as a verified claim.",
            "unavailable": "Weight, material or factor missing: no number is shown.",
        },
        "not_counted": ["Use phase (e.g. electricity for lights)", "End of life (disposal or recycling)",
                        "Delivery of the new item that was not bought",
                        "Empty truck runs: only the two loaded legs (delivery, then return of the items) are counted"],
        "limitations": [
            "UK factors are used as a proxy for Turkey.",
            "Material factors are per tonne of material, not per finished product; manufacturing and packaging are not modelled separately.",
            "The conservative bound depends on an assumed number of uses with no citable source.",
            "All inventory in this prototype is fictional.",
        ],
    }
