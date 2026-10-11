# Plan P

When your parking plan falls apart mid-drive, Plan P already has a backup ready. It sees the "FULL" sign, tells you where to go next, and reroutes you without you touching the phone.

Built for the Multi Model Hackathon (SF Tech Week, Oct 11 2026). Fully vibe-coded from the PRD.

- [PRD.md](PRD.md): product, judging rubric, build plan
- [ARCHITECTURE.md](ARCHITECTURE.md): components, API routes, where each model is called
- [SUBMISSION.md](SUBMISSION.md): submission form draft

## Models

| Job | Model |
|---|---|
| Plan and re-plan the backup chain | Claude Opus 5.5 (Anthropic) |
| Voice command → action | Claude Haiku 5.5 (Anthropic) |
| Read garage signs from the camera | Gemini 2.5 Flash (Google) |
| Speech to text | gpt-4o-mini-transcribe (OpenAI) |
| Text to speech | gpt-4o-mini-tts (OpenAI) |

## Status

- [x] Landing page
- [ ] Batch 1 — map + fake garages + deterministic chain + tests
- [ ] Batch 2 — snake route + "Lot is full" + chain extension
- [ ] Batch 3 — Claude planner + model trace
- [ ] Batch 4 — Gemini sign reader
- [ ] Batch 5 — voice (transcribe + Haiku intents + TTS)
- [ ] Batch 6 — open in Maps + simulate drive
- [ ] Batch 7 — deploy, phone test, video, submission

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
