# AI layer evaluation (English): rules fallback, no LLM

Measured on 14 Nov 2026, 23:30 TR, with `backend/tools/ai_eval.py` against a local API running `main` at commit
8fd7fcf (AI layer included, no LLM key, so every answer comes from the deterministic rule parser and templates).
Expected values are hand-written. The LLM path has NOT been evaluated yet (runtime AI budget is zero).

## Summary: which number to quote

| Set | What it is | Fully correct | Fields that matter most |
|---|---|---|---|
| **Held-out (20)** | Written AFTER the parser was tuned, never shown to the parser's author before measuring. **The independent result: quote this one.** | **14/20** | location 20/20, items+quantities 19/20, dates 16/20 |
| Original (30) | The cases the parser was tuned on (it scored 20/30 before the fixes) | 30/30 | not independent: do not quote as accuracy |
| Grounding | Every number in each explanation must appear in the engine data | 0/8 with a stray number (both runs) | |

How it fails matters as much as how often: in the held-out set the parser never invented a value. Four misses
left a field empty for the user to fill in; two date ranges written as "from Saturday 21 November until Monday
23 November" and "between 21 and 23 November" were read as one day, each with a visible warning ("Only one date
found; assumed a one-day event") on the review screen. One unsupported item without a number ("a projector")
was not flagged.

Pitch wording: "On 20 new test requests it had never seen, the rule-based parser got 14 fully right; when it
was unsure it asked or warned, and it never invented a quantity, date or place. The LLM path is built but not
yet evaluated." Do not call the AI validated.

Do not tune the parser on the held-out cases; if they are used for fixes, write a new held-out set first.

## Held-out set (20 cases)

### Part 1: parsing free text into a request

Parser that answered: rules x20. Median latency 0.01 s.

**Fully correct: 14/20**

| Field | Correct |
|---|---|
| needs | 19/20 |
| dates | 16/20 |
| location | 20/20 |
| filters | 20/20 |
| asks_for_missing | 17/20 |
| flags_unsupported | 0/1 |

HARD cases (written-out numbers, unusual date formats, vague quantities): 1/4 fully correct.

### Not fully correct

- #H4 (HARD) "Konyaalti 21–23/11: 2 stages and 10 banners": wrong ['asks_for_missing', 'dates']; got `{"needs": {"staging": 2, "signage": 10}, "start_date": null, "end_date": null, "missing_fields": ["dates"], "warnings": [], "place": "konyaalti"}`
- #H5 "Please find 35 chairs, Lara, from Saturday 21 November until Monday 23 November": wrong ['dates']; got `{"needs": {"chairs": 35}, "start_date": "2026-11-21", "end_date": "2026-11-21", "missing_fields": [], "warnings": ["Only one date found; assumed a one-day event."], "place": "lara"}`
- #H8 "Need 40 chairs and a projector in Belek, 22-23 Nov": wrong ['flags_unsupported']; got `{"needs": {"chairs": 40}, "start_date": "2026-11-22", "end_date": "2026-11-23", "missing_fields": [], "warnings": [], "place": "belek"}`
- #H11 "need 50 chairs between 21 and 23 November near Lara": wrong ['dates']; got `{"needs": {"chairs": 50}, "start_date": "2026-11-23", "end_date": "2026-11-23", "missing_fields": [], "warnings": ["Only one date found; assumed a one-day event."], "place": "lara"}`
- #H17 (HARD) "3 stage platforms, Kepez, 23.11 - 24.11": wrong ['asks_for_missing', 'dates']; got `{"needs": {"staging": 3}, "start_date": null, "end_date": null, "missing_fields": ["dates"], "warnings": [], "place": "kepez"}`
- #H20 (HARD) "need chairs and tables in Lara on 21-23 Nov, around 30 of each": wrong ['asks_for_missing', 'needs']; got `{"needs": {}, "start_date": "2026-11-21", "end_date": "2026-11-23", "missing_fields": ["needs"], "warnings": ["'30 of each' is not in our inventory categories (tables, chairs, lighting, signage, staging)."], "place": "lara"}`

### Part 2: are explanations grounded in engine data?

Explainer that answered: template x3.

**Explanations with a number not found in the engine data: 0/8**


## Original set (30 cases, tuned on)

### Part 1: parsing free text into a request

Parser that answered: rules x30. Median latency 0.02 s.

**Fully correct: 30/30**

| Field | Correct |
|---|---|
| needs | 30/30 |
| dates | 30/30 |
| location | 30/30 |
| filters | 30/30 |
| asks_for_missing | 30/30 |
| flags_unsupported | 2/2 |

HARD cases (written-out numbers, unusual date formats, vague quantities): 5/5 fully correct.

### Part 2: are explanations grounded in engine data?

Explainer that answered: template x3.

**Explanations with a number not found in the engine data: 0/8**

