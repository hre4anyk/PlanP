# Plan P — Architecture

How the app is built, where each AI model is called, and the decisions behind it. Product requirements live in [PRD.md](PRD.md). Prelint reviews pull requests against both files, so update this one in the same PR when a decision changes.

## 1. System overview

```
 PHONE BROWSER (Next.js client)              NEXT.JS SERVER (Netlify)             ANBARIC APP (Anbaric Cloud)          PROVIDERS
 ┌───────────────────────────────┐          ┌─────────────────────────┐          ┌──────────────────────────────┐
 │ Park me                        │          │                         │          │ state machines               │
 │  camera + on-device detector   │          │                         │          │   park-me, park-car          │
 │  seat map, instant reroute     │─ JPEG ─► │ POST /api/look ─────────┼──────────┼──────────────────────────────┼──► Claude Opus 5.5
 │                                │          │                         │          │                              │
 │ Park my car                    │          │                         │          │                              │
 │  map + snake, instant reroute  │─ JSON ─► │ /api/engine/* (proxy) ──┼─ HTTP ─► │ POST /sessions               │
 │                                │◄─ poll ─ │                         │          │ POST /sessions/:id/events    │
 │                                │          │                         │          │ GET  /sessions/:id           │
 │                                │          │                         │          │  └ planner agent ────────────┼──► Claude Opus 5.5
 │ Voice                          │          │                         │          │ audit trail → admin console  │
 │  WebRTC audio + tool calls     │◄─ key ── │ POST /api/voice-key ────┼──────────┼──────────────────────────────┼──► OpenAI (mint short-lived key)
 │                                │◄═════════╪═════ audio (WebRTC) ════╪══════════╪══════════════════════════════╪══► gpt-realtime-2.1-mini
 └───────────────────────────────┘          └─────────────────────────┘          └──────────────────────────────┘
        │
        └──► OSRM public server (driving route, no key), called from the browser
```

- **Two AI models:** Claude Opus 5.5 (brain: planning + photo checks) and OpenAI gpt-realtime-2.1-mini (voice). The on-device detector is a free vision tool, not an AI service.
- **The browser owns the moment-to-moment state** (seat map, current target) and reroutes instantly. **Anbaric owns the session record**: the official state, Claude's plans and the audit trail.
- **Keys never reach the browser.** Claude keys sit in the Next.js server env (photo checks) and the Anbaric secret store (planning). The voice uses a short-lived key minted per session.
- **Next.js proxies to Anbaric** (`/api/engine/*`), so the browser never calls another origin (no CORS) and the engine URL stays configurable.

## 2. Code layout

```
src/                         Next.js app (Netlify)
  app/
    page.tsx                 landing page (links to both modes + waitlist QR)
    me/page.tsx              Park me (camera), client-side
    car/page.tsx             Park my car (map), client-side
    api/look/route.ts        Claude Opus 5.5 photo checks: describe driver, is-this-the-driver
    api/voice-key/route.ts   mint a short-lived OpenAI Realtime key
    api/engine/[...path]/route.ts   pass-through to the Anbaric app (ENGINE_URL)
  data/lots.ts               12 fake garages + preset places (typed)
  logic/
    geo.ts                   map distance and walk-minute math
    chain.ts                 closest-first ranking + chain extension (fallback, both modes)
    chain.test.ts
    seats.ts                 room scan, chair IDs, free/taken with debounce, steps + direction
    seats.test.ts
    route.ts                 OSRM call with 5 s timeout → straight-line fallback (one path + drive minutes per leg)
    route.test.ts
    trip.ts                  car trip in the browser: start, "Lot is full" → next plan, grow chain, full lots for the map
    trip.test.ts
  vision/
    detector.ts              starts the detector worker; sends one camera frame at a time (stale frames dropped)
    detector-worker.ts       Web Worker running MediaPipe (GPU first, CPU fallback with a fresh runtime)
    frame.ts                 grab a JPEG from the video, cropped to one chair
  voice/
    realtime.ts              WebRTC session, tool definitions, announce(text)
  ai/
    models.ts                ONE place for model IDs and list prices
    trace.ts                 timing + cost per call for the trace panel
  components/
    camera-view.tsx          video + box overlay + A/B/C labels
    map-view.tsx             Leaflet map, pins, snake polyline
    control-panel.tsx        pickers, chain list, big buttons
    talk-button.tsx          start/stop the voice session
    model-trace.tsx          trace panel + link to the job in the Anbaric console

engine/                      Anbaric app (Anbaric Cloud), its own package.json
  .anbaric/app-config.json   { "name": "planp-engine", "internalPort": 3000 }
  package.json               "type": "module", "main": "src/main.ts", depends on anbaric
  src/
    main.ts                  HTTP server: /sessions, /sessions/:id/events, /sessions/:id
    machines/park-me.ts      scanning → ready → planning → guiding → checking → landed
    machines/park-car.ts     planning → driving → arrived → parked
    planner.ts               AnthropicAgent + RemoteLLMAgenticAction, prompt + output schema
    actors.ts                Human("driver"), Code("camera"), Agent("claude-planner"), Agent("voice")
    machines.test.ts         drive both machines in memory
```

