# Plan P — Product Requirements Document (Vertical Slice v0.4)

> **One line:** When your parking plan falls apart, Plan P already has a backup ready. It sees which spots are taken, tells you where to go next, and reroutes you without you touching the phone.

**Event:** Multi Model Hackathon, SF Tech Week, Sunday Oct 11 2026, Frontier Tower, San Francisco. Live demo this evening.
**Theme:** multi-model AI systems that combine models, providers, agents and modalities.
**Architecture details:** [ARCHITECTURE.md](ARCHITECTURE.md). **Submission draft:** [SUBMISSION.md](SUBMISSION.md).

### Two modes

| Mode | What it does | Role in the demo |
|---|---|---|
| **Park me** | A phone on a stand watches a room, finds every chair, sees which are taken, and walks you to a free one: Plan A, B, C. If someone takes your chair first, it reroutes you. | **The live wow on stage.** Chairs are parking spaces, and the audience watches it happen. |
| **Park my car** | Builds a backup chain of SF garages near your meeting, draws it as one "snake" route, and reroutes you hands-free when a lot is full. | **The product.** Shown on the map, plus a short video filmed on real streets. |

Both modes share one engine: a backup chain (A → B → C), a camera that sees what's free, a brain that picks and explains, and a voice you talk to. Park me also shows how Plan P gets **real availability data** later: any camera looking over a parking lot becomes a space sensor, exactly like the phone looking over the chairs.

### Two AI models, one job each

| Role | Model | Does |
|---|---|---|
| **Brain** (text, reasoning, vision) | **Claude Opus 5.5** (Anthropic) | Picks and re-plans the backup chain, explains each pick, and answers "is that the driver or someone else?" from a photo |
| **Voice** (speech-to-speech) | **OpenAI gpt-realtime-2.1-mini** (OpenAI) | Listens and talks back in one step, and calls Plan P's actions ("find me a spot", "it's full") as tools |

Plus a free **on-device vision tool** (MediaPipe object detector) that finds chairs and people in every camera frame. It isn't an AI service; it's what lets the camera watch continuously without a cloud call per frame.

---

## 0. How we win (read this first)

### 0.1 Judging rubric and our answer to each

| Criterion | Weight | What judges look for | How Plan P scores |
|---|---|---|---|
| Multi-model integration is essential | **25%** | Each model chosen for its strength; integration unlocks something no single model can do | **A brain and a voice, each the best at its job, working in one loop.** OpenAI Realtime is a natural, interruptible voice but not the strongest planner. Claude Opus 5.5 is the strongest reasoner and reads photos, but can't hold a live spoken conversation. The voice model calls the brain as a tool mid-sentence: you say "it's full", Claude re-plans, and the voice tells you. The on-device detector watches the camera and calls Claude only when a seat changes. |
| Novel idea, clear differentiation | 20% | Real problem solved a new way, not a remix | Parking apps (SpotHero, ParkWhiz, Google Maps) help you **before** you arrive. Plan P handles the moment the plan **fails on the way**: a backup chain that's already planned, and a camera that knows when Plan A is gone. |
| Production-ready, economically viable | 15% | Clean code, manageable dependencies, unit economics work at standard API prices | Each session is an **audited workflow on Anbaric**: every state change records who made it (the driver, the camera, Claude or the voice agent), viewable in Anbaric's admin console. About **$0.13 per car trip** and **$0.08 per Park me session** at list prices (§10). Every AI step has a fallback. Unit tests, pull requests reviewed by Prelint. |
| Compelling demo under pressure | 20% | Works end to end; the killer feature is obvious | Live in the room: the phone finds the chairs, you say "find me a spot", Plan P says *"Plan A: second row, left, about six steps."* A friend steals that chair while you walk. *"Plan A just got taken. Heading to Plan B."* You sit. *"Great landing."* Then a QR code: the audience joins the waitlist live. |
| Solves a problem people care about | 20% | Need is real and urgent; someone would pay | SF drivers lose **83 hours a year** hunting for parking. **More than 4 in 10** Americans have missed an appointment because they couldn't park (INRIX). The **Base44 waitlist** asks "would you pay $4.99/month?", so we end the demo with a live count. |

### 0.2 What we must submit

