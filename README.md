# AI Hacker House — Equinox Edition

Hackathon project, likely targeting the **Agents on Stellar** track. Fully vibe-coded — implementation is driven by AI from the PRD, not hand-written.

See [HACKATHON.md](HACKATHON.md) for the full track rules and judging criteria.

## Status

- [x] `PRD.md` — product spec (Version 1: profiles, Version 2: Stellar)
- [x] V1 Batch 1 — app shell + login
- [ ] V1 Batch 2 — CV upload + AI executive summary
- [ ] V1 Batch 3 — AI chat-log upload + export instructions + "AI work" summary
- [ ] V1 Batch 4 — profile library (Name / Location / Superpower cards)
- [ ] Version 2 — Stellar wallet, tokens, access NFTs
- [ ] Deployed on Netlify

## Stack

- **Framework:** Next.js 16 (TypeScript)
- **UI:** [shadcn/ui](https://ui.shadcn.com/) + Tailwind CSS
- **Auth:** [Clerk](https://clerk.com)
- **AI:** OpenAI
- **Database:** Supabase
- **Blockchain/MCP:** [stellar-raven](https://raven.stellar.org/mcp) — Stellar MCP server, connected via Claude Code
- **Hosting:** Netlify (see [DEPLOYMENT.md](DEPLOYMENT.md))

## Docs

- [PRD.md](PRD.md) — product requirements (flow, functionality) — added separately
- [HACKATHON.md](HACKATHON.md) — track rules and judging criteria
- [DEPLOYMENT.md](DEPLOYMENT.md) — how to ship it to Netlify

## MCP

This project uses the `stellar-raven` MCP server (Raven — read-only Stellar ecosystem knowledge: projects, docs, research, audits, funding history).

```
claude mcp add --transport http stellar-raven "https://raven.stellar.org/mcp"
```

Already added to this project's local Claude config. Run `/mcp` in Claude Code and authenticate in the browser before using it.

## Getting started

```bash
cp .env.example .env.local   # then fill in the keys
npm install
npm run dev                  # http://localhost:3000
```
