"""Deterministic request parser: the no-LLM fallback, and the safety net for LLM output.

Handles the demo phrasing ("50 chairs and 2 stage lights near Lara, Antalya, from 21 to 23 November 2026")
and common variants. Anything it cannot read goes to missing_fields / warnings for the review screen.
"""
import re
from datetime import date

from .presets import find_preset
from .schemas import Need, ParsedLocation, ParsedRequirements, ParseOut

# Head noun -> category. The LAST matching word of a phrase wins, so "stage lights" -> lighting.
NOUN_TO_CATEGORY = {
    "chair": "chairs", "chairs": "chairs", "seat": "chairs", "seats": "chairs",
    "stool": "chairs", "stools": "chairs", "sandalye": "chairs",
    "table": "tables", "tables": "tables", "masa": "tables",
    "light": "lighting", "lights": "lighting", "lighting": "lighting", "lamp": "lighting",
    "lamps": "lighting", "spotlight": "lighting", "spotlights": "lighting", "uplighter": "lighting",
    "uplighters": "lighting", "lantern": "lighting", "lanterns": "lighting",
    "sign": "signage", "signs": "signage", "signage": "signage", "banner": "signage",
    "banners": "signage", "board": "signage", "boards": "signage",
    "stage": "staging", "stages": "staging", "staging": "staging", "platform": "staging",
    "platforms": "staging", "podium": "staging", "podiums": "staging", "riser": "staging",
    "risers": "staging",
}

# Words after a number that end the item phrase.
_STOP = {"and", "or", "near", "in", "at", "for", "from", "on", "between", "with", "by", "within", "to"}

MONTHS = {m: i for i, m in enumerate(
    ["january", "february", "march", "april", "may", "june", "july", "august",
     "september", "october", "november", "december"], 1)}
MONTHS.update({k[:3]: v for k, v in list(MONTHS.items())})
MONTHS["sept"] = 9

_MON = r"(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\b\.?"
_D = r"(?:the\s+)?\b(\d{1,2})(?:st|nd|rd|th)?\b"
_SEP = r"\s*(?:-|–|—|to|until|till|through)\s*"
_OF = r"\s+(?:of\s+)?"
_Y = r"(?:,?\s*(\d{4}))?"
_NUM_DATE = r"\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b"                              # 21.11.2026, 21/11/2026

RE_ISO_RANGE = re.compile(r"(\d{4}-\d{2}-\d{2})" + _SEP + r"(\d{4}-\d{2}-\d{2})")
RE_ISO_ONE = re.compile(r"\b(\d{4}-\d{2}-\d{2})\b")
RE_NUM_RANGE = re.compile(_NUM_DATE + _SEP + _NUM_DATE)
RE_NUM_ONE = re.compile(_NUM_DATE)
RE_D_D_MON = re.compile(_D + _SEP + _D + _OF + _MON + _Y)                        # 21 to 23 November 2026
RE_D_MON_D_MON = re.compile(_D + _OF + _MON + _SEP + _D + _OF + _MON + _Y)       # 30 Nov - 2 Dec
RE_MON_D_MON_D = re.compile(_MON + r"\s+" + _D + _SEP + _MON + r"\s+" + _D + _Y)  # Nov 24 to Nov 25
RE_MON_D_D = re.compile(_MON + r"\s+" + _D + _SEP + _D + _Y)                     # November 21-23
RE_D_MON = re.compile(_D + _OF + _MON + _Y)                                      # on 21 November
RE_MON_D = re.compile(_MON + r"\s+" + _D + r"(?!\s*(?:-|–|to)\s*\d)" + _Y)        # on November 23

# Written-out quantities ("Fifty chairs"). Small closed list; anything else stays as written.
_WORD_NUMS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9,
    "ten": 10, "eleven": 11, "twelve": 12, "fifteen": 15, "twenty": 20, "thirty": 30, "forty": 40,
    "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90, "hundred": 100,
    "a hundred": 100, "one hundred": 100, "two hundred": 200, "three hundred": 300, "a dozen": 12, "dozen": 12,
}
RE_WORD_NUM = re.compile(r"\b(" + "|".join(sorted(map(re.escape, _WORD_NUMS), key=len, reverse=True)) + r")\b")


