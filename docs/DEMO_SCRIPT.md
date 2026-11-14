# Demo script (3 minutes, live or recorded)

For the recorded demo video (submission) and the showcase on 18 Nov. Every number below comes from
`docs/PITCH_NUMBERS.md` (generated from the code); if they differ, regenerate that file and use it.
All inventory is fictional; say so once, at the start.

## Before you start (5 min before)

1. Open `https://<backend>/health` and wait for `"status": "ok"` (the free server sleeps; first call ~50 s).
   Check `"inventory_source": "supabase"`. If it says `json_fallback`, the demo still works: the UI shows
   the "offline demo data" badge, so say it out loud instead of hiding it.
2. Open the web app on a phone-sized window (or a real phone, screen-mirrored).
3. Plan B if the network fails: the app's demo mode (explicitly labelled), or the recorded video.
4. Have one slide ready with the three-events table (step 7) and one with limits + next step (step 8).

## Script

| # | Time | Show | Say (key line) |
|---|---|---|---|
| 1 | 0:00 | Title screen | "Every event in Antalya buys chairs, lights and stages that already exist across the city, used once and stored. Making them new is the emissions. ReLoop finds what already exists, nearby, for your dates." |
| 2 | 0:15 | Type: *I need 50 chairs and 2 stage lights near Lara, Antalya, from 21 to 23 November 2026.* (or tap "Try the Antalya demo request") | "You just describe what you need, in plain words." |
| 3 | 0:30 | Review screen: 50 chairs, 2 stage lights, 21–23 Nov, Lara (demo preset), label "Read by AI" or "standard rules" | "AI turns the text into a request, and you check it. It never guesses: anything it cannot read, it asks. Here it got everything." |
| 4 | 0:50 | Results, chairs: 7 eligible options, top 3 shown. Best: Stackable banquet chairs, Demo Lara Event Hall, 0 km, 50/50, TRY 1,800 for 3 days, "Delivery and deposit not included". Source badge. | "These are real availability checks: the whole date range, enough stock, loan or rental only. The badge says this came from our live database." |
| 5 | 1:15 | Lighting: 2 options. Best: Stage par lights LED, Konyaalti, 14.5 km, 2/2, TRY 420. Point at "not a combined package". | "Chairs and lights are separate offers. We never pretend one supplier covers everything unless the engine checked it." (If `/plan` is approved and in the UI: "And here the engine found one supplier, Konyaalti, that covers both: one pickup.") |
| 6 | 1:35 | Tap "View details" on the best chairs: reasons, things to check, Climate impact with the range, then "View assumptions" | "Why this option: closest, excellent condition, fair price. The climate estimate is a range: about 96 to 956 kg CO2e avoided versus buying new chairs, from UK government factors, and every assumption is one tap away. Illustrative, because the item weights are estimates. We show our working instead of a big green number." Optional: whole request ≈ 99–990 kg CO2e. |
| 7 | 2:05 | Slide: three events, one chair stock (first come, first served: 2/3 events covered, 20 chairs short, 14.5 km; optimised: 3/3 covered, 0 short, 7.7 km) | "When several events want the same stock, first come first served leaves someone short. Our optimiser plans them together: in our demo scenario, every event is covered and pickups drop from 14.5 to 7.7 km. That is mathematical optimisation, not AI, and we say which is which." |
| 8 | 2:30 | Slide: limits + next step | "What is honest to say: the data is fictional, availability is declared not booked, carbon uses UK factors as a proxy. Next: a pilot with 2–3 Antalya venues, real inventory, and real organiser requests." |
| 9 | 2:50 | Logo | "ReLoop: reuse made the easy choice, with honest numbers." |

## Numbers you may say (and how)

| Claim | Wording |
|---|---|
| 50 chairs, Lara hall | "about 96 to 956 kg CO2e avoided, estimated" (95.6–956.0 in the file) |
| Whole demo request (top option per need) | "roughly 100 to 1,000 kg CO2e, estimated" (98.95–989.87) |
| Three events | "in our demo scenario: all three covered instead of two, 7.7 instead of 14.5 km" |
| AI parsing | only the measured result from `docs/AI_EVAL_*.md`, e.g. "20 of 30 test requests fully correct with the rule fallback; it never invented a value, it asked". Quote the LLM figure only once `docs/AI_EVAL_LLM.md` exists. |
| Robustness | "small changes to the scoring weights keep the first recommendation in about 94% of cases" |

Never say: "saved", "measured", "verified", "always", or a percentage improvement in general.

## Likely judge questions

- **Where do the carbon numbers come from?** UK Government GHG Conversion Factors 2025 (DESNZ/Defra, Open
  Government Licence): material production per tonne and road freight per tonne-km. Item weights are our
  estimates for fictional items, so results are labelled illustrative. The "How we calculate" view shows it all.
- **Why a range?** Upper: the new items would be bought for this event alone. Conservative: they would serve
  about 10 events (our assumption; we found no published figure), so this event gets a tenth.
- **What does the AI do, exactly?** Reads free text into a structured request and writes explanations. It
  never decides availability, prices, ranking or carbon; numbers in explanations are checked against the
  engine and replaced if they don't match.
- **Is this real data?** No, fictional suppliers and stock. The pilot is the next step.
- **Why not rank by CO2?** Heavier items would always win, which rewards the wrong thing. The climate win
  is reuse versus new; between reuse options, shorter trips are what we optimise.
