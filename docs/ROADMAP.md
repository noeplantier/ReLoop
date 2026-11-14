# ReLoop roadmap to submission (written 14 Nov 2026, 17:45 TR)

Audience: the coding agent (Claude Opus 5.5) working in this checkout with Atay, and the team.
Read `CLAUDE.md` first. This file says WHAT to build, in what order, and how to know it is done.

## 0. Status board (updated Sat 14 Nov, 22:15 TR)

Official deadlines (handbook 10.1): core development closes **Sun 15 Nov 23:59 TR**; submission **Mon 16 Nov 12:00 TR**.
Team targets: full phone journey Sun 15:00, feature freeze Sun 19:00. Runtime AI budget: zero (labelled fallback).

| Task | State | Owner / waiting on |
|---|---|---|
| 0.1 Deploy | Config + DATABASE_URL sent; Render service not created yet. Fresh-clone rehearsal of Render's exact build/start PASSED (live Supabase, CORS from *.vercel.app, no secret in logs) | Noé (his Render account) |
| 0.2 Warm start, cache, richer /health | Done | |
| 0.3 CI | Approved by Noé; `.github/workflows/ci.yml` (backend + DB + ai tests, no secrets). Keep-warm: not added (Free plan, wake manually) | |
| 1.1 /impact/methodology | Done | |
| 1.2 Carbon range | Done (assumed 10 uses, labelled) | |
| 1.3 Priority presets | Done | |
| 2.1 /plan | DEFERRED (Noé, 14 Nov): only after the phone journey works, as a small time-boxed proposal that does not touch matching or force a frontend rewrite | |
| 2.2 Shared-stock story | Done (in docs/PITCH_NUMBERS.md) | |
| 2.3 LLM live | llm.py verified against SDK 2.8.0 (mocked); AI off without key (verified) | Noé: provider + budget; Sueda: merge feat/web-ai |
| 2.4 AI eval | Rules: 20/30, 0/8 ungrounded (docs/AI_EVAL_RULES.md). LLM run pending | key |
| 3.1 Deployed e2e | `tools/smoke.py` ready | backend URL |
| 3.2 Frontend notes | Sent to Sueda | |
| 3.3 Backup video | | Noé / Sueda |
| Extra: request limits (Noé) | Done: per-IP + 300 AI requests/day cap | |
| Extra: demo fixtures | Done: backend/fixtures + staleness test | |
| 4.1 Pitch numbers | Done (regenerate after any backend change) | |
| 4.2 README | Draft in docs/README_DRAFT.md | Noé |
| 4.3 Submission form + AI disclosure | | Team, before Mon 09:00 |
| 4.4 Demo script | Done (docs/DEMO_SCRIPT.md) | |

## 1. Where we are (commit 00c802a)

Works and is tested:
- Matching engine, what-if suggestions, CO2 estimate (DEFRA 2025), greedy-vs-MILP batch, FastAPI API.
  34 backend tests, 31 SQL checks (PGlite), `tools/smoke.py` for any URL.
- Supabase (team project, Tokyo): migrations 0001–0005 + seed applied. The API reads it live through the
  read-only role `reloop_reader` (verified locally, `inventory_source: supabase`).
- Sueda's branch `feat/web-ai`: `ai/` (parse + grounded explanations, LLM optional, 21 tests) and
  `frontend/` (React/TS, first screen). `main.py` already mounts `ai.router` when `ai/` exists.

Not done:
- NO public deployment (Render access missing). Frontend not connected to a live backend.
- The LLM path has never run with a real key (`ai/llm.py` SDK parameters unverified).
- Results/Details screens, demo video, submission form.

## 2. Time left

