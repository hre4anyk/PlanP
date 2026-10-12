# Plan P — Architecture (v1.1, hands-free)

How the app is built, where each AI model is called, and why. Product requirements: [PRD.md](PRD.md). Prelint reviews pull requests against both files, so update this one in the same PR when a decision changes.

## 1. System overview

```
 PHONE BROWSER (Next.js client)               NEXT.JS SERVER (Netlify)                     PROVIDERS
 ┌───────────────────────────────┐           ┌───────────────────────────────┐
 │ 🎙 Talk to Plan P  (only button)│           │ POST /api/voice-key           │──► OpenAI (short-lived key,
 │ Voice copilot ◄═══════════════╪═ WebRTC ══╪═══════════════════════════════╪══►  instructions + 5 tools)
 │   tools: set_destination,      │           │                               │    gpt-realtime-2.1-mini
 │   start_drive, save_answer,    │           │ GET  /api/geocode             │──► OSM Nominatim
 │   i_parked                     │           │                               │
 │ Plans A, B, C (garage chain)       │           │ POST /api/curb                │──► Google Street View Static
 │ Street journey (photos, curb   │──route──► │   (live plans B–E)            │──► Claude Opus 5.5 (eyes)
 │   colour, minimap, hold)       │           │ GET  /api/streetview/photo    │──► Google (key stays here)
 │ Arrival popup → next plan      │           │                               │
 │ Pitch: 4 answers ──────────────┼─────────► │ POST /api/coach ─► queue ─────┼──► Netlify Blobs
 │   poll /api/coach/result       │           │ POST /api/trip  ─► queue      │        ▲  │
 │ Fundy (grows with the score)   │           │                               │           │  ▼
 └───────────────────────────────┘           │ GET  /api/engine/queue ◄──────┼── ANBARIC ENGINE (polls 0.5 s)
                                             │ POST /api/engine/result ◄─────┼──  jobs: trip, answer-review
                                             └───────────────────────────────┘    agent claude-coach → Claude Opus 5.5
```

- **One mode, hands-free.** The voice runs the whole trip; the screen shows what's happening. No forms.
- **Two AI providers, three jobs:** OpenAI Realtime (voice), Claude Opus 5.5 (eyes on Street View; judge of the pitch). Keys stay on the server; the voice uses a short-lived key.
- **Free building blocks:** OpenStreetMap tiles, OSRM routing, Nominatim geocoding.

## 2. Code layout

```
src/
  app/
    page.tsx                       landing page
    car/car-app.tsx                the app: copilot + tools, plans A, B, C, street journey, hold, arrival → next plan, banner
    api/voice-key/route.ts         short-lived OpenAI Realtime key; instructions, 5 tools, noise reduction, semantic VAD
    api/geocode/route.ts           address → SF places (Nominatim)
    api/curb/route.ts              points → Street View metadata (Google car only) + photos → Claude (batches of 6) → verdicts
    api/streetview/photo/route.ts  photo proxy (netlify-vary on pano|heading so the CDN caches each photo separately)
    api/coach/route.ts             whole pitch → queue for Anbaric, or `direct` → Claude scores it here
    api/coach/result/route.ts      the browser polls for Anbaric's score
    api/trip/route.ts              trip start / arrived → queue for Anbaric
    api/engine/queue|result        the engine's side of the queue (x-planp-token = ENGINE_TOKEN)
  ai/
    models.ts                      model IDs and list prices
    questions.ts                   the four pitch questions
    coach.ts                       Claude's coaching rubric + JSON schema {score, strong, fix}
    founder.ts                     founder context from idea.md
  voice/copilot.ts                 WebRTC session, tool calls, queued app updates, mic mute
  lib/engine-queue.ts              Netlify Blobs queue (enqueue, claim, complete, read), 4 s timeouts
  data/lots.ts                     24 fake SF garages
  data/poc-route.json              the demo route: path, photo IDs, headings, Claude's verdicts (scripts/build-poc-route.mts)
  logic/                           geo, chain (plans A, B, C), trip (next plan), route (OSRM), eta, stretch, journey (Base44), maps links; *.test.ts
  components/
    street-journey.tsx             the main view: photos in driving order, curb box + verdict, autoplay with `holdAt`
    map-view.tsx                   Leaflet map / minimap
    arrival-popup.tsx              green / red / orange popup at the last photo (Base44)
    safe-map-container.tsx         (Base44)
    fundy.tsx, fundy-sprites.tsx   the pixel dino that grows with the voice pitch score (Base44); one compact row
engine/                            the Anbaric app (separate package)
  src/main.ts                      starts the app
  src/machines.ts                  state machines `trip` (driving → arrived) and `answer-review` (submitted → scored)
  src/claude.ts                    ClaudeClient for the Anbaric agent `claude-coach`
  src/relay.ts                     polls each site's queue, runs jobs, posts results
```

