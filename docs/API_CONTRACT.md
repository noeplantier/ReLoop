# API contract v1 (DRAFT: needs Sueda's and Noé's OK before implementation)

Base URL: `http://localhost:8000` (dev), public URL after deploy. JSON only. Dates are ISO `YYYY-MM-DD`.
`null` for missing values, never empty strings. Quantities are integers. Scores are 0..1.
All demo inventory is fictional. The mobile/web client never talks to Supabase; it only calls this API.

## GET /health
`{ "status": "ok", "inventory_source": "supabase" | "json_fallback", "inventory_age_s": 12.3, "ai_layer": true, "llm_enabled": false, "commit": "00c802a" }`
- `inventory_age_s`: seconds since the inventory copy was loaded. The API keeps a copy for 5 min and refreshes it in the
  background; if a refresh fails it keeps the last live copy (still `supabase`) instead of switching to the fallback.
- `ai_layer`: `/parse-request` and `/explain` are mounted. `llm_enabled`: they call the LLM (else rules/templates).
- `commit`: deployed git commit (Render), `null` locally. Added 14 Nov, additive.

## GET /categories
`[ { "slug": "chairs", "name": "Chairs", "unit_label": "chair" }, ... ]`
Slugs: `tables`, `chairs`, `lighting`, `signage`, `staging`.

## POST /match
One request, returns the **top 3** options.

Request
```json
{
  "request_id": "req-1",
  "category": "chairs",
  "quantity": 50,
  "start_date": "2026-11-21",
  "end_date": "2026-11-23",
  "location": { "lat": 36.89, "lon": 30.70 },
  "requirements": { "min_condition": "good", "max_distance_km": 40 }
}
```
- `requirements` is optional. `min_condition`: `"fair" | "good" | "excellent"`.
- `priority` is optional (added 14 Nov): `"balanced"` (default, same as omitting it) | `"closest"` (distance 0.8,
  condition 0.1, price 0.1) | `"cheapest"` (0.2 / 0.2 / 0.6) | `"best_condition"` (0.2 / 0.6 / 0.2). Weights are design
  choices, not learned; the ones used are always in `breakdown.weights`. Good for a "What matters most?" chip row.
- Hard rules: category matches; ONE availability window covers the whole `start_date..end_date`; reuse mode is `loan` or `rental`; condition and distance limits (if given).
- `donation` and `resale` items are never returned in this MVP.

Response
```json
{
  "request_id": "req-1",
  "days": 3,
  "total_options": 5,
  "matches": [
    {
      "item_id": "b0000000-0000-4000-8000-000000000001",
      "name": "Stackable banquet chairs",
      "supplier": { "id": "a0000000-0000-4000-8000-000000000001", "name": "Demo Lara Event Hall (fictional)", "city": "Antalya" },
      "reuse_mode": "rental",
      "condition": "excellent",
      "available_quantity": 150,
      "quoted_quantity": 50,
      "missing_quantity": 0,
      "covers_quantity": true,
      "distance_km": 12.4,
      "unit_price_per_day_try": 12.0,
      "estimated_cost_try": 1800.0,
      "score": 0.91,
      "breakdown": {
        "distance_score": 0.78,
        "condition_score": 1.0,
        "price_score": 0.85,
        "weights": { "distance": 0.5, "condition": 0.3, "price": 0.2 }
      },
      "explanation": null,
      "impact": {
        "avoided_kgco2e": 956.02,
        "avoided_kgco2e_conservative": 95.6,
        "transport_kgco2e": 0.0,
        "status": "illustrative",
        "basis": { "upper": "New items bought for this event alone.", "conservative": "New items would serve 10 events; this event gets 1/10 (assumption)." },
        "assumptions": ["Upper bound: producing 50 new unit(s) of metals, about 5.0 kg each = 0.250 t x 3824.09335 kgCO2e/t = 956.0 kgCO2e is avoided.", "Factor source: DESNZ/Defra 2025, ...", "Conservative bound: a new item would serve 10 events (ASSUMPTION, not sourced), ...", "..."]
      }
    }
  ],
  "suggestions": [],
  "inventory_source": "supabase",
  "cost_note": "Rental price only (unit price x quantity x days). Delivery, deposit, setup and taxes are not included."
}
```
- `estimated_cost_try` = `unit_price_per_day_try * quoted_quantity * days`, or `null` for free loans / no price. `days` counts both ends (21-23 Nov = 3). Show `cost_note` next to it.
- `covers_quantity` is `false` when the item has fewer units than requested (shown but ranked lower). `missing_quantity` = requested − `quoted_quantity` (0 when covered). Never present a partial option as a complete solution.
- `inventory_source`: `"supabase"` (live database) or `"json_fallback"` (offline fictional dataset, used when Supabase is unreachable). Same value as `/health`.
- `matches` holds up to 3 options; fewer when fewer are feasible. A multi-item request ("50 chairs and 2 stage lights") = one `/match` call per category.
- Added 14 Nov (additive, nothing renamed): `missing_quantity`, `inventory_source`, `cost_note`.
- `explanation` is filled by the AI layer (Sueda) using ONLY `breakdown`, `distance_km`, `condition`. Backend returns `null`.
- Carbon is a RANGE (added 14 Nov, additive). `impact.avoided_kgco2e` = UPPER bound: producing the NEW items we avoid (weight x DEFRA 2025 material factor), as if they were bought for this event alone. `impact.avoided_kgco2e_conservative` = the same production shared over the uses a new item would get (`assumed_uses_per_new_item` in `impact_factors.json`, currently 10, an ASSUMPTION), so it is always illustrative. Both have `impact.transport_kgco2e` (delivery AND return, sourced factor) deducted and are floored at 0. `impact.basis` gives one line per bound. UI: show "Estimated 96–956 kg CO2e avoided (illustrative)", with assumptions on demand; never rank options by CO2 (heavier items would win). `impact.status`: `"sourced"` (real weights), `"illustrative"` (weights/materials are demo estimates: the UI MUST label it "estimate", never a verified claim) or `"unavailable"` (data missing, `avoided_kgco2e` is `null`). `assumptions` lists the calculation in plain text, show it on demand.
- `suggestions` (what-if, later): `{ "type": "shift_date", "detail": "Starting 1 day later adds 2 options" }`.
- Empty `matches` is a valid 200 response.

