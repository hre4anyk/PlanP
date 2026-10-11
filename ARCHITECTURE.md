# Plan P — Architecture

How the app is built, where each AI model is called, and the decisions behind it. Product requirements live in [PRD.md](PRD.md). Prelint reviews pull requests against both files, so update this one in the same PR when a decision changes.

## 1. System overview

```
 PHONE BROWSER (Next.js client)                               NEXT.JS SERVER (Netlify functions)    PROVIDERS
 ┌─────────────────────────────────────────────┐             ┌───────────────────────────┐
 │ Park me                                      │             │                           │
 │   Camera (getUserMedia, rear)                │             │                           │
 │   On-device detector (MediaPipe,             │             │                           │
 │     EfficientDet-Lite0) ─► seat map          │             │                           │
 │   Seat state machine (src/logic/seats.ts)    │── JPEG ───► │ POST /api/look            │──► Gemini 2.5 Flash  (Google)
 │                                              │             │                           │
 │ Park my car                                  │             │                           │
 │   Map (Leaflet + OSM) + snake route          │             │                           │
 │   Trip state machine (src/logic/trip.ts)     │── JSON ───► │ POST /api/plan            │──► Claude Opus 5.5   (Anthropic)
 │                                              │             │                           │
 │ Shared                                       │             │                           │
 │   Hold-to-talk mic (MediaRecorder)           │── audio ──► │ POST /api/voice           │──► gpt-4o-mini-transcribe (OpenAI)
 │                                              │             │        └─ intent ─────────│──► Claude Haiku 5.5  (Anthropic)
 │   Speaker (audio element)                    │◄── mp3 ──── │ POST /api/speak           │──► gpt-4o-mini-tts   (OpenAI)
 │   Model trace panel                          │◄── trace ── │ every response has trace  │
 └─────────────────────────────────────────────┘             └───────────────────────────┘
        │
        └──► OSRM public server (driving route, no key), called from the browser
```

- **All cloud AI calls run on the server.** API keys never reach the browser.
- **The on-device detector runs in the browser** on every frame, for free. Cloud models are called only when something changes.
- **The browser owns all state** (seats, trip). Server routes are stateless.
- **Every AI step has a fallback**, so the demo never dead-ends (§5).

## 2. Code layout

```
src/
  app/
    page.tsx                 landing page (links to both modes)
    me/page.tsx              Park me (camera), client-side
    car/page.tsx             Park my car (map), client-side
    api/plan/route.ts        Claude Opus 5.5: build / re-plan a chain (seats or garages)
    api/look/route.ts        Gemini Flash: describe driver, is-this-the-driver, scene check, (stretch) sign reading
    api/voice/route.ts       OpenAI transcribe, then Claude Haiku 5.5 intent
    api/speak/route.ts       OpenAI TTS
  data/lots.ts               12 fake garages + preset places (typed)
  logic/
    geo.ts                   map distance and walk-minute math
    chain.ts                 deterministic ranking + chain extension (planner fallback, both modes)
    chain.test.ts
    seats.ts                 room scan, chair IDs, free/taken with debounce, steps + direction
    seats.test.ts
    trip.ts                  car trip state machine: setup → planning → driving → arrived → parked
    route.ts                 OSRM call with 5 s timeout → straight-line fallback
  vision/
    detector.ts              MediaPipe object detector wrapper (load once, detect per frame)
    frame.ts                 grab a JPEG from the video, optionally cropped to one chair
  ai/
    models.ts                ONE place for model IDs and list prices
    trace.ts                 timing + token cost for every call
    planner.ts               prompt + schema + validation for Claude
    look.ts                  prompts + schemas for Gemini
    intent.ts                prompt + schema for Haiku
  components/
    camera-view.tsx          video + box overlay + A/B/C labels
    map-view.tsx             Leaflet map, pins, snake polyline
    control-panel.tsx        pickers, chain list, big buttons
    talk-button.tsx          hold-to-talk
    model-trace.tsx          collapsible trace panel + session cost
```

## 3. Data shapes