## 3. Data shapes

```ts
type LatLng = { lat: number; lng: number };
type Place = LatLng & { name: string };
type ChainItem = { id: string; label: string; distance: string; reason: string };   // Plan A, B, …
type Trip = { chain: ChainItem[]; currentIndex: number; fullIds: string[]; exhausted: boolean };
type CurbFrame = LatLng & {                                   // one Street View photo along a drive
  walkMin: number; heading: number; date: string; photoUrl: string;
  status: "free_to_park" | "cant_park" | "occupied";          // green / red / orange
  kind: string; reason: string; box: { x: number; y: number; w: number; h: number } | null;
};
type CoachScore = { score: number; strong: string; fix: string };   // the whole pitch, 1–10
```

## 4. Models

| Job | Where | Model | In → out |
|---|---|---|---|
| Voice copilot | browser ⇄ OpenAI over WebRTC | `gpt-realtime-2.1-mini`, voice `marin`, transcription `gpt-4o-mini-transcribe` | speech ⇄ speech; tools `set_destination`, `confirm_destination`, `start_drive`, `save_answer`, `i_parked` |
| Read the curb in Street View photos | `/api/curb` | `claude-opus-5-5`, effort `low`, JSON schema, server-side fallbacks | ≤ 6 photos per call → per photo `{ status, kind, reason, box }` |
| Score the pitch | Anbaric agent `claude-coach` (`engine/`); fallback `/api/coach` `direct` | `claude-opus-5-5`, effort `low`, JSON schema | four Q&A → `{ score, strong, fix }` |

## 5. Key flow (S5, hands-free)

