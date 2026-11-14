# Pitch numbers (generated 2026-11-14 by backend/tools/pitch_numbers.py)

Do not edit by hand: rerun the tool. All inventory is fictional.

## 1. Main demo request

> I need 50 chairs and 2 stage lights near Lara, Antalya, from 21 to 23 November 2026.

Location preset Lara (36.853, 30.80). Up to 3 options per need, ranked with default weights.


**chairs: 50 requested, 7 eligible option(s), 3 shown, 3 days**

| # | Item | Supplier | km | Covers | Cost (TRY) | CO2e avoided, kg (conservative to upper) |
|---|---|---|---|---|---|---|
| 1 | Stackable banquet chairs | Demo Lara Event Hall (fictional) | 0.0 | 50/50 | 1,800 | 95.6 to 956.0 (illustrative) |
| 2 | Folding chairs, white | Demo Lara Event Hall (fictional) | 0.0 | 50/50 | 1,200 | 76.5 to 764.8 (illustrative) |
| 3 | Conference chairs, upholstered | Demo Konyaalti Hotel Storage (fictional) | 14.5 | 50/50 | 3,000 | 169.5 to 1,718.3 (illustrative) |

**lighting: 2 requested, 2 eligible option(s), 2 shown, 3 days**

| # | Item | Supplier | km | Covers | Cost (TRY) | CO2e avoided, kg (conservative to upper) |
|---|---|---|---|---|---|---|
| 1 | Stage par lights LED | Demo Konyaalti Hotel Storage (fictional) | 14.5 | 2/2 | 420 | 3.4 to 33.9 (illustrative) |
| 2 | String festoon lights 20 m | Demo Belek Resort Warehouse (fictional) | 22.3 | 2/2 | 480 | 4.5 to 45.1 (illustrative) |

**Top option of each need together:** 52 units reused, 14.5 km, about 2,220 TRY rental, **99 to 990 kg CO2e avoided (illustrative)**, transport 0.03 kg CO2e.

Say: "estimated", "illustrative", "in our demo". The conservative bound assumes a new item would serve 10 events (our assumption, no source found).


## 2. Can one supplier cover the whole demo request?

- **Demo Konyaalti Hotel Storage (fictional)** (14.5 km): chairs: Conference chairs, upholstered; lighting: Stage par lights LED
- **Demo Belek Resort Warehouse (fictional)** (22.3 km): chairs: Chiavari chairs, gold; lighting: String festoon lights 20 m

## 3. Three events competing for the same chairs (optimiser)

Events: 200 chairs Lara 21-23 Nov, 150 Konyaalti 21-23 Nov, 100 Belek 22-24 Nov; max 2 suppliers each.

| | First come, first served | Optimised (MILP) |
|---|---|---|
| Events fully covered | 2/3 | 3/3 |
| Chairs left unmet | 20 | 0 |
| Total pickup distance (km) | 14.5 | 7.7 |

**First come, first served:**
- Event 1 (Lara): 150 x Stackable banquet chairs (Demo Lara Event Hall (fictional), 0.0 km); 50 x Folding chairs, white (Demo Lara Event Hall (fictional), 0.0 km)
- Event 2 (Konyaalti): 60 x Conference chairs, upholstered (Demo Konyaalti Hotel Storage (fictional), 0.0 km); 70 x Folding chairs, white (Demo Lara Event Hall (fictional), 14.5 km); **20 unmet**
- Event 3 (Belek): 100 x Chiavari chairs, gold (Demo Belek Resort Warehouse (fictional), 0.0 km)

**Optimised (MILP):**
- Event 1 (Lara): 150 x Stackable banquet chairs (Demo Lara Event Hall (fictional), 0.0 km); 50 x Folding chairs, white (Demo Lara Event Hall (fictional), 0.0 km)
- Event 2 (Konyaalti): 65 x Plastic stacking chairs (Demo Kepez Equipment Depot (fictional), 7.7 km); 60 x Conference chairs, upholstered (Demo Konyaalti Hotel Storage (fictional), 0.0 km); 25 x Bar stools (Demo Kepez Equipment Depot (fictional), 7.7 km)
- Event 3 (Belek): 100 x Chiavari chairs, gold (Demo Belek Resort Warehouse (fictional), 0.0 km)

Say: "in our demo scenario". This is mathematical optimisation, not AI.

## 4. Robustness of the ranking (scoring-weight sensitivity)

```
30 requests with at least 2 options; 66 weight vectors (7 within +/-0.1 of default)
within +/-0.1 of default  : top-1 unchanged  93.8%   top-3 set unchanged  75.2%
whole grid                : top-1 unchanged  59.5%   top-3 set unchanged  56.0%
distance only             : top-1 same as default in 29/30 requests, top-3 set in 20/30
condition only            : top-1 same as default in 14/30 requests, top-3 set in 17/30
price only                : top-1 same as default in 6/30 requests, top-3 set in 13/30
equal weights             : top-1 same as default in 21/30 requests, top-3 set in 17/30
```

## 5. Tests

- Backend automated tests: 45
- Database checks (PGlite): 31 passed, 0 failed

