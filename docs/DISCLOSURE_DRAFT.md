# Disclosure (DRAFT for Noé's approval)

For the submission form ("AI tools, models, APIs, data sources and any existing components used";
"work completed during the event"; handbook 10.1 and 10.2). Items in `<...>` need a teammate's input.
Keep it short; everything below is checkable in the repository.

**Pre-existing work.** Before the event: a small (~90 lines) greedy-vs-optimisation prototype by Atay,
rewritten for ReLoop's data model during the event. `<Noé: logo / brand assets created before the event?>`
`<Sueda: anything pre-existing?>` Everything else was built during the event.

**Built during the event (14–15 Nov 2026).** Matching engine and API (FastAPI), database schema, rules and
fictional demo data (Supabase/Postgres), carbon estimate module, multi-event optimiser (MILP), request
limits, tests and evaluation tools (backend: Atay); AI layer for request parsing and grounded explanations,
and the mobile-first web app (Sueda); product scope, design direction, integration and deployment (Noé).

**AI used in the product (runtime).** At submission, no live LLM is used: runtime AI budget is zero.
Requests are parsed by a deterministic rule-based parser and explanations come from templates filled
with the engine's numbers; the interface says so ("Read with standard rules", "Standard explanation").
An optional LLM path exists in the code (`<Claude Haiku 5.5 via the Anthropic API / a Gemini free-tier
model: final choice>`), switched off unless a key is configured on the server. If enabled, its output is
validated in code (quantities must appear in the user's text; every number in an explanation must exist in
the engine data). Availability, ranking, prices and carbon figures are never produced by AI; the
multi-event optimiser is mathematical optimisation (MILP), not AI.

**AI tools used during development.** Backend, database and documentation: Claude Code (Anthropic) was
used to write, test and review code and documents under Atay's direction; all output was reviewed and
tested by the team. `<Sueda: tools used>` `<Noé: tools used, e.g. for the mockup / slides>`
AI-generated content in the submission: `<code and documentation partly AI-assisted as above; images or
mockups made with AI, if any>`.

**Data sources.** All inventory, suppliers and prices are fictional, created for this prototype; no real
company or personal data. Emission factors: UK Government GHG Conversion Factors for Company Reporting
2025 (DESNZ/Defra), Open Government Licence v3.0, used as a proxy for Türkiye.

**Carbon figures.** Scenario-based estimates, not measured or verified impact. Shown as a range: upper
bound (new items bought for this event alone) and conservative bound (new items would serve 10 events,
our assumption, no published source found), minus delivery and return transport. Item weights and
materials are estimates, so every figure is labelled illustrative. Method and factors: `GET
/impact/methodology` and `docs/PITCH_NUMBERS.md`.

**Open-source components.** FastAPI, Pydantic, Uvicorn, SciPy/HiGHS, NumPy, psycopg, supabase-py,
python-dotenv, PGlite (tests), React, Vite, TypeScript `<complete from frontend/package.json>`. Used under
their respective open-source licences. Repository licence: `<none declared / choose one>`.

**Evaluation status.** On 30 hand-written English test requests the rule-based parser read 20/30 fully
correctly; when unsure it leaves fields for the user to fill in rather than guessing. No explanation
contained a number missing from the engine data (0/8). The LLM path has not been evaluated live. The AI
layer is not described as validated.

**Limitations and next validation step.** Fictional inventory; availability is declared, not booked; no
payments or reservations; scoring weights are design choices. Next: a pilot with 2–3 Antalya venues using
their real inventory and real organiser requests, comparing reuse rate and delivery distance with what
they would otherwise have done.
