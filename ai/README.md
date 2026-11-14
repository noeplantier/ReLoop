# ai/ — request parsing and grounded explanations (Sueda)

Two endpoints as a FastAPI `APIRouter`. Contract: `docs/API_CONTRACT_REVIEW.md` (D5, D6).

| Endpoint | Does | Without an LLM |
|---|---|---|
| `POST /parse-request` | free text → `needs[]`, dates, preset location, requirements, `missing_fields`, `warnings` | rule-based parser (`rules.py`), `parser: "rules"` |
| `POST /explain` | `/match` results → `summary`, `reasons`, `things_to_check` per option (one batched call) | template from engine fields (`explain.py`), `explainer: "template"` |

## Safety rules (enforced in code, covered by tests)
- The LLM never decides feasibility, ranking, prices or CO2. Those come from the backend engine.
- Parsed quantities must appear in the user's text, otherwise the rules parser is used.
- Coordinates come only from the labelled preset list (`presets.py`); no geocoding, no guessed places.
- Every number in an LLM explanation must exist in the engine output; no percentages; CO2 must be called an
  estimate; words like "verified" or "guaranteed" are rejected. Failing text is replaced by the template.
- `avoided_kgco2e` and `things_to_check` are always copied/derived deterministically, never generated.
- User text and inventory names are treated as data; the prompts say so.

## Config (server-side env only)
```
LLM_PROVIDER=anthropic        # unset or anything else = no LLM calls at all
ANTHROPIC_API_KEY=...         # never in the web app, never committed
LLM_MODEL=claude-haiku-5-5    # optional override (default)
```
Cost controls: one call per submit, low effort, `max_tokens` 4000, 25 s timeout, 1 retry, 2-minute cache of
identical inputs, input capped at 1000 characters and 10 options. Raw user text is not logged.

## Backend integration (Atay)
```python
import sys, pathlib; sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from ai.router import router as ai_router
app.include_router(ai_router)
```
Plus `anthropic` in `backend/requirements.txt`. Render uses `rootDir: backend`; please confirm `../ai` is present
in the build there (otherwise we copy `ai/` into `backend/` at build time).

## Tests
```
python -m pytest -q ai/tests
```
21 tests: parser variants, LLM output validation (with a fake LLM), grounding checks, and an end-to-end run of
the demo request through Atay's unchanged `/match` on the offline JSON inventory.
Not tested yet: a real LLM call (no API key available).