| Field | Required | Our plan |
|---|---|---|
| Project name | yes | Plan P |
| Pitch (1–2 sentences) | yes | Draft in [SUBMISSION.md](SUBMISSION.md) |
| Code repository | yes | github.com/hre4anyk/PlanP. Judges check that **the code runs** and **uses multiple models**, so the README must show how to run it and where each model is called. |
| Demo (video or live URL) | yes | **Both**: the live Netlify link plus a 4-minute video (Park me in a real room, Park my car on real SF streets; script in §13) |
| Models used and why | yes | "Two AI models" table above + §6 |
| Why multiple models beat multiple apps | yes | §6.3 |
| Team contributions | yes | Solo |
| What would you build next | optional | §16. Answer it: it feeds the "production-ready" score |

### 0.3 Sponsors and how we use them

| Sponsor | What it is | How we use it |
|---|---|---|
| **Anbaric** | Workflow engine (state machines, audited jobs, built-in AI agents) + Anbaric Cloud hosting and admin console. Promo `SFTW26` = 3 months free hosting. | **Our backend.** Every Park me session and car trip is an Anbaric job moving through states. Claude runs as an Anbaric agent; every decision and reroute is audited and visible in the console. Replaces Clerk (no login needed for the demo). |
| **Base44** | No-code prompt-to-app builder (Wix). We have credits. | **The waitlist.** A one-page "Join Plan P" app with a "would you pay $4.99/month?" question, shown as a QR code at the end of the demo, so we can show a live signup count. Built in Base44 by the founder, no code (§8, F17). |
| **Prelint** | Reviews each pull request against your ADRs and docs for "product drift" | **Our code review.** Each build batch goes in as a pull request; Prelint checks it against this PRD and [ARCHITECTURE.md](ARCHITECTURE.md). |

---

## 1. The problem (plain language)

You're driving to an important meeting in San Francisco. You know where you'll park. You get there and the lot is full.

Now you're circling, checking the clock, getting more stressed. You can't search on your phone because you're driving. Every wrong turn makes you later.

- SF drivers spend about **83 hours a year** looking for parking (INRIX).
- More than **4 in 10** Americans have missed an appointment because they couldn't park (INRIX survey).
- Today's parking apps help you **plan ahead**. Nothing helps when **the plan fails on the way**.

## 2. The solution

Before you go, Plan P lines up a **backup chain**: **Plan A → Plan B → Plan C**. When Plan A is gone, you don't search again. You just go to Plan B.

Plan P works like a co-pilot you talk to:

- **It sees.** A camera knows which spots are free and notices the moment one gets taken.
- **It listens and talks.** Say "find me a spot" or "it's full" and it answers out loud, like a person in the passenger seat.
- **It thinks.** It picks the best order (walk time, price, closing time, height limit, rules) and says why in one sentence.

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
| AI models | **Two**: Claude Opus 5.5 (brain) and OpenAI gpt-realtime-2.1-mini (voice). Plus the free on-device detector. |
| Backend | **Anbaric** app (`engine/`): state machines for both modes, Claude as an Anbaric agent, audit trail, hosted on Anbaric Cloud |
| Frontend | **Next.js on Netlify** (camera, map, voice). Its server routes stay thin: get a short-lived voice key, run the photo check, pass calls through to the Anbaric app. |
| Login | **None in the demo. Clerk removed.** The Anbaric console has its own login for us. |
| Waitlist | **Base44** page behind a QR code |
| Park me camera | **Handheld.** You scan the room, Plan A and B stay pinned to the real chairs as you walk (phone motion sensors + live detection), and an arrow points to A when it's off screen. Decided 2026-10-11 after the first iPhone test. |
| Seat accuracy | The phone's fast detector proposes boxes; **Claude checks each scan** (real seat? taken?) so bags, laptops and tables aren't counted as chairs. |
| Who is "me" in Park me | At the start you stand in front of the camera; Claude notes your **clothing** (e.g. "black hoodie, white sneakers"). **No face recognition**, nothing stored. |
| Distance to a chair | Estimated from how big the chair looks in the picture. Rough (±30%), so shown as **steps** ("about six steps") plus left/right/ahead. |
| Car parking data | **Fake data**: 12 real SF garages with made-up availability and rules |
| How we know a lot is full (car) | **Voice** ("it's full") or the **big button** |
| Speed promise | Reroutes happen **instantly in the browser** from the chain already on screen. Claude's re-plan and the Anbaric record follow in the background. |
| Map, routes | OpenStreetMap via Leaflet; OSRM public server. Free, no keys. |
| Showing the phone to the room | Mirror the iPhone to the Mac with AirPlay, Mac on the projector |

