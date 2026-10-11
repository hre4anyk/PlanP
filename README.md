# Plan P

When your parking plan falls apart, Plan P already has a backup ready. It sees which spots are taken, tells you where to go next, and reroutes you without you touching the phone.

Two modes: **Park me** (a phone camera finds you a free chair in a room, live demo) and **Park my car** (a backup chain of SF garages near your meeting).

Built for the Multi Model Hackathon (SF Tech Week, Oct 11 2026). Fully vibe-coded from the PRD.

- [PRD.md](PRD.md): product, judging rubric, build plan
- [ARCHITECTURE.md](ARCHITECTURE.md): components, API routes, where each model is called
- [SUBMISSION.md](SUBMISSION.md): submission form draft

## Models

| Job | Model |
|---|---|
| Find chairs and people in every camera frame (on the phone) | EfficientDet-Lite0 via MediaPipe (Google) |
| Is that you or someone else? Is this seat really free? | Gemini 2.5 Flash (Google) |
| Plan and re-plan the backup chain | Claude Opus 5.5 (Anthropic) |
| Voice command → action | Claude Haiku 5.5 (Anthropic) |
| Speech to text | gpt-4o-mini-transcribe (OpenAI) |
| Text to speech | gpt-4o-mini-tts (OpenAI) |

## Status

- [x] Landing page
- [ ] Batch 1 — car: map + fake garages + deterministic chain + tests
- [ ] Batch 2 — car: snake route + "Lot is full" + chain extension
- [ ] Batch 3 — Park me: camera + on-device detection + free/taken seats + A/B/C
- [ ] Batch 4 — Claude planner (both modes) + model trace
- [ ] Batch 5 — Gemini: "this is me", chair thief, Great landing
- [ ] Batch 6 — voice (transcribe + Haiku intents + TTS)
- [ ] Batch 7 — open in Maps + simulate drive + landing buttons
- [ ] Batch 8 — rehearsal, video, submission

## Stack

- **Framework:** Next.js 16 (TypeScript)
- **UI:** [shadcn/ui](https://ui.shadcn.com/) + Tailwind CSS
- **AI:** Anthropic, Google Gemini and OpenAI SDKs, called only from server route handlers
- **Auth:** [Clerk](https://clerk.com) (wired up, not used by the demo yet)
- **Database:** Supabase (wired up, not used by the demo yet)
- **Hosting:** Netlify (see [DEPLOYMENT.md](DEPLOYMENT.md))

## Getting started

```bash
cp .env.example .env.local   # then fill in the keys
npm install
npm run dev                  # http://localhost:3000
```
