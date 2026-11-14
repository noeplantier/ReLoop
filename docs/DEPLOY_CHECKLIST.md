# Deploy and demo checklist (Sun 15 Nov → Mon 16 Nov)

Tick in order. Commands run from `backend/` unless noted. Never paste a secret into chat, git or a screenshot.

Deadlines: phone journey **Sun 15:00** · feature freeze **Sun 19:00** · core development closes **Sun 23:59** ·
submission **Mon 16 Nov 12:00 TR** (handbook 10.1).

## A. As soon as Noé sends the Render URL (Atay, ~15 min)

- [ ] Service is on the latest `main` and CI is green for that commit (`gh run list -R noeplantier/ReLoop -L 1`).
- [ ] `https://<render>/health` (first call can take ~50 s):
      `status: ok` · `inventory_source: supabase` · `ai_layer: true` · `llm_enabled: false` · `commit` = latest main.
      If `json_fallback`: the DATABASE_URL in Render is wrong or old → ask Noé to re-paste the new one (not in the group).
- [ ] Smoke test: `python tools/smoke.py https://<render> --origin http://localhost:5173` → `RESULT: PASS`.
- [ ] `/parse-request` in the smoke output answers with `parser=rules` (AI layer mounted, no paid calls).
- [ ] Post in the group: URL, commit, PASS/FAIL, inventory source. On FAIL: the failing lines + Render log excerpt
      (no secrets).

## B. When the Vercel URL exists (Sueda / Noé, then Atay)

- [ ] Vercel env `VITE_API_URL=https://<render>` (no trailing slash), then redeploy the frontend.
- [ ] CORS from the real origin: `python tools/smoke.py https://<render> --origin https://<vercel-app>` → the
      `CORS preflight` line is `ok`. `*.vercel.app` is allowed already; a custom domain needs `CORS_ORIGINS` in Render.
- [ ] The app shows the "Live inventory" label (not "offline dataset" / "demo recorded results").

## C. Phone journey (target 15:00, whole team)

On a real phone, mobile data (not office Wi-Fi), with the live URLs:
- [ ] Type the demo request → review screen shows 50 chairs, 2 stage lights, 21–23 Nov, Lara, "standard rules" label.
- [ ] Edit something on the review screen (quantity, date) → results update accordingly.
- [ ] Results: chairs 3 of 7 options, lights 2; "Live inventory"; "not a combined package"; cost + "delivery and
      deposit not included".
- [ ] Details: reasons, things to check, carbon RANGE (≈96–956 kg for the banquet chairs), "How we calculate" opens.
- [ ] A request with nothing available (e.g. January) → clear empty state, no error.
- [ ] A partial request (400 chairs) → "partial match", missing units shown.
- [ ] Desktop browser: same journey once.
- [ ] Note anything broken with a screenshot → fix before 19:00, or drop the feature.

## D. Before 19:00 freeze (Atay)

- [ ] `python tools/pitch_numbers.py --out ../docs/PITCH_NUMBERS.md` (numbers in slides must match this file).
- [ ] If anything in `match.py` / `impact.py` / `impact_factors.json` changed: `python tools/export_demo_fixtures.py`,
      then `cd frontend && npm run sync:fixtures` (CI fails otherwise).
- [ ] If an AI provider was approved and a key set by Noé: `python tools/ai_eval.py https://<render> --set heldout
      --out ../docs/AI_EVAL_LLM.md` (slow on purpose: it respects the 10 AI requests/min limit), then set
      `AI_DAILY_LIMIT` in Render below the provider's free-tier daily limit.
- [ ] All tests green on `main` (CI) and `git status` clean. No new features after 19:00, fixes only.

## E. Recording and submission (Mon morning, Noé + Sueda; Atay on call)

- [ ] 5 min before recording: open `/health` until `ok` (wakes the free server), then follow `docs/DEMO_SCRIPT.md`.
- [ ] Record the backup video; keep a local copy; test playback inside the slides.
- [ ] Submission form fields (handbook 10.1): team + contact · description + climate problem + users · slides .pptx
      + PDF · live link (works without private accounts) · repo · AI tools / models / APIs / data / existing
      components (`docs/DISCLOSURE_DRAFT.md`, approved) · recorded demo · work done during the event, limitations,
      next validation step.
- [ ] Final check of every link in a private/incognito window. **Submit before 11:00**, not at 11:59.

## If something breaks

| Symptom | Likely cause | Fix |
|---|---|---|
| First request takes ~50 s | Free Render instance was asleep | Expected; open `/health` before demos |
| `inventory_source: json_fallback` | DB URL wrong/old, or Supabase unreachable | Check Render env; the app still works on the labelled offline dataset |
| Browser shows a CORS error | Frontend origin not allowed | Use `*.vercel.app`, or add the origin to `CORS_ORIGINS` and redeploy |
| `429 Too many requests` | Per-minute or daily AI limit | Wait a minute; raise `RATE_LIMIT_PER_MIN` / `AI_DAILY_LIMIT` in Render if needed |
| Render build fails | Dependency or Python version | Send Atay the build log; rehearsal passed on a fresh clone with the same commands |
| Everything down during judging | Network / host | Demo mode (labelled "Demo recorded results") or the recorded video |

After the event: Supabase pauses free projects after about a week without activity; open `/health` the day
before the 18 Nov final to be safe.
