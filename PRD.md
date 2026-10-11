# Plan P — Product Requirements Document (Vertical Slice v0.3)

> **One line:** When your parking plan falls apart, Plan P already has a backup ready. It sees which spots are taken, tells you where to go next, and reroutes you without you touching the phone.

**Event:** Multi Model Hackathon, SF Tech Week, Sunday Oct 11 2026, Frontier Tower, San Francisco. Live demo this evening.
**Theme:** multi-model AI systems that combine models, providers, agents and modalities.
**Architecture details:** [ARCHITECTURE.md](ARCHITECTURE.md). **Submission draft:** [SUBMISSION.md](SUBMISSION.md).

### Two modes

| Mode | What it does | Role in the demo |
|---|---|---|
| **Park me** | A phone on a stand watches a room, finds every chair, sees which are taken, and walks you to a free one: Plan A, B, C. If someone takes your chair first, it reroutes you. | **The live wow on stage.** Chairs are parking spaces, and the audience watches it happen. |
| **Park my car** | Builds a backup chain of SF garages near your meeting, draws it as one "snake" route, and reroutes you hands-free when a lot is full. | **The product.** Shown on the map, plus a short video filmed on real streets. |

Both modes share the same engine: a backup chain (A → B → C), a camera that sees what's free, a planner that picks and explains, and a voice that tells you. Park me also shows how Plan P gets **real availability data** later: any camera looking over a parking lot becomes a space sensor, exactly like the phone looking over the chairs.

---

## 0. How we win (read this first)

### 0.1 Judging rubric and our answer to each

| Criterion | Weight | What judges look for | How Plan P scores |
|---|---|---|---|
| Multi-model integration is essential | **25%** | Each model chosen for its strength; integration unlocks something no single model can do | **Six models from three providers, plus one running on the phone itself.** On-device detector finds chairs and people 15 times a second (free, instant). Gemini Flash understands the scene (a bag on a chair means taken) and recognises whether the person who just sat down is you. Claude Opus 5.5 picks and explains the backup chain. Claude Haiku 5.5 turns speech into an action in under a second. OpenAI transcribes and speaks. Take any one out and the hands-free reroute breaks. |
| Novel idea, clear differentiation | 20% | Real problem solved a new way, not a remix | Parking apps (SpotHero, ParkWhiz, Google Maps) help you **before** you arrive. Plan P handles the moment the plan **fails on the way**: a backup chain that's already planned, and a camera that knows when Plan A is gone. |
| Production-ready, economically viable | 15% | Clean code, manageable dependencies, unit economics work at standard API prices | About **$0.12 per car trip** and **$0.08 per Park me session** at list prices (§10). The fast detector runs free on the phone; the expensive models run only when something changes. Every AI step has a non-AI fallback. Unit tests, pull requests reviewed by Prelint. |
| Compelling demo under pressure | 20% | Works end to end; the killer feature is obvious | Live in the room: the phone finds the chairs, you say "find me a spot", Plan P says *"Plan A: second row, left, about six steps."* A friend steals that chair while you walk. *"Plan A just got taken. Heading to Plan B."* You sit. *"Great landing."* An on-screen **model trace** shows which model did what, how fast, and for how much. |
| Solves a problem people care about | 20% | Need is real and urgent; someone would pay | SF drivers lose **83 hours a year** hunting for parking. **More than 4 in 10** Americans have missed an appointment because they couldn't park (INRIX). Everyone in the room has circled a full garage before a meeting. |

### 0.2 What we must submit

| Field | Required | Our plan |
|---|---|---|
| Project name | yes | Plan P |
| Pitch (1–2 sentences) | yes | Draft in [SUBMISSION.md](SUBMISSION.md) |
| Code repository | yes | github.com/hre4anyk/PlanP. Judges check that **the code runs** and **uses multiple models**, so the README must show how to run it and where each model is called. |
| Demo (video or live URL) | yes | **Both**: the live Netlify link plus a 4-minute video (Park me in a real room, Park my car on real SF streets; script in §13) |
| Models used and why | yes | §6, copied into the form |
| Why multiple models beat multiple apps | yes | §6.3 |
| Team contributions | yes | Solo |
| What would you build next | optional | §16. Answer it: it feeds the "production-ready" score |

### 0.3 Sponsors and how we use them

