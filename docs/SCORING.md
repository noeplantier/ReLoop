# Scoring: how it works and how sensitive it is

Score = 0.5 x distance_score + 0.3 x condition_score + 0.2 x price_score (each 0..1).
- distance_score = exp(-km / 50): 0 km = 1.0, 10 km = 0.82, 35 km = 0.50, 100 km = 0.14
- condition_score: fair 0.4, good 0.7, excellent 1.0
- price_score: cheapest candidate 1.0, most expensive 0.0 (free loans count as price 0)

The weights are placeholders chosen by us, not learned from users. Hard filters (category, dates,
stock, reuse mode, optional distance/condition limits) are applied before scoring.

## Sensitivity check (`python tools/sensitivity.py`, fictional inventory)

30 requests (5 categories x 3 locations x 2 date ranges) that have at least 2 options; 66 weight
vectors on a 0.1 grid. Compared with the default weights:

| Weights tried | Top-1 unchanged | Top-3 set unchanged |
|---|---|---|
| Within +/-0.1 of default (7 vectors) | 93.8% | 75.2% |
| Whole grid (66 vectors) | 59.5% | 56.0% |

| Single alternative | Same top-1 as default | Same top-3 set |
|---|---|---|
| Distance only | 29/30 | 20/30 |
| Equal weights | 21/30 | 17/30 |
| Condition only | 14/30 | 17/30 |
| Price only | 6/30 | 13/30 |

## What this means (say it this way in the pitch)
- Small changes to the weights rarely change the first recommendation (about 94% stable), so the
  demo is not fragile.
- With the current weights the first pick is driven almost entirely by distance (29 of 30 equal to
  "distance only"). That fits the climate goal (shorter delivery = less transport emissions) but it
  means condition and price mostly reorder the 2nd and 3rd options.
- The weights are a design choice, not a validated model. Next step: let organisers set their own
  priorities (e.g. a "budget vs quality vs distance" slider) and test with real organisers.
- Results come from a small fictional inventory; with real data the numbers will differ.
