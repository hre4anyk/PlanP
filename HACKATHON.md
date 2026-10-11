# Hackathon Rules & Tracks

Reference notes for the AI Hacker House — Equinox Edition hackathon. Kept separate from the project [README](README.md) so the repo root stays about *our* project.

## Tracks

Five tracks this edition. Pick the one that fits your idea, or go with Open Track if it doesn't fit anywhere else.

When you submit on TAIKAI you'll tag your project with one of five labels: agents on stellar, sustainability, workplace wellbeing, social good, or open.

### 🌐 Agents on Stellar
Sponsor track, by HackMeridian

Defined by what an agent does, not by which tool it was built with. Use at least one of Stellar's three capabilities and be measured on what your agent can do as a result.

**What you can build on**
- **Knowledge, Raven.** MCP server exposing the Stellar ecosystem as callable tools: projects, docs, research, audits, funding history. Read-only, no wallet needed.
- **Money, agentic payments.** x402 and the Machine Payments Protocol: per-request payments over HTTP with stablecoin settlement.
- **Authority, smart wallets.** Contract accounts with policy signers and passkeys, enforcing what an agent may spend, sign or do.
- Anything else on Stellar counts equally.

**Valid:** the agent acts (decides, moves value, produces something usable); at least one Stellar capability runs and affects behaviour (testnet fine); built during the event; runs live or on recording; submitted with repo/link, demo and a paragraph on what it does.

**Invalid:** Stellar only used while researching, not in the build; nothing runs (slides/mockups only); existing project with no real event work; faked results presented as live; missing demo or description.

### ⚡ Build with Jev
Jev, from TypeSafe, returns typed, calibrated decisions in milliseconds instead of generating text. Use it anywhere you'd otherwise write a brittle if-statement or a slow LLM call: classify, route, score, extract, branch.

**Lands well:** the decision's confidence score is visible, and speed/cost is part of the demo (a toggle against a slow LLM call makes it obvious).

**Trap:** Jev mentioned but never actually called; a faked or hardcoded decision shown as live.

### 🌱 Sustainability
AI tools that track, reduce or rethink environmental impact: energy, waste, supply chains, consumption. A carbon dashboard nobody checks changes nothing; aim for one decision someone actually makes because of your tool.

**Lands well:** an invisible cost made visible enough to change a choice on the spot.

**Trap:** pretty charts with no action attached; overstating impact you can't verify.

### 💼 Workplace Wellbeing
Tools that ease the mental load of work: burnout, focus, communication overload, admin. Give someone back time or headspace, don't add a sixth app to check.

**Lands well:** a concrete moment of friction disappearing (a backlog that triages itself, an inbox that flags what actually needs you).

**Trap:** a habit tracker that becomes one more guilt trip; a calm colour palette standing in for real care.

### 🤝 Social Good
AI for a real community need: accessibility, education, civic participation, underserved groups. Pick one moment in someone's day, not a whole system.

**Lands well:** specific enough that the room can picture the exact person it helps.

**Trap:** building for a group you've never talked to; generic empathy framing over a generic chatbot.

### 🎲 Open Track
No theme, no constraints. If your idea doesn't fit elsewhere but it's worth building, this is your lane. Anchor it in a person, a technique, or pure delight, whichever you actually mean.

## Choosing a track

| If the core question is... | Track | Tag |
|---|---|---|
| "Does an agent actually act on Stellar?" | 🌐 Agents on Stellar | agents on stellar |
| "Does this put Jev's decisions to work?" | ⚡ Build with Jev | build with jev |
| "Does this shrink a footprint or a bill?" | 🌱 Sustainability | sustainability |
| "Does this give someone at work time or headspace back?" | 💼 Workplace Wellbeing | workplace wellbeing |
| "Does this help one person navigate something hard?" | 🤝 Social Good | social good |
| "Do I want this to exist?" | 🎲 Open Track | open track |

## What tends to land

- Demo under 30 seconds, no explanation needed
- Deployed — a link beats a localhost screen-share
- One finished feature beats four half-built
- Knows what it isn't ("this doesn't diagnose", "this is demo data")
- You can name who it's for, and they're a real person
