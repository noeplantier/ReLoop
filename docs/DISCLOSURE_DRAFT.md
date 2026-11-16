# Disclosure (DRAFT for Noé's approval)

For the submission form ("AI tools, models, APIs, data sources and any existing components used";
"work completed during the event"; handbook 10.1 and 10.2). Items in `<...>` need a teammate's input.
Keep it short; everything below is checkable in the repository.

**Pre-existing work.** Before the event: a small (~90 lines) greedy-vs-optimisation prototype by Atay,
rewritten for ReLoop's data model during the event. The ReLoop logo and brand assets were created by Noé Plantier before the event.
Sueda reported no pre-existing work. Everything else was built during the event.

**Built during the event (14–15 Nov 2026).** Matching engine and API (FastAPI), database schema, rules and
fictional demo data (Supabase/Postgres), carbon estimate module, multi-event optimiser (MILP), request
limits, tests and evaluation tools (backend: Atay); AI layer for request parsing and grounded explanations,
and the mobile-first web app (Sueda); product scope, design direction, integration and deployment (Noé).

**AI used in the product (runtime).** At submission, no live LLM is used: runtime AI budget is zero.
Requests are parsed by a deterministic rule-based parser and explanations come from templates filled
with the engine's numbers; the interface says so ("Read with standard rules", "Standard explanation").
An optional LLM path exists in the code (Claude Haiku 5.5 via the Anthropic API is the default model in
`ai/llm.py`; no other provider is wired in), switched off unless both `LLM_PROVIDER=anthropic` and an API key are
configured on the server. The optional LLM path remains disabled at submission; no live LLM is used.
Server limits cap any such use at 10 AI requests per minute per client and 300 per day overall. If enabled, its output is
validated in code (quantities must appear in the user's text; every number in an explanation must exist in
the engine data). Availability, ranking, prices and carbon figures are never produced by AI; the
multi-event optimiser is mathematical optimisation (MILP), not AI.

**AI tools used during development.**

Backend, database and documentation: Claude Code (Anthropic) was used to write, test and review code and documents under Atay’s direction; all output was reviewed and tested by the team.

Web application: Claude Code (Anthropic, Claude Opus 5.5) was used under Sueda’s direction for the `ai/` module and tests; Sueda’s frontend work, including screens, styles, demo mode, save/return, progress panel, landing page and date/dropdown fixes; the API-contract review document; and the pitch deck content, layout and speaker notes in Claude Slides. Sueda directed and approved each change, tested the app on an iPhone, and Atay reviewed the code before CI and merge.

Web app redesign (16 Nov, PRs #6–#14: visual system, results carousel, offer flow, My ReLoop hub, badges and celebrations, profile on this device): Claude Code (Anthropic) wrote and browser-tested the code under Noé’s direction; the team reviewed and merged it. The equipment pictures and reward concept art are SVG illustrations drawn in code, not AI-generated images or photos.

Pitch deck: created in Claude Slides. All figures were taken from Atay’s engine-generated files.

Noé used Perplexity for research, product-direction drafting and team communication. It was not used to generate the application code, logo, demo video, slides or product artwork.

The hero illustration is an SVG drawn in code, not an AI-generated image or photo. The colour palette was sampled from the existing ReLoop logo; the logo mark was cropped from that asset, not generated.

No AI-generated images, mockups, logo assets or video narration/music were used. The demo video was not produced by Sueda.

**Data sources.** All inventory, suppliers and prices are fictional, created for this prototype; no real
company or personal data. Emission factors: UK Government GHG Conversion Factors for Company Reporting
2025 (DESNZ/Defra), Open Government Licence v3.0, used as a proxy for Türkiye.

**Carbon figures.** Scenario-based estimates, not measured or verified impact. Shown as a range: upper
bound (new items bought for this event alone) and conservative bound (new items would serve 10 events,
our assumption, no published source found), minus delivery and return transport. Item weights and
materials are estimates, so every figure is labelled illustrative. Method and factors: `GET
/impact/methodology` and `docs/PITCH_NUMBERS.md`.

**Open-source components.** FastAPI, Pydantic, Uvicorn, SciPy/HiGHS, NumPy, psycopg, supabase-py,
python-dotenv, Anthropic SDK (only used if the LLM is enabled), PGlite (database tests), pytest, httpx, React 18,
Vite 6, TypeScript 5 (from `backend/requirements.txt`, `ai/requirements.txt`, `frontend/package.json`,
`supabase/tests/package.json`). Used under their respective open-source licences.
- Plus Jakarta Sans, loaded from Google Fonts, under the SIL Open Font License 1.1; not bundled in the repository.
- UK Government GHG Conversion Factors for Company Reporting 2025 (DESNZ/Defra), used under the Open Government Licence v3.0, with attribution retained.

Repository licence: MIT License. All team contributors have agreed to release the project under MIT.

**Evaluation status.** On 20 held-out English test requests (written after the parser was tuned and not
used for tuning) the rule-based parser read 14/20 fully correctly; when unsure it left the field for the user
or showed a warning, and it never invented a value. On the 30 cases it was tuned on it scores 30/30, which is
not an independent result. No explanation contained a number missing from the engine data. The LLM path has
not been evaluated live. The AI layer is not described as validated (`docs/AI_EVAL_RULES.md`).

**Limitations and next validation step.** Fictional inventory; availability is declared, not booked; no
payments or reservations; scoring weights are design choices. Next: a pilot with 2–3 Antalya venues using
their real inventory and real organiser requests, comparing reuse rate and delivery distance with what
they would otherwise have done.