| When (TR) | What |
|---|---|
| Sat 14 Nov, evening | Phase 0 (deploy, harden). Start Phase 1. |
| Sun 15 Nov, 09:00–19:00 | Phases 1–3. **19:00 feature freeze.** |
| Sun 15 Nov, 19:00–23:30 | End-to-end tests on phone + desktop, backup video, docs. **23:30 code freeze** (rules: 23:59). |
| Mon 16 Nov, 09:00–11:00 | Submission form, final smoke test. **Submit by 11:00** (deadline 12:00). |

About 12–14 working hours. Everything below is sized to fit; anything not listed is out of scope.

## 3. How we win (judging criteria -> what the judges must see)

| Criterion | Weight | What we show | Biggest gap today |
|---|---|---|---|
| Climate relevance | 30% | An honest, sourced carbon estimate per plan, with a conservative–upper range, a public methodology page and stated limits | One optimistic number per item; no range; no methodology view |
| AI integration | 20% | Free text (EN + TR) -> structured request -> grounded explanations; invented numbers are rejected; measured accuracy | Never run with a real model; no evaluation numbers |
| Prototype | 20% | A public link that works on a phone without an account, shows live-vs-offline data, and never breaks | Not deployed |
| Innovation | 20% | (a) the engine computes whole-event plans (one supplier vs several pickups), (b) several events sharing scarce stock are planned together by an optimiser | Both exist only as API/tests, not as something a judge sees |
| Pitch | 10% | Reproducible numbers, clear limits, next validation step | Numbers sheet must be regenerated after changes |

Thesis for the pitch: *"Reuse is the climate win; ReLoop makes it the easy choice, and is honest about the numbers."*
Our edge over a typical hackathon entry is credibility: deterministic engine, sourced factors, visible
assumptions, AI that cannot invent facts, and a real optimisation model.

## 4. Operating rules for the agent

1. One task at a time, in the order below. Before every commit: `cd backend && python -m pytest -q` and
   `cd supabase/tests && npm test` must pass. If `ai/` is present, also `python -m pytest -q ai/tests`.
2. Commit and push only when Atay says so. Commit messages in English. Follow Atay's instruction on
   commit attribution (see CLAUDE.md / memory). Chat with Atay in Turkish.
3. API changes are ADDITIVE only (new optional fields, new endpoints). Never rename or remove. Update
   `docs/API_CONTRACT.md` in the same commit and tell Atay what to forward to Sueda.
4. Stay in `backend/`, `supabase/`, `docs/`, `render.yaml`. `frontend/` and `ai/` are Sueda's: write
   proposals for her, do not edit. Product decisions are Noé's: prepare the question, do not decide.
5. Never invent numbers. Every factor needs a source in `impact_factors.json`; every assumption is
   labelled as one. Pitch figures come from `tools/pitch_numbers.py` (task 4.1), never from memory.
6. Secrets: never print, log or paste a key, password or connection string. Do not create or type
   passwords or keys; Atay or Noé enters them in dashboards. When checking `.env`, print key NAMES and
   boolean checks only, and catch exceptions before they echo a value.
7. If a task runs past 1.5x its estimate, take its "fallback" and move on. If a phase gate fails, stop
   adding features and fix the gate.
8. Demo numbers must stay stable: do not change `seed.sql` / `data/inventory.json` (see section 7).

## 5. Phases and tasks

Each task: goal, why, steps, done-when. Estimates assume the agent works with Atay available.

### Phase 0 — a public, reliable backend (tonight; blocks everyone)

**0.1 Deploy (45 min).**
- If Noé's Render invite has arrived: create the web service in his ReLoop project from `render.yaml`
  (Blueprint), region Frankfurt. Otherwise, at 19:00 TR at the latest, deploy to Atay's own free
  workspace as a temporary home and tell Noé in one line; move it when the invite arrives.
- Env vars (Atay types the values in Render): `DATABASE_URL` (reloop_reader pooler URI),
  `CORS_ORIGINS` (Vercel origin once known). AI vars later (task 2.1).
- Done when: `python tools/smoke.py https://<url> --origin http://localhost:5173` prints `RESULT: PASS`
  with `Inventory source: supabase`; URL + commit posted to the team; `docs/DEPLOY.md` status updated.