1. **Talk.** "🎙 Talk to Plan P" → `/api/voice-key` mints a short-lived key with the instructions, the five tools, `noise_reduction: far_field` and `turn_detection: semantic_vad (low)` → `copilot.ts` opens WebRTC (mic in, voice out, data channel `oai-events`). Banner: "Tell Plan P where you're going".
2. **`set_destination(address)`.** "South Park" → the precomputed demo meeting; anything else → `/api/geocode` (Google Geocoding, SF only; OSM Nominatim fallback). Returns the exact address; she reads it back and asks if it's right. Banner: "2 S Park St? · say yes".
3. **`confirm_destination()`** after his yes. `startTrip` builds plans A, B, C (garages within 15 min walk, by walk time; the chain grows if all fail); `/api/trip` queues `trip_start` for Anbaric. She says she found 3 places nearby, Plan A plus two backups in case Plan A doesn't work, and asks "Let's go?". **`start_drive()`** after "yes": Frontier Tower → 2 S Park St replays `poc-route.json` instantly; other trips load live via `journey.ts` → `/api/curb`. Returns Question 1. Each tool checks the stage (`where → confirm → ready → questions → debrief → quiet`) and refuses out-of-order calls.
4. **`save_answer(answer)`** ×4. Stores the answer and returns the first unanswered question, so she never repeats one; no scoring in between. The panel shows only the current question and his answer. **Hold:** while the voice is on and the pitch isn't scored, `StreetJourney` stops at the second-to-last photo (`holdAt`), so the four questions always finish before Plan A.
5. **Scoring** (after answer 4). `/api/coach` queues the whole pitch in Netlify Blobs and returns an id; the Anbaric engine (polling every 0.5 s) runs an `answer-review` job scored by `claude-coach` and posts the result; the browser polls `/api/coach/result` every 0.6 s. After 13 s without a score, `/api/coach` with `direct` asks Claude itself. Measured: ~2–8 s via Anbaric. The result feeds the banner ("Pitch 7/10 · driving to Plan A"), the panel, Fundy (`feedFundy` returns how much it grew), and the voice: score, strong, fix, Fundy's growth, the next stop; then she stays quiet unless asked. The hold is released.
6. **Arrival at a plan** (last photo). The page sends the voice "[Plan P app] Arrived at Plan A… Last photo: red, can't park (bike lane: …). The app is taking him to Plan B…" (queued if it's speaking). Green → `parked`, "park here". Red/orange → Base44's popup and, after 3.5 s, `markCurrentFull` → the next plan's drive loads live from this garage; no hold on later plans.
7. **Mic off** disables the mic track (silence), so noise can't interrupt; the voice keeps talking.

Earlier flows (S1 address form, S3 investor research, S4 one stretch per question with six scored answers) are in git history and superseded.

## 6. Fallbacks

| Step | Fails how | Fallback |
|---|---|---|
| Voice | can't connect / mic blocked | Error with the fix shown on screen ("aA → Website Settings → Microphone"); tap Talk again |
| Loud room | noise interrupts the voice | Mic off button; noise reduction; semantic VAD |
| Geocode | not found | The voice asks him to repeat the street and number |
| OSRM | > 5 s or error | Straight lines + "Approximate route" |
| Street View / Claude | no photo, error | Server-side model fallbacks; "Street View unavailable"; the garage is still the plan |
| Anbaric engine | slow / down / queue error | Claude scores directly after 13 s |
| Claude scoring | fails | The voice gives one honest sentence itself and carries on |

## 7. Environment variables

| Name | Used by | Status |
|---|---|---|
| `ANTHROPIC_API_KEY` | `/api/curb`, `/api/coach` | set (Netlify, local) |
| `OPENAI_API_KEY` | `/api/voice-key` | set |
| `GOOGLE_MAPS_API_KEY` | `/api/curb`, `/api/streetview/photo`, `/api/geocode` (Street View Static + Geocoding APIs) | set |
| `ENGINE_TOKEN` | `/api/engine/*` (shared with the Anbaric engine's `engine-token`) | set |
| Anbaric secrets | `anthropic-key`, `engine-token`, `site-urls` | set |

Set them in `.env.local` and on Netlify (Site configuration → Environment variables), then redeploy. See [DEPLOYMENT.md](DEPLOYMENT.md).

## 8. Development flow

One branch and pull request per sub-batch (PRD §5); Prelint reviews it; the founder tests the Netlify preview on the iPhone; merge to `main`. `npm run lint`, `npm run build` and `npm test` pass before merging. When stacking PRs, retarget the child to `main` before merging the parent (merging with branch deletion closes stacked PRs).

## 9. Decisions

| # | Decision | Why |
|---|---|---|
| D1 | One mode (Park my car); Park me and the live street camera removed | Founder: "we overcomplicated it"; one clear journey to visualise and demo |
| D2 | Street parking from Google Street View photos read by Claude, not our own camera | No hardware in the car, works before you leave, covers the whole last stretch; Street View is not live, so we show where parking is allowed and the driver's eyes judge free spaces |
| D3 | No model training: Claude reads photos directly | Accurate enough today, no dataset needed, ~1 cent a photo |
| D4 | Two AI models: Claude Opus 5.5 (eyes + research), OpenAI Realtime (voice) | Each the best at its job; the voice calls Claude as a tool |
| D5 | Garage chain A/B/C stays as Plan B | If no street space is free, the backup is already routed |
| D6 | Free OSM stack for map, routing, geocoding; Google only for Street View | Fewer keys and costs; Google's photos are the one thing we can't get elsewhere |
| D8 | Street View is the main view (drive-through photos), the map is a minimap | Founder: "it must be a street view as a human sees the street, not a 2D map" |
| D9 | One precomputed demo route, iPhone first | Founder: keep it simple, one POC route that never fails on stage; more routes later |
| D10 | ~~One question = one stretch; 6 questions scored one by one~~ (superseded by D13); no live parking alerts | Founder: voice and screen were out of sync; the AI can't know a spot is free ahead from old Street View photos |
| D11 | Anbaric hosts the trip engine (audited jobs, Claude as an Anbaric agent); the website stays on Netlify and talks to it through a queue the engine polls | Anbaric apps sit behind Anbaric's login (verified: 302 to Auth0), and Next.js doesn't fit Anbaric's no-build hosting |
| D7 | Next.js on Netlify; Anbaric for the trip engine; Base44 builds UI on the same repo; Prelint reviews | Reuse what works; sponsors where they add value |
| D12 | Hands-free: "Talk to Plan P" is the only control; the voice sets the destination and starts the drive ("Let's go?") | Founder: the driver can't touch the phone; one clear demo |
| D13 | Four fixed questions, no per-answer scoring; Claude scores the whole pitch once, before Plan A (the drive holds at the second-to-last photo until then) | Founder: fewer interruptions, feedback on the pitch as a whole, always before arrival |
| D14 | The last photo's colour at each plan drives the next step: green park, red/orange popup + next plan, and the voice says why | Founder: "the algo has a colour status for the last picture; based on this the agent takes next actions" |
| D15 | Mic on/off button + noise reduction + semantic VAD | Founder: loud venue; nothing should interrupt the AI |
| D16 | Fundy (Base44) is fed only by the voice pitch score; no typed pitch box | Founder: gamification without breaking hands-free; a clean panel |
| D17 | Conversation stages enforced by the tools: where → read the address back → confirm → "3 places nearby… Let's go?" → four questions (never repeated) → debrief (score, fix, Fundy growth, next stop) → quiet unless asked or arriving | Founder: clear stages; no repeated questions; she stays quiet after the debrief |
| D18 | Three parking plans (A + two backups; the chain grows if all fail); Google Geocoding first, OSM fallback | Founder: "3 points nearby in case Plan A doesn't work"; the right address every time |
| D19 | One-screen panel: mic, the current question and your answer, the score, Fundy; no garage list, trip card or typed pitch | Founder: everything on one screen; the banner and the voice already say where you're heading |
