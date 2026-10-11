# Plan P — Product Requirements Document (Vertical Slice v0.2)

> **One line:** When your parking plan falls apart mid-drive, Plan P already has a backup ready. It sees the "FULL" sign, tells you where to go next, and reroutes you without you touching the phone.

**Event:** Multi Model Hackathon, SF Tech Week, Sunday Oct 11 2026, Frontier Tower, San Francisco. Live demo this evening.
**Theme:** multi-model AI systems that combine models, providers, agents and modalities.
**Architecture details:** [ARCHITECTURE.md](ARCHITECTURE.md). **Submission draft:** [SUBMISSION.md](SUBMISSION.md).

---

## 0. How we win (read this first)

### 0.1 Judging rubric and our answer to each

| Criterion | Weight | What judges look for | How Plan P scores |
|---|---|---|---|
| Multi-model integration is essential | **25%** | Each model chosen for its strength; integration unlocks something no single model can do | Five models from three providers, each doing one job in a single loop: **eyes** (Gemini Flash reads the garage sign), **ears** (OpenAI transcribe hears "it's full"), **fast reflex** (Claude Haiku 5.5 turns speech into an action in under a second), **brain** (Claude Opus 5.5 plans and re-plans the chain), **voice** (OpenAI TTS speaks). Take any one out and the hands-free reroute breaks. |
| Novel idea, clear differentiation | 20% | Real problem solved a new way, not a remix | Parking apps (SpotHero, ParkWhiz, Google Maps) help you **before** the drive. Plan P is the first that handles the moment the plan **fails while you're driving**. The "backup chain" (snake route) is our own idea. |
| Production-ready, economically viable | 15% | Clean code, manageable dependencies, unit economics work at standard API prices | About **$0.12 per trip** at list prices (see §10). Every AI step has a non-AI fallback, so the app never dead-ends. Typed code, unit tests on the core logic, a pull-request flow reviewed by Prelint. |
| Compelling demo under pressure | 20% | Works end to end; the killer feature is obvious | Killer moment: phone camera sees a real **"FULL"** sign → Plan P says *"Plan A is full. Heading to Plan B, four-minute walk"* → the route jumps forward. No tap needed. An on-screen **model trace** shows which model did what, how fast, and for how much. |
| Solves a problem people care about | 20% | Need is real and urgent; someone would pay | SF drivers lose **83 hours a year** hunting for parking. **More than 4 in 10** Americans have missed an appointment because they couldn't park (INRIX). Everyone in the room has circled a full garage before a meeting. |

### 0.2 What we must submit

| Field | Required | Our plan |
|---|---|---|
| Project name | yes | Plan P |
| Pitch (1–2 sentences) | yes | Draft in [SUBMISSION.md](SUBMISSION.md) |
| Code repository | yes | github.com/hre4anyk/PlanP. Judges check that **the code runs** and **uses multiple models**, so the README must show how to run it and where each model is called. |
| Demo (video or live URL) | yes | **Both**: the live Netlify link plus a 4-minute video filmed in real SF streets (script in §13) |
| Models used and why | yes | §6 of this PRD, copied into the form |
| Why multiple models beat multiple apps | yes | §6.3 |
| Team contributions | yes | To fill in |
| What would you build next | optional | §15. Answer it: it feeds the "production-ready" score |

### 0.3 Sponsors and how we use them

| Sponsor | What it is | Decision |
|---|---|---|
| **Prelint** | Reviews each pull request against your ADRs and docs for "product drift" | **Use it.** Cheap, and it backs up the production-ready score. Each build batch goes in as a pull request; Prelint checks it against this PRD and [ARCHITECTURE.md](ARCHITECTURE.md). |
| **Anbaric** | Auth, team management, audit trails, hosting, agents (open source TypeScript library + Anbaric Cloud). Promo `SFTW26` = 3 months free hosting. Top 3 teams get 6 months. | **Not in the slice.** We already have login (Clerk) and hosting (Netlify) working, and switching costs hours we don't have. Listed as a post-hackathon option (audit trail of reroutes for fleets). |
| **Base44** | No-code prompt-to-app builder (Wix) | **Not used.** We already have a coded app. |

