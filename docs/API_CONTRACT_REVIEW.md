# API contract v1: review and proposals (Sueda → Atay, Noé)

Status: PROPOSAL. Nothing in `backend/` has been changed. Each point needs Atay's OK before anyone implements it.
Basis: `docs/API_CONTRACT.md`, `backend/models.py`, `backend/main.py`, and a local run of the main demo request
on the offline JSON inventory (Supabase not reached).

Main demo request (Noé): *"I need 50 chairs and 2 stage lights near Lara, Antalya, from 21 to 23 November 2026."*

## What I checked locally (JSON fallback, Lara = 36.853, 30.80)

| Need | Options found | Top result |
|---|---|---|
| 50 chairs | 7 | Stackable banquet chairs, Demo Lara Event Hall, 0.0 km, 1,800 TRY |
| 2 lighting | 2 | Stage par lights LED, Demo Konyaalti Hotel Storage, 14.5 km, 420 TRY |

The contract works for this request. The points below are what the web client needs to show it honestly.

## Agreed as-is (I accept)
- `GET /health`, `GET /categories`, `POST /match`, `POST /impact/summary`, `POST /match/batch` shapes as in `models.py`.
- Errors: 422 for validation, `{ "error": "..." }` otherwise. Empty `matches` = valid 200.
- Client never talks to Supabase. Only the public backend URL goes in frontend config.

## Decisions needed

### D1. Several categories in one request (blocking for the demo)
The demo request has two needs, but `/match` takes one category.
- **Proposal (no backend change):** the client sends one `/match` call per need, in parallel, and shows the
  results grouped by need ("Chairs: 3 options", "Lighting: 2 options").
- A combined "plan" card (best option per need) is built on the client from those results. It says plainly when
  it uses more than one supplier ("2 pickups"). No single-supplier bundle is claimed unless the data shows one.
- Note for Noé: in the current seed no supplier has both the chairs and the stage lights, so the mockup's
  "Supplier A: 50/50 chairs, 2/2 lights" card does not happen with real data. Either we show the 2-supplier
  plan or Atay adds stage lights to the Lara hall in the seed.
- Update 14 Nov: Noé asked to stay as close as possible to the wireframe, so I now recommend the seed change:
  add a small "Stage par lights LED" stock (e.g. 4 units, 21–23 Nov available) to Demo Lara Event Hall, in both
  `supabase/seed.sql` (live) and `backend/data/inventory.json` (fallback), so the one-supplier card is real data.
  The client still handles the multi-supplier case for other requests.

### D2. Show the data source on every result (small backend change)
Noé wants each result to say whether it came from live Supabase or the offline dataset.
- **Proposal:** add `"inventory_source": "supabase" | "json_fallback"` to `MatchResponse`
  (and `SummaryResponse`). Same value `/health` already returns.
- Until then the client calls `/health` once per search and shows that value.

### D3. Item type within a category
`lighting` mixes stage par lights, festoon strings, lanterns. "2 stage lights" currently also returns
"String festoon lights 20 m" as option 2.
- **Option A (no change):** keep it; the explanation states the item name, so the organiser sees it is a string light.
- **Option B:** optional `requirements.keywords: ["stage"]` that filters on item name. Parser can fill it.
- I suggest A for now, B only if time allows.

### D4. Where the AI endpoints live
Noé's rules: LLM calls server-side, one backend only.
- **Proposal:** a Python package `ai/` (my folder) exposing a FastAPI `APIRouter`. Atay adds one line in
  `main.py`: `app.include_router(ai_router)`. I never edit `main.py` otherwise.
- LLM provider, model and key come from server env vars (`LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`), never the frontend.
- If the key is missing or the LLM fails, both endpoints still answer with deterministic output (see below).

### D5. `POST /parse-request`
Request
```json
{ "text": "I need 50 chairs and 2 stage lights near Lara, Antalya, from 21 to 23 November 2026.",
  "context": { "today": "2026-11-14" } }
```
Response
```json
{
  "needs": [
    { "category": "chairs",   "quantity": 50, "label": "chairs" },
    { "category": "lighting", "quantity": 2,  "label": "stage lights" }
  ],
  "start_date": "2026-11-21",
  "end_date": "2026-11-23",
  "location": { "place_text": "Lara, Antalya", "preset_id": "lara", "lat": 36.853, "lon": 30.80 },
  "requirements": { "min_condition": null, "max_distance_km": null },
  "missing_fields": [],
  "warnings": [],
  "parser": "llm" 
}
```
- `category` is always one of the 5 slugs; an unknown need goes to `warnings` ("'speakers' is not in our inventory").
- Coordinates only come from a fixed, labelled preset list (Lara, Konyaalti, Kepez, Belek, Kemer); no geocoding.
  Unknown place → `location.lat/lon = null` and `"location"` in `missing_fields`; the review screen asks the user.
- `parser`: `"llm"` or `"rules"` (fallback), so the UI can say which one ran.
- The client turns `needs[]` into one `/match` body each (D1).

### D6. `POST /explain` (batched: one call per result set)
Request: `{ "request": <the /match body>, "matches": [ <MatchOut>, ... ] }`
Response:
```json
{ "explanations": [
    { "item_id": "...", "summary": "...", "reasons": ["..."], "things_to_check": ["deposit", "damage responsibility", "return conditions"] }
  ],
  "explainer": "llm" }
```
- Uses ONLY fields present in the match (`distance_km`, `condition`, `breakdown`, `estimated_cost_try`,
  `covers_quantity`, `available_quantity`, `impact`). Any number in the text is checked against the input;
  if a number does not match, that explanation is replaced by the deterministic template.
- `explainer`: `"llm"` or `"template"`.
- `/match` keeps returning `explanation: null`; the client calls `/explain` after results are shown, so a slow
  LLM never blocks the results.

## Small clarifications (doc only)
- C1. `estimated_cost_try` is `unit_price × quoted_quantity × days` (code), not `× quantity` (doc). Same thing
  when coverage is full; for partial matches the code is the right one. Please update the doc line.
- C2. `days` counts both ends (21–23 Nov = 3 days). Fine, just note it in the doc.
- C3. Cost: no delivery, deposit or transport charge exists in the data. The UI will always show
  "Delivery and deposit not included". OK?
- C4. Partial match: client shows missing = requested − `quoted_quantity` when `covers_quantity` is false.
- C6. Security: the shared Supabase project also holds non-ReLoop tables (staff, payroll, app_users). The backend
  only needs SELECT on the 5 ReLoop tables. If possible, use a key/role limited to those tables rather than the
  service-role key, and never expose any key to the client.
- C5. Deploy: please share the public Render URL once live, and add the Vercel origin to `CORS_ORIGINS`
  (the `*.vercel.app` regex already covers preview URLs).

## What I build next, against this contract
1. `ai/` module with the two endpoints above + tests, deterministic fallback first.
2. Shared fixtures in `frontend/src/fixtures/` copied from real `/match` responses (labelled demo mode).
3. Web client calling the live API; demo mode only when explicitly selected.