| Sponsor | What it is | Decision |
|---|---|---|
| **Prelint** | Reviews each pull request against your ADRs and docs for "product drift" | **Use it.** Each build batch goes in as a pull request; Prelint checks it against this PRD and [ARCHITECTURE.md](ARCHITECTURE.md). |
| **Anbaric** | Auth, team management, audit trails, hosting, agents. Promo `SFTW26` = 3 months free hosting. Top 3 teams get 6 months. | **Not in the slice.** We already have login (Clerk) and hosting (Netlify) working. Post-hackathon option for fleets. |
| **Base44** | No-code prompt-to-app builder (Wix) | **Not used.** We already have a coded app. |

---

## 1. The problem (plain language)

You're driving to an important meeting in San Francisco. You know where you'll park. You get there and the lot is full.

Now you're circling, checking the clock, getting more stressed. You can't search on your phone because you're driving. Every wrong turn makes you later.

- SF drivers spend about **83 hours a year** looking for parking (INRIX).
- More than **4 in 10** Americans have missed an appointment because they couldn't park (INRIX survey).
- Today's parking apps help you **plan ahead**. Nothing helps when **the plan fails on the way**.

## 2. The solution

Before you go, Plan P lines up a **backup chain**: **Plan A → Plan B → Plan C**. When Plan A is gone, you don't search again. You just go to Plan B.

Plan P works like a co-pilot with eyes, ears and a voice:

- **It sees.** A camera knows which spots are free and notices the moment one gets taken.
- **It hears.** Say "find me a spot" or "it's full". No tapping.
- **It thinks.** It picks the best order (walk time, price, closing time, height limit, rules) and says why in one sentence.
- **It speaks.** *"Plan A is full. Heading to Plan B: Sutter-Stockton. Four-minute walk."*

A big button is always there as a backup for when the camera or microphone can't help.

## 3. Who it's for

**Primary user:** A busy professional driving to a meeting in an unfamiliar part of San Francisco, on a tight schedule, already stressed.

**Demo audience:** Hackathon judges and investors, watching live and on video.

## 4. Goal of this vertical slice

Build the thinnest working version of **both modes**, end to end, today:

- **Park me:** phone on a stand → scan the room → "find me a spot" → Plan A/B/C chairs with distance → someone takes Plan A → reroute to Plan B → you sit → "Great landing".
- **Park my car:** say or pick a meeting → Claude builds the A → B → C garage chain with reasons → snake route → "it's full" (voice or tap) → spoken reroute in under 2 seconds → open directions in Apple/Google Maps.

## 5. Key decisions

| Topic | Decision |
|---|---|
| Platform | Web app in the phone's browser (iPhone 13, Safari). Also works on a laptop. |
| Park me camera | iPhone **on a fixed stand** near the door, rear camera facing the room. Fixed means chairs don't move in the picture, which keeps detection simple. |
| Who is "me" in Park me | At the start you stand in front of the camera; Gemini notes your **clothing** (e.g. "black hoodie, white sneakers"). **No face recognition**, nothing stored. |
| Distance to a chair | Estimated from how big the chair looks in the picture. Rough (±30%), so shown as **steps** ("about six steps") plus left/right/ahead. |
| Car parking data | **Fake data**: 12 real SF garages with made-up availability and rules |
| How we know a lot is full (car) | **Voice** ("it's full") or the **big button**. Reading garage signs with the camera is a stretch goal (F15). |
| Who plans the chain | **Claude Opus 5.5**, given distances computed by our own code. Falls back to "closest first" if the AI fails. |
| Map, routes | OpenStreetMap via Leaflet; OSRM public server for driving routes. Free, no keys. |
| Framework and hosting | **Reused**: Next.js 16, Tailwind + shadcn/ui, Clerk, Supabase, Netlify |
| AI keys | Server only (Next.js route handlers). The browser never sees a key. |
| Showing the phone to the room | Mirror the iPhone to the Mac with AirPlay, Mac on the projector |

## 6. Models used and why

### 6.1 The models

