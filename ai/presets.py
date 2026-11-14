"""Labelled preset locations for the demo. No geocoding: a place is either in this list or unknown.

Coordinates are approximate district points in Antalya, chosen for the fictional demo inventory.
The UI must show the preset label ("Lara, Antalya (demo preset)") so nobody reads it as an exact address.
"""
import unicodedata

PRESETS = {
    "lara":      {"label": "Lara, Antalya (demo preset)",      "lat": 36.853, "lon": 30.80},
    "konyaalti": {"label": "Konyaalti, Antalya (demo preset)", "lat": 36.88,  "lon": 30.64},
    "kepez":     {"label": "Kepez, Antalya (demo preset)",     "lat": 36.93,  "lon": 30.70},
    "belek":     {"label": "Belek, Serik (demo preset)",       "lat": 36.86,  "lon": 31.05},
    "kemer":     {"label": "Kemer, Antalya (demo preset)",     "lat": 36.60,  "lon": 30.56},
    "antalya":   {"label": "Antalya city centre (approximate demo preset)", "lat": 36.8969, "lon": 30.7133},
}

# Most specific first: "Lara, Antalya" must resolve to Lara, not the city centre.
_ORDER = ["lara", "konyaalti", "kepez", "belek", "kemer", "antalya"]


def _fold(s: str) -> str:
    """Lowercase and strip accents: 'Konyaaltı' -> 'konyaalti'."""
    s = s.replace("ı", "i").replace("İ", "i")
    return "".join(c for c in unicodedata.normalize("NFKD", s.lower()) if not unicodedata.combining(c))


def find_preset(text: str):
    """Return (preset_id, preset) for the most specific preset named in text, else (None, None)."""
    folded = _fold(text or "")
    for pid in _ORDER:
        if pid in folded:
            return pid, PRESETS[pid]
    return None, None
