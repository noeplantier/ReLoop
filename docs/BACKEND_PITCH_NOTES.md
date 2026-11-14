# Backend facts for the pitch and the submission form

For Sueda (slides) and Noé (submission). Every number here is reproducible from the repo.

## One-line description
A transparent matching engine: hard availability filters, an explainable score, and an
optimiser that shares scarce equipment fairly between several events.

## What the backend does (plain words)
1. Finds equipment that is really available for the WHOLE event (date range), in the right
   category, with enough stock, as a loan or rental.
2. Ranks options with a visible formula (distance, condition, price) and returns the top 3 with the
   numbers behind each score, so the AI explanation can only use real facts.
3. Suggests what-if changes (shift by a day, wider radius, accept lower condition) when that adds options.
4. Estimates avoided CO2e per match from official UK government (DESNZ/Defra 2025) conversion factors.
5. When several events want the same stock, an optimisation model (MILP) plans all of them at once.

## Numbers you may use (with the wording)
- Demo scenario (3 events, 450 chairs, fictional data): first-come-first-served leaves 20 chairs
  unmet; the optimiser covers all 3 events and cuts total pickup distance from 14.5 km to 7.7 km.
  Say: "in our demo scenario". Do not say "always" or "X% better in general".
- CO2: e.g. reusing 50 metal banquet chairs 10 km away is ESTIMATED to avoid about 955 kgCO2e
  (making 250 kg of new metal at 3,824 kgCO2e/t, minus about 0.5 kgCO2e of delivery). Say
  "estimated", "illustrative", "based on assumed weights". Never "measured" or "saved".
- Robustness: small changes to the scoring weights keep the first recommendation in about 94% of
  test cases (docs/SCORING.md).
- Tests: 31 automated backend tests + 22 database checks.

## AI vs not-AI (judges score "AI integration" and "awareness of limitations")
- AI (Sueda's layer): understanding free-text requests, writing grounded explanations.
- Not AI, on purpose: filters, scoring, CO2 arithmetic and the optimiser are deterministic, so
  results are reproducible and explanations cannot invent reasons. The MILP is mathematical
  optimisation, not machine learning.

## Limitations to state openly
- All inventory is fictional. No real suppliers, no reservations: availability is declared, not booked.
- CO2 uses UK factors as a proxy for Turkey; item weights and materials are rough estimates;
  use phase and end-of-life are ignored; the new item's own delivery is not counted.
- Cost savings versus buying new are not computed (no new-purchase prices).
- Scoring weights are our choice, not validated with organisers; the first pick is mostly distance.
- The optimiser advantage is shown on one constructed scenario.

## Next validation step (for "next steps" slide)
Pilot with 2-3 real Antalya venues: load their real inventory and weights, run real requests from
organisers, and compare reuse rate and delivery distance with what they would have done.

## Submission form: backend parts
- Built during the event: matching engine, API, database schema/seed, CO2 module, optimiser, tests, docs.
- Existed before: a small greedy-vs-MILP prototype (about 90 lines) by Atay; rewritten for the new data model.
- Data sources: fictional inventory (ours); UK Government GHG Conversion Factors 2025 (Open Government Licence v3.0).
- Libraries: FastAPI, Pydantic, SciPy (HiGHS MILP solver), supabase-py, PGlite (tests).
- AI tools used during development: TEAM TO FILL IN (the handbook asks to disclose AI tools and AI-generated content).