## 3. Data shapes

```ts
// Shared
type ChainItem = { id: string; label: string /* A, B, C, D… */; distance: string; reason: string };
type TraceEntry = {
  model: string; provider: "anthropic" | "openai" | "on-device";
  job: "detect" | "plan" | "look" | "voice";
  ms: number; costUsd: number; fallback: boolean;
};

// Park me (browser)
type Seat = {
  id: string;                                            // stable after the room scan, e.g. "S4"
  box: { x: number; y: number; w: number; h: number };   // normalised 0–1, fixed camera
  state: "free" | "taken";
  steps: number; direction: "left" | "ahead" | "right";
};

// Park my car (browser)
type Lot = {
  id: string; name: string; lat: number; lng: number;
  pricePerHour: number; hours: string; clearanceInches: number;
  rule?: string; status: "open" | "full";
};

// Anbaric job properties (each one has a PropertyDefinition with validation)
//   mode: "me" | "car"
//   candidates: Seat[] | Lot-with-walk-minutes[]      (sent by the browser)
//   wish?: string; meeting?: { at, minutes }; carHeightInches?: number
//   chain: ChainItem[]; currentIndex: number; takenIds: string[]
//   driver?: string                                  (clothing description, session only)
//   outcome?: "landed" | "parked"
```

## 4. Models