```ts
// Shared
type ChainItem = { id: string; label: string /* A, B, C, D… */; distance: string; reason: string };
type TraceEntry = {
  model: string; provider: "anthropic" | "google" | "openai" | "on-device";
  job: "detect" | "look" | "plan" | "transcribe" | "intent" | "speak";
  ms: number; costUsd: number; fallback: boolean;
};

// Park me
type Seat = {
  id: string;                         // stable after the room scan, e.g. "S4"
  box: { x: number; y: number; w: number; h: number };   // normalised 0–1, fixed camera
  state: "free" | "taken";
  steps: number; direction: "left" | "ahead" | "right";
  note?: string;                      // from Gemini, e.g. "bag on seat"
};
type SeatSession = {
  phase: "scan" | "whoami" | "ready" | "walking" | "checking" | "landed";
  driver?: string;                    // clothing description, in memory only
  seats: Seat[]; chain: ChainItem[]; currentIndex: number; wish?: string;
};

// Park my car
type Lot = {
  id: string; name: string; lat: number; lng: number;
  pricePerHour: number; hours: string; clearanceInches: number;
  rule?: string; status: "open" | "full";
};
type TripState = {
  phase: "setup" | "planning" | "driving" | "arrived" | "parked";
  destination: LatLng; start: LatLng; meeting?: { at: string; minutes: number };
  carHeightInches?: number; chain: ChainItem[]; currentIndex: number; fullLotIds: string[];
};
```

## 4. Models

All cloud model IDs and prices sit in `src/ai/models.ts`, so a model can be swapped in one line and the trace panel prices calls correctly.

| Job | Where | Model | Input → output | Latency budget |
|---|---|---|---|---|
| Chair + person detection | browser | MediaPipe EfficientDet-Lite0 (float16, GPU delegate) | video frame → boxes (`chair`, `couch`, `person`) | < 100 ms per frame |
| Describe driver / is-this-the-driver / scene check | `/api/look` | `gemini-2.5-flash` | JPEG (+ driver description) → JSON via response schema | 1.5 s |
| Plan / re-plan chain | `/api/plan` | `claude-opus-5-5`, effort `low` | candidates + context → `{ chain: ChainItem[], spoken: string }` via structured output | 6 s |
| Voice intent | `/api/voice` | `claude-haiku-5-5` | transcript → `{ intent, wish? }` via structured output | 800 ms |
| Speech to text | `/api/voice` | `gpt-4o-mini-transcribe` | audio → text | 1 s |
| Text to speech | `/api/speak` | `gpt-4o-mini-tts` with tone instructions | text → mp3 | 1 s to first byte |

Notes:
- **Claude:** `@anthropic-ai/sdk`, structured output via `output_config.format`. Opus 5.5 thinking can't be turned off, so speed and cost are controlled with `effort: "low"`. The server checks every ID Claude returns against the candidates it was sent and drops unknown ones.
- **Gemini:** `@google/genai`, `responseMimeType: "application/json"` + response schema. Images are resized to ≤ 768 px before sending.
- **MediaPipe:** `@mediapipe/tasks-vision`; model file served from `public/models/`, so the demo doesn't depend on a CDN.

## 5. Fallbacks

| Step | Fails how | Fallback | Trace shows |
|---|---|---|---|
| Detector | model fails to load | Message + switch to Park my car | n/a |
| Gemini "this is me" | error | Skip; thief check falls back to buttons | `fallback: true` |
| Gemini thief/landing check | error or confidence < 0.7 | Two big buttons: "That's me" / "Someone else" | `fallback: true` |
| Planner | timeout > 6 s, error, invalid IDs | `chain.ts` closest-first, generic reasons | `fallback: true` |
| Transcribe | error | Browser `SpeechRecognition` if available, else buttons | `fallback: true` |
| Intent | error | Keyword match | `fallback: true` |
| TTS | error | Browser `speechSynthesis` | `fallback: true` |
| OSRM | > 5 s or error | Straight lines + "approximate route" | n/a |

## 6. Key sequences

### 6.1 Park me: the chair thief

