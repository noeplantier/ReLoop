# Offers, first participation, badge and map: proposed contract (v1.1, PROPOSAL)

Status: proposal for Sueda's agreement and Noé's approval, 15 Nov. Nothing below is implemented. No frontend
change is needed before this is agreed, and no backend code is written before it is. Owner: Atay (backend),
consumed by Sueda (web app). Builds on `docs/PROJECT_PROGRESS_CONTRACT.md` (v1, approved and merged).

## 0. Decisions (taken by Atay, to confirm)

1. **Offers are local to the browser today.** They are NOT published for others to discover. Reason: the
   inventory reader is SELECT-only and must stay so; publishing needs a separate write role, abuse limits and
   moderation (3-4 h plus review, credentials only Noé can create). The UI must say so everywhere an offer
   appears: "Saved in this browser. Not visible to others yet."
2. **No free-text address, ever.** An offer's place is one of the six demo location presets (id, lat, lon).
   No street, no contact details, no photos uploaded by users. This is what protects private addresses.
3. **Participation is not exchange.** Nothing here records or verifies that equipment changed hands. No new
   milestone is "verified", and nothing is called saved, measured or verified carbon.
4. **The reward is a digital badge and a downloadable card.** No voucher, prize or redemption. Existing
   `relooper_badge` stays a concept.
5. **Points are derived, never accumulated.** The server re-evaluates the whole project each time, so
   refreshing, reopening or resubmitting cannot add points. Offers are de-duplicated server-side.

## 1. Project document: one additive field (stays `reloop.project/v1`)

`offers` is optional and defaults to `[]`, so every project saved today is still valid (the model keeps
`extra="forbid"`; only this field is new).

```json
"offers": [
  { "id": "uuid (client-generated)", "category": "chairs", "label": "Folding chairs, white",
    "quantity": 40, "condition": "good",
    "available_from": "2026-11-20", "available_to": "2026-11-30",
    "location": { "preset_id": "lara", "lat": 36.853, "lon": 30.80 },
    "created_at": "2026-11-15T12:00:00Z" } ]
```

Rules (max 20 offers per project): `category` is a known category; `label` 1-80 chars and must not contain `@`,
`http` or a long digit run (a cheap guard against contact details; documented, not security); `quantity`
1-100000; `condition` is `fair | good | excellent` (same as the inventory); dates ordered and at most 180 days
apart; `preset_id` must be a known demo preset, and its lat/lon must match the preset (the server uses the
preset's coordinates, not the client's).

## 2. New endpoint: `POST /offer/validate` (stateless, stores nothing)

Request: `{ "offer": <offer> }`. Response 200:

```json
{ "valid": true, "visibility": "this_browser",
  "offer": { "...normalised copy..." },
  "approx_location": { "lat": 36.85, "lon": 30.80, "precision_km": 1.1, "label": "Lara, Antalya (demo location)" },
  "note": "Saved in this browser only. Not visible to others yet. Fictional demo prototype." }
```

Invalid input is 422 in the same shape as the other endpoints. Counts as a general POST for rate limits.

## 3. Progress changes (`POST /progress/evaluate`, rules_version `progress/v1.1`)

- **New milestone `offer_saved`** (10 points): "At least one valid equipment offer is saved in this project."
  Possible points go from 70 to 80. Existing milestones, ids and points are unchanged.
- **New block `participation`:**
  `{ "level": "none" | "started", "completed_exchanges": 0, "note": "Participation means you used the app. No exchange is tracked or verified in this prototype." }`
  `level = "started"` when `brief_reviewed` OR `offer_saved` is complete. A request counts even with partial or
  no matches (as today: `brief_reviewed` does not depend on results). `completed_exchanges` is always 0 in v1.
- **Rewards:** new item `{ "id": "reuse_starter", "title": "Reuse Starter badge", "kind": "digital_badge",
  "status": "unlocked" | "locked", "note": "Digital badge. No prize, voucher or redemption." }`, `unlocked` iff
  `participation.level == "started"`. `relooper_badge` stays `concept`. `status` gains the value `unlocked`
  (frontend type must accept it).
- Evidence follows the project: `demo` mode projects give `demo`, otherwise `user_reported`; never `verified`.
- Estimated opportunity is unchanged (items on the shortlist, each counted once). Offers add NO carbon.

## 4. Achievement card: `POST /progress/card` (returns `image/svg+xml`)

Request: `{ "project": <project> }` (same strict schema). The server derives the result and returns a
deterministic SVG (no date, no random): "ReLoop", the badge title, "Reuse steps: N of 8", "Participation, not a
verified exchange", "Fictional demo inventory". It contains only fixed strings and integers (never user text), so
there is nothing to escape or inject. Locked badge gives 409 `{ "error": "badge not unlocked yet" }`. The app
offers "Download card" (SVG; PNG conversion in the browser is Sueda's choice).

## 5. Map support (additive response fields)

- `supplier.approx_location`: `{ "lat", "lon", "precision_km" }`, coordinates rounded to 2 decimals (about
  1 km), and `supplier.is_demo: true` for the fictional inventory (shown as "fictional" on the marker).
- Offers use `approx_location` from section 2. The app places the owner's offers on the map, labelled
  "Your offer (this browser only)". Other users never see them.
- Representative images are a frontend choice per category; they must be labelled "Representative image" and
  must not state specifications.
- Cost to know: `SupplierOut` changes, so the recorded demo fixtures and the golden file must be regenerated
  (`backend/fixtures/`, then `npm run sync:fixtures` in the frontend). The staleness test guards this.

## 6. What this does not do

No publishing of offers, no accounts, no matching of offers to requests, no notifications, no exchange
tracking, no verified carbon, no vouchers or prizes, no uploaded images, no write access to the database.

## 7. Delivery order and estimates (Atay)

| Step | Estimate | Gate |
|---|---|---|
| Agree this contract (Sueda, Noé) | by 15:30 | nothing is built before |
| `models.py` + `/offer/validate` + `offer_saved` + `participation` + `reuse_starter`, tests | ~2 h | CI green, merged tree tested |
| `approx_location`, `is_demo`, fixtures regenerated | ~1 h | `check:fixtures` green |
| `/progress/card` + tests | ~45 min | |
| Each step: review, test, deploy, smoke test on Render | ~20 min each | rollback point stays `f18e600` once deployed |

Hard stop for code: 19:00. Anything not stable by then is dropped, not rushed.

## 8. Questions for Sueda

1. Is the additive `offers` field acceptable in `reloop.project/v1` (no version bump)?
2. Card as SVG download, or do you prefer a PNG made in the browser?
3. Is `participation.level` enough for the congratulations modal, or do you need a separate "just unlocked" flag?
   (Proposal: the app compares the previous and current `reuse_starter.status`; the server stores nothing.)
