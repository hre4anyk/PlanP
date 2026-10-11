# Plan P

When your parking plan falls apart, Plan P already has a backup ready. It sees which spots are taken, tells you where to go next, and reroutes you without you touching the phone.

Two modes: **Park me** (a phone camera finds you a free chair in a room, live demo) and **Park my car** (a backup chain of SF garages near your meeting).

Built for the Multi Model Hackathon (SF Tech Week, Oct 11 2026). Fully vibe-coded from the PRD.

- [PRD.md](PRD.md): product, judging rubric, build plan
- [ARCHITECTURE.md](ARCHITECTURE.md): components, API routes, where each model is called
- [SUBMISSION.md](SUBMISSION.md): submission form draft

## Models

| Role | Model | Where it's called |
|---|---|---|
| Brain: plan the backup chain, photo checks ("is that the driver?") | Claude Opus 5.5 (Anthropic) | `engine/src/planner.ts`, `src/app/api/look/route.ts` |
| Voice: speech-to-speech, calls Plan P actions as tools | gpt-realtime-2.1-mini (OpenAI) | `src/voice/realtime.ts` |
| Camera watcher (on the phone, not an AI service) | MediaPipe EfficientDet-Lite0 | `src/vision/detector.ts` |

## Status

- [x] Landing page
- [x] Clerk removed (no login in the demo)
- [ ] Batch 1 — car: map + fake garages + deterministic chain + tests
- [ ] Batch 2 — car: snake route + "Lot is full" + chain extension
- [ ] Batch 3 — Park me: camera + on-device detection + free/taken seats + A/B/C
- [ ] Batch 4 — Anbaric engine + Claude planner (both modes) + model trace
- [ ] Batch 5 — Claude photo checks: "this is me", chair thief, Great landing
- [ ] Batch 6 — voice (OpenAI Realtime with tools)
- [ ] Batch 7 — open in Maps + simulate drive + landing buttons + waitlist QR
- [ ] Batch 8 — rehearsal, video, submission

## Stack

- **Framework:** Next.js 16 (TypeScript)
- **UI:** [shadcn/ui](https://ui.shadcn.com/) + Tailwind CSS
- **Backend:** [Anbaric](https://github.com/anbaric-ai/anbaric-cloud) app in `engine/` (audited state machines, Claude agent), hosted on Anbaric Cloud
- **AI:** Claude (Anthropic) and OpenAI Realtime; keys stay on the server
- **Waitlist:** Base44
- **Database:** Supabase (wired up, not used by the demo yet)
- **Hosting:** Netlify for the web app, Anbaric Cloud for the engine (see [DEPLOYMENT.md](DEPLOYMENT.md))
- **Code review:** Prelint on every pull request

## Getting started

```bash
cp .env.example .env.local   # then fill in the keys
npm install
npm run dev                  # http://localhost:3000
# engine (from batch 4): PORT=4000 npx tsx engine/src/main.ts
```
