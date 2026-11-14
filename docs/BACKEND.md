# Backend hand-off (for Noé and Sueda)

Status: works end to end on the offline JSON inventory. The SQL (migrations + seed) is validated on a local in-process Postgres (`cd supabase/tests && npm install && npm test`: 31 checks incl. overlap, stock, RLS and the read-only role). Migrations 0001-0005 + seed are applied on the team Supabase project (14 Nov). The API has NOT yet read from it live: that needs `DATABASE_URL` (read-only role) or the service-role key on the server.

## Run
```
cd backend
python -m venv venv
venv\Scripts\activate          # Windows  (macOS/Linux: source venv/bin/activate)
pip install -r requirements.txt
python -m pytest -q             # 41 tests, no network needed
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
2. Score = 0.5 distance + 0.3 condition + 0.2 price (all 0..1). Distance score = exp(-km/50). Condition: fair 0.4, good 0.7, excellent 1.0. Price: cheapest candidate = 1.0 down to priciest = 0.0 (free loans count as price 0). Weights are placeholders; sensitivity in docs/SCORING.md.
3. Options that cover the full quantity rank first, then by score; ties are broken by item id (deterministic).
4. Top 3 returned with `breakdown`. `explanation` is `null`: the AI layer fills it using ONLY the breakdown.
5. `suggestions` (what-if): re-runs with the event shifted by 1 day, a 1.5x radius, or one condition level lower, and reports only what adds options.

## Placeholders and limits (be honest in the pitch)
- All inventory is fictional.
- CO2 is a range. Upper = weight x DEFRA 2025 material factor (new item bought for this event alone); conservative = the same / assumed uses per new item (10, ASSUMPTION in `impact_factors.json`). Both minus delivery AND return (rigid truck, 2 legs), floored at 0. Factors are read from the official UK Government GHG Conversion Factors 2025 file (see `backend/impact_factors.json` for exact rows). Item weights and materials are ROUGH ESTIMATES for fictional items, so every number is `illustrative`. UK factors are a proxy for Turkey; use phase and end-of-life are ignored; the avoided new item's own delivery is not counted. In the pitch say "estimated", never "measured".
- Cost savings versus buying new is NOT implemented: the schema has only rental price per day, no new-purchase price.
- Availability is declared stock, not reservations. Two requests can see the same stock.
- A stay split across two windows of one item is not matched (rule: one window covers the whole range).
- Scoring weights are not validated against real user preferences; the first pick is driven mostly by distance (see docs/SCORING.md).
- Batch/MILP is built (`POST /match/batch`, see docs/DEMO_SCENARIO.md) but tested on the synthetic inventory only. In scenarios with enough stock greedy and MILP give the same plan; the advantage appears when requests compete.

## Supabase setup (manual, owner of the project)
1. Create a project. 2. SQL editor: run `supabase/migrations/0001..0004` in order, then `supabase/seed.sql`, then `supabase/verify.sql`.
3. Put `SUPABASE_URL` and the service-role key in `backend/.env` (never commit). The mobile/web app must NOT get the service-role key and does not read tables directly.
