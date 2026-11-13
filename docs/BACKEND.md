# Backend hand-off (for Noé and Sueda)

Status: works end to end on the offline JSON inventory. Supabase loader is written but NOT yet tested against a live project.

## Run
```
cd backend
python -m venv venv
venv\Scripts\activate          # Windows  (macOS/Linux: source venv/bin/activate)
pip install -r requirements.txt
python -m pytest -q             # 13 tests, no network needed
uvicorn main:app --reload       # docs: http://localhost:8000/docs
```
Without `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` the API silently uses `backend/data/inventory.json`.
`GET /health` shows which source is active (`supabase` or `json_fallback`).

## Endpoints (shapes: docs/API_CONTRACT.md)
```
curl localhost:8000/health
curl localhost:8000/categories
curl -X POST localhost:8000/match -H "Content-Type: application/json" -d '{
  "request_id":"req-1","category":"chairs","quantity":50,
  "start_date":"2026-11-21","end_date":"2026-11-23",
  "location":{"lat":36.853,"lon":30.80},
  "requirements":{"min_condition":"good","max_distance_km":40}}'
curl -X POST localhost:8000/impact/summary -H "Content-Type: application/json" -d '{"selections":[
  {"item_id":"<item_id from /match>","quantity":50,"start_date":"2026-11-21","end_date":"2026-11-23",
   "location":{"lat":36.853,"lon":30.80}}]}'
```

## How matching works
1. Hard filters: category; reuse mode is loan or rental; ONE availability window covers the whole date range with stock > 0; optional min condition and max distance.
2. Score = 0.5 distance + 0.3 condition + 0.2 price (all 0..1). Distance score = exp(-km/50). Condition: fair 0.4, good 0.7, excellent 1.0. Price: free = 1.0, otherwise cheapest = 1.0 down to priciest = 0.0 among the candidates. Weights are placeholders to tune.
3. Options that cover the full quantity rank first, then by score; ties are broken by item id (deterministic).
4. Top 3 returned with `breakdown`. `explanation` is `null`: the AI layer fills it using ONLY the breakdown.
5. `suggestions` (what-if): re-runs with the event shifted by 1 day, a 1.5x radius, or one condition level lower, and reports only what adds options.

## Placeholders and limits (be honest in the pitch)
- All inventory is fictional.
- CO2: `backend/impact_factors.json` has NO numbers yet. Until a published factor is entered, `impact.status` is `unavailable` and `avoided_kgco2e` is `null`. Factors with no source are labelled `illustrative`. Transport emissions are not deducted until a sourced transport factor is added.
- Cost savings versus buying new is NOT implemented: the schema has only rental price per day, no new-purchase price.
- Availability is declared stock, not reservations. Two requests can see the same stock.
- A stay split across two windows of one item is not matched (rule: one window covers the whole range).
- Scoring weights are not validated against real user preferences.
- Batch/MILP (`/match/batch`) is not built (stretch).

## Supabase setup (manual, owner of the project)
1. Create a project. 2. SQL editor: run `supabase/migrations/0001..0003` in order, then `supabase/seed.sql`, then `supabase/verify.sql`.
3. Put `SUPABASE_URL` and the service-role key in `backend/.env` (never commit). The mobile/web app must NOT get the service-role key and does not read tables directly.
