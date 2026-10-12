# Plan P — Product Requirements Document (v1.1, hands-free)

> **Park effortlessly. Pitch confidently. Plan P's got you covered.**
> A hands-free voice copilot for the drive to your most important meeting: it lines up parking plans near the door, reads each curb from Google Street View, and rehearses your pitch on the way.

**Event:** Multi Model Hackathon, SF Tech Week, Sunday Oct 11 2026, Frontier Tower, San Francisco. Live demo this evening.
**Live:** https://getplanp.netlify.app/car · **Architecture:** [ARCHITECTURE.md](ARCHITECTURE.md) · **Submission:** [SUBMISSION.md](SUBMISSION.md) · **User story:** [idea.md](idea.md)

**History (2026-10-11):** morning, two modes (Park me with chairs, Park my car with a live camera). Afternoon, simplified to one mode over Google Street View (S1–S2b) with a voice copilot (S3–S4). Evening, the founder made it fully hands-free (S5): one button, four questions, one pitch score, and the curb colour at each plan decides the next step. Base44 added parking plans A–E, the arrival popup and Fundy.

---

## 1. The user (from idea.md)

**Nazar, a defense founder**, driving to a 1:1 with an investor in San Francisco at a set time and place. He has never been to SF, doesn't know where to park, must not be late, and hasn't had time to rehearse. He's stressed, and he's driving: he can't look at or touch the phone.

**Outcome:** he parks without circling, arrives on time, and walks in having rehearsed the pitch and fixed its weakest point.

## 2. The experience (built)

