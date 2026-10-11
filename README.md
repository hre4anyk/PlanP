# Plan P

When your parking plan falls apart mid-drive, Plan P already has a backup ready and reroutes you there with one tap.

Hackathon project, fully vibe-coded from the PRD. See [PRD.md](PRD.md).

## Status

- [x] Landing page
- [ ] Batch 1 — SF map + fake garages
- [ ] Batch 2 — destination/start + backup chain logic
- [ ] Batch 3 — snake route
- [ ] Batch 4 — "Lot is full" + chain extension
- [ ] Batch 5 — open in Maps + simulate drive
- [ ] Batch 6 — calm mobile design + voice
- [ ] Batch 7 — phone test, deploy, demo rehearsal

## Stack

- **Framework:** Next.js 16 (TypeScript)
- **UI:** [shadcn/ui](https://ui.shadcn.com/) + Tailwind CSS
- **Auth:** [Clerk](https://clerk.com) (wired up, not used by the demo yet)
- **Database:** Supabase (wired up, not used by the demo yet)
- **Hosting:** Netlify (see [DEPLOYMENT.md](DEPLOYMENT.md))

## Getting started

```bash
cp .env.example .env.local   # then fill in the keys
npm install
npm run dev                  # http://localhost:3000
```