## 6. Models used and why

### 6.1 The models

| Job | Model (provider) | Why this model for this job | If it fails |
|---|---|---|---|
| **Brain**: plan and re-plan the backup chain; read photos ("this is me", "is that the driver?") | **Claude Opus 5.5** (Anthropic) | The strongest reasoner, and it reads images. For chairs: closest, unblocked, matches what you asked ("near the window"). For garages: walk time vs. price, closing time vs. meeting length, height clearance, permit rules. Explains each pick in one sentence. Called only when something changes, so its price stays low per session. | Planning: closest-first ranking. Photo check: "That's me" / "Someone else" buttons. |
| **Voice**: listen and talk back, call Plan P's actions | **gpt-realtime-2.1-mini** (OpenAI) | Speech in and speech out in one model, fast enough for natural back-and-forth, and you can interrupt it. It turns "find me a spot near the window" or "ugh, it's full" into tool calls (`find_spot`, `lot_full`, `parked`, `where_to`). The mini version keeps voice cost to a few cents a session. Reuses our existing OpenAI key. | Big buttons on screen + the browser's built-in voice for announcements |
| **Camera watcher** (not an AI service) | **MediaPipe object detector**, EfficientDet-Lite0, on the phone | Finds chairs and people 10–20 times a second, free, no network. That makes "watching" possible; a cloud model per frame would be too slow and expensive. | Switch to Park my car |

Model IDs live in one config file ([ARCHITECTURE.md §4](ARCHITECTURE.md)) so either model can be swapped in one line.

### 6.2 How they work together: the chair thief

```
every frame   camera ──► on-device detector ──► seat map (free / taken)                 [phone, free]

"find me a spot near the window"
   you ──► OpenAI Realtime (voice) ──► tool call find_spot(wish) ──► Anbaric job ──► Claude picks A, B, C
                                                                                         │
   you ◄── OpenAI Realtime: "Plan A: second row, left, about six steps" ◄────────────────┘

someone sits in Plan A
   detector: chair A has a person ──► Claude (photo): "Is this the driver?" ──► no
        │
        └► browser moves to Plan B instantly ──► OpenAI Realtime: "Plan A just got taken. Heading to Plan B."
                                              └► Anbaric records: seat A taken (camera), reroute (Claude)

you sit in Plan B ──► detector ──► Claude (photo): driver? yes ──► "Great landing." ──► Anbaric: landed
```

### 6.3 Why multiple models beat multiple apps

1. **A voice isn't a brain, and a brain isn't a voice.** A speech-to-speech model gives a stressed driver a natural, interruptible conversation, but it isn't the strongest at weighing closing times, prices and rules. Claude is, but it can't hold a live spoken conversation. Here the voice model **calls Claude as a tool mid-conversation**, so you get Claude's judgement in the voice's tone and speed.
2. **Watching isn't understanding.** The on-device detector sees a person sit in chair A instantly, but can't tell if it's you. Claude can, from one photo. So the detector notices the change and Claude is asked one precise question at exactly that moment.
3. **One loop, eyes on the road.** Separate apps would each make you stop, look and tap. In one system the camera notices, Claude decides and the voice tells you.
4. **Each model runs only when it's worth it.** The detector runs on every frame for free; Claude runs a handful of times per session; the voice runs only while someone is talking.

## 7. User flows

### 7.1 Park me (live on stage)

1. **Set up.** Phone on a stand near the door, rear camera on the room. Open Plan P → **Park me**. Boxes appear over every chair: green = free, red = taken.
2. **"This is me."** You stand in front of the camera for 2 seconds. Plan P: *"Got you: black hoodie, white sneakers."*
3. **"Find me a spot"**, spoken (optionally "near the window") or tapped.
4. **The chain.** Claude labels three free chairs **A, B, C** on the video, with a reason each. The voice: *"Plan A: second row, left, about six steps."*
5. **You walk.** The camera keeps watching.
6. **The chair thief.** A friend sits in Plan A first. The detector sees a person on chair A, Claude confirms it's not you, and:
   - chair A turns red with a ✕,
   - the highlight jumps to Plan B,
   - the voice: *"Plan A just got taken. Heading to Plan B, three steps to your right."*