---

## 1. The problem (plain language)

You're driving to an important meeting in San Francisco. You know where you'll park. You get there and the lot is full.

Now you're circling, checking the clock, getting more stressed. You can't search on your phone because you're driving. Every wrong turn makes you later.

- SF drivers spend about **83 hours a year** looking for parking (INRIX).
- More than **4 in 10** Americans have missed an appointment because they couldn't park (INRIX survey).
- Today's parking apps help you **plan ahead**. Nothing helps when **the plan fails while you're on the road**.

## 2. The solution

Before you leave, Plan P lines up a **backup chain** of parking lots near your meeting: **Plan A → Plan B → Plan C**. The route is drawn as one continuous line through all of them, like the snake in the old Snake game.

While you drive, Plan P works like a co-pilot with eyes, ears and a voice:

- **It sees.** Your phone, mounted on the dashboard, looks at the garage entrance. If the sign says FULL (or "Monthly permits only", or a height limit your car won't clear), Plan P knows.
- **It hears.** Just say "It's full" or "Where am I parking?". No tapping.
- **It thinks.** It re-plans the chain around your meeting time, your car and the garage rules, and says why in one sentence.
- **It speaks.** *"Plan A is full. Heading to Plan B: Sutter-Stockton. Four-minute walk."*

The big "Lot is full" button stays as a backup for when the camera or microphone can't help.

## 3. Who it's for

**Primary user:** A busy professional driving to a meeting in an unfamiliar part of San Francisco, on a tight schedule, already stressed.

**Demo audience:** Hackathon judges and investors, watching live or on video.

## 4. Goal of this vertical slice

Build the **thinnest working version of the whole experience**, end to end, today:

> Say or pick a meeting → Claude builds the A → B → C backup chain with reasons → snake route on the map → camera sees "FULL" (or driver says "it's full", or taps) → Plan P speaks and moves to the next lot in under 2 seconds → open turn-by-turn directions in Apple/Google Maps.

## 5. Key decisions

| Topic | Decision |
|---|---|
| Platform | Web app in the phone's browser (also works on a laptop) |
| Parking data | **Fake data**: 12 real SF garages with made-up availability and rules |
| How we know a lot is full | **Camera + Gemini** reads the entrance sign; **voice** ("it's full"); **big button** as last resort |
| Who plans the chain | **Claude Opus 5.5**, given walk times computed by our own code. Falls back to "shortest walk first" if the AI fails. |
| Map | **OpenStreetMap** via Leaflet. Free, no key |
| Driving routes | **OSRM public demo server**. Free, no key. Straight lines if it fails |
| Directions | Route shown inside Plan P **plus** a button to open Apple Maps or Google Maps |
| Framework and hosting | **Reused** from our previous project: Next.js 16, Tailwind + shadcn/ui, Clerk, Supabase, Netlify |
| AI keys | Stay on the server only (Next.js route handlers). The browser never sees a key. |

## 6. Models used and why

### 6.1 The five models

| Job | Model (provider) | Why this model for this job | If it fails |
|---|---|---|---|
| **Brain**: plan and re-plan the backup chain | **Claude Opus 5.5** (Anthropic) | The hard reasoning step. It weighs walk time against price, closing time vs. meeting length, height clearance vs. your car, and permit-only rules, then explains each pick in one sentence. Runs once per trip plus once per sign, so its higher price barely matters. | Deterministic ranking: shortest walk first |
| **Reflex**: turn a voice command into an action | **Claude Haiku 5.5** (Anthropic) | Needs to answer in well under a second and costs almost nothing ($0.10 per million input tokens). Maps "ugh it's full", "they want monthly only" or "where am I going?" to one of a few intents. | Keyword match ("full", "parked", "repeat") |
| **Eyes**: read the garage sign | **Gemini 2.5 Flash** (Google) | Fast, cheap multimodal model with strong text-in-image reading. It can look at a frame every couple of seconds while you approach a garage for fractions of a cent. Returns structured JSON: status, restrictions, price, clearance, confidence. | Ask the driver: "Is there space?" |
| **Ears**: speech to text | **gpt-4o-mini-transcribe** (OpenAI) | Handles road noise and short commands well at about $0.003 per minute. Reuses the OpenAI key we already have. | Browser speech recognition, then the big button |
| **Voice**: text to speech | **gpt-4o-mini-tts** (OpenAI) | Natural, calm voice that can be told to "sound calm and reassuring". About $0.015 per minute. | Browser built-in voice |

Model IDs live in one config file ([ARCHITECTURE.md §4](ARCHITECTURE.md)) so any of them can be swapped in one line.

### 6.2 How they work together (one reroute)

```
camera frame ──► Gemini Flash ──► { status: "full", sign: "LOT FULL", confidence: 0.94 }
                                              │
driver: "it's full" ──► OpenAI transcribe ──► Haiku 5.5 ──► { intent: "lot_full" }
                                              │
                                              ▼
                          Claude Opus 5.5 re-plans the chain (with reasons)
                                              │
                         ┌────────────────────┴────────────────────┐
                         ▼                                         ▼
               map: snake head moves to Plan B          OpenAI TTS speaks the change
```

### 6.3 Why multiple models beat multiple apps

A sign-reading app, a voice-assistant app and a route-planning app on their own can't help a stressed driver. The value is in the **hand-off between them, inside one loop that takes under 2 seconds**:

1. **Seeing isn't enough.** Gemini can read "Monthly permits only 7am–10am", but only Claude, which knows it's 9:40 and your meeting runs until 11, can decide that this lot counts as full **for you**.
2. **Hearing isn't enough.** A transcript of "ugh, they want forty bucks" means nothing until Haiku turns it into "too expensive" and Claude re-plans with a price cap.
3. **Planning isn't enough.** The best plan is useless if the driver has to look at the screen. The voice closes the loop with eyes on the road.
4. **Each model runs where it's cheapest and fastest.** The frequent, simple calls (every camera frame, every voice command) go to the cheap fast models. The rare, hard decision goes to the strongest one. Using Opus for everything would cost far more and be too slow; using a small model for everything would make bad parking decisions.

## 7. User flow (the demo story)

1. **Open Plan P.** A map of San Francisco with parking garages shown as pins.
2. **Say or choose where you're going.** "Investor meeting at Frontier Tower, two o'clock, about an hour." Or pick a preset, or tap the map.
3. **Choose where you're starting.** Preset demo start, or "Use my location".
4. **Tap "Plan my parking".** Claude picks the 3 best lots and labels them **Plan A, B, C**, each with a one-line reason (e.g. *"Closest walk, open past your meeting"*).
5. **See the snake.** One driving route: Start → A → B → C. The part to the current target is bright, the backups are faded.
6. **Drive (or simulate driving).** A car icon moves along the route toward Plan A.
7. **Plan A is full.** Any of three triggers:
   - the camera sees the FULL sign (**the killer moment**),
   - the driver says "It's full",
   - the driver taps the big red **"Lot is full"** button.

   Then:
   - Plan A gets a red ✕.
   - The snake's head moves to Plan B. That segment lights up.
   - Plan P speaks: *"No problem. Heading to Plan B: Sutter-Stockton Garage. 3 min drive, 4 min walk."*
8. **Open in Maps.** Opens Apple Maps or Google Maps with directions to the current lot.
9. **Parked.** Driver says "I parked" or taps the button. Plan P shows the walking time to the meeting and a success screen.
10. **Every lot in the chain is full (edge case).** The snake grows: Claude adds the next 3 best lots (Plan D, E, F) to the end of the chain.

## 8. Features and acceptance criteria

### F1. Map of San Francisco with parking lots
- Map opens centered on downtown SF. All 12 fake garages appear as pins. Tapping a pin shows name, price per hour, hours, clearance and status.
- **Done when:** the map loads on a phone screen and all pins are visible and tappable.

### F2. Choose destination and start
- Dropdown with preset meeting places + "tap on map". Optional meeting time and length.
- Start defaults to a preset demo point. "Use my location" works on the deployed HTTPS link.
- **Done when:** the destination shows as a flag pin and the start shows as a car pin.

### F3. Backup chain: deterministic core (no AI)
- Walking distance from each lot to the destination (straight line; walking speed 80 m per minute).
- Ignore lots that are full in the data or more than 15 minutes' walk away. Sort by shortest walk.
- This is both the input to Claude and the fallback when Claude fails.
- **Done when:** the ranked list shows walk times, and the logic has unit tests.

### F4. Claude planner (Brain)
- Server route sends Claude Opus 5.5 the ranked candidates (walk minutes, price, hours, clearance, rules), the meeting time and length, and car height if given.
- Claude returns structured JSON: the ordered chain plus a one-sentence reason per lot. Our code checks that every lot ID exists before using it.
- Re-plan calls include what just happened (e.g. "Plan A sign: monthly permits only").
- Time limit: 6 seconds, then fall back to F3.
- **Done when:** the chain shows Claude's reasons, and changing the meeting length (e.g. a lot closing at 6pm vs. a 3-hour meeting) visibly changes the order.

### F5. Snake route
- One driving route through all stops (Start → A → B → C) from OSRM. Thick line:
  - **Driven part:** solid grey.
  - **Current segment:** bright, thick, animated "flowing" dash.
  - **Backup segments:** faded.
- Lot pins labelled **A, B, C**. If OSRM fails or takes over 5 seconds, draw straight lines and show "approximate route".
- **Done when:** the snake is visible and the current segment is clearly different from the backups.

### F6. Sign reader (Eyes): the killer feature
- "Camera" button opens the rear camera (works on HTTPS). While approaching the current lot, a frame is sent to the server every 2 seconds (paused when far away, to save cost).
- Gemini Flash returns `{ status: open|full|restricted|unknown, sign_text, restrictions, price, clearance, confidence }`.
- `full` with confidence ≥ 0.8 triggers the reroute automatically. `restricted` goes to Claude to decide whether it applies to this driver. Anything else does nothing.
- Demo safety net: an "Upload photo" option, plus 3 bundled photos of real SF garage signs.
- **Done when:** pointing the phone at a printed or real "FULL" sign reroutes to the next lot within 3 seconds.

### F7. Voice (Ears + Reflex + Voice)
- Hold-to-talk button (and optional always-listening during the drive). Audio → OpenAI transcribe → Claude Haiku 5.5 → intent: `lot_full`, `parked`, `repeat`, `where_to`, `too_expensive`, `other`.
- Every change of plan is spoken with OpenAI TTS (calm voice). Browser voice if the API fails.
- **Done when:** saying "it's full" moves to the next lot and the app speaks the new plan.

### F8. "Lot is full" button and chain extension
- Big red button at the bottom (at least 64 px tall). On tap: mark current lot full (red ✕), move the snake head, update the message card, all in under 2 seconds. The reroute uses the existing chain immediately, and Claude's re-plan updates the rest in the background.
- If no lots are left: extend the chain with the next 3 best lots and redraw.
- **Done when:** tapping repeatedly walks through A → B → C → D… without errors.

### F9. Open in Apple Maps / Google Maps
- iPhone opens Apple Maps (`https://maps.apple.com/?daddr=LAT,LNG&dirflg=d`); otherwise Google Maps (`https://www.google.com/maps/dir/?api=1&destination=LAT,LNG&travelmode=driving`).
- **Done when:** tapping it on a phone opens the maps app with the right garage.

### F10. Simulate drive (demo mode)
- "Simulate drive" moves the car icon along the route at a steady speed. When it reaches the current lot: "Is there space?" → "Yes, I parked" / "Lot is full".
- **Done when:** the full demo runs on a laptop without moving.

### F11. Model trace (for the judges)
- A small collapsible panel listing every AI call: which model, what it did, how long it took, what it cost (from token counts × list prices). Plus a running "cost of this trip" total.
- **Done when:** after one demo run the panel shows all five models with latency and a trip total near $0.12.

### F12. Calm, driver-friendly design
- Big text, few words, one main action at a time. Red only for "full".
- **Done when:** a non-technical person can run the demo without explanation.

## 9. Fake parking data

Stored in `src/data/lots.ts`. Coordinates are approximate. **Hours, clearance and rules are made up** to give the planner real trade-offs to make.

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

**Preset meeting places:**
- Demo day: Frontier Tower, 995 Market St (37.7826, -122.4098). The default, since the judges are sitting there.
- Investor meeting: 1 Market St (37.7941, -122.3951)
- Salesforce Tower (37.7897, -122.3972)
- Moscone Center (37.7842, -122.4016)

**Preset demo start:** Fell St & Van Ness Ave (37.7765, -122.4200)

## 10. Unit economics (standard API list prices, no discounts)

One typical trip: one plan, one re-plan, 20 camera frames on approach, 1 minute of speech in, 1 minute of speech out, 5 voice commands.

| Step | Model | Usage per trip | Cost |
|---|---|---|---|
| Plan + 1 re-plan | Claude Opus 5.5 ($4 in / $20 out per 1M tokens) | 2 × (~4k in, ~1.5k out incl. thinking, effort `low`) | ~$0.092 |
| Voice intents | Claude Haiku 5.5 ($0.10 / $0.50 per 1M) | 5 × (~800 in, ~60 out) | ~$0.0006 |
| Sign reading | Gemini 2.5 Flash (~$0.30 per 1M image/text in, $2.50 out) | 20 frames × (~1.3k in, ~80 out) | ~$0.012 |
| Speech to text | gpt-4o-mini-transcribe (~$0.003/min) | 1 min | ~$0.003 |
| Text to speech | gpt-4o-mini-tts (~$0.015/min) | 1 min | ~$0.015 |
| **Total** | | | **≈ $0.12 per trip** |

- **Consumer:** $4.99/month. A heavy user (20 trips/month) costs about $2.40 in AI calls, so gross margin is around 50% even at list prices. A typical user (8 trips) costs about $1, so roughly 80% margin.
- **Easy savings** (not needed to be viable): prompt caching of the lot data and rules, only sending camera frames within 150 m of a garage, Sonnet 5.5 for the planner if quality holds.
- **B2B later:** per-seat pricing for field-sales and home-service fleets, where one missed appointment costs far more than the subscription.

Prices checked Oct 11 2026. Claude prices from Anthropic's model table; Gemini and OpenAI prices from public price trackers, to confirm on the providers' pages before submitting.

## 11. Out of scope for this slice

- Real-time parking availability data (fake data only)
- Reservations or payments
- User accounts, saved trips (Clerk is installed but not used by the demo)
- Native iPhone/Android app
- Typing an address (presets, tap-on-map and voice only)
- Cities other than San Francisco

## 12. Technical approach

| Piece | Choice | Why |
|---|---|---|
| App framework | **Next.js 16 + React + TypeScript** (reused) | Already set up, building and deployable. Route handlers keep AI keys on the server. |
| Map | **Leaflet + react-leaflet**, OpenStreetMap tiles | Free, no key |
| Routing | **OSRM public demo server** | Free, multiple stops in one request |
| AI SDKs | `@anthropic-ai/sdk`, `@google/genai`, `openai` (`openai` already installed) | Official SDK per provider |
| Tests | **Vitest** | Quick, for plain logic files |
| Styling | Tailwind + shadcn/ui (reused) | Already set up with our dark design system |
| Hosting | **Netlify** (reused) | HTTPS link that works on any phone (camera and location need HTTPS) |
| Code review | **Prelint** on every pull request | Catches drift from this PRD |

Full component map, API routes and data shapes: [ARCHITECTURE.md](ARCHITECTURE.md).

## 13. Build plan: small batches

Each batch ends with something you can **see working**, a **pull request** (Prelint reviews it) and a merge. The must-haves for a winning demo are batches 1–5. Batches 6–7 can shrink.

| # | Batch | Time | You can see… |
|---|---|---|---|
| 0 | Setup, cleanup, landing page | done | Plan P landing page |
| 1 | Map + fake garages + deterministic chain + tests | 1:15 | SF map with 12 tappable pins, ranked list with walk times |
| 2 | Snake route + "Lot is full" button + chain extension | 1:15 | Tapping moves the snake head forward |
| 3 | **Claude planner** (Opus 5.5) with reasons + fallback + model trace panel | 1:00 | Plan A/B/C with one-line reasons; trace shows the call |
| 4 | **Sign reader** (Gemini Flash) from camera or uploaded photo | 1:00 | Point at a FULL sign → reroute |
| 5 | **Voice** (transcribe + Haiku intents + TTS) | 1:00 | Say "it's full" → reroute, app speaks |
| 6 | Open in Maps + simulate drive + landing page "Try the demo" button | 0:45 | Full demo on a laptop |
| 7 | Deploy, phone test, film the video, fill in the submission | 1:00 | Public HTTPS link + 4-min video + submitted form |

**Keys needed before batch 3:** `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` in `.env.local` and on Netlify. `OPENAI_API_KEY` is already set.

### Demo video script (4 minutes, filmed in real SF)

| Time | Shot |
|---|---|
| 0:00–0:30 | The problem: circling a full garage before a meeting. The 83 hours/year stat. |
| 0:30–1:00 | Say the meeting into Plan P. Claude's chain appears with reasons; the snake is drawn. |
| 1:00–2:00 | **Real conditions:** passenger holds the phone (dashboard mount) as the car approaches a real garage showing FULL. Gemini reads it, Plan P speaks, the snake jumps to Plan B. |
| 2:00–2:40 | Voice: "they want monthly only" → Claude re-plans and explains. Open in Apple Maps. |
| 2:40–3:20 | Model trace: five models, what each did, latency, $0.12 trip cost. |
| 3:20–4:00 | Why it matters, pricing, what's next. |

Safety: the driver never touches the phone while filming; a passenger operates it.

## 14. Success criteria

- The full demo story (§7) runs start to finish 3 times in a row without errors, on the deployed link.
- From "full" detected (sign, voice or tap) to the new target on screen: **under 2 seconds**. The spoken message starts within 3 seconds.
- The sign reader correctly reads at least 4 of 5 test photos of real SF garage signs.
- Works on an iPhone in Safari through the deployed link (camera, microphone, location).
- The model trace shows all five models and a trip cost.
- A non-technical person can run the demo after one explanation.

## 15. Risks

| Risk | What we do |
|---|---|
| An AI provider is slow or down during the live demo | Every step has a fallback (§6.1); recorded video as backup |
| Camera misreads a sign | Confidence threshold 0.8; low confidence asks the driver instead |
| Camera, microphone or location blocked on the phone over local Wi-Fi | Expected: they need HTTPS. Test on the deployed link |
| OSRM demo server slow or down | Straight-line fallback (F5) |
| API keys exposed | Keys only in server route handlers and Netlify env vars; never sent to the browser |
| Running out of time | Batches 1–5 are the must-haves; cut simulate drive and design polish first |
| Safety: driver touching the phone | Camera and voice make it hands-free; big button is the last resort |

## 16. After the slice (what we'd build next)

1. Real availability data (garage partners, SFMTA SFpark sensors, crowd reports from other Plan P drivers' camera reads).
2. Automatic "lot is full" detection from motion (car slows at the entrance, then drives away).
3. Reserve and pay for the backup spot in advance, so Plan B is guaranteed.
4. Fleets: field-sales and home-service teams, with an audit trail of reroutes (possibly on Anbaric).
5. CarPlay / Android Auto.
