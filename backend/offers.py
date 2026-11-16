"""Equipment offers saved in the user's own browser (docs/OFFERS_REWARDS_CONTRACT.md). Pure Python.

An offer is NOT published: nothing here stores it or shows it to anyone else. The server only validates and
normalises it, so the app can show the same rules everywhere. The place is one of the six demo presets
(no street address, no contact details). PRESETS mirrors ai/presets.py; a test keeps the two in sync.
"""

PRESETS = {
    "lara":      {"label": "Lara, Antalya (demo location)",      "lat": 36.853, "lon": 30.80},
    "konyaalti": {"label": "Konyaalti, Antalya (demo location)", "lat": 36.88,  "lon": 30.64},
    "kepez":     {"label": "Kepez, Antalya (demo location)",     "lat": 36.93,  "lon": 30.70},
    "belek":     {"label": "Belek, Serik (demo location)",       "lat": 36.86,  "lon": 31.05},
    "kemer":     {"label": "Kemer, Antalya (demo location)",     "lat": 36.60,  "lon": 30.56},
    "antalya":   {"label": "Antalya city centre (approximate demo location)", "lat": 36.8969, "lon": 30.7133},
}
MAX_OFFERS = 20
MAX_SPAN_DAYS = 180
VISIBILITY = "this_browser"
OFFER_NOTE = "Saved in this browser only. Not visible to others yet. Fictional demo prototype."
PRECISION_KM = 1.1   # two decimals of latitude is about 1.1 km


def label_problem(label: str):
    """Cheap guard against contact details in a free-text label. Documented, not a security control."""
    low = label.lower()
    if "@" in label or "http" in low or "www." in low:
        return "label must not contain contact details or links"
    run = best = 0
    for ch in label:
        run = run + 1 if ch.isdigit() else 0
        best = max(best, run)
    if best >= 7:
        return "label must not contain a long number (phone numbers are not accepted)"
    return None


def approx_location(preset_id: str) -> dict:
    p = PRESETS[preset_id]
    return {"lat": round(p["lat"], 2), "lon": round(p["lon"], 2), "precision_km": PRECISION_KM,
            "label": p["label"]}


def normalise(offer: dict) -> dict:
    """Return the offer with the preset's own coordinates (the client's lat/lon are never trusted)."""
    p = PRESETS[offer["location"]["preset_id"]]
    out = dict(offer)
    out["label"] = offer["label"].strip()
    out["location"] = {"preset_id": offer["location"]["preset_id"], "lat": p["lat"], "lon": p["lon"]}
    return out


def unique_offers(offers: list) -> list:
    """De-duplicate by id (first wins), so a repeated offer can never count twice."""
    seen, out = set(), []
    for o in offers:
        if o["id"] not in seen:
            seen.add(o["id"])
            out.append(o)
    return out