7. **You sit in Plan B.** Claude confirms it's you. *"Great landing. You're parked."* Success screen with the session timeline from Anbaric.
8. **Every chair taken (edge case).** *"This lot is full. Plan B is the room next door."*
9. **QR code** on the screen: "Want Plan P for your car? Join the waitlist."

### 7.2 Park my car

1. **Open Park my car.** A map of San Francisco with parking garages shown as pins.
2. **Say or choose where you're going.** "Investor meeting at Frontier Tower, two o'clock, about an hour." Or pick a preset, or tap the map.
3. **Choose where you're starting.** Preset demo start, or "Use my location".
4. **"Plan my parking."** Claude picks the 3 best lots, labelled **A, B, C**, each with a one-line reason (*"Closest walk, open past your meeting"*).
5. **See the snake.** One driving route: Start → A → B → C. Current segment bright, backups faded.
6. **Drive (or simulate driving).** A car icon moves toward Plan A.
7. **Plan A is full.** Say "It's full" or tap the big red button. Plan A gets a red ✕, the snake head moves to Plan B, and the voice: *"No problem. Heading to Plan B: Sutter-Stockton Garage. 3 min drive, 4 min walk."*
8. **Open in Maps** for turn-by-turn directions to the current lot.
9. **Parked.** "I parked" → walking time to the meeting and a success screen.
10. **Every lot full (edge case).** The snake grows: Plan D, E, F get added.

## 8. Features and acceptance criteria

### Park me

**F1. Live camera with chair and person detection**
- Rear camera fills the screen. The on-device detector runs on every frame it can (target ≥ 10 per second on iPhone 13) and draws boxes around chairs.
- A 2-second **room scan** locks in chair positions (the phone is fixed) and gives each a stable ID. Later frames only check which chairs have a person on them.
- A chair is **taken** when a person's box covers it for at least 1 second, **free** after 2 seconds without one (stops flicker).
- **Done when:** on the deployed link on an iPhone 13, chairs in a real room show green or red correctly as people sit and stand.

**F2. "This is me"**
- One frame of the driver goes to Claude, which returns a short clothing description. Shown on screen and spoken. Held in memory only for the session.
- **Done when:** the description matches what you're wearing.

**F3. Seat chain (A/B/C) with distance**
- Distance per free chair estimated from its size in the picture (a chair is about 0.85 m tall); shown as steps (0.75 m each) plus left / ahead / right.
- Closest-first ranking is the input to Claude and the fallback.
- **Done when:** A/B/C labels appear on three free chairs with step counts that are roughly right.

**F4. Thief detection and reroute**
- When the target chair becomes taken, a cropped frame goes to Claude: "Is the person in this chair the driver described as …?"
- Not the driver → mark ✕, move to the next chair **instantly**, speak the change. Driver → F5.
- Low confidence, error or no answer within 4 seconds → "That's me" / "Someone else" buttons.
- **Done when:** a second person sitting in Plan A reroutes to Plan B within 4 seconds, at least 4 times out of 5.

**F5. Great landing**
- Driver confirmed in the target chair → *"Great landing. You're parked."* Success screen with time taken and the session timeline.
- **Done when:** sitting in the target chair triggers it within 4 seconds.

### Park my car

**F6. Map of San Francisco with parking lots**
- Centered on downtown SF. All 12 fake garages as pins. Tapping one shows name, price per hour, hours, clearance and status.
- **Done when:** the map loads on a phone and all pins are tappable.

**F7. Choose destination and start**
- Preset meeting places + "tap on map", optional meeting time and length. Start: preset or "Use my location" (HTTPS only).
- **Done when:** destination shows as a flag pin and start as a car pin.

**F8. Backup chain: deterministic core (no AI)**
- Walking distance from each lot to the destination (straight line; 80 m per minute). Ignore full lots and lots more than 15 minutes' walk away. Sort by shortest walk.
- Input to Claude and fallback when Claude or Anbaric fails.
- **Done when:** the ranked list shows walk times and the logic has unit tests.

