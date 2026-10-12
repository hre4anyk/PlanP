# Plan P

**Park effortlessly. Pitch confidently. Plan P's got you covered.**

A hands-free voice copilot for the drive to your most important meeting. Say where you're going: Plan P lines up parking plans A, B, C… near the door, has Claude read Google Street View photos of each curb (green: free to park, red: can't park, orange: occupied), and rehearses your investor pitch with you on the way. Claude scores the whole pitch before you arrive. At each plan, the colour of the curb decides: park here, or on to the next plan.

Built in one day for the Multi Model Hackathon (SF Tech Week, Oct 11 2026). Fully vibe-coded with Claude Code and Base44.

- **Live:** https://getplanp.netlify.app/car (iPhone first: tap "Talk to Plan P", say "2 South Park Street")
- [PRD.md](PRD.md): product, judging rubric, sub-batches
- [ARCHITECTURE.md](ARCHITECTURE.md): components, API routes, where each model is called, decisions
- [SUBMISSION.md](SUBMISSION.md): the submission form answers
- [DEPLOYMENT.md](DEPLOYMENT.md): Netlify + Anbaric Cloud

## Models

| Role | Model | Where it's called |
|---|---|---|
| Eyes: reads Street View photos of the curb, structured verdict per photo | Claude Opus 5.5 | `src/app/api/curb/route.ts` |
| Judge: scores the whole spoken pitch (as the Anbaric agent `claude-coach`) | Claude Opus 5.5 | `engine/src/machines.ts`, fallback `src/app/api/coach/route.ts` |
| Voice: speech-to-speech copilot, drives the app through tools | OpenAI gpt-realtime-2.1-mini | `src/voice/copilot.ts`, session in `src/app/api/voice-key/route.ts` |
| Fundy: scores a typed pitch to grow the dino | Claude Opus 5.5 | `src/app/api/pitch/route.ts` |

## Sponsors

- **Anbaric:** the trip engine in `engine/` (audited state machines `trip` and `answer-review`, Claude as an Anbaric agent), hosted on Anbaric Cloud.
- **Base44:** parking plans A–E, the arrival popup, the spot list and Fundy were built in Base44 on the same repo (branch `base44/setup-515c62ae`).
- **Prelint:** reviews pull requests against PRD.md and ARCHITECTURE.md.

## Stack

- **Web app:** Next.js 16 (TypeScript), Tailwind + shadcn/ui, on Netlify
- **Map and routing:** Leaflet + OpenStreetMap tiles, OSRM routing, Nominatim geocoding (all free)
- **Street View:** Google Street View Static API through a server proxy (the key never reaches the browser)
- **Queue between site and engine:** Netlify Blobs
- **Tests:** Vitest (`npm test`, 38 tests)

## Getting started

```bash
cp .env.example .env.local   # ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_MAPS_API_KEY, ENGINE_TOKEN
npm install
npm run dev                  # http://localhost:3000/car
npm test && npm run lint && npm run build
```

The engine runs separately: see [engine/](engine/) and [DEPLOYMENT.md](DEPLOYMENT.md). Without it, the site scores pitches with Claude directly.