1. **Scan (2 s):** detector boxes for `chair`/`couch` are merged across frames into stable seats. Steps are estimated with a pinhole model: `distance ≈ 0.85 m × focalPx / boxHeightPx`, focal length taken from an assumed ~65° horizontal field of view; `steps = distance / 0.75`. Direction comes from the box's horizontal position.
2. **Occupancy (every frame, on-device):** a seat is taken when a `person` box overlaps its lower half by ≥ 40% for ≥ 1 s; free after 2 s without. All local, no network.
3. **Find a spot:** free seats → `/api/plan` (mode `seats`, plus the wish from Haiku) → chain A/B/C → `/api/speak`.
4. **Target seat becomes taken:** crop that seat from the frame → `/api/look` "is this the driver?" with the stored description.
   - `false` → **instantly** mark ✕, move `currentIndex`, redraw labels, `/api/speak` *"Plan A just got taken…"*. If fewer than 2 seats are left in the chain, re-plan.
   - `true` → `landed`, *"Great landing."*
5. Optional scene check (every ~5 s while `ready`/`walking`, only on free seats): `/api/look` flags seats that look free but aren't (bag, coat, blocked).

### 6.2 Park my car: the 2-second reroute

1. Trigger: voice intent `lot_full` or button tap.
2. **Instantly, on the client:** mark the lot full, move to the next lot already in the chain, redraw the snake, update the message card.
3. **In parallel:** `/api/speak` speaks the change; `/api/plan` re-plans with the event and updates the lots after the current one; extend with D, E, F if fewer than 2 remain.

## 7. Environment variables

| Name | Used by | Status |
|---|---|---|
| `ANTHROPIC_API_KEY` | `/api/plan`, `/api/voice` | **to add** |
| `GEMINI_API_KEY` | `/api/look` | **to add** |
| `OPENAI_API_KEY` | `/api/voice`, `/api/speak` | set |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk middleware (installed, not used by the demo) | set |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | not used by the demo | set |

Set them in `.env.local` and on Netlify (Site configuration → Environment variables).

## 8. Development flow

- One branch and pull request per build batch (PRD §13). **Prelint** reviews each PR against PRD.md and this file; merge to `main` after a manual test pass, and Netlify deploys `main` automatically.
- `npm run lint`, `npm run build` and `npx vitest run` must pass before merging.
- Camera features are tested on the Netlify link (HTTPS) on the iPhone 13; the PR's deploy preview link works for that before merging.

## 9. Decisions

| # | Decision | Why | Rejected |
|---|---|---|---|
| D1 | Reuse Next.js 16 + Netlify, not Vite + Vercel | Already builds and deploys; route handlers keep keys on the server | Vite (no server for keys), Anbaric Cloud (migration time on demo day) |
| D2 | Two modes on one engine: Park me (chairs, live) and Park my car (map) | Live, physical wow on stage, plus the real product; same chain, planner and voice | Car-only (no live wow); chairs-only (looks like a gimmick) |
| D3 | On-device detector every frame + Gemini only on change | Instant and free where speed matters; smart where judgement matters; ~$0.08 per session | Gemini on every frame (slow, costly); detector only (can't tell driver from thief) |
| D4 | Fixed phone on a stand; seat positions locked after a 2 s scan | Makes occupancy a simple overlap test; no tracking needed | Hand-held phone (the camera can't see you sit) |
| D5 | Driver identified by clothing description, no faces, nothing stored | Enough to tell two people apart on stage; privacy-safe | Face recognition |
| D6 | Distance as steps from the chair's size in the picture | Good enough (±30%) for "about six steps"; no depth sensor in iPhone Safari | WebXR depth (not available on iOS Safari) |
| D7 | Deterministic chain first, Claude re-ranks on top | The demo never depends on one provider | Claude-only planning |
| D8 | Instant client-side reroute, AI re-plan in the background | Meets the speed promise even when an API is slow | Waiting for Claude before moving on |
| D9 | Fake garage data with made-up rules | No live feed today; rules give Claude real trade-offs | Scraping live data |
| D10 | Garage sign reading is a stretch goal | Park me covers the "camera sees what's taken" story; saves build time | Building both camera features up front |
| D11 | Keep Clerk and Supabase installed but unused | Ready for accounts later; zero cost now | Removing them |
