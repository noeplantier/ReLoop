# ReLoop: find equipment, reuse locally

> DRAFT for the repository's front page (`README.md`, Noé's call). Replace every `<...>` before submission.

Every event rents or buys chairs, tables, lights, stages and signs that already exist somewhere nearby,
used once and stored. Making new equipment is where most of the emissions are. ReLoop lets an event
organiser describe what they need in plain words and returns real, available reuse options close by,
with the cost, the distance and an honest estimate of the CO2e avoided.

Built for the ATOX "AI for Climate" hackathon, Antalya, November 2026. **All inventory is fictional.**

- Live app: `<Vercel URL>`
- API: `<Render URL>/health`, docs at `<Render URL>/docs`
- Demo video: `<link>`

## What it does

1. **Describe:** "I need 50 chairs and 2 stage lights near Lara, Antalya, from 21 to 23 November 2026."
2. **Review:** the AI layer turns the text into a structured request (items, quantities, dates, place). The
   organiser checks and edits it; anything that could not be read is asked, never guessed.
3. **Results:** for each item, up to 3 options that are really available for the whole date range, ranked
   by a visible formula (distance, condition, price). Partial matches say how many units are missing.
4. **Why this option:** a short explanation built only from the engine's numbers, the estimated rental
   cost ("delivery and deposit not included"), and a carbon RANGE with every assumption on demand.
5. **Many events, one stock:** an optimiser (mixed-integer programming) plans several events together so
   shared stock is not used up by whoever asks first.

## How it works

```
Web app (React, mobile-first)  ──►  One API (FastAPI)
                                     ├─ Matching engine   deterministic filters + explainable score
                                     ├─ Carbon module     UK Gov GHG factors 2025, conservative–upper range
                                     ├─ Optimiser         greedy baseline vs MILP (SciPy / HiGHS)
                                     ├─ AI layer          text → request, grounded explanations (optional LLM)
                                     └─ Inventory         Supabase Postgres (read-only role) → JSON fallback
```

AI where it helps, deterministic where it must be right: availability, ranking, prices and carbon are
computed by code, so results are reproducible and explanations cannot invent reasons. Every response says
whether it came from the live database or the offline demo dataset, and whether an LLM or the rule-based
fallback produced the text.

## Run it locally

```bash
cd backend
python -m venv venv && venv\Scripts\activate        # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
python -m pytest -q                                   # backend tests, no network needed
uvicorn main:app --reload                             # http://127.0.0.1:8000/docs
```

Without a `backend/.env` the API serves the built-in fictional inventory. With `DATABASE_URL` (see
`.env.example`) it reads Supabase. The AI layer (`ai/`) is loaded automatically when present; it calls an
LLM only if `LLM_PROVIDER=anthropic` and a key are set on the server. Web app: see `frontend/README.md`
`<Sueda to confirm>`. Database: migrations in `supabase/migrations/`, demo data in `supabase/seed.sql`,
checks with `cd supabase/tests && npm install && npm test`.

## Evidence

All figures are generated from the code: `docs/PITCH_NUMBERS.md` (demo results, carbon range, optimiser
scenario, ranking robustness, test counts) and `docs/AI_EVAL_*.md` (AI parsing accuracy, grounding).
Method and factors: `GET /impact/methodology`, `docs/SCORING.md`.

## Data and licences

- Inventory, suppliers and prices: fictional, created for this prototype.
- Emission factors: UK Government GHG Conversion Factors for Company Reporting 2025 (DESNZ/Defra),
  Open Government Licence v3.0. Used as a proxy for Türkiye.
- Libraries: FastAPI, Pydantic, SciPy (HiGHS), psycopg, supabase-py, React, Vite `<complete>`.

## Limitations (stated openly)

- Fictional inventory; availability is declared by suppliers, not booked; no payments or reservations.
- Carbon: item weights and materials are estimates; UK factors as a proxy; use phase and end of life not
  counted; the conservative bound uses an assumed 10 uses per new item (no published source found).
- Scoring weights are design choices, not learned from users; the first pick is mostly driven by distance.
- The optimiser's advantage is shown on one constructed scenario.

## Next step

A pilot with 2–3 Antalya venues: their real inventory and weights, real organiser requests, and a
comparison of reuse rate and delivery distance with what they would have done.

## Team

Noé Plantier (product, integration), Atay `<surname>` (backend, matching engine, data), Sueda `<surname>`
(web app, AI layer, pitch) `<4th member>`.

## AI tools disclosure

`<TEAM TO FILL IN, required by the hackathon rules: AI tools, models and APIs used in the product (runtime)
and during development, and which content is AI-generated.>`
