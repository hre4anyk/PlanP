# Plan P — Architecture

How the app is built, where each AI model is called, and the decisions behind it. Product requirements live in [PRD.md](PRD.md). Prelint reviews pull requests against both files, so update this one in the same PR when a decision changes.

## 1. System overview

```
 PHONE BROWSER (Next.js client)                            NEXT.JS SERVER (Netlify functions)        PROVIDERS
 ┌──────────────────────────────────────────┐              ┌──────────────────────────────┐
 │ Map (Leaflet + OSM tiles)                 │              │ POST /api/plan               │──► Claude Opus 5.5   (Anthropic)
 │ Trip state machine  (src/logic/trip.ts)   │── JSON ────► │ POST /api/sign               │──► Gemini 2.5 Flash  (Google)
 │ Camera capture  (getUserMedia, 1 frame/2s)│── JPEG ────► │ POST /api/voice              │──► gpt-4o-mini-transcribe (OpenAI)
 │ Hold-to-talk mic (MediaRecorder)          │── audio ───► │        └─ intent ────────────│──► Claude Haiku 5.5  (Anthropic)
 │ Speaker (audio element)                   │◄─ mp3 ────── │ POST /api/speak              │──► gpt-4o-mini-tts   (OpenAI)
 │ Model trace panel                         │◄─ trace ──── │ every response carries trace │
 └──────────────────────────────────────────┘              └──────────────────────────────┘
          │
          └──► OSRM public server (driving route, no key)   ◄── called from the browser
```

- **All AI calls run on the server.** API keys never reach the browser.
- **The browser owns trip state.** The server routes are stateless; each request carries what the model needs.
- **Every AI step has a fallback**, so the demo never dead-ends (§5).

## 2. Code layout

```
src/
  app/
    page.tsx                 landing page
    plan/page.tsx            the app (map + controls), client-side
    api/plan/route.ts        Claude Opus 5.5: build / re-plan the chain
    api/sign/route.ts        Gemini Flash: read a garage sign from an image
    api/voice/route.ts       OpenAI transcribe, then Claude Haiku 5.5 intent
    api/speak/route.ts       OpenAI TTS
  data/lots.ts               12 fake garages + preset places (typed)
  logic/
    geo.ts                   distance and walk-minute math
    chain.ts                 deterministic ranking, chain extension (fallback for the planner)
    chain.test.ts            Vitest unit tests
    trip.ts                  trip state machine: planning → driving → arrived → parked
    route.ts                 OSRM call with 5s timeout → straight-line fallback
  ai/
    models.ts                ONE place for model IDs and list prices
    trace.ts                 timing + token cost for every call
    planner.ts               prompt + schema + validation for Claude
    sign-reader.ts           prompt + schema for Gemini
    intent.ts                prompt + schema for Haiku
  components/
    map-view.tsx             Leaflet map, pins, snake polyline
    control-panel.tsx        destination/start pickers, chain list, big buttons
    camera-watch.tsx         camera preview + frame sampler
    talk-button.tsx          hold-to-talk
    model-trace.tsx          collapsible trace panel + trip cost
```

## 3. Data shapes

```ts
type Lot = {
  id: string; name: string; lat: number; lng: number;
  pricePerHour: number; hours: string; clearanceInches: number;
  rule?: string;                 // e.g. "Monthly permits only 7–10am"
  status: "open" | "full";
};

type ChainItem = { lotId: string; label: "A" | "B" | "C" | string; walkMin: number; reason: string };

type TripState = {
  phase: "setup" | "planning" | "driving" | "arrived" | "parked";
  destination: LatLng; start: LatLng; meeting?: { at: string; minutes: number };
  carHeightInches?: number;
  chain: ChainItem[]; currentIndex: number; fullLotIds: string[];
};

type TraceEntry = {
  model: string; provider: "anthropic" | "google" | "openai";
  job: "plan" | "sign" | "transcribe" | "intent" | "speak";
  ms: number; costUsd: number; fallback: boolean;
};
```

## 4. Models

All model IDs and prices sit in `src/ai/models.ts`, so a model can be swapped in one line and the trace panel prices calls correctly.