**F9. Snake route**
- One OSRM driving route through Start → A → B → C. Driven part grey; current segment bright with a flowing dash; backups faded. Pins labelled A, B, C. Straight lines + "approximate route" if OSRM takes over 5 seconds.
- **Done when:** the current segment is clearly different from the backups.

**F10. "Lot is full" and chain extension**
- Big red button at the bottom (at least 64 px tall) and the voice command. Reroute happens instantly from the existing chain (< 2 seconds); Claude's re-plan updates the rest in the background. When fewer than 2 plans are left ahead, add the next 3 (D, E, F), so there is always a backup.
- **Done when:** repeated "full" walks A → B → C → D… without errors.

**F11. Open in Apple Maps / Google Maps**
- iPhone: `https://maps.apple.com/?daddr=LAT,LNG&dirflg=d`. Otherwise: `https://www.google.com/maps/dir/?api=1&destination=LAT,LNG&travelmode=driving`.
- **Done when:** it opens the maps app with the right garage.

**F12. Simulate drive (demo mode)**
- The car icon moves along the route; on arrival: "Is there space?" → "Yes, I parked" / "Lot is full".
- **Done when:** the full car demo runs on a laptop without moving.

### Shared

**F13. Anbaric engine**
- An Anbaric app with two state machines: `park-me` (scanning → ready → planning → guiding → checking → landed) and `park-car` (planning → driving → arrived → parked). Each session is a job.
- Planning runs as an Anbaric agentic action with Claude Opus 5.5 (structured output; IDs checked against the candidates).
- Events (seat taken, lot full, landed) are recorded with the right actor: `Human` (driver), `Code` (camera), `Agent` (Claude, voice).
- **Done when:** a full Park me run appears in the Anbaric console as one job with every state change and actor.

**F14. Voice (OpenAI Realtime)**
- "Talk" button opens a live voice session (WebRTC) using a short-lived key from our server. Tools: `find_spot(wish?)`, `lot_full()`, `parked()`, `where_to()`, `repeat()`.
- Plan P also pushes announcements into the session (reroutes, "Great landing") so the same voice speaks them.
- **Done when:** in both modes, saying the command triggers the right action and the reply is spoken.

**F15. Model trace (for the judges)**
- Collapsible panel listing each AI call: model, what it did, how long, what it cost; the detector shown with frames per second and $0. Link to the session's job in the Anbaric console.
- **Done when:** after one Park me run the panel shows both models and a session cost.

**F16. Calm, playful design**
- Car mode: big text, few words, one action at a time, red only for "full". Park me: fun and readable from the back of the room.
- **Done when:** a non-technical person can run either demo without explanation.

**F17. Base44 waitlist (built by the founder, no code)**
- One page: what Plan P is in one line, email, "Would you pay $4.99/month for this? Yes / Maybe / No", optional "What do you drive to most?". Shows a live count of signups.
- QR code on the last demo screen and on the landing page ("Join the waitlist").
- **Done when:** scanning the QR on a phone and submitting adds a row visible in Base44, and the count updates.

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

Prices used: Claude Opus 5.5 $4 in / $20 out per 1M tokens. gpt-realtime-2.1-mini $10 audio in / $20 audio out per 1M tokens; about 600 tokens per minute of listening and 1,200 per minute of speaking, so roughly **$0.006/min listening and $0.024/min speaking**.

**Park my car**: one trip with one plan, one re-plan, about a minute of talking each way.

| Step | Model | Usage | Cost |
|---|---|---|---|
| Plan + re-plan | Claude Opus 5.5 | 2 × (~4k in, ~1.5k out, effort `low`) | ~$0.092 |
| Conversation | gpt-realtime-2.1-mini | ~1 min listening, ~1 min speaking, plus instructions | ~$0.035 |
| **Total** | | | **≈ $0.13** |

**Park me**: one 2-minute session.

| Step | Model | Usage | Cost |
|---|---|---|---|
| Chair/person detection | on-device detector | every frame | **$0** |
| Pick the chain | Claude Opus 5.5 | 1 × (~3k in, ~1.5k out) | ~$0.042 |
| "This is me" + 2 driver checks | Claude Opus 5.5 | 3 × (~1.2k in incl. a small photo, ~150 out) | ~$0.024 |
| Conversation | gpt-realtime-2.1-mini | ~30 s each way | ~$0.015 |
| **Total** | | | **≈ $0.08** |

