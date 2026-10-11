<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Base44 sandbox setup

- **Runtime:** Next.js 16.3.6 (Turbopack) on Node 22, via `docker-compose.base44.yml`.
- **Credentials:** `ANTHROPIC_API_KEY`, `GOOGLE_MAPS_API_KEY`, and `OPENAI_API_KEY` are wired via `env_file: /run/base44/app.env` (Base44 secrets dashboard). Placeholder defaults in `.env.base44-defaults` let the app boot before real values are provided. Curb analysis needs real Anthropic and Google keys; the precomputed demo still needs a Google key for its photo proxy. OpenAI is reserved for the voice feature.
- **`allowedDevOrigins`** in `next.config.ts` is conditionally set only when `BASE44_PREVIEW_MODE === "1"` so the preview proxy can load dev assets/HMR. No effect in normal local dev.
- **Current page routes:** `/` (landing), `/car` (Park my car — Leaflet map and Street View journey).
- **Verify:** `docker compose -f docker-compose.base44.yml up -d`, then curl `http://localhost:3000/` — expect 200 with `<title>Plan P — your backup parking, already planned</title>`.
- **Sandbox flag:** Compose passes the platform's `BASE44_PREVIEW_MODE` through without setting it. Only the exact value `"1"` enables the preview-origin override; unset/other values retain normal Next.js behavior. Dependencies are synchronized from the lockfile with `npm ci` at startup.
- **Parking journey:** The initial Frontier Tower → South Park demo uses precomputed photos. Marking a garage occupied loads a new drive from that garage to the next plan via `src/logic/journey.ts`; walking distances always remain relative to the original meeting. Reset aborts pending analysis. Street View dates/analysis are historical, not live availability.
- **Tests:** `docker compose -f docker-compose.base44.yml exec -T web npm test`; journey tests mock both routing and curb analysis, so they do not call paid providers.