| Job | Model (provider) | Why this model for this job | If it fails |
|---|---|---|---|
| **Fast eyes**: find chairs and people in every frame | **EfficientDet-Lite0 via MediaPipe** (Google, open model, runs **on the phone**) | Needs to run 10–20 times a second with no lag and no cost. A small on-device model does that; a cloud model can't. It knows "chair" and "person", which is all occupancy needs. | n/a (core; if the camera fails we show the car mode) |
| **Smart eyes**: understand the scene and recognise you | **Gemini 2.5 Flash** (Google) | The small detector can't tell that a bag on a chair means "taken", or whether the person who just sat down is you or a stranger. Gemini can, quickly and cheaply, so we call it only when something changes, never every frame. | Taken = person in chair only; "Was that you?" with two big buttons |
| **Brain**: pick and re-plan the backup chain | **Claude Opus 5.5** (Anthropic) | The one hard reasoning step. For chairs: closest, not blocked, matches what you asked ("near the exit", "not the front row"). For garages: walk time vs. price, closing time vs. meeting length, height clearance, permit rules. Explains each pick in one sentence. Runs once per plan, so its higher price barely matters. | Closest-first ranking |
| **Reflex**: turn a voice command into an action | **Claude Haiku 5.5** (Anthropic) | Answers in well under a second for almost nothing ($0.10 per million input tokens). Maps "find me a spot near the window", "ugh it's full" or "where am I going?" to one of a few actions. | Keyword match |
| **Ears**: speech to text | **gpt-4o-mini-transcribe** (OpenAI) | Handles background noise and short commands at about $0.003 per minute. Reuses our existing OpenAI key. | Browser speech recognition, then buttons |
| **Voice**: text to speech | **gpt-4o-mini-tts** (OpenAI) | Natural voice that can be told to sound calm (car) or playful ("Great landing"). About $0.015 per minute. | Browser built-in voice |

Model IDs live in one config file ([ARCHITECTURE.md §4](ARCHITECTURE.md)) so any of them can be swapped in one line.

### 6.2 How they work together: the chair thief

```
every frame   phone camera ──► on-device detector ──► chairs + people boxes ──► seat map (free / taken)
                                                                   │
on "find me a spot"  mic ──► OpenAI transcribe ──► Haiku 5.5 ──► { action: find_spot, wish: "near the window" }
                                                                   ▼
                                     Claude Opus 5.5 picks Plan A, B, C + one-line reasons
                                                                   │
                                     OpenAI TTS: "Plan A: second row, left, about six steps"
                                                                   │
someone sits in Plan A ──► detector: chair A now has a person ──► Gemini: "Is this the driver?" ──► no
                                                                   ▼
               snake head moves to Plan B instantly + TTS: "Plan A just got taken. Heading to Plan B."
                                                                   │
you sit in Plan B ──► detector ──► Gemini: "Is this the driver?" ──► yes ──► TTS: "Great landing."
```

### 6.3 Why multiple models beat multiple apps

The value is in the **hand-off between models, inside one loop that runs in a couple of seconds**:

1. **Fast isn't smart, smart isn't fast.** The on-device detector sees a person on chair A 15 times a second, but can't tell if it's you. Gemini can tell, but is too slow and costly to run on every frame. Together: the detector notices the change instantly, and Gemini is asked one precise question only at that moment.
2. **Seeing isn't deciding.** Gemini can see that chair A is taken or that a garage says "monthly permits only 7–10am". Only the planner, which knows what you asked for, the time and your meeting, decides what to do next and explains it.
3. **Deciding isn't helping.** The best plan is useless if a driver has to read a screen. Speech in and speech out close the loop with eyes on the road.
4. **Each model runs where it's cheapest.** Free on-device detection for every frame, cheap Gemini and Haiku for frequent questions, and Opus only for the rare hard decision. Opus for everything would be slow and expensive; a small model for everything would make bad choices.

## 7. User flows

### 7.1 Park me (live on stage)

1. **Set up.** Phone on a stand near the door, rear camera on the room. Open Plan P → **Park me**. Boxes appear over every chair: green = free, red = taken.
2. **"This is me."** You stand in front of the camera for 2 seconds. Plan P: *"Got you: black hoodie, white sneakers."*
3. **"Find me a spot"**, spoken or tapped, optionally with a wish: "near the window".
4. **The chain.** Claude labels three free chairs **A, B, C** on the video, with a reason each. Plan P speaks: *"Plan A: second row, left, about six steps."*
5. **You walk.** The camera keeps watching.
6. **The chair thief.** A friend sits in Plan A first. The detector sees a person on chair A, Gemini confirms it's not you, and:
   - chair A turns red with a ✕,
   - the highlight jumps to Plan B,
   - Plan P speaks: *"Plan A just got taken. Heading to Plan B, three steps to your right."*
