# Saved projects and progression: contract (v1)

Status: APPROVED by Noé (15 Nov). Backend implemented on branch `feat/progress` (`backend/progress.py`,
`POST /shortlist/check`, `POST /progress/evaluate`, `backend/test_progress.py`); merged into `main` only after the
deployed phone journey is stable. No database change, no write API. Owner: Atay (backend), consumed by Sueda.

## UX wording (Noé, 15 Nov): use exactly these

| Say | Never say |
|---|---|
| "Saved in this browser" | "saved to your account", "synced" |
| "Shortlist" | "reserved", "booked", "secured" |
| "Availability re-checked" (with the time) | "guaranteed", "confirmed" |
| "Next steps" | "completed reuse", "exchange done" |
| "Estimated opportunity: X–Y kg CO2e (illustrative)" | "CO2 saved", "impact achieved" |
| "Concept — not redeemable" (rewards) | prizes, vouchers, "claim" |

If browser data is gone (cleared, private window, other device): say so plainly, e.g. "No saved project found
in this browser. Projects are saved only in the browser where you created them." and offer "Start a new
project" (the review screen can be refilled quickly). Never imply cross-device or durable storage.

Principles (from Noé, 15 Nov): a saved selection is a **shortlist, not a reservation**; inventory is never
deducted and availability is never "secured"; the inventory reader stays **read-only**; no unauthenticated public
write API; progression is **deterministic and separate from the LLM**; no real rewards, redemption or
financial liability; estimated impact is never counted twice and never presented as saved or verified.

## Part A. Saved projects: browser-local today, server-side deferred

**Recommendation for today:** the project lives in the user's browser (localStorage), written by the web app.
The backend adds one stateless, read-only endpoint to re-check a shortlist when the project is reopened. No
database writes, no new credentials, no new attack surface.

Limitations to show in the UI: "Saved on this device and browser only. Clearing browser data deletes it.
A shortlist is not a reservation: availability is re-checked when you reopen."

### A1. Project document (`reloop.project/v1`), shared by the browser now and any server later

```json
{
  "schema": "reloop.project/v1",
  "id": "8b1c...uuid (client-generated)",
  "name": "Gala, Lara, 21-23 Nov",
  "mode": "live | demo",
  "created_at": "2026-11-15T10:00:00Z",
  "updated_at": "2026-11-15T10:20:00Z",
  "brief": {
    "needs": [ { "category": "chairs", "quantity": 50, "label": "chairs" } ],
    "start_date": "2026-11-21", "end_date": "2026-11-23",
    "location": { "preset_id": "lara", "lat": 36.853, "lon": 30.80 },
    "requirements": { "min_condition": null, "max_distance_km": null },
    "priority": "balanced"
  },
  "brief_confirmed_at": "2026-11-15T10:05:00Z",
  "shortlist": [
    { "need_category": "chairs", "item_id": "b000...0001", "quantity": 50, "added_at": "2026-11-15T10:10:00Z",
      "snapshot": { "name": "Stackable banquet chairs", "supplier_name": "Demo Lara Event Hall (fictional)",
                    "distance_km": 0.0, "estimated_cost_try": 1800.0, "inventory_source": "supabase",
                    "checked_at": "2026-11-15T10:10:00Z" } }
  ],
  "events": [ { "type": "details_viewed", "item_id": "b000...0001", "at": "2026-11-15T10:08:00Z" } ]
}
```

- `events.type` (user-reported, recorded by the app): `brief_confirmed`, `details_viewed`, `shortlist_added`,
  `shortlist_removed`, `project_reopened`, `brief_changed`. Max 200 events; older ones may be dropped.
- The raw free text the user typed is **not** stored in the project (it may contain personal data).
- `snapshot` is for display only. Every number used for checks, progress or impact is recomputed by the server.

### A2. `POST /shortlist/check` (new, stateless, read-only) ~1 h incl. tests

Request: `{ "brief": <brief>, "shortlist": [ { "need_category", "item_id", "quantity" } ] }` (max 20 items).
Response, one entry per item, in order (implemented):

```json
{ "inventory_source": "supabase", "note": "Shortlist only, not reserved. Availability re-checked, not guaranteed.",
  "items": [ { "item_id": "b000...0001", "need_category": "chairs",
               "status": "available | partial | unavailable | unknown_item",
               "requested_quantity": 50, "available_quantity": 150, "missing_quantity": 0,
               "current": { "name": "...", "supplier": {"id": "...", "name": "..."}, "distance_km": 0.0,
                           "condition": "excellent", "estimated_cost_try": 1800.0 },
               "note": "Shortlist only, not reserved. Availability re-checked, not guaranteed." } ] }
```

The app should store its own `checked_at` when it calls this (the server adds no clock, so results stay
reproducible).

