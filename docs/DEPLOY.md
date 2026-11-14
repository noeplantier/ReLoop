# Deploying the backend (so judges get a public link)

## Status (14 Nov 2026)
- Supabase (shared team project, region Northeast Asia / Tokyo): migrations 0001–0004 and `seed.sql`
  applied. Checked: 5 suppliers, 5 categories, 30 items, 31 windows, 5 impact assumptions; RLS on for
  all 5 tables; `anon` / `authenticated` cannot read them. The project also holds other, unrelated
  tables; ReLoop's migrations do not touch them.
- Read-only role `reloop_reader` (migration 0005) created on Supabase. Checked live: it can SELECT
  the 5 ReLoop tables only; the other 25 tables/views in the project (staff, payroll, ...) are not
  readable; no insert/update/delete; no RLS bypass. Password set by the team (not in git). Verified locally: the API reads the live inventory as
  reloop_reader through the transaction pooler (5/5/30/31, ~3.6 s cold) and `tools/smoke.py` passes with
  `inventory_source: supabase`.
- Render: NOT deployed yet (waiting for access to the team workspace).

## Connecting the API with the read-only role (preferred over the service-role key)
1. A team member sets the password once, in Supabase > SQL editor (never in git or chat):
   `alter role reloop_reader with password '<long random password>';`
2. Supabase > Connect > "Transaction pooler": copy the URI, then replace the user `postgres.<ref>`
   with `reloop_reader.<ref>` and the password with the one from step 1. Shape:
   `postgresql://reloop_reader.<ref>:<password>@<pooler-host>:6543/postgres`
3. Put it in Render as `DATABASE_URL` (and in `backend/.env` for local runs). Leave
   `SUPABASE_SERVICE_ROLE_KEY` empty: then no key that can read other apps' tables is on the server.
4. `/health` must say `"inventory_source": "supabase"`; if the URL is wrong the API serves the
   JSON fallback and says `json_fallback`.
- After deploy: `python tools/smoke.py https://<service>.onrender.com --origin <frontend origin>`
  runs the main demo request and reports whether it used live Supabase or the offline fallback.

Needs: access to the team's Render workspace (GitHub repo connected) and the `DATABASE_URL` above.

1. Render > New > Blueprint > pick the repo (it reads `render.yaml`). Manual alternative: New Web Service, root
   directory EMPTY (repo root, because `ai/` sits next to `backend/`), build `pip install -r backend/requirements.txt
   && if [ -f ai/requirements.txt ]; then pip install -r ai/requirements.txt; fi`, start
   `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`, health check `/health`.
2. Set environment variables in the Render dashboard (NOT in git):
   - `DATABASE_URL` (preferred, read-only role, see above), or `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (fallback). With none of them the API serves the built-in fictional JSON inventory.
   - `CORS_ORIGINS` = the deployed web app origin(s), comma separated (e.g. `https://reloop.vercel.app`). `*.vercel.app`, `*.netlify.app`, `*.onrender.com` are already allowed.
3. Check `https://<service>.onrender.com/health` returns `{"status":"ok","inventory_source":"supabase"}` (or `json_fallback`).
4. Free plan sleeps after ~15 min idle and the first request can take ~30-60 s. Before judging or recording the demo, open `/health` to wake it, and tell the frontend to show a loading state.
5. Docker alternative: `docker build -t reloop-api backend && docker run -p 8000:8000 --env-file backend/.env reloop-api`.

Security checklist: service-role key only in the server environment; never in the web app, git, logs or screenshots; the web app calls only this API. If a key leaks, rotate it in Supabase immediately.