All model IDs and prices sit in `src/ai/models.ts` (and the planner's in `engine/src/planner.ts`), so a model can be swapped in one line.

| Job | Where | Model | Input → output | Latency budget |
|---|---|---|---|---|
| Plan / re-plan chain | Anbaric agentic action | `claude-opus-5-5`, effort `low` | job properties → `{ chain: ChainItem[], spoken: string }` (structured output) | 6 s |
| Describe driver / is-this-the-driver | `/api/look` | `claude-opus-5-5`, effort `low` | small JPEG (+ driver description) → `{ description }` / `{ isDriver, confidence }` | 4 s, then buttons |
| Voice conversation + tool calls | browser ⇄ OpenAI over WebRTC | `gpt-realtime-2.1-mini` | speech ⇄ speech; tools `find_spot`, `lot_full`, `parked`, `where_to`, `repeat` | real-time |
| Chair + person detection | browser | MediaPipe EfficientDet-Lite0 (not an AI service) | frame → boxes (`chair`, `couch`, `person`) | < 100 ms per frame |

Notes:
- **Claude in Anbaric:** `AnthropicAgent` + `RemoteLLMAgenticAction` with a JSON Schema for the chain. Anbaric constrains the output to the schema; our code still checks every ID against the candidates and drops unknown ones. The prompt is saved in Anbaric's prompt manager, so it's versioned and visible in the console.
- **Claude in `/api/look`:** `@anthropic-ai/sdk` directly, because this check is time-critical and shouldn't wait on a job queue. Images resized to ≤ 768 px and cropped to the chair. The result is posted to the Anbaric job as an event, attributed to `Agent("claude-eyes")`.
- **Opus 5.5 thinking can't be turned off;** speed and cost are controlled with `effort: "low"`.
- **OpenAI Realtime:** the browser connects over WebRTC with a short-lived key from `/api/voice-key`. Tool calls arrive on the data channel; the browser runs them (instant reroute, call the engine) and returns the result. Announcements are sent into the same session so one voice speaks everything. Exact endpoint and event names get checked against OpenAI's Realtime docs when it's built (batch 6).
- **MediaPipe:** `@mediapipe/tasks-vision` in a Web Worker so the camera view stays smooth on phones; 640×480 camera frames; runtime and model copied into `public/mediapipe/` by `scripts/mediapipe-assets.mjs` before dev/build, so the demo doesn't depend on a CDN.

## 5. Fallbacks

| Step | Fails how | Fallback | Trace shows |
|---|---|---|---|
| Detector | model fails to load | Message + switch to Park my car | n/a |
| Claude photo check | error, low confidence, or > 4 s | "That's me" / "Someone else" buttons | `fallback: true` |
| Anbaric engine / planner | unreachable, > 6 s, invalid IDs | `chain.ts` closest-first in the browser, generic reasons; events queued and retried | `fallback: true` |
| OpenAI Realtime | can't connect or drops | Big buttons; announcements via browser `speechSynthesis` | `fallback: true` |
| OSRM | > 5 s or error | Straight lines + "approximate route" | n/a |

## 6. Key sequences

### 6.1 Park me: the chair thief

1. **Start:** `POST /api/engine/sessions { mode: "me" }` → Anbaric job in `scanning`.
2. **Scan (2 s, browser):** detector boxes for `chair`/`couch` are merged across frames into stable seats. Distance uses a pinhole model: `distance ≈ 0.85 m × focalPx / boxHeightPx`, focal length from an assumed ~65° horizontal field of view; `steps = distance / 0.75`. Direction comes from the box's horizontal position. Seats are posted to the job → `ready`.
3. **This is me:** `/api/look` describes the driver; stored on the job.
4. **Occupancy (every frame, browser):** a seat is taken when a `person` box covers ≥ 30% of its lower half for ≥ 1 s; free after 2 s without. No network.
5. **Find a spot:** the voice model calls `find_spot(wish)` → event to the job → `planning` → Claude agent writes `chain` → `guiding`. The browser polls `GET /sessions/:id` (about once a second) and shows A/B/C; the voice announces Plan A.
6. **Target seat becomes taken:** crop → `/api/look` "is this the driver?"
   - `false` → **instantly** in the browser: ✕, next seat, redraw, voice announcement. Then event `seat_taken` (actor `Code("camera")`) and `reroute` (actor `Agent("claude-eyes")`) to the job. If fewer than 2 seats remain, the job re-plans.
   - `true` → event `landed` → job `landed`. *"Great landing."*

### 6.2 Park my car: the 2-second reroute

1. Trigger: the voice model calls `lot_full()`, or the button is tapped.
2. **Instantly, in the browser:** mark the lot full, move to the next lot already in the chain, redraw the snake, voice announcement.
3. **Then:** event `lot_full` to the job (actor `Human("driver")` for a tap, `Agent("voice")` for speech). The job re-plans the lots after the current one with Claude and extends with D, E, F if fewer than 2 remain; the browser picks up the new chain on its next poll.

## 7. Environment variables

**Next.js (`.env.local` + Netlify):**

| Name | Used by | Status |
|---|---|---|
| `ANTHROPIC_API_KEY` | `/api/look` | **to add** |
| `OPENAI_API_KEY` | `/api/voice-key` | set |
| `ENGINE_URL` | `/api/engine/*` (local: `http://localhost:4000`; deployed: the Anbaric app's address) | **to add** |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | not used by the demo | set |

**Anbaric app:** the Anthropic key goes in Anbaric's secret store (locally it falls back to the environment). Never set the `ANBARIC_*` variables; the platform provides them.

## 8. Development flow

- One branch and pull request per build batch (PRD §13). **Prelint** reviews each PR against PRD.md and this file; merge to `main` after a manual test pass. Netlify deploys `main` automatically; the engine deploys with `anbaric app deploy` (or `anbaric app update`).
- Local: `npm run dev` (Next.js) and `npx tsx engine/src/main.ts` with `PORT=4000` (Anbaric runs fully in memory locally).
- `npm run lint`, `npm run build` and `npx vitest run` must pass before merging.
- Camera features are tested on the Netlify deploy preview link (HTTPS) on the iPhone 13.

## 9. Decisions

| # | Decision | Why | Rejected |
|---|---|---|---|
| D1 | Reuse Next.js 16 on Netlify for the frontend | Already builds and deploys; HTTPS for camera and mic | Hosting Next.js on Anbaric (no build step and a 1 GB container don't suit Next.js) |
| D2 | Two modes on one engine: Park me (chairs, live) and Park my car (map) | Live, physical wow on stage, plus the real product | Car-only; chairs-only |
| D3 | **Two AI models**: Claude Opus 5.5 for all reasoning and vision, OpenAI gpt-realtime-2.1-mini for speech-to-speech | Simple, each the best at its job; the voice model calls Claude as a tool | Five specialised models (more moving parts on a one-day build) |
| D4 | On-device detector every frame; Claude only when a seat changes | Instant and free where speed matters; smart where judgement matters | Claude on every frame (slow, costly); detector only (can't tell driver from thief) |
| D5 | **Anbaric** runs each session as an audited job; Claude planning is an Anbaric agent | Production-grade record of every decision and actor; admin console for the demo; sponsor | Plain API routes with no record; Supabase tables (we'd build the audit trail ourselves) |
| D6 | Time-critical work (reroute, photo check) stays in the browser and Next.js; Anbaric records it after | Anbaric updates are queued, and the speed promise can't depend on a queue | Routing every reroute through the job queue |
| D7 | **Clerk removed**; no driver login in the demo | Not needed; was a deploy risk (pages break without its keys) | Keeping Clerk alongside Anbaric |
| D8 | **Base44** for the waitlist | No-code, built by the founder in parallel; live traction in the demo | Building a waitlist in our app |
| D9 | Fixed phone on a stand; seat positions locked after a 2 s scan | Occupancy becomes a simple overlap test | Hand-held phone (the camera can't see you sit) |
| D10 | Driver identified by clothing description, no faces, nothing stored | Enough to tell two people apart on stage; privacy-safe | Face recognition |
| D11 | Distance as steps from the chair's size in the picture | Good enough (±30%) for "about six steps" | WebXR depth (not on iOS Safari) |
| D12 | Closest-first chain in the browser is always ready as a fallback | The demo never depends on one provider or the engine | Claude-only planning |
| D13 | Fake garage data with made-up rules | No live feed today; rules give Claude real trade-offs | Scraping live data |
| D14 | Keep Supabase installed but unused | Zero cost now; may hold waitlist exports or analytics later | Removing it |
