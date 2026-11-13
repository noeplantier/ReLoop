# Demo scenario: three side events compete for chairs (greedy vs optimised)

Fictional inventory. Three events near COP31, all in Antalya, need chairs for overlapping dates.

| Request | Where | Chairs | Dates |
|---|---|---|---|
| R1 | Lara | 200 | 21-23 Nov |
| R2 | Konyaalti | 150 | 21-23 Nov |
| R3 | Belek | 100 | 22-24 Nov |

```
curl -X POST localhost:8000/match/batch -H "Content-Type: application/json" -d '{
 "max_suppliers_per_request": 2,
 "requests": [
  {"request_id":"R1","category":"chairs","quantity":200,"start_date":"2026-11-21","end_date":"2026-11-23","location":{"lat":36.853,"lon":30.80}},
  {"request_id":"R2","category":"chairs","quantity":150,"start_date":"2026-11-21","end_date":"2026-11-23","location":{"lat":36.88,"lon":30.64}},
  {"request_id":"R3","category":"chairs","quantity":100,"start_date":"2026-11-22","end_date":"2026-11-24","location":{"lat":36.86,"lon":31.05}}]}'
```

Result on the current seed (reproduced by `test_batch.py::test_milp_covers_what_greedy_cannot`):

| | Covered requests | Unmet chairs | Total distance |
|---|---|---|---|
| Greedy (first come, first served) | 2 of 3 | 20 | 14.5 km |
| MILP (all requests together) | 3 of 3 | 0 | 7.7 km |

Why: greedy serves R1 first and uses the Lara hall's 150 stackable plus 50 of its 120 folding chairs, leaving only 70 folding chairs. R2 then gets 60 (Konyaalti) + 70 (Lara) = 130 and is 20 short. MILP gives R2 90 plastic chairs from Kepez + 60 from Konyaalti, so everyone is covered.

Honest limits for the pitch: one constructed scenario on fictional data; greedy is a deliberately simple baseline (a smarter heuristic could do better); with abundant stock both give the same plan. The point is that shared stock needs a global decision, not that greedy is always bad.