- **Hosting:** Anbaric Cloud, free for 3 months with `SFTW26`, then $20/month for the small instance. Netlify free tier.
- **Consumer (car):** $4.99/month. A heavy user (20 trips) costs about $2.60 in AI calls, so around 48% gross margin even at list prices; a typical user (8 trips) about $1.05, so around 79%.
- **Lot-side cameras (later):** the Park me pipeline on a camera over a parking lot. Detection is free on the device and Claude runs only when a space changes, so a 100-space lot costs cents per day.
- **Easy savings** (not needed to be viable): prompt caching of lot data; Claude Sonnet 5.5 for planning if quality holds.

Prices checked Oct 11 2026. Claude prices from Anthropic's model table; OpenAI Realtime prices and per-minute token counts from OpenAI's pricing page and public guides, to confirm before submitting.

## 11. Out of scope for this slice

- Real-time garage availability (fake data only)
- Reservations or payments
- Driver accounts and login (Clerk removed; Anbaric console login is for us only)
- Face recognition or storing any images (clothing description only, in memory)
- Native iPhone/Android app
- Typing an address (presets, tap-on-map and voice only)
- Cities other than San Francisco

## 12. Technical approach

| Piece | Choice | Why |
|---|---|---|
| Frontend | **Next.js 16 + React + TypeScript** on **Netlify** (reused) | Already deploys; HTTPS so camera, mic and location work on the phone |
| Backend | **Anbaric** (`anbaric` npm package), hosted on **Anbaric Cloud** | Audited state machines for each session, built-in Claude agent, admin console |
| On-device detection | **MediaPipe Tasks Vision** object detector, EfficientDet-Lite0 (COCO classes include chair, couch, person) | Runs in iPhone Safari on the GPU, no server cost |
| Voice | **OpenAI Realtime** over WebRTC, short-lived key from our server | Speech-to-speech with tool calls, low latency |
| Brain | **Claude Opus 5.5** via Anbaric's `AnthropicAgent` (planning) and `@anthropic-ai/sdk` (photo checks) | Strongest reasoning + vision |
| Map, routes | Leaflet + react-leaflet with OpenStreetMap; OSRM public server | Free, no keys |
| Waitlist | **Base44** | No-code; built by the founder in parallel |
| Tests | **Vitest** | Quick, for plain logic files |
| Styling | Tailwind + shadcn/ui (reused) | Already set up |
| Code review | **Prelint** on every pull request | Catches drift from this PRD |

## 13. Build plan: small batches

Each batch ends with something you can **see working**, a **pull request** (Prelint reviews it) and a merge. **Netlify must be connected before batch 3**, because the camera only works on HTTPS.

| # | Batch | Time | You can see… |
|---|---|---|---|
| 0 | Setup, cleanup, landing page; remove Clerk | done / 0:10 | Plan P landing page, no login |
| 1 | Car: map + fake garages + deterministic chain + tests | 1:00 | SF map with 12 pins, ranked list with walk times |
| 2 | Car: snake route + "Lot is full" button + chain extension | 1:00 | Tapping moves the snake head forward |
| 3 | **Park me: camera + on-device detection + room scan + free/taken + A/B/C with steps** (no cloud AI yet) | 1:15 | On the iPhone: green/red boxes on real chairs, A/B/C labels |
| 4 | **Anbaric engine + Claude planner** for both modes, deployed to Anbaric Cloud; model trace panel | 1:15 | Chains with Claude's reasons; each session is a job in the Anbaric console |
| 5 | **Claude photo checks**: "This is me", thief check, Great landing | 0:45 | The full chair-thief demo, using buttons instead of voice |
| 6 | **Voice: OpenAI Realtime** with tools, both modes | 1:00 | Say "find me a spot" / "it's full"; it answers out loud |
| 7 | Open in Maps + simulate drive + landing page buttons for both modes + waitlist QR | 0:45 | Full car demo on a laptop |
| 8 | Rehearse on stage (stand, AirPlay), film video, fill in submission | 1:00 | Video + submitted form |