7. **You sit in Plan B.** Gemini confirms it's you. *"Great landing. You're parked."* Success screen, plus the model trace.
8. **Every chair taken (edge case).** *"This lot is full. Plan B is the room next door."*

### 7.2 Park my car

1. **Open Park my car.** A map of San Francisco with parking garages shown as pins.
2. **Say or choose where you're going.** "Investor meeting at Frontier Tower, two o'clock, about an hour." Or pick a preset, or tap the map.
3. **Choose where you're starting.** Preset demo start, or "Use my location".
4. **Tap "Plan my parking".** Claude picks the 3 best lots, labelled **A, B, C**, each with a one-line reason (*"Closest walk, open past your meeting"*).
5. **See the snake.** One driving route: Start → A → B → C. Current segment bright, backups faded.
6. **Drive (or simulate driving).** A car icon moves toward Plan A.
7. **Plan A is full.** Say "It's full" or tap the big red button. Plan A gets a red ✕, the snake head moves to Plan B, and Plan P speaks: *"No problem. Heading to Plan B: Sutter-Stockton Garage. 3 min drive, 4 min walk."*
8. **Open in Maps** for turn-by-turn directions to the current lot.
9. **Parked.** "I parked" → walking time to the meeting and a success screen.
10. **Every lot full (edge case).** The snake grows: Plan D, E, F get added.

## 8. Features and acceptance criteria

### Park me

**F1. Live camera with chair and person detection**
- Rear camera fills the screen. The on-device detector runs on every frame it can (target ≥ 10 per second on iPhone 13) and draws boxes around chairs.
- Because the phone is fixed, a 2-second **room scan** locks in chair positions and gives each a stable ID. Later frames only check which chairs have a person on them.
- A chair is **taken** when a person's box covers it for at least 1 second, **free** after 2 seconds without one (stops flicker).
- **Done when:** on the deployed link on an iPhone 13, chairs in a real room show green or red correctly as people sit and stand.

**F2. "This is me"**
- One frame of the driver is sent to Gemini, which returns a short clothing description. Shown on screen and spoken. Held in memory only for the session.
- **Done when:** the description matches what you're wearing.

**F3. Seat chain (A/B/C) with distance**
- Distance per free chair estimated from its size in the picture (a chair is about 0.85 m tall); shown as steps (0.75 m each) plus left / ahead / right.
- Deterministic ranking (closest first) is the input to Claude and the fallback.
- **Done when:** A/B/C labels appear on three free chairs with step counts that are roughly right.

**F4. Thief detection and reroute**
- When the current target chair becomes taken, one frame goes to Gemini: "Is the person sitting in the highlighted chair the driver described as …?"
- Not the driver → mark ✕, move to the next chair **instantly**, speak the change. Driver → F5.
- Low confidence or error → two big buttons: "That's me" / "Someone else".
- **Done when:** a second person sitting in Plan A reroutes to Plan B within 3 seconds, at least 4 times out of 5.

**F5. Great landing**
- Driver confirmed in the target chair → *"Great landing. You're parked."* Success screen with time taken and the model trace.
- **Done when:** sitting in the target chair triggers it within 3 seconds.

### Park my car

**F6. Map of San Francisco with parking lots**
- Centered on downtown SF. All 12 fake garages as pins. Tapping one shows name, price per hour, hours, clearance and status.
- **Done when:** the map loads on a phone and all pins are tappable.

**F7. Choose destination and start**
- Preset meeting places + "tap on map", optional meeting time and length. Start: preset or "Use my location" (HTTPS only).
- **Done when:** destination shows as a flag pin and start as a car pin.

**F8. Backup chain: deterministic core (no AI)**
- Walking distance from each lot to the destination (straight line; 80 m per minute). Ignore full lots and lots more than 15 minutes' walk away. Sort by shortest walk.
- Input to Claude and fallback when Claude fails.
- **Done when:** the ranked list shows walk times and the logic has unit tests.

**F9. Snake route**
- One OSRM driving route through Start → A → B → C. Driven part grey; current segment bright with a flowing dash; backups faded. Pins labelled A, B, C. Straight lines + "approximate route" if OSRM takes over 5 seconds.
- **Done when:** the current segment is clearly different from the backups.