- Fallback: service starts but Supabase fails -> ship with `json_fallback` (the UI shows the source) and
  debug the URI separately.

**0.2 Fast first request + richer /health (40 min).**
- Why: DB is in Tokyo (~3.6 s cold read); Render free plan sleeps. The demo's first search must not hang.
- Steps: (a) load the inventory once at startup (FastAPI lifespan) so the first `/match` is warm;
  (b) cache: serve the last good Supabase copy while refreshing in the background, raise TTL to 5 min,
  and when Supabase fails keep the last good copy instead of dropping to JSON immediately;
  (c) `/health` adds `ai_layer` (bool), `llm_enabled` (bool, from `ai.llm.enabled()` if importable),
  `commit` (env `RENDER_GIT_COMMIT`, else null), `inventory_age_s`.
- Done when: tests cover stale-serve and the new fields; `/match` after startup answers in < 300 ms locally.

**0.3 CI + keep-warm (30 min).** `.github/workflows/ci.yml`: backend tests, SQL checks, `ai/tests` if the
folder exists, on every push/PR. Optional second workflow: `curl /health` every 10 minutes during
15–18 Nov (GitHub cron is best-effort; still open `/health` manually before any demo).
Needs Noé's OK because `.github/` is repo-level. Done when: green check on `main`.

**GATE 0:** public URL passes the smoke test and Sueda has it. Do not start Phase 1 features before this,
except while waiting on a human (login, invite).

### Phase 1 — climate credibility (30% of the score)

**1.1 Methodology endpoint (30 min).** `GET /impact/methodology` returns, from `impact_factors.json`: formula in
words, each factor with value/unit/source/licence, the assumptions (weights are estimates, UK factors as a
proxy for Türkiye, what is excluded) and limitations. Sueda renders it as a "How we calculate" sheet.
Done when: endpoint + test + contract entry; no number appears that is not in the JSON file.

**1.2 Honest carbon range (90 min).** Today `avoided_kgco2e` assumes the organiser would have bought a
brand-new item for ONE event, and counts delivery one way. A judge who knows LCA will challenge both.
- Keep `avoided_kgco2e` (meaning unchanged, now named the *upper bound* in the docs).
- Add to `impact` (additive): `avoided_kgco2e_conservative`, `transport_kgco2e` (round trip: delivery and
  return, 2 legs), `basis` (short text for each bound).
- Conservative bound: production emissions shared over the item's expected number of uses. First spend
  max 20 min looking for a citable figure for reuse cycles of rental event furniture/equipment; if none is
  found, add `assumed_uses_per_item` to `impact_factors.json` with `"status": "illustrative"` and say so in
  `assumptions`. Never present it as sourced.
- `/impact/summary` sums both bounds; status rules unchanged (weakest evidence wins).
- Done when: unit tests for both bounds and the round trip; contract + `docs/BACKEND_PITCH_NOTES.md`
  updated; the UI wording proposal for Sueda: "Estimated 95–955 kg CO2e avoided (illustrative)"-style
  range, numbers from the API only.
- Trap to avoid: do NOT rank options by "most CO2 avoided". Heavier items would win, which is absurd.
  Between reuse options the only real climate difference is transport; the big win is reuse vs new.
  Say exactly that in the pitch.

**1.3 Priority presets (45 min).** `/match` and `/plan` accept optional `priority`:
`"balanced"` (default, current weights) | `"closest"` | `"cheapest"` | `"best_condition"`. Each is a weight
preset in `match.py`; `breakdown.weights` already reports what was used. This answers the sensitivity
finding (the first pick is distance-driven) by letting the organiser choose.
Done when: tests show the top result changes for a constructed case; default behaviour byte-identical.

### Phase 2 — the differentiators (innovation 20% + AI 20%)

