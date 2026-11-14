# Demo fixtures (generated, do not edit)

Real `/match` responses from the backend engine, on the fictional demo inventory with the LLM off.
Made by `python tools/export_demo_fixtures.py` (run from `backend/`). The backend test suite fails
when these files no longer match the engine, so they cannot silently drift.

| File | What | Use in the web app |
|---|---|---|
| `demo_scenarios.json` | Full, unmodified responses for 8 scenarios (main demo request: chairs + lighting, 200 chairs Konyaalti, partial match, no options, priority = cheapest, tables Belek, filters), plus `/impact/summary` for the main demo and `/impact/methodology` | Demo mode can show these exactly as the live API would (`inventory_source` is `json_fallback`: label it "Demo inventory (fictional)") |
| `match_golden.json` | Key numbers of `/match` for 480 requests: 5 categories x 6 location presets x 4 date ranges x 4 quantities. Key: `category\|preset\|start_date\|end_date\|quantity` | Parity test for any other implementation (e.g. a browser copy of the engine): same inputs must give these outputs. Test-only; keep it out of the app bundle |

`meta.backend_commit` says which backend version produced them. To include `/parse-request` and
`/explain` outputs (needs the `ai/` package), run `python tools/export_demo_fixtures.py --ai ..`.