**F10. "Lot is full" and chain extension**
- Big red button at the bottom (at least 64 px tall) and the voice command. Reroute happens instantly from the existing chain (< 2 seconds); Claude's re-plan updates the rest in the background. No lots left → add the next 3 (D, E, F).
- **Done when:** repeated "full" walks A → B → C → D… without errors.

**F11. Open in Apple Maps / Google Maps**
- iPhone: `https://maps.apple.com/?daddr=LAT,LNG&dirflg=d`. Otherwise: `https://www.google.com/maps/dir/?api=1&destination=LAT,LNG&travelmode=driving`.
- **Done when:** it opens the maps app with the right garage.

**F12. Simulate drive (demo mode)**
- The car icon moves along the route; on arrival: "Is there space?" → "Yes, I parked" / "Lot is full".
- **Done when:** the full car demo runs on a laptop without moving.

### Shared

**F13. Claude planner and voice**
- `/api/plan` (Claude Opus 5.5) works for both modes: candidates in, ordered chain with one-sentence reasons out (structured JSON, IDs checked by our code). 6-second limit, then fallback.
- Voice: hold-to-talk → transcribe → Haiku intent (`find_spot`, `lot_full`, `parked`, `repeat`, `where_to`, `other`, plus an optional wish) → action. Every change is spoken with OpenAI TTS.
- **Done when:** in both modes, a spoken command produces the right action, and the chain shows Claude's reasons.

**F14. Model trace (for the judges)**
- Collapsible panel listing every AI call: model, what it did, how long, what it cost (token counts × list prices); on-device detector shown with frames per second and $0. Running session total.
- **Done when:** after one Park me run the panel shows all six models and a session cost.

**F15. Garage sign reader (stretch)**
- In Park my car, the camera reads a garage entrance sign with Gemini (`full`, `restricted`, price, clearance). `full` reroutes; `restricted` goes to Claude.
- Only if batches 1–7 are done.

**F16. Calm, playful design**
- Car mode: big text, few words, one action at a time, red only for "full". Park me: fun and readable from the back of the room.
- **Done when:** a non-technical person can run either demo without explanation.

## 9. Fake parking data (Park my car)

Stored in `src/data/lots.ts`. Coordinates are approximate. **Hours, clearance and rules are made up** so the planner has real trade-offs to make.

| ID | Name | Lat | Lng | $/hr | Hours | Clearance | Rule | Starting status |
|---|---|---|---|---|---|---|---|---|
| L1 | Union Square Garage | 37.7880 | -122.4075 | 6 | 24h | 6'8" | | open |
| L2 | Sutter-Stockton Garage | 37.7898 | -122.4068 | 5 | 24h | 6'2" | | open |
| L3 | Ellis-O'Farrell Garage | 37.7856 | -122.4070 | 5 | 5:30am–1am | 6'6" | | open |
| L4 | Fifth & Mission Garage | 37.7835 | -122.4055 | 6 | 24h | 6'10" | | open |
| L5 | Moscone Center Garage | 37.7840 | -122.4005 | 5 | 6am–midnight | 7'0" | Event rate $30 flat on event days | open |
| L6 | Portsmouth Square Garage | 37.7948 | -122.4052 | 4 | 24h | 6'6" | | open |
| L7 | St. Mary's Square Garage | 37.7920 | -122.4050 | 5 | 6am–10pm | 6'6" | | full |
| L8 | Golden Gateway Garage | 37.7955 | -122.3990 | 7 | 6am–7pm | 7'0" | Monthly permits only 7–10am | open |
| L9 | Embarcadero Center Garage | 37.7950 | -122.3975 | 8 | 24h | 6'8" | | open |
| L10 | Civic Center Garage | 37.7795 | -122.4180 | 4 | 24h | 7'0" | | open |
| L11 | Performing Arts Garage | 37.7770 | -122.4225 | 4 | 6am–midnight | 6'8" | | open |
| L12 | Mission-Bartlett Garage | 37.7560 | -122.4195 | 3 | 7am–7pm | 6'6" | | open |

**Preset meeting places:** Frontier Tower, 995 Market St (37.7826, -122.4098; the default, since the judges are there) · 1 Market St (37.7941, -122.3951) · Salesforce Tower (37.7897, -122.3972) · Moscone Center (37.7842, -122.4016)