**2.1 Whole-event plans: `POST /plan` (2 h). Needs Noé's OK first** (he parked bundling until the core
flow works; he also asked that the UI never imply a combined offer the engine has not computed. This
endpoint is how the engine computes it).
- Request: `{ needs: [{category, quantity, label?}], start_date, end_date, location, requirements?, priority? }`
  (1–5 needs, distinct categories; same validation as `/match`).
- Response: `{ days, inventory_source, cost_note, needs: [{category, quantity, total_options, matches, suggestions}],
  plans: [{ id, label, lines: [{need_index, item_id, name, supplier, quantity, missing_quantity, distance_km,
  estimated_cost_try}], pickups, total_distance_km, estimated_cost_try, fully_covered, impact }] }`
- `needs[i].matches` is exactly what `/match` returns for that need (reuse `match.rank`).
- Plans (deduplicated, max 3): `best_per_need` (top match of each need), `fewest_pickups` (fewest suppliers,
  then shortest total distance, then score), `lowest_cost`. One trip per supplier for distance and
  transport emissions. `fully_covered` is false if any line has `missing_quantity > 0`.
- New pure module `backend/plan.py` (no HTTP/DB). Search: top 6 full-coverage options per need, enumerate
  combinations (max 6^5), fall back to the best partial option when a need has none.
- Done when: tests for the demo request assert that Konyaalti appears as a one-pickup plan covering both
  needs and Lara + Konyaalti as the two-pickup plan; partial coverage is flagged; `tools/smoke.py` calls it.
- Fallback: ship `best_per_need` + `fewest_pickups` only.

**2.2 Shared-stock story made visible (45 min).** `/match/batch` already proves the optimiser. Add
`tools/demo_batch.py` that prints the COP31 side-events scenario as a table (per event: greedy vs
optimised lines, unmet units, distance) for the slide and for a "City view" screen if Sueda has time.
Optional: `objective: "score" | "distance"` for the MILP. No new claims: "in our demo scenario".

**2.3 LLM live and verified (45 min, with Sueda + Noé).** Noé sets `ANTHROPIC_API_KEY`,
`LLM_PROVIDER=anthropic`, `LLM_MODEL` in Render. Before relying on it: load the `claude-api` skill and
check the request in `ai/llm.py` against the current SDK (the `betas` / `fallbacks` / `output_config`
parameters have never run). Report findings to Sueda; she fixes her file. Suggest a small, cheap model
for parsing (Haiku 5.5 or Sonnet 5.5) since Noé asked for low cost.
Done when: deployed `/parse-request` returns `"parser": "llm"` for the demo sentence and
`/explain` returns `"explainer": "llm"`; with the key removed both still answer.

**2.4 AI evaluation numbers (60 min, proposal for Sueda; agent can write the harness in `backend/tools/`).**
`tools/ai_eval.py`: ~30 requests (English and Turkish, tidy and messy, some with unsupported items or
missing dates) with expected fields; run against the deployed API; print field-level accuracy for LLM vs
rules, and how many explanations were replaced because a number was not grounded. Put the REAL results
in the pitch ("x/30 requests parsed correctly; 0 ungrounded numbers shown"). If Turkish fails in the
rules parser, say so; do not hide it.

**2.5 Stretch, only if GATE 2 is green by Sun 15:00:** `POST /assist` in `ai/` (Sueda): the organiser
writes "too expensive" / "one pickup only" / "can it be a day later?" and the model, with tool calls
limited to `/plan`, returns an adjusted request plus a grounded explanation; fallback = `suggestions[]`.

**GATE 2 (Sun 15:00):** the deployed frontend runs text -> review -> results -> details against the live
API on a phone. If not, drop 2.2/2.4/2.5 and put every hour into the core journey.

### Phase 3 — make it unbreakable (prototype 20%)

