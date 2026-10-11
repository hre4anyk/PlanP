# Plan P — Architecture (v1.0, simplified)

How the app is built, where each AI model is called, and why. Product requirements: [PRD.md](PRD.md). Prelint reviews pull requests against both files, so update this one in the same PR when a decision changes.

## 1. System overview

```
 PHONE BROWSER (Next.js client)                NEXT.JS SERVER (Netlify)                    PROVIDERS
 ┌──────────────────────────────┐             ┌──────────────────────────────┐
 │ GPS (start position)          │             │                              │
 │ Address search ───────────────┼── query ──► │ GET  /api/geocode            │──► OpenStreetMap Nominatim (free)
 │ Map (Leaflet + OSM tiles)     │             │                              │
 │ Route (OSRM, from the browser)│             │                              │
 │ Garage chain A/B/C            │             │                              │
 │ Street parking markers (S2) ──┼── route ──► │ POST /api/curb          (S2) │──► Google Street View Static API
 │                               │             │                              │──► Claude Opus 5.5 (reads photos)
 │ Voice copilot (S3) ◄══════════╪═ WebRTC ════╪══════════════════════════════╪══► OpenAI gpt-realtime-2.1-mini
 │   tool calls ─────────────────┼───────────► │ POST /api/voice-key     (S3) │──► OpenAI (short-lived key)
 │                               │             │ POST /api/research      (S3) │──► Claude Opus 5.5 + web search
 └──────────────────────────────┘             └──────────────────────────────┘
```

- **One mode: Park my car.** Park me (chairs) and the live street camera were removed on 2026-10-11 (see D1); they remain in git history.
- **Two AI models:** Claude Opus 5.5 (eyes on Street View, investor research) and OpenAI Realtime (voice). Keys stay on the server; the voice uses a short-lived key.
- **Free building blocks:** OpenStreetMap tiles, OSRM routing, Nominatim geocoding.

## 2. Code layout

```
src/
  app/
    page.tsx                 landing page
    car/page.tsx             the app (map + panel)
    car/car-app.tsx          GPS start, address search, meeting time, route, garage chain, arrival estimate
    api/geocode/route.ts     address → SF places (Nominatim, identifying User-Agent)
    api/curb/route.ts        (S2) stretch points → Street View metadata + photos → Claude (batches of 6) → verdict per photo
    api/streetview/photo/route.ts  (S2) photo proxy so the Google key never reaches the browser
    api/voice-key/route.ts   (S3) short-lived OpenAI Realtime key
    api/research/route.ts    (S3) Claude + web search: investor brief + likely questions
  ai/
    models.ts                (S2) model IDs and list prices, one place
    founder.ts               founder context from idea.md for the coach
  voice/copilot.ts           WebRTC voice session, tool calls, queued app updates
  data/lots.ts               12 fake SF garages + preset places
  data/poc-route.json        the demo route (S2b): path, photo IDs, headings, Claude's verdicts; built by scripts/build-poc-route.mts
  logic/
    geo.ts                   distances, walk minutes (80 m/min)
    chain.ts                 garage ranking (walk to meeting), A/B/C, extension
    trip.ts                  "Lot is full" → next plan, grow the chain
    route.ts                 OSRM route with per-leg paths and drive minutes; straight-line fallback
    eta.ts                   arrival at the door vs meeting time
    stretch.ts               (S2) points every ~50 m along the last 10 min walk, with driving bearing
    *.test.ts                Vitest
  components/
    map-view.tsx             Leaflet map: garages, route snake, meeting flag, you; follows the current photo as a minimap
    street-journey.tsx       (S2) the main view: Street View photos in driving order, Claude's curb box + verdict, ▶ Drive
```

## 3. Data shapes

```ts
type LatLng = { lat: number; lng: number };
type Place = LatLng & { name: string };                        // geocoded meeting place
type ChainItem = { id: string; label: string; distance: string; reason: string };  // garage A/B/C
type Leg = { path: LatLng[]; driveMin: number };               // one leg of the route
// S2
type CurbPoint = LatLng & {
  allowed: "yes" | "no" | "unsure"; reason: string;            // e.g. "metered, 2 h", "red curb", "hydrant"
  walkMin: number; side: "left" | "right"; photoDate: string; photoUrl: string;
};
```

## 4. Models