Uses the same availability rules as `/match` (one window covering the whole date range). Never reserves.

### A3. Server-side persistence: deferred (not approved)

Would need: authenticated ownership or unguessable capability links, a separate write role limited to one
table (never the reader), size limits, retention and deletion, abuse limits, and review. Estimate 3-4 h plus
review. The `reloop.project/v1` document above is the storage format, so the web app does not change later.

## Part B. Progression: deterministic, stateless, no LLM

### B1. `POST /progress/evaluate` ~2-2.5 h incl. tests

Request: `{ "project": <reloop.project/v1> }`. The schema **rejects unknown fields** (422), so a client cannot
submit points, balances, milestone states or rewards. The server derives everything from the project each time:
the same project always gives the same result, and repeating the request can never award a milestone twice.

```json
{
  "rules_version": "progress/v1",
  "evidence": "user_reported",
  "milestones": [
    { "id": "brief_reviewed", "title": "Brief reviewed", "status": "complete",
      "eligibility": "The request was confirmed on the review screen with at least one item, dates and a location.",
      "evidence": "user_reported", "points": 10 }
  ],
  "points": { "earned": 30, "possible": 70, "note": "Product progress points. Not money, not exchangeable." },
  "next_step": { "id": "complete_shortlist", "text": "Choose an option for lighting (2 needed)." },
  "rewards": [ { "id": "relooper_badge", "title": "Relooper badge", "status": "concept",
                 "note": "Concept — not redeemable. No real reward, prize or redemption exists in this prototype." } ],
  "estimated_opportunity": { "kgco2e_conservative": 95.6, "kgco2e_upper": 956.0, "status": "illustrative",
                             "counted_items": ["b000...0001"],
                             "note": "Estimated opportunity of the current shortlist, each item counted once. Not saved, measured, verified or achieved carbon." },
  "shortlist": [ "same entries as POST /shortlist/check" ],
  "inventory_source": "supabase"
}
```

### B2. Milestones v1 (product actions only)

| id | points | eligibility (exact rule) | evidence |
|---|---|---|---|
| `brief_reviewed` | 10 | `brief_confirmed_at` set; brief has ≥1 need, both dates and a location | user_reported |
| `options_compared` | 10 | `details_viewed` events for ≥2 different items of the same category | user_reported |
| `shortlist_started` | 10 | shortlist has ≥1 item | user_reported |
| `shortlist_complete` | 20 | for every need, shortlisted quantity of that category ≥ needed quantity AND the server re-check says those items are available | user_reported (availability server-checked) |
| `local_first` | 10 | shortlist not empty and every shortlisted supplier is ≤ 15 km away (server-computed distance) | user_reported |
| `returned_and_updated` | 10 | a `project_reopened` event followed by a later `shortlist_added`, `shortlist_removed` or `brief_changed` | user_reported |

If `mode` is `demo`, every milestone's evidence is `demo` instead of `user_reported`. **No v1 milestone is
`verified`**: that level is reserved for actions confirmed independently (e.g. a supplier confirming a handover),
which needs accounts and is out of scope.

### B3. Next step (deterministic, first rule that applies)

1. No `brief_confirmed_at` → "Review your request." 2. A shortlisted item is unavailable or partial →
"Replace <item>: availability changed." 3. A need has no (or not enough) shortlisted quantity → "Choose an
option for <category> (<n> needed)." 4. Otherwise → "Your shortlist is ready. Contacting suppliers is not part
of this prototype."

### B4. Rewards

All `concept` in v1, shown with "Concept only. No real reward, no redemption." `available` / `unavailable`
exist in the schema for the future; using them requires authenticated ownership, server-side eligibility, a
reward ledger, stock controls and an audit trail, none of which is approved.

### B5. Impact accounting

`estimated_opportunity` is computed by the server from the current inventory and `impact.py` for the current
shortlist, each `item_id` counted once (re-saving, reopening or reselecting cannot add it again). It is labelled
an estimated opportunity, never saved, measured or verified carbon. Three levels stay distinct: estimated
opportunity (this), user-reported reuse (not collected in v1), verified reuse (not possible in v1).

## Estimates and order

| Step | Owner | Estimate |
|---|---|---|
| 0. Deploy + full smoke test report | Noé (Render) + Atay | 15-30 min after the URL |
| 1. `POST /shortlist/check` | Atay | ~1 h |
| 2. `POST /progress/evaluate` + rules + tests + contract doc | Atay | ~2-2.5 h |
| 3. Browser-local projects, "continue where you left off", progress view | Sueda | her estimate |
| Server-side persistence | not today | 3-4 h + review |

Order: 0 → phone journey fixes → 1 → 2 (after approval). Nothing here touches the database or the reader role.
