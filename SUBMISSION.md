# Submission — Multi Model Hackathon (SF Tech Week, Oct 11 2026)

One section per form field, ready to paste. The judging criterion each answer serves is noted in *italics* (delete before pasting).

## Project name

Plan P

## Tagline

Park effortlessly. Pitch confidently. Plan P's got you covered.

## Pitch

*Problem people care about, novelty, demo*

You're driving to the most important meeting of your life, in a city you don't know. You don't know where to park, you can't be late, and you haven't rehearsed. Plan P is a hands-free copilot for exactly that drive.

Tap one button and talk. Plan P asks where you're going, finds your parking plans (A, B, C… near the door) and asks "Let's go?". As you drive, Claude reads Google Street View photos of the curb at each plan and marks it green (free to park), red (can't park: hydrant, red curb, bus stop) or orange (occupied). Meanwhile the voice uses the dead time of the drive to rehearse the four questions every investor asks: what you do, the problem, your vision, and why your team. Before you arrive, Claude scores the whole pitch and gives you one fix. At each plan, the colour of the curb decides what happens next: green, park here; red or orange, Plan P tells you why and takes you to the next plan. You never touch the phone.

SF drivers lose 83 hours a year looking for parking (INRIX), and nobody walks into a meeting wishing they'd rehearsed less. Plan P solves both on the same drive, for about 45 cents.

## Code repository

https://github.com/hre4anyk/PlanP

## Demo

- **Live (iPhone, Safari):** https://getplanp.netlify.app/car (tap "Talk to Plan P", say "2 South Park Street")
- **Video:** _link_ (the full drive: Frontier Tower → 2 South Park, four questions, pitch score, red curb → Plan B, green curb → park)

## Models used and why

*Multi-model integration (25%)*

| Model | Job | Why this model |
|---|---|---|
| **Claude Opus 5.5** (Anthropic) | **The eyes:** reads each Street View photo facing the curb and returns a structured verdict: free to park / can't park / occupied, what's there (meter, hydrant, red curb, driveway, bike lane), a one-line reason and a box around the judged curb. | The strongest vision reasoner we tested on messy street scenes and parking rules; structured output means the app can act on every answer. Effort `low` keeps it ~1 cent a photo. |
| **Claude Opus 5.5** as an **Anbaric agent** (`claude-coach`) | **The judge:** scores the founder's whole spoken pitch 1–10 on clarity, proof and confidence, with what landed and one fix, using the founder's context. | Judging a pitch needs reasoning and honesty, not speed. It runs as an audited job on Anbaric, with Claude called directly as a fallback after 13 s. |
| **OpenAI gpt-realtime-2.1-mini** | **The voice:** speech in, speech out, over WebRTC. It runs the whole conversation and drives the app through four tools: `set_destination`, `start_drive`, `save_answer`, `i_parked`. | Natural, interruptible, low-latency speech in one model, built for a driver who can't look at a screen. The mini version keeps voice to cents per trip. Noise filtering and semantic turn detection handle a loud car or a stage. |
| **gpt-4o-mini-transcribe** (inside the Realtime session) | Transcribes what the founder says, so his exact answers reach Claude and appear on screen. | Cheap and accurate enough; Claude judges his real words, not the voice model's paraphrase. |

## Why multiple models beat multiple apps

*Multi-model integration, novelty*

A voice isn't a pair of eyes, and neither is a judge. The realtime voice model is great at conversation but can't read a curb in a photo or judge a pitch with care; Claude is, but it can't hold a live spoken conversation with a driver. In Plan P they work as one loop, each passing work to the other:

1. **Voice → app → Claude's eyes:** "2 South Park Street" becomes a destination; the app plans parking A–E; Claude has already read the curb photos along each drive.
2. **Claude's eyes → app → voice:** when the drive reaches a plan, the last photo's colour goes back to the voice, which tells the driver to park or explains why it's moving to Plan B, and the app reroutes.
3. **Voice → Claude the judge → voice:** the four spoken answers go to Claude as one pitch; its score and fix come back as speech, before the car arrives.

With separate apps you'd stop, look at a parking app, tap, open a coaching app, type your pitch, and read the feedback. That's impossible while driving. One system turns a stressful drive into rehearsal time, hands-free, and every trip and every score is an audited job on Anbaric.

## Team contributions

- **Nazar** (solo founder): product, design and engineering. Built with Claude Code (voice copilot, Street View + Claude pipeline, Anbaric engine) and Base44 (parking plans A–E, arrival popup, spot list and Fundy, the pixel dino that grows with your pitch score). Prelint reviewed every pull request against our PRD and architecture.

## What would you build next?

*Production-ready and economics (15%)*

- **Live availability:** Street View shows where parking is allowed, not whether a space is free right now. Next: drivers' phones confirm free and taken spaces as they pass (crowd-sourced), SFMTA meter and sensor data, and garage occupancy feeds.
- **Calendar in, pitch out:** pull the meeting address, time and investor from the calendar invite, and tailor the questions to that fund.
- **Reserve the backup:** book and pay for the Plan B garage in advance so it's guaranteed.
- **Fundy streaks:** the dino grows across trips, turning pitch practice into a daily habit.
- **CarPlay and Android Auto**, then more cities.

**Unit economics at standard list prices (no discounts):**

| Per trip | Cost |
|---|---|
| Voice, ~10 min (gpt-realtime-2.1-mini + transcription) | ~$0.15 |
| Street View photos for one parking plan (20 × $0.007) | ~$0.14 |
| Claude reading those photos (Opus 5.5, effort low) | ~$0.13 |
| Claude scoring the pitch (one call) | ~$0.01 |
| **Typical trip (one plan read live)** | **≈ $0.45** |
| Each extra plan (red/orange → next) | +$0.27 |

Curb verdicts belong to the street, not the driver, so they're cached and shared: the demo route was read once for $0.63 and replays for free. The more drivers, the cheaper each trip. At $9.99/month for founders and sales teams who drive to meetings, a heavy user (20 trips) costs about $9 today, falling with caching. The code is typed TypeScript with 38 unit tests, every key stays on the server, and every external call has a fallback.