def normalize_quantities(text: str) -> str:
    """Lowercase and rewrite quantity phrasings into '<number> <noun>':
    'Fifty chairs' -> '50 chairs'; 'signs x 25' -> '25 signs'; 'chairs, 40 of them' -> '40 chairs'."""
    t = text.lower()
    t = RE_WORD_NUM.sub(lambda m: str(_WORD_NUMS[m.group(1)]), t)
    t = re.sub(r"\b([a-z][a-z\- ]{1,40}?)\s+[x×]\s*(\d{1,6})\b", lambda m: f"{m.group(2)} {m.group(1)}", t)
    t = re.sub(r"\b([a-z][a-z\-]*(?:\s+[a-z][a-z\-]*){0,2}),?\s+(\d{1,6})\s+of\s+them\b",
               lambda m: f"{m.group(2)} {m.group(1)}", t)
    return t


def numbers_in_text(text: str) -> set[str]:
    """Every quantity the user wrote, digits or words (used to check LLM output)."""
    return set(re.findall(r"\d+", normalize_quantities(text)))
RE_KM = re.compile(r"(?:within|max(?:imum)?|under|less than)\s+(\d+(?:\.\d+)?)\s*km")
RE_QTY = re.compile(r"\b(\d{1,6})\s*(?:x\s*)?([a-zçğıöşü][a-zçğıöşü\-]*(?:\s+[a-zçğıöşü][a-zçğıöşü\-]*){0,3})")


def _year(y, today: date, month: int, day: int) -> int:
    if y:
        return int(y)
    # No year given: the next occurrence on or after today.
    try:
        candidate = date(today.year, month, day)
    except ValueError:
        return today.year
    return today.year if candidate >= today else today.year + 1


def _mk(y, m, d):
    try:
        return date(y, m, d)
    except ValueError:
        return None


def parse_dates(text: str, today: date):
    """Return (start, end, warnings)."""
    t = text.lower()
    m = RE_ISO_RANGE.search(t)
    if m:
        return date.fromisoformat(m.group(1)), date.fromisoformat(m.group(2)), []
    m = RE_NUM_RANGE.search(t)
    if m:
        d1, m1, y1, d2, m2, y2 = map(int, m.groups())
        return _mk(y1, m1, d1), _mk(y2, m2, d2), []   # day first (Turkish/European order)
    m = RE_MON_D_MON_D.search(t)
    if m:
        m1, d1, m2, d2, y = m.groups()
        mo1, mo2 = MONTHS[m1], MONTHS[m2]
        y1 = _year(y, today, mo1, int(d1))
        y2 = y1 + 1 if mo2 < mo1 else y1
        return _mk(y1, mo1, int(d1)), _mk(y2, mo2, int(d2)), []
    m = RE_D_MON_D_MON.search(t)
    if m:
        d1, m1, d2, m2, y = m.groups()
        mo1, mo2 = MONTHS[m1], MONTHS[m2]
        y1 = _year(y, today, mo1, int(d1))
        y2 = y1 + 1 if mo2 < mo1 else y1
        return _mk(y1, mo1, int(d1)), _mk(y2, mo2, int(d2)), []
    m = RE_D_D_MON.search(t)
    if m:
        d1, d2, mon, y = m.groups()
        mo = MONTHS[mon]
        yy = _year(y, today, mo, int(d1))
        return _mk(yy, mo, int(d1)), _mk(yy, mo, int(d2)), []
    m = RE_MON_D_D.search(t)
    if m:
        mon, d1, d2, y = m.groups()
        mo = MONTHS[mon]
        yy = _year(y, today, mo, int(d1))
        return _mk(yy, mo, int(d1)), _mk(yy, mo, int(d2)), []
    m = RE_D_MON.search(t)
    if m:
        d1, mon, y = m.groups()
        mo = MONTHS[mon]
        dd = _mk(_year(y, today, mo, int(d1)), mo, int(d1))
        return dd, dd, ["Only one date found; assumed a one-day event."]
    m = RE_MON_D.search(t)
    if m:
        mon, d1, y = m.groups()
        mo = MONTHS[mon]
        dd = _mk(_year(y, today, mo, int(d1)), mo, int(d1))
        return dd, dd, ["Only one date found; assumed a one-day event."]
    m = RE_NUM_ONE.search(t)
    if m:
        d1, m1, y1 = map(int, m.groups())
        dd = _mk(y1, m1, d1)
        return dd, dd, ["Only one date found; assumed a one-day event."]
    m = RE_ISO_ONE.search(t)
    if m:
        dd = date.fromisoformat(m.group(1))
        return dd, dd, ["Only one date found; assumed a one-day event."]
    return None, None, []


