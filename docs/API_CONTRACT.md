# API contract v1 (DRAFT: needs Sueda's and Noé's OK before implementation)

Base URL: `http://localhost:8000` (dev), public URL after deploy. JSON only. Dates are ISO `YYYY-MM-DD`.
`null` for missing values, never empty strings. Quantities are integers. Scores are 0..1.
All demo inventory is fictional. The mobile/web client never talks to Supabase; it only calls this API.

## GET /health
`{ "status": "ok", "inventory_source": "supabase" | "json_fallback" }`

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
        "avoided_kgco2e": null,
        "status": "unavailable",
        "assumptions": ["No sourced emission factor loaded yet."]
      }
    }
  ],
  "suggestions": []
}
```
- `estimated_cost_try` = `unit_price_per_day_try * quantity * days`, or `null` for free loans / no price.
- `covers_quantity` is `false` when the item has fewer units than requested (shown but ranked lower).
- `explanation` is filled by the AI layer (Sueda) using ONLY `breakdown`, `distance_km`, `condition`. Backend returns `null`.
- `impact.status`: `"sourced"` (published factor), `"illustrative"` (placeholder, must be labelled in the UI), or `"unavailable"`. Never present `illustrative` as a verified claim.
- `suggestions` (what-if, later): `{ "type": "shift_date", "detail": "Starting 1 day later adds 2 options" }`.
- Empty `matches` is a valid 200 response.

## POST /impact/summary
Aggregates chosen matches for the dashboard.
Request: `{ "selections": [ { "item_id": "...", "quantity": 50, "start_date": "...", "end_date": "...", "location": {"lat": 0, "lon": 0} } ] }`
Response
```json
{
  "reused_units": 50,
  "total_distance_km": 12.4,
  "estimated_cost_try": 1800.0,
  "avoided_kgco2e": null,
  "impact_status": "unavailable",
  "assumptions": []
}
```

## Planned (Sueda / AI layer, may live in a separate module)
- `POST /parse-request`: `{ "text": "50 chairs near Lara on 21-23 Nov" }` returns a `/match` request or a list of them.
- `POST /explain`: `{ "request": {...}, "match": {...} }` returns `{ "explanation": "..." }`.

## Later (stretch)
- `POST /match/batch`: several requests sharing stock, greedy vs MILP comparison.

## Errors
Invalid input: HTTP 422 (FastAPI default). Other errors: `{ "error": "message" }`.
CORS allows `http://localhost:5173`, `http://localhost:3000`, `http://localhost:8081`, plus the deployed web origin.

## Open points
1. Should one option be able to combine several suppliers to cover the quantity (bundle)? v1: one item per option.
2. Cost savings vs buying new needs a new-price baseline column; not in the schema yet.
3. Units/currency: prices are TRY per unit per day.