**Preset demo start:** Fell St & Van Ness Ave (37.7765, -122.4200)

## 10. Unit economics (standard API list prices, no discounts)

**Park my car**: one trip with one plan, one re-plan, 1 minute of speech each way, 5 voice commands.

| Step | Model | Usage | Cost |
|---|---|---|---|
| Plan + re-plan | Claude Opus 5.5 ($4 in / $20 out per 1M tokens) | 2 × (~4k in, ~1.5k out, effort `low`) | ~$0.092 |
| Voice intents | Claude Haiku 5.5 ($0.10 / $0.50 per 1M) | 5 × (~800 in, ~60 out) | ~$0.001 |
| Speech to text | gpt-4o-mini-transcribe (~$0.003/min) | 1 min | ~$0.003 |
| Text to speech | gpt-4o-mini-tts (~$0.015/min) | 1 min | ~$0.015 |
| **Total** | | | **≈ $0.11** (≈ $0.12 with the sign reader) |

**Park me**: one 2-minute session.

| Step | Model | Usage | Cost |
|---|---|---|---|
| Chair/person detection | EfficientDet-Lite0, on the phone | every frame | **$0** |
| "This is me" + thief/landing checks + scene checks | Gemini 2.5 Flash (~$0.30 per 1M in, $2.50 out) | ~40 frames × (~1.3k in, ~80 out) | ~$0.024 |
| Pick the chain | Claude Opus 5.5 | 1 × (~3k in, ~1.5k out) | ~$0.042 |
| Voice in/out + intents | OpenAI + Haiku | ~30 s each way | ~$0.010 |
| **Total** | | | **≈ $0.08** |

- **Consumer (car):** $4.99/month. A heavy user (20 trips) costs about $2.40 in AI calls, so around 50% gross margin even at list prices; a typical user (8 trips) about $1, so around 80%.
- **Lot-side cameras (later):** the Park me pipeline on a camera over a parking lot. The detector is free, and Gemini runs only when a space changes, so a 100-space lot costs cents per day.
- **Easy savings** (not needed to be viable): prompt caching of lot data, Sonnet 5.5 for the planner if quality holds.

Prices checked Oct 11 2026. Claude prices from Anthropic's model table; Gemini and OpenAI prices from public price trackers, to confirm on the providers' pages before submitting.

## 11. Out of scope for this slice

- Real-time garage availability (fake data only)
- Reservations or payments
- User accounts, saved trips (Clerk installed, not used by the demo)
- Face recognition or storing any images (clothing description only, in memory)
- Native iPhone/Android app
- Typing an address (presets, tap-on-map and voice only)
- Cities other than San Francisco

## 12. Technical approach

| Piece | Choice | Why |
|---|---|---|
| App framework | **Next.js 16 + React + TypeScript** (reused) | Already deploys; route handlers keep AI keys on the server |
| On-device detection | **MediaPipe Tasks Vision** object detector, EfficientDet-Lite0 (COCO classes include chair, couch, person) | Runs in iPhone Safari on the GPU, no server cost |
| Camera | `getUserMedia` rear camera (HTTPS only, so test on the Netlify link) | Standard browser API |
| Map, routes | Leaflet + react-leaflet with OpenStreetMap; OSRM public server | Free, no keys |
| AI SDKs | `@anthropic-ai/sdk`, `@google/genai`, `openai` (`openai` already installed) | Official SDK per provider |
| Tests | **Vitest** | Quick, for plain logic files |
| Styling | Tailwind + shadcn/ui (reused) | Already set up |
| Hosting | **Netlify** (reused) | HTTPS link: camera, mic and location work on the phone |
| Code review | **Prelint** on every pull request | Catches drift from this PRD |

## 13. Build plan: small batches

Each batch ends with something you can **see working**, a **pull request** (Prelint reviews it) and a merge. **Netlify must be connected before batch 3**, because the camera only works on HTTPS.

