# ReLoop: find equipment, reuse locally

Every event rents or buys chairs, tables, lights, stages and signs that already exist somewhere nearby,
used once and stored. Making new equipment is where much of the emissions come from. ReLoop lets an event
organiser describe what they need in plain words and returns real, available reuse options close by,
with the cost, the distance and an honest estimate of the CO2e avoided.

Built for the ATOX "AI for Climate" hackathon, Antalya, November 2026. **All inventory is fictional.**

- Live app: TODO(Noé): public URL (must open without an account)
- API health: https://reloop-api-kdq2.onrender.com/health (free host: the first call after idle can take about a minute)
- API docs: https://reloop-api-kdq2.onrender.com/docs
- Demo video: TODO(Noé): link

## What it does

1. **Describe:** "I need 50 chairs and 2 stage lights near Lara, Antalya, from 21 to 23 November 2026."
2. **Review:** the text is turned into a structured request (items, quantities, dates, place). The organiser
   checks and edits it; anything that could not be read is asked, never guessed. At submission this step uses a
   deterministic rule-based parser and the interface says so ("Read from your text with standard rules").
3. **Results:** for each item, up to 3 options that are really available for the whole date range, ranked by a
   visible formula (distance, condition, price). Partial matches say how many units are missing. A priority
   switch (balanced, closest, cheapest, best condition) changes the ranking.
4. **Why this option:** a short explanation built only from the engine's numbers, the estimated rental cost
   ("delivery and deposit not included"), and a carbon RANGE with every assumption one tap away.
5. **Offline fallback:** if the server cannot be reached, the app offers an explicitly labelled demo mode that
   replays responses recorded from the real backend.

Also in the backend, not yet in the web app: an optimiser (mixed-integer programming, `POST /match/batch`) that
plans several events together so shared stock is not used up by whoever asks first.

## How it works

```
Web app (React, Vite)  ──►  One API (FastAPI)
                             ├─ Matching engine   deterministic filters + explainable score
                             ├─ Carbon module     UK Gov GHG factors 2025, conservative-to-upper range
                             ├─ Optimiser         greedy baseline vs MILP (SciPy / HiGHS)
                             ├─ AI layer          text → request, grounded explanations (LLM optional, off by default)
                             └─ Inventory         Supabase Postgres (read-only role) → JSON fallback
```

Deterministic where it must be right: availability, ranking, prices and carbon are computed by code, so results
are reproducible and explanations cannot invent reasons. Every response says whether it came from the live
database or the offline demo dataset (`inventory_source`).

## Run it locally

Backend:

```bash
cd backend
python -m venv venv && venv\Scripts\activate        # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
python -m pytest -q                                   # backend tests, no network needed
uvicorn main:app --reload                             # http://127.0.0.1:8000/docs
```

Without a `backend/.env` the API serves the built-in fictional inventory. With `DATABASE_URL` (see `.env.example`)
it reads Supabase through a read-only role. The AI layer (`ai/`) loads automatically and calls an LLM only if
`LLM_PROVIDER=anthropic` and a key are both set on the server; otherwise it uses rules and templates.

Web app:

```bash
cd frontend
npm install
VITE_API_URL=http://127.0.0.1:8000 npm run dev      # Windows PowerShell: $env:VITE_API_URL="http://127.0.0.1:8000"; npm run dev
```

Without `VITE_API_URL` the app starts in its recorded demo mode. Database: migrations in `supabase/migrations/`,
demo data in `supabase/seed.sql`, checks with `cd supabase/tests && npm install && npm test`.
Deployment steps and the smoke test: `docs/DEPLOY.md`, `docs/DEPLOY_CHECKLIST.md`, `backend/tools/smoke.py`.

## Evidence

Figures are generated from the code: `docs/PITCH_NUMBERS.md` (demo results, carbon range, optimiser scenario,
ranking robustness) and `docs/AI_EVAL_RULES.md` (parser accuracy, grounding). Carbon method and every factor:
`GET /impact/methodology` and `docs/SCORING.md`. The need itself, with sources: `docs/EVIDENCE.md`.

## Data and licences

- Inventory, suppliers and prices: fictional, created for this prototype. No real company or personal data.
- Emission factors: UK Government GHG Conversion Factors for Company Reporting 2025 (DESNZ/Defra), Open
  Government Licence v3.0. Used as a proxy for Türkiye.
- Open-source libraries: FastAPI, Pydantic, Uvicorn, NumPy, SciPy (HiGHS), psycopg, supabase-py, python-dotenv,
  Anthropic SDK (only used if the LLM is enabled), React, Vite, TypeScript, PGlite (database tests).
- Repository licence: TODO(Noé): choose one (none declared yet).

## Limitations (stated openly)

- Fictional inventory; availability is declared by suppliers, not booked. No accounts, supplier side,
  reservations or payments in this prototype.
- Carbon: item weights and materials are estimates; UK factors as a proxy; use phase and end of life are not
  counted; the conservative bound assumes 10 uses per new item (our assumption, no published source found).
  Every figure is labelled illustrative and is not measured or verified impact.
- Scoring weights are design choices, not learned from users; the first pick is mostly driven by distance.
- The rule-based parser read 14 of 20 held-out test requests fully correctly and never invented a value; the
  optional LLM path has not been evaluated live. The AI layer is not described as validated.
- The optimiser's advantage is shown on one constructed scenario.

## Next step

A pilot with 2-3 Antalya venues: their real inventory and weights, real organiser requests, and a comparison of
reuse rate and delivery distance with what they would have done. Supplier onboarding comes after that.

## Team

Noé Plantier (product, integration, deployment), Atay (backend, matching engine, data),
Sueda (web app, AI layer, pitch). TODO(Noé): add surnames and any other members.

## AI tools disclosure

See `docs/DISCLOSURE_DRAFT.md` (to be renamed `DISCLOSURE.md` once approved).