**In parallel (founder, no code):** build the Base44 waitlist (F17) and send me its link.

**Accounts and keys needed:**
- before batch 3: Netlify connected
- before batch 4: `ANTHROPIC_API_KEY`; an Anbaric Cloud account (promo `SFTW26`)
- `OPENAI_API_KEY` is already set

### Live demo script (about 2 minutes, on stage)

| Time | What happens |
|---|---|
| 0:00–0:20 | "You're late for a meeting and the garage is full. Plan P always has a Plan B. Let me show you with chairs." Phone on the stand, mirrored on the projector. |
| 0:20–0:40 | Boxes on every chair. "This is me" → *"Got you: black hoodie."* |
| 0:40–1:00 | "Find me a spot near the window." → A/B/C on screen, *"Plan A: second row, left, about six steps."* |
| 1:00–1:30 | Walk. A friend steals chair A. *"Plan A just got taken. Heading to Plan B."* Sit. *"Great landing."* |
| 1:30–1:50 | Model trace + the Anbaric console: the session as one audited job, every decision and who made it. |
| 1:50–2:00 | QR code: "Join the waitlist." Live count. |

### Video (4 minutes)

| Time | Shot |
|---|---|
| 0:00–0:30 | The problem: circling a full garage before a meeting. The 83 hours/year stat. |
| 0:30–1:30 | Park me in a real room, chair thief included. |
| 1:30–2:40 | Park my car: say the meeting, Claude's chain with reasons, snake route, a real drive to a full SF garage, "it's full" by voice, spoken reroute (a passenger runs the phone; the driver never touches it). Open in Apple Maps. |
| 2:40–3:20 | How it works: voice model calls Claude as a tool; the Anbaric audit trail; cost per trip. |
| 3:20–4:00 | Why it matters, waitlist numbers, pricing, what's next (lot-side cameras). |

## 14. Success criteria

- Both demo stories (§7) run start to finish 3 times in a row without errors, on the deployed link.
- Park me: the detector runs at 10+ frames per second on the iPhone 13; the thief reroute and Great landing each fire within 4 seconds, 4 times out of 5.
- Car: from "full" (voice or tap) to the new target on screen in under 2 seconds; the voice starts within 3 seconds.
- A full session shows up in the Anbaric console with every state change and actor.
- The waitlist QR works from a phone in the audience.
- A non-technical person can run either demo after one explanation.

## 15. Risks

| Risk | What we do |
|---|---|
| Room lighting or angle confuses the detector | Rehearse in the demo room; tall stand angled down; "rescan" button; tested threshold for "taken" |
| Claude mixes up the driver and the thief | Thief wears clearly different clothes; low confidence shows "That's me" / "Someone else" |
| Claude photo check too slow on stage | Small cropped image, effort `low`; buttons after 4 s; if still slow, swap that one call to Claude Sonnet 5.5 (one line) |
| Anbaric queueing adds delay | The reroute never waits for Anbaric: the browser moves instantly and Anbaric records it after. The page checks Anbaric about once a second for Claude's re-plan. |
| Anbaric app down or not deployed in time | Next.js falls back to the closest-first chain and calls nothing else; demo still runs without Claude's reasons |
| OpenAI Realtime connection drops | Big buttons + browser voice for announcements |
| Camera, mic or location blocked | They need HTTPS; always test on the Netlify link |
| Audience can't see the phone | AirPlay mirroring to the Mac on the projector; big labels |
| API keys exposed | Keys stay on servers (Netlify env, Anbaric secret store); the voice uses a short-lived key |
| Running out of time | Must-haves: batches 1–5. Voice (6) falls back to buttons. |
| Privacy concern about cameras | Clothing description only, no faces, nothing stored, frames dropped after each call |

## 16. After the slice (what we'd build next)

1. **Lot-side cameras:** the Park me engine on existing garage cameras or a cheap phone on a pole, giving real-time free-space counts. This is how we get real availability data.
2. Garage partners and SFMTA sensor feeds; crowd-sourced "full" reports from other Plan P drivers.
3. Reserve and pay for the backup spot in advance, so Plan B is guaranteed.
4. Fleets: field-sales and home-service teams, using the Anbaric audit trail and roles (dispatcher, driver).
5. Driver accounts and saved places; CarPlay / Android Auto.