| Job | Route | Model ID | Input → output | Latency budget |
|---|---|---|---|---|
| Plan / re-plan | `/api/plan` | `claude-opus-5-5`, adaptive thinking, effort `low` | candidates + meeting + event → `{ chain: ChainItem[], spoken: string }` via structured output | 6 s (background on re-plan) |
| Voice intent | `/api/voice` | `claude-haiku-5-5` | transcript → `{ intent, detail? }` via structured output | 800 ms |
| Sign reading | `/api/sign` | `gemini-2.5-flash` | JPEG frame → `{ status, sign_text, restrictions, price, clearance, confidence }` (JSON schema) | 1.5 s |
| Speech to text | `/api/voice` | `gpt-4o-mini-transcribe` | audio (webm/m4a) → text | 1 s |
| Text to speech | `/api/speak` | `gpt-4o-mini-tts`, calm voice instructions | text → mp3 | 1 s to first byte |

Notes:
- **Claude:** `@anthropic-ai/sdk`, `messages.parse` / `output_config.format` for JSON. Opus 5.5 thinking can't be turned off, so we control cost and speed with `effort: "low"`. The lot list and rules form a fixed system prompt with `cache_control` so repeat plans hit the cache. The server checks every `lotId` Claude returns against `lots.ts` and drops unknown ones.
- **Gemini:** `@google/genai`, `responseMimeType: "application/json"` with a response schema.
- **OpenAI:** the existing `openai` package.

## 5. Fallbacks

| Step | Fails how | Fallback | Trace shows |
|---|---|---|---|
| Planner | timeout > 6 s, error, invalid lot IDs | `chain.ts` shortest-walk ranking, generic reasons | `fallback: true` |
| Sign reader | error or confidence < 0.8 | Card asks "Is there space?" with two big buttons | `fallback: true` |
| Transcribe | error | Browser `SpeechRecognition` if available, else big button | `fallback: true` |
| Intent | error | Keyword match: full / parked / repeat | `fallback: true` |
| TTS | error | Browser `speechSynthesis` | `fallback: true` |
| OSRM | > 5 s or error | Straight lines + "approximate route" note | n/a |

## 6. Reroute sequence (the 2-second promise)

1. A trigger arrives (sign `full`, intent `lot_full`, or button tap).
2. **Instantly, on the client:** mark the lot full, move `currentIndex` to the next lot already in the chain, redraw the snake, show the message card. No network needed, which is what makes the < 2 s target safe.
3. **In parallel:** `/api/speak` speaks the change; `/api/plan` re-plans with the event ("Plan A full") and quietly updates the lots after the current one. If fewer than 2 lots remain, the chain is extended (Plan D, E, F).

`restricted` sign results are the exception: they go to `/api/plan` first, because Claude decides whether the rule applies to this driver right now.

## 7. Environment variables

| Name | Used by | Status |
|---|---|---|
| `ANTHROPIC_API_KEY` | `/api/plan`, `/api/voice` | **to add** |
| `GEMINI_API_KEY` | `/api/sign` | **to add** |
| `OPENAI_API_KEY` | `/api/voice`, `/api/speak` | set |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk middleware (installed, not used by the demo) | set |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | not used by the demo | set |

Set them in `.env.local` and on Netlify (Site configuration → Environment variables).

## 8. Development flow

- One branch and pull request per build batch (PRD §13). **Prelint** reviews each PR against PRD.md and this file; merge to `main` after a manual test pass, and Netlify deploys `main` automatically.
- `npm run lint`, `npm run build` and `npx vitest run` must pass before merging.

## 9. Decisions

| # | Decision | Why | Rejected |
|---|---|---|---|
| D1 | Reuse Next.js 16 + Netlify from the previous project, not Vite + Vercel | Already builds and deploys; route handlers keep keys on the server | Vite (no server for keys), Anbaric Cloud (migration time on demo day) |
| D2 | Five models, each for one job (§4) | Hackathon theme, and it's genuinely cheaper and faster than one model for everything | Opus for everything (slow + expensive per camera frame); one small model for everything (weak planning) |
| D3 | Deterministic chain first, Claude re-ranks on top | The demo never depends on one provider; Claude adds judgement, not plumbing | Claude-only planning |
| D4 | Instant client-side reroute, AI re-plan in the background | Meets the < 2 s promise even when an API is slow | Waiting for Claude before moving the snake |
| D5 | Fake garage data with made-up rules | No real-time feed available today; rules give Claude real trade-offs to make | Scraping live data |
| D6 | Camera frames only when near the current lot | Keeps sign reading at ~$0.01 per trip | Continuous streaming |
| D7 | Keep Clerk and Supabase installed but unused in the demo | Ready for saved trips/accounts later; zero cost now | Removing them |