## GET /impact/methodology
Everything behind the carbon range, for a "How we calculate" screen (added 14 Nov). Numbers come only from
`backend/impact_factors.json`. Shape: `{ summary, formula: {upper, conservative, transport, floor}, dataset: {name,
published, url, licence, caveat}, factors: [{id, label, value, unit, status, source}], assumptions: [{id, value,
status, note}], status_labels: {sourced, illustrative, unavailable}, not_counted: [..], limitations: [..] }`.

## POST /impact/summary
Aggregates chosen matches for the dashboard.
Request: `{ "selections": [ { "item_id": "...", "quantity": 50, "start_date": "...", "end_date": "...", "location": {"lat": 0, "lon": 0} } ] }`
Response
```json
{
  "reused_units": 50,
  "total_distance_km": 12.4,
  "estimated_cost_try": 1800.0,
  "avoided_kgco2e": 956.02,
  "avoided_kgco2e_conservative": 95.6,
  "transport_kgco2e": 0.0,
  "impact_status": "illustrative",
  "assumptions": ["..."],
  "inventory_source": "supabase"
}
```

## AI layer: POST /parse-request, POST /explain (owner: Sueda, `ai/`)
Served by the same API (mounted in `main.py` if `ai/` is present). Shapes: `docs/API_CONTRACT_REVIEW.md` D5/D6 on
branch `feat/web-ai`. `parser` / `explainer` say whether the LLM or the deterministic fallback answered.
The LLM key is a server env var; without it both routes still answer (rules / templates).

## POST /match/batch
Several requests (2-10) that compete for the same stock. Returns a greedy baseline and the MILP optimum side by side.
Request: `{ "requests": [ <match request>, ... ], "max_suppliers_per_request": 2 }` (`request_id` optional; missing ids become `req-1`, `req-2`...; ids must be unique).
Response
```json
{
  "allocations": [ { "request_id": "R1", "lines": [ { "item_id": "...", "name": "...", "supplier": "...", "quantity": 150, "distance_km": 0.0 } ], "unmet": 0 } ],
  "comparison": {
    "greedy": { "allocations": [ "..." ], "summary": { "covered_requests": 2, "total_requests": 3, "unmet_units": 20, "total_score": 363.97, "total_distance_km": 14.5 } },
    "milp":   { "allocations": [ "..." ], "summary": { "covered_requests": 3, "total_requests": 3, "unmet_units": 0,  "total_score": 377.32, "total_distance_km": 7.7 } }
  },
  "note": null
}
```
- Top-level `allocations` = the MILP plan (the one to show). `comparison` is for the "greedy vs optimised" slide.
- Greedy = first come, first served in the order sent. MILP decides all requests together. Stock is shared per availability window.
- `max_suppliers_per_request` counts suppliers (one pickup each), not item lines; `total_distance_km` counts one trip per (request, supplier).
- `note` is set (and `milp` = `greedy`) only if the solver fails; the endpoint never breaks `/match`.
- This is optimisation, not AI: say so in the pitch.

## POST /shortlist/check and POST /progress/evaluate (branch `feat/progress`)
Saved-project re-check and deterministic progression. Read-only, stateless, no LLM, strict input (unknown fields → 422,
so clients cannot submit points or claims). Full contract and UX wording: `docs/PROJECT_PROGRESS_CONTRACT.md`.

## Demo fixtures (for the web app's demo mode)
`backend/fixtures/demo_scenarios.json` holds real, unmodified responses of the endpoints above for the demo scenarios;
`backend/fixtures/match_golden.json` holds key `/match` numbers for 480 requests as a parity test. Generated by
`backend/tools/export_demo_fixtures.py`; the backend tests fail if they go stale. See `backend/fixtures/README.md`.

## Errors
Invalid input: HTTP 422 (FastAPI default). Other errors: `{ "error": "message" }` (404 unknown id, 500 `internal error`, 503 batch solver unavailable).
Request limits (added 14 Nov, POST only, per client IP per minute): 60 general, 10 for `/match/batch`, 10 for `/parse-request` +
`/explain`, and a global cap of 300 AI requests per UTC day. Over a limit: HTTP 429 `{ "error": "..." }` with `Retry-After: 60`
(the AI cap message says the request can still be filled in manually). Bodies over 64 KB: HTTP 413. `/health` shows
`ai_requests_today` and `ai_daily_limit`. All limits are env vars (see `docs/DEPLOY.md`).
CORS allows `http://localhost:5173`, `http://localhost:3000`, `http://localhost:8081`, plus the deployed web origin.

## Open points
1. Should one option be able to combine several suppliers to cover the quantity (bundle)? v1: one item per option.
2. Cost savings vs buying new needs a new-price baseline column; not in the schema yet (not shown in the dashboard).
3. Units/currency: prices are TRY per unit per day.
