<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Base44 sandbox setup

- **Runtime:** Next.js 16.3.6 (Turbopack) on Node 22, via `docker-compose.base44.yml`.
- **Credentials:** `ANTHROPIC_API_KEY`, `GOOGLE_MAPS_API_KEY`, and `OPENAI_API_KEY` are wired via `env_file: /run/base44/app.env` (Base44 secrets dashboard). Placeholder defaults in `.env.base44-defaults` let the app boot before real values are provided. On `main`, none are used at boot — they matter only in API routes on feature branches (`street-parking` uses Anthropic; `s2-street-journey` uses Anthropic + Google Maps).
- **`predev` script** (`scripts/mediapipe-assets.mjs`) copies MediaPipe WASM from `node_modules` and downloads the EfficientDet-Lite0 model into `public/mediapipe/`. It needs network access on first boot; the download is cached on the named volume thereafter.
- **`allowedDevOrigins`** in `next.config.ts` is conditionally set only when `BASE44_PREVIEW_MODE === "1"` so the preview proxy can load dev assets/HMR. No effect in normal local dev.
- **Three routes:** `/` (landing), `/car` (Park my car — Leaflet map), `/me` (Park me — camera demo).
- **Verify:** `docker compose -f docker-compose.base44.yml up -d`, then curl `http://localhost:3000/` — expect 200 with `<title>Plan P — your backup parking, already planned</title>`.