| # | Batch | Time | You can see… |
|---|---|---|---|
| 0 | Setup, cleanup, landing page | done | Plan P landing page |
| 1 | Car: map + fake garages + deterministic chain + tests | 1:00 | SF map with 12 pins, ranked list with walk times |
| 2 | Car: snake route + "Lot is full" button + chain extension | 1:00 | Tapping moves the snake head forward |
| 3 | **Park me: camera + on-device detection + room scan + free/taken + A/B/C with steps** (no cloud AI yet) | 1:15 | On the iPhone: green/red boxes on real chairs, A/B/C labels |
| 4 | **Claude planner** for both modes + model trace panel | 0:45 | Chains with one-line reasons; trace shows each call |
| 5 | **Gemini**: "This is me", thief check, Great landing | 1:00 | The full chair-thief demo, using buttons instead of voice |
| 6 | **Voice**: transcribe + Haiku intents + TTS, both modes | 1:00 | Say "find me a spot" / "it's full"; the app speaks |
| 7 | Open in Maps + simulate drive + landing page "Try it" buttons for both modes | 0:45 | Full car demo on a laptop |
| 8 | Rehearse on stage setup (stand, AirPlay), film video, fill in submission | 1:00 | Video + submitted form |
| 9 | Stretch: garage sign reader (F15) | — | Only if time is left |

**Keys needed before batch 4:** `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` in `.env.local` and on Netlify. `OPENAI_API_KEY` is already set.

### Live demo script (about 2 minutes, on stage)

| Time | What happens |
|---|---|
| 0:00–0:20 | "You're late for a meeting and the garage is full. Plan P always has a Plan B. Let me show you with chairs." Phone on the stand, mirrored on the projector. |
| 0:20–0:40 | Boxes on every chair. "This is me" → *"Got you: black hoodie."* |
| 0:40–1:00 | "Find me a spot." → A/B/C on screen, *"Plan A: second row, left, about six steps."* |
| 1:00–1:30 | Walk. A friend steals chair A. *"Plan A just got taken. Heading to Plan B."* Sit. *"Great landing."* |
| 1:30–2:00 | Model trace: six models, what each did, latency, cost. "Same engine for your car" → cut to the map and the video. |

### Video (4 minutes)

| Time | Shot |
|---|---|
| 0:00–0:30 | The problem: circling a full garage before a meeting. The 83 hours/year stat. |
| 0:30–1:30 | Park me in a real room, chair thief included. |
| 1:30–2:40 | Park my car: say the meeting, Claude's chain with reasons, snake route, a real drive to a full SF garage, "it's full" by voice, spoken reroute (a passenger runs the phone; the driver never touches it). Open in Apple Maps. |
| 2:40–3:20 | Model trace: what each model did, latency, cost per trip. |
| 3:20–4:00 | Why it matters, pricing, what's next (lot-side cameras). |

## 14. Success criteria

- Both demo stories (§7) run start to finish 3 times in a row without errors, on the deployed link.
- Park me: the detector runs at 10+ frames per second on the iPhone 13; the thief reroute and Great landing each fire within 3 seconds, 4 times out of 5.
- Car: from "full" (voice or tap) to the new target on screen in under 2 seconds; speech starts within 3 seconds.
- The model trace shows every model and a session cost.
- A non-technical person can run either demo after one explanation.

## 15. Risks

| Risk | What we do |
|---|---|
| Room lighting or angle confuses the detector | Rehearse in the demo room; tall stand angled down; "rescan" button; tested threshold for "taken" |
| Gemini mixes up the driver and the thief | Thief wears clearly different clothes; low confidence shows "That's me" / "Someone else" buttons |
| An AI provider is slow or down live | Every step has a fallback (§6.1); recorded video as backup |
| Camera, mic or location blocked | They need HTTPS; always test on the Netlify link |
| Audience can't see the phone | AirPlay mirroring to the Mac on the projector; big labels |
| OSRM slow or down | Straight-line fallback |
| API keys exposed | Keys only in server route handlers and Netlify env vars |
| Running out of time | Must-haves: batches 1–5. Voice (6) falls back to buttons; the sign reader is a stretch goal. |
| Privacy concern about cameras | Clothing description only, no faces, nothing stored, frames dropped after each call |

## 16. After the slice (what we'd build next)

1. **Lot-side cameras:** the Park me engine on existing garage cameras or a cheap phone on a pole, giving real-time free-space counts. This is how we get real availability data.
2. Garage partners and SFMTA sensor feeds; crowd-sourced "full" reports from other Plan P drivers.
3. Reserve and pay for the backup spot in advance, so Plan B is guaranteed.
4. Fleets: field-sales and home-service teams, with an audit trail of reroutes (possibly on Anbaric).
5. CarPlay / Android Auto.