| Job | Where | Model | In → out |
|---|---|---|---|
| Read Street View photos for parking rules (S2) | `/api/curb` | `claude-opus-5-5`, effort `low` | photos facing the curb → per photo `{ allowed, reason }` (structured output) |
| Investor research + likely questions (S3) | `/api/research` | `claude-opus-5-5` with web search | name + firm → brief + 5 likely questions |
| Voice copilot (S3) | browser ⇄ OpenAI over WebRTC | `gpt-realtime-2.1-mini` | speech ⇄ speech; tools `set_destination`, `research_investor`, `parking_options`, `i_parked` |

## 5. Key flows

**S1 — route:** GPS position on load (fallback: Fell & Van Ness, said on screen) → address search (`/api/geocode`, SF only) → optional meeting time → "Plan my parking" → garage chain A/B/C by walk to the meeting → OSRM route Start → A → B → C (or straight to the meeting if no garage is within 15 min walk) → status card: "Heading to Plan A… 10 min drive, 3 min walk. At the door 13:40, 20 min spare."

**S2 — the street journey (main view):** "Plan my parking" also fetches the drive straight to the meeting; `stretch.ts` samples a point every ~50 m along its last 10 minutes' walk (max 16). `/api/curb`: Street View metadata per point (free) → one photo per panorama, looking ahead and 25° right (how a driver glances at the curb) → Claude reads them in batches of 6, in parallel → per photo `{ allowed, kind, reason, box }`. The main area switches from the map to `StreetJourney`: the photo fills the screen, the judged curb outlined green/red/amber, "4 min walk to your meeting", the photo's date, ◀ ▶ / swipe and ▶ Drive auto-play; a minimap in the corner follows the photo. The panel lists the green stretches (tap to jump) and the trace (photos, seconds, cost). Founder choices: drive-through photos (not interactive 360°), minimap, right-hand curb only.

**S2b — the demo route:** 995 Market St → 2 S Park St is precomputed once (route, a photo every 40 m along the whole drive, Claude's verdicts; $0.63 one-off) into `poc-route.json`. When the trip matches it, the journey appears instantly and auto-plays (0.7 s per photo while driving, 1.2 s in the parking zone, next 4 photos preloaded). Only photo IDs and verdicts are stored; images always come live through `/api/streetview/photo`. Verdicts show only within a 10-minute walk of the meeting; before that the view says "Driving". The demo starts at Frontier Tower; "Use my location" switches to GPS for live trips.

**S3 — copilot (built):** "🎙 Talk to Plan P" → `/api/voice-key` mints a short-lived OpenAI Realtime key (model `gpt-realtime-2.1-mini`, voice `marin`, input transcription, the instructions and four tools fixed server-side) → `src/voice/copilot.ts` opens WebRTC (mic in, voice out, data channel `oai-events`). Flow: greet → "where and when?" → `set_destination` (the demo address "2 South Park" maps to the precomputed route and starts the drive) → summary of drive, free street parking and garage backup → "who are you meeting?" → `research_investor` → `/api/research` (Claude Opus 5.5 + `web_search`, max 3 searches, resumes `pause_turn`; ~20 s, ~$0.11) → brief in the panel → coaching: one likely question, feedback in two sentences, next question. During the drive the page sends "[Plan P app] …" updates (free parking on the right, arrival); they queue while the copilot is speaking (one response at a time). `parking_options` and `i_parked` read the live trip. Replies are kept under 35 words. Founder context: `src/ai/founder.ts` (from idea.md).

## 6. Fallbacks

| Step | Fails how | Fallback |
|---|---|---|
| GPS | denied / indoors | Preset start, said on screen |
| Address search | Nominatim down | Preset meeting places, tap on the map |
| OSRM | > 5 s or error | Straight lines + "Approximate route" |
| Street View / Claude (S2) | no key, no photo, error | Garages only; markers missing for that point |
| Voice (S3) | can't connect | Text box + buttons |
| Investor research (S3) | nothing found | Coach from idea.md with tough generic defense-VC questions |

## 7. Environment variables

| Name | Used by | Status |
|---|---|---|
| `ANTHROPIC_API_KEY` | `/api/curb`, `/api/research` | set (workspace-scoped key) |
| `OPENAI_API_KEY` | `/api/voice-key` | set |
| `GOOGLE_MAPS_API_KEY` | `/api/curb` (Street View Static API) | **to add** before S2 |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | not used | set |

Set them in `.env.local` and on Netlify (Site configuration → Environment variables), then redeploy.

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
| D7 | Next.js on Netlify; Anbaric for the trip record (S5); Base44 waitlist; Prelint reviews | Reuse what works; sponsors where they add value |