1. **Open Plan P, tap "🎙 Talk to Plan P".** The only control on screen.
2. **"Where are you headed?"** He says "2 South Park Street". Plan P sets the destination and finds the parking plans A–E (garages within a walk of the door, ranked by walk time).
3. **"I've found 5 places to park. The first is Brannan Square Garage, 3 minutes' walk. Let's go?"** He says yes; the drive starts: Street View photos in driving order, a minimap in the corner.
4. **On the way, four questions**, one at a time, no comments in between: *What do you do? What is the problem you're solving? What is your vision? Why are you the best team to do this?* The drive holds before the last photo until all four are answered, so the questions always come before Plan A.
5. **Claude scores the whole pitch** (1–10) with what landed and one fix; Plan P says it in two sentences, then where he's driving. Fundy, the pixel dino, grows with the score.
6. **At each plan, the colour of the last photo decides** (Claude's verdict on the curb):
   - **Green, free to park:** "Pull in and park here, 3 minutes' walk. Good luck."
   - **Red, can't park** (hydrant, red curb, bus stop, bike lane) or **orange, occupied:** a popup, and Plan P says why and takes him to the next plan, whose drive loads automatically.
7. **"I parked."** Done; walking directions to the door in Apple or Google Maps.

**Loud room or car:** a big **Mic on / Mic off** button. Mic off sends silence, so noise can't interrupt Plan P; tap it to answer. The voice session also filters noise and waits for a finished sentence before replying.

**Important:** Street View photos are not live (months or years old). The verdict says what the curb allows and what the photo showed; the driver's eyes confirm.

## 3. How we win (judging rubric)

| Criterion | Weight | How Plan P scores |
|---|---|---|
| Multi-model integration | **25%** | Three jobs, each to the model best at it, in one loop: **OpenAI Realtime** is the voice and drives the app through four tools; **Claude Opus 5.5** is the eyes (reads Street View photos, structured verdicts) and the judge (scores the spoken pitch, as an audited Anbaric agent). The voice's words go to Claude; Claude's verdicts and scores come back as speech. |
| Novel idea | 20% | Parking apps book garages; coaching apps want you at a desk. Plan P turns Street View into a curb-by-curb parking layer at each plan and turns the dead time of the drive into pitch rehearsal, hands-free. |
| Production-ready, economics | 15% | ≈ $0.45 per trip at list prices, falling with shared curb caching (§6). Typed code, 38 tests, keys server-side, a fallback for every external call, Prelint on every PR, Anbaric audit trail of every trip and score. |
| Demo under pressure | 20% | On stage, one tap and voice only: destination → "Let's go?" → four questions while the street rolls by → pitch score → red curb, "taking you to Plan B" → green, "park here". Mic off for a loud room. |
| Problem people care about | 20% | SF drivers lose 83 hours a year looking for parking (INRIX). Every founder knows the drive to a pitch: lost, late, unrehearsed. Founders and sales teams would pay $9.99/month. |

**Sponsors:** **Anbaric** hosts the trip engine (audited `trip` and `answer-review` jobs; Claude as the Anbaric agent `claude-coach`). **Base44** built plans A–E, the arrival popup, the spot list and Fundy on the same repo. **Prelint** reviews every pull request against this PRD and ARCHITECTURE.md.

## 4. Models

| Role | Model | Does | Fallback |
|---|---|---|---|
| **Voice** | OpenAI `gpt-realtime-2.1-mini` (+ `gpt-4o-mini-transcribe`) | Speech-to-speech copilot. Tools: `set_destination`, `start_drive`, `save_answer`, `i_parked`. | Error shown on screen; tap Talk again |
| **Eyes** | Claude `claude-opus-5-5`, effort low | Reads each Street View photo facing the curb: `free_to_park` / `cant_park` / `occupied`, kind, reason, box. | Server-side model fallbacks; garages remain the plan |
| **Judge** | Claude `claude-opus-5-5` as Anbaric agent `claude-coach` | Scores the four-answer pitch 1–10: what landed, one fix, with the founder's context. | Claude called directly after 13 s |

## 5. Sub-batches (each ended with a test the founder ran)

| # | Sub-batch | Status |
|---|---|---|
| S1 | One mode, address → route, garage chain A/B/C with walk minutes | ✓ |
| S2 | Street View parking layer: Claude marks each photo along the last stretch | ✓ |
| S2b | The demo route 995 Market St → 2 S Park St, precomputed and replayed instantly, iPhone first | ✓ |
| S3 | Voice copilot (OpenAI Realtime + tools) | ✓ |
| S4 | Voice and drive in sync; Claude scores answers; Anbaric trip engine | ✓ |
| **S5** | **Hands-free (founder's spec, evening):** only "Talk to Plan P"; voice sets the destination and asks "Let's go?"; four questions before Plan A; one score for the whole pitch; curb colour at each plan drives the next step (Base44 plans A–E + popup); Mic on/off; Fundy | ✓ live |
| S6 | Demo video, rehearsal (3 clean runs), submission | in progress |

**S5 test:** on the iPhone, tap Talk, say "2 South Park Street" → "found N places… Let's go?" → yes → banner "Driving to Plan A · Question 1 of 4" → answer four questions → "Pitch 7/10 · driving to Plan A" before the last photo → red: popup "Going to Plan B" and Plan P explains → green: "park here".

## 6. Unit economics (one trip, standard list prices)

| Step | Usage | Cost |
|---|---|---|
| OpenAI Realtime voice (mini) + transcription | ~10 min | ~$0.15 |
| Street View photos (Static API, $7 / 1,000) | 20 photos for one plan | ~$0.14 |
| Claude reads the photos (Opus 5.5, $4 / $20 per M tokens, effort low) | 20 photos | ~$0.13 |
| Claude scores the pitch | 1 call | ~$0.01 |
| **Typical trip** | one plan read live | **≈ $0.45** |
| Each extra plan (red/orange) | 20 photos + Claude | +$0.27 |

Curb verdicts belong to the street, so they're cached and shared by every driver (the demo route was read once for $0.63 and replays free). At $9.99/month, a heavy user (20 trips) costs ~$9 today, falling with caching.

## 7. Data

- **Garages:** 24 SF garages (`src/data/lots.ts`, made-up availability, hours, clearance and rules); plans A–E by walk to the meeting.
- **Curb verdicts:** from Google Street View photos read by Claude; not live availability.
- **Founder context:** from idea.md (multi-polar world, cost of destruction → zero, Ukrainian drone experience, 15,000 drones deployed, MOU with a Mercedes-owned company, raising $5M for the Black Manta unmanned helicopter).

## 8. Out of scope

Live space availability, payments/reservations, accounts, native app, cities other than SF, investor-specific questions (removed in S4: four fixed questions are faster and always relevant).

## 9. Risks

| Risk | What we do |
|---|---|
| Street View photos are old | Photo date on every frame; the verdict is a guide, the driver's eyes confirm |
| Google terms restrict extracting data from Street View | Fine for a hackathon demo; check before launch; Mapillary (open licence) is the alternative |
| Loud room interrupts the voice | Mic on/off button; noise reduction; semantic turn detection |
| Anbaric engine slow or down | Claude scores directly after 13 s |
| Live plan B–E loads slowly | Loading banner; the voice explains while it loads |

## 10. What we'd build next

Live availability (crowd-sourced from drivers' phones, SFMTA sensors, garage feeds), calendar integration (address, time and investor from the invite; fund-specific questions), reserving the backup garage, Fundy streaks across trips, CarPlay and Android Auto, more cities.
