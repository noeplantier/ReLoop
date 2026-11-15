# Recording plan: demo video (shot list)

Turns `docs/DEMO_SCRIPT.md` (what to SAY, numbers, judge questions) into what to RECORD. Target: a 3-minute
video, recorded in one sitting once the public Vercel link opens in a private window. Narration: record the voice
yourself, or read it live while screen-recording. If AI voice, music or generated visuals are used, add them to
the disclosure (`docs/DISCLOSURE_DRAFT.md`).

Button and screen names below are the ones in the web app on `main` today (checked 15 Nov, rule-based parsing).

## 0. Before you press record (10 min)

- [ ] Public URL opens in a private/incognito window with no login. If it shows a Vercel login page, stop: the
      deployment protection is still on.
- [ ] Wake the free server: open `https://reloop-api-kdq2.onrender.com/health` until `"status": "ok"`, then check
      `"inventory_source": "supabase"`. Do it again right before each take (it sleeps after idle).
- [ ] Phone-size window (375 px wide) or a real phone, mirrored. Hide notifications, close other tabs, battery
      charged, do not disturb on.
- [ ] Clean state: private window, so no saved projects or old inputs appear.
- [ ] Rate limits are generous for a demo (60 requests/min, AI 10/min) but do not repeat takes in a loop.
- [ ] Run `python backend/tools/smoke.py <backend> --origin <vercel url> --expect-source supabase` first (Atay).
- [ ] Two slides ready: (A) three events, one chair stock, (B) limits and next step. Numbers from `docs/PITCH_NUMBERS.md`.

## 1. Shots (screen recording)

| Shot | Approx. time | Screen | Action | Must be visible on screen |
|---|---|---|---|---|
| 1 | 0:00-0:15 | Title/logo (slide or app header) | none | "ReLoop", the tagline |
| 2 | 0:15-0:30 | Start screen | tap "Try the Antalya demo request" (or type the sentence), then "Find reuse options" | the typed request: 50 chairs, 2 stage lights, Lara, 21-23 Nov |
| 3 | 0:30-0:50 | "Review your request" | scroll once; do not edit anything; tap "Confirm and search" | 50 chairs, 2 lighting, dates, Lara; the label "Read from your text with standard rules" |
| 4 | 0:50-1:15 | "Your reuse options", chairs | scroll slowly past the top 3 | "Live inventory" badge; Stackable banquet chairs, Demo Lara Event Hall (fictional), 50/50, TRY 1,800, "Delivery and deposit not included" |
| 5 | 1:15-1:35 | Lighting results | scroll to "2 stage lights" | Stage par lights LED, ~14.5 km, TRY 420; the line that options are separate offers, not a combined package |
| 6 | 1:35-2:05 | Details | tap "View details" on the best chairs; scroll through "Why this match?", "Things to check with the supplier", "Climate impact"; tap "How we calculate" | the carbon RANGE (95.6-956 kgCO2e), the words "Illustrative estimate" and "not measured or verified" |
| 7 | 2:05-2:30 | Slide A | none | first come first served 2/3 covered, 20 chairs short, 14.5 km; optimised 3/3, 0 short, 7.7 km. Say it is mathematical optimisation, in the backend, not in this app yet |
| 8 | 2:30-2:50 | Slide B | none | what is fictional, what is not built (accounts, supplier side, reservations, payments), next step: pilot with 2-3 Antalya venues |
| 9 | 2:50-3:00 | Logo | none | "Reuse made the easy choice, with honest numbers." |

Optional extra shots, ONLY if `feat/save-return` is merged, deployed and passed the phone test:
tap "Add to shortlist" on the best chairs, open the Shortlist page, reopen the page ("Continue where you left off"),
show "Availability re-checked" and the next step. Say "Saved in this browser" and "a shortlist is not a reservation".
Do not show the progress panel's points as an achievement; if shown, read "Concept, not redeemable" aloud.

## 2. Recording the offline fallback (10 s, optional, good for trust)

Only if you can do it cleanly: with the network off, run a search, show "Could not reach the server",
tap "Use demo inventory (fictional)", and show the label "Demo: recorded results (fictional)". It proves the
app does not fake live data. Skip it if it makes the video longer than 3 minutes.

## 3. Rules for the voice-over (from the team's decisions)

- Say "estimated" and "illustrative"; never "saved", "measured", "verified", "always", or a general percentage.
- Never say the upper carbon figure alone: always "about 96 to 956 kg", with the method one tap away.
- Say once that all inventory is fictional.
- AI: say what is true. At submission parsing is rule-based and explanations are templates; if the LLM is enabled
  later, say so only if the app shows it. Quote only the held-out parser result (14 of 20), never 30/30.
- Do not claim accounts, supplier onboarding, reservations or payments exist.

## 4. After recording

- [ ] Watch it once on a phone: is every number readable? Is the carbon range on screen long enough (3 s)?
- [ ] Captions (English), no secrets on screen (no tokens, no `.env`, no dashboard URLs, no personal data).
- [ ] Upload so that the link opens without an account; test it in a private window.
- [ ] Add the video link to `README.md` and the submission form; update the disclosure if AI voice or music was used.

## 5. If something breaks

| Problem | Do this |
|---|---|
| Vercel link asks for a login | Not recordable: ask Noé to disable Vercel Authentication; do not record from localhost for the submission |
| First search hangs about a minute | The free server was asleep. Cut the wait in editing or re-record after `/health` is ok |
| Badge says offline/fallback data | The database was unreachable. Say it aloud, or wait and re-record when `inventory_source` is `supabase` |
| A number differs from `docs/PITCH_NUMBERS.md` | Regenerate it (`backend/tools/pitch_numbers.py`) and use the file, not this plan |