def _strip_dates(text: str) -> str:
    """Remove date expressions so '21 to 23 November' is not read as '21 to...' / '23 November'."""
    t = text.lower()
    for rx in (RE_ISO_RANGE, RE_NUM_RANGE, RE_MON_D_MON_D, RE_D_MON_D_MON, RE_D_D_MON, RE_MON_D_D, RE_D_MON,
               RE_MON_D, RE_NUM_ONE, RE_ISO_ONE, RE_KM):
        t = rx.sub(" ", t)
    t = re.sub(r"\b20\d{2}\b", " ", t)  # bare years only (2026), so "1000 tables" stays
    return t


def parse_needs(text: str):
    """Return (needs, warnings). One Need per category; repeated categories are summed."""
    needs: dict[str, Need] = {}
    warnings = []
    for m in RE_QTY.finditer(normalize_quantities(_strip_dates(text))):
        qty = int(m.group(1))
        words = []
        for w in m.group(2).split():
            if w in _STOP:
                break
            words.append(w)
        if not words or qty == 0:
            continue
        cat = None
        for w in reversed(words):
            if w in NOUN_TO_CATEGORY:
                cat = NOUN_TO_CATEGORY[w]
                break
        if cat is None:
            if words[0] in {"km", "days", "day", "people", "guests", "persons", "pm", "am", "h", "hours"}:
                continue   # "for 300 people" is not an equipment need
            warnings.append(f"'{qty} {' '.join(words)}' is not in our inventory categories "
                            "(tables, chairs, lighting, signage, staging).")
            continue
        # Keep the phrase up to the head noun as the user's label.
        label_words = words[: max(i for i, w in enumerate(words) if NOUN_TO_CATEGORY.get(w) == cat) + 1]
        label = " ".join(label_words)
        if cat in needs:
            needs[cat] = Need(category=cat, quantity=needs[cat].quantity + qty,
                              label=f"{needs[cat].label} + {label}")
            warnings.append(f"Two {cat} requests were combined into one quantity; please check.")
        else:
            needs[cat] = Need(category=cat, quantity=qty, label=label)
    return list(needs.values()), warnings


def parse_location(text: str) -> ParsedLocation:
    pid, p = find_preset(text)
    m = re.search(r"\b(?:near|in|at|around)\s+([A-Za-zÇĞİÖŞÜçğıöşü][\wÇĞİÖŞÜçğıöşü ,.'-]{1,60}?)"
                  r"(?=,?\s+(?:from|on|between|for|within|tomorrow|today|next|this|\d)|[.;!?]|$)", text)
    place_text = m.group(1).strip(" ,.") if m else None
    if pid:
        return ParsedLocation(place_text=place_text or p["label"], preset_id=pid,
                              preset_label=p["label"], lat=p["lat"], lon=p["lon"])
    return ParsedLocation(place_text=place_text)


def parse_requirements(text: str) -> ParsedRequirements:
    t = text.lower()
    cond = None
    if re.search(r"\b(excellent|like[\s-]new|mint)\b", t):
        cond = "excellent"
    elif re.search(r"\bgood condition\b|\bat least good\b", t):
        cond = "good"
    km = RE_KM.search(t)
    return ParsedRequirements(min_condition=cond, max_distance_km=float(km.group(1)) if km else None)


def finish(needs, start, end, location, requirements, warnings, parser) -> ParseOut:
    """Shared validation for rules and LLM output: compute missing_fields, sanity-check dates."""
    missing = []
    if not needs:
        missing.append("needs")
    if start and end and end < start:
        warnings.append("End date is before start date; please check the dates.")
        start = end = None
    if not (start and end):
        missing.append("dates")
    if location.lat is None or location.lon is None:
        missing.append("location")
        if location.place_text:
            warnings.append(f"'{location.place_text}' is not one of our demo locations; "
                            "please pick a location on the review screen.")
    return ParseOut(needs=needs, start_date=start, end_date=end, location=location,
                    requirements=requirements, missing_fields=missing, warnings=warnings,
                    parser=parser)


def parse_rules(text: str, today: date) -> ParseOut:
    start, end, w_dates = parse_dates(text, today)
    needs, w_needs = parse_needs(text)
    return finish(needs, start, end, parse_location(text), parse_requirements(text),
                  w_needs + w_dates, "rules")
