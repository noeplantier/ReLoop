# ReLoop: AI-powered equipment reuse for sustainable events

ATOX "AI for Climate" hackathon. Build 14-15 Nov 2026 (core dev closes 15 Nov 23:59 TR). SUBMISSION Mon 16 Nov 12:00 TR. Showcase 18 Nov, Antalya.
Judging: climate relevance 30%, AI integration 20%, prototype 20%, innovation 20%, pitch 10%.
Submission needs a working prototype LINK that works without private accounts, repo, AI/tools disclosure, recorded demo.

## Ownership
- Atay: `backend/` and `supabase/` (this repo checkout). Matching engine, FastAPI, schema, seed, API contract.
- Sueda: client app and AI module (request parsing, explanations), pitch. Noé: product scope, integration, submission.
- Do not edit other people's folders. Agree the API contract with Sueda before changing it.

## Rules
- Atay writes Turkish: reply in Turkish. Code, comments, docs, commits: English.
- Say plainly what is untested. Never invent numbers (CO2 factors, savings). Illustrative values must be labelled.
- `match.py` and `impact.py` are pure Python (no HTTP/DB). `main.py` is thin. `inventory.py` loads Supabase with JSON fallback.
- All demo data is fictional. Never commit `.env`. Service-role key is backend only.
- Out of scope: payments, reservations, route optimisation, real company data.
- MILP batch is a stretch goal, only after the full demo works.

## Commands
```
cd backend && venv\Scripts\activate && python -m pytest -q && uvicorn main:app --reload
```
See docs/BACKEND.md and docs/API_CONTRACT.md.