**3.1 End-to-end checks on the deployed stack (60 min).** `tools/smoke.py` extended to `/plan`,
`/parse-request`, `/explain`, `/impact/methodology`. Manual script on phone + desktop: demo request, a
request with nothing available, a partial match, Supabase down (set a wrong `DATABASE_URL` on a
preview service or test locally) -> UI must show "offline demo data".
**3.2 Frontend review notes for Sueda (30 min, read-only).** Check that she shows: source badge,
missing quantity, `cost_note`, carbon range with "estimate" label and assumptions on demand, loading
state for a sleeping server, plan cards only from `/plan`.
**3.3 Backup demo (Noé/Sueda).** Record the full journey once the gate is green; keep demo mode fixtures
copied from real API responses.

### Phase 4 — pitch and submission (pitch 10%, and nothing may be wrong)

**4.1 `tools/pitch_numbers.py` (30 min).** Prints every figure used in slides and the form straight from the
code: demo request results, carbon range, batch scenario, test counts, sensitivity summary. Regenerate
after the last backend change; update `docs/BACKEND_PITCH_NOTES.md` from its output.
**4.2 Repo front page (30 min, proposal to Noé).** Root `README.md`: one-paragraph pitch, live links,
architecture sketch (web app -> one API -> engine / AI layer / Supabase), how to run, data sources and
licences, limitations, AI/tools disclosure.
**4.3 Submission form (Noé).** Built during the event vs before; AI tools, models and APIs used in the
PRODUCT and in DEVELOPMENT. The handbook requires disclosing AI-generated content; the team must fill
this in truthfully before submitting. Atay decides the wording with Noé.
**4.4 Demo script (20 min).** `docs/DEMO_SCRIPT.md`, 3 minutes: type the request (then one in Turkish) ->
review -> results with source badge -> why this option + carbon range + assumptions -> one-pickup vs
two-pickup plan -> three events sharing stock (greedy vs optimised) -> limits and next pilot step.

## 6. Decisions needed from people (ask today)

| # | Who | Question | Default if no answer |
|---|---|---|---|
| 1 | Noé | Render invite for atytmr07@gmail.com, or OK to deploy temporarily to Atay's workspace? | Temporary deploy at 19:00 |
| 2 | Noé | OK to add `/plan` (engine-computed whole-event plans) after the core flow works? | Build it Sunday morning, keep it out of the UI until he approves |
| 3 | Noé | Render plan for 16–18 Nov (free sleeps) and `.github/` CI + keep-warm workflow | Free plan + manual wake |
| 4 | Noé + Sueda | LLM model name and when the key goes into Render | Rules/templates only |
| 5 | Sueda | Accept new fields: carbon range, `priority`, `/plan`, `/impact/methodology` | Fields are optional; UI adopts what it can |
| 6 | Team | Wording of the AI-tools disclosure in the submission | Must be settled before Monday 09:00 |

## 7. Not doing (and why)

- Payments, reservations, accounts, route optimisation, real company data: out of scope (CLAUDE.md).
- Changing the demo seed (e.g. adding lights to the Lara hall): not needed, Konyaalti already covers both
  needs; it would also shift every tested and pitched number.
- Geocoding or maps APIs: preset locations are enough; a static map is Sueda's call.
- Training any ML model, or ranking by "CO2 avoided": no data to justify it; see the trap in 1.2.
- A supplier-side listing flow with writes: needs auth and a write role. Mention as a next step; at most
  show a mock in the pitch.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Render access never arrives | Temporary deploy on Atay's workspace (decision 1) |
| Server asleep or Supabase slow during judging | Task 0.2, keep-warm, wake `/health` before demos, JSON fallback with visible badge |
| LLM call fails live | Deterministic fallback already built; UI shows which one answered |
| Scope creep on Sunday | Gates 0 and 2, 19:00 feature freeze |
| Branch conflicts | Sueda rebases `feat/web-ai` on `main` once; she never edits `backend/`, we never edit `ai/` or `frontend/` |
| A wrong number in the pitch | Task 4.1; "estimated / illustrative / in our demo scenario" wording |
