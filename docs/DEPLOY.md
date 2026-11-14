# Deploying the backend (so judges get a public link)

## Status (14 Nov 2026)
- Supabase (shared team project, region Northeast Asia / Tokyo): migrations 0001–0004 and `seed.sql`
  applied. Checked: 5 suppliers, 5 categories, 30 items, 31 windows, 5 impact assumptions; RLS on for
  all 5 tables; `anon` / `authenticated` cannot read them. The project also holds other, unrelated
  tables; ReLoop's migrations do not touch them.
- Render: NOT deployed yet (waiting for access to the team workspace).
- After deploy: `python tools/smoke.py https://<service>.onrender.com --origin <frontend origin>`
  runs the main demo request and reports whether it used live Supabase or the offline fallback.

Needs: a free Render account connected to the GitHub repo, and the Supabase URL + service-role key.

1. Render > New > Blueprint > pick the repo (it reads `render.yaml`) or New Web Service with root dir `backend`.
2. Set environment variables in the Render dashboard (NOT in git):
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (optional: without them the API serves the built-in fictional JSON inventory)
   - `CORS_ORIGINS` = the deployed web app origin(s), comma separated (e.g. `https://reloop.vercel.app`). `*.vercel.app`, `*.netlify.app`, `*.onrender.com` are already allowed.
3. Check `https://<service>.onrender.com/health` returns `{"status":"ok","inventory_source":"supabase"}` (or `json_fallback`).
4. Free plan sleeps after ~15 min idle and the first request can take ~30-60 s. Before judging or recording the demo, open `/health` to wake it, and tell the frontend to show a loading state.
5. Docker alternative: `docker build -t reloop-api backend && docker run -p 8000:8000 --env-file backend/.env reloop-api`.

Security checklist: service-role key only in the server environment; never in the web app, git, logs or screenshots; the web app calls only this API. If a key leaks, rotate it in Supabase immediately.
