<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Base44 sandbox setup

- **Runtime:** Next.js 16.3.6 (Turbopack) on Node 22, via `docker-compose.base44.yml`.
- **No external credentials needed to boot.** The app is a frontend-only demo at this stage. `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `ENGINE_URL`, and `SUPABASE_*` are only referenced in modules not imported by any page (`src/lib/supabase.ts` has `import "server-only"` and is unused by routes). Add them via the Base44 secrets dashboard when batches 4–6 land.
- **`predev` script** (`scripts/mediapipe-assets.mjs`) copies MediaPipe WASM from `node_modules` and downloads the EfficientDet-Lite0 model into `public/mediapipe/`. It needs network access on first boot; the download is cached on the named volume thereafter.
- **`allowedDevOrigins`** in `next.config.ts` is conditionally set only when `BASE44_PREVIEW_MODE === "1"` so the preview proxy can load dev assets/HMR. No effect in normal local dev.
- **Three routes:** `/` (landing), `/car` (Park my car — Leaflet map), `/me` (Park me — camera demo).
- **Verify:** `docker compose -f docker-compose.base44.yml up -d`, then curl `http://localhost:3000/` — expect 200 with `<title>Plan P — your backup parking, already planned</title>`.
