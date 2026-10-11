# Plan P — Product Requirements Document (Vertical Slice v0.1)

> **One line:** When your parking plan falls apart mid-drive, Plan P already has a backup ready and reroutes you there with one tap.

---

## 1. The problem (plain language)

You're driving to an important meeting in San Francisco. You know where you'll park. You get there and the lot is full.

Now you're circling, checking the clock, getting more stressed. You can't search on your phone because you're driving. Every wrong turn makes you later.

- SF drivers spend about **83 hours a year** looking for parking (INRIX).
- More than **4 in 10** Americans have missed an appointment because they couldn't park (INRIX survey).
- Today's parking apps help you **plan ahead**. Nothing helps when **the plan fails while you're on the road**.

## 2. The solution

Before you leave, Plan P lines up a **backup chain** of parking lots near your meeting: **Plan A → Plan B → Plan C**.

The route is drawn as one continuous line through all of them, like the snake in the old Snake game. If Plan A is full, you tap one big button and simply keep driving to Plan B. No new search, no panic. The snake's head moves forward to the next lot.

## 3. Who it's for

**Primary user:** A busy professional driving to a meeting in an unfamiliar part of San Francisco, on a tight schedule, already stressed.

**Demo audience for this slice:** Investors watching a live demo on a phone or laptop.

## 4. Goal of this vertical slice

Build the **thinnest working version of the whole experience**, end to end, in **8 hours**:

> Pick a meeting place → Plan P builds the A → B → C backup chain → shows the snake route on a map → driver taps "Lot is full" → Plan P moves to the next lot instantly → driver can open turn-by-turn directions in Apple/Google Maps.

Everything else is out of scope (see section 9).

## 5. Key decisions (from the interview)

| Topic | Decision |
|---|---|
| Platform | Web app that runs in the phone's browser (also works on a laptop) |
| Parking data | **Fake data**: 12 real SF garages with made-up availability |
| How we know a lot is full | Driver taps a big **"Lot is full"** button |
| Map | **OpenStreetMap** via Leaflet. Free, no account, no API key |
| Driving routes | **OSRM public demo server**. Free, no key. Falls back to straight lines if it fails |
| How the next lot is chosen | **Backup chain planned upfront**, ranked by **shortest walk to the meeting** |
| Directions | Route shown inside Plan P **plus** a button to open Apple Maps or Google Maps |
| Builder's computer | Mac, VS Code, Claude Code, Node.js, GitHub account |

## 6. User flow (the demo story)

1. **Open Plan P.** A map of San Francisco appears with parking garages shown as pins.
2. **Choose where you're going.** Pick a preset meeting place (e.g. "Investor meeting — 1 Market St") or tap anywhere on the map.
3. **Choose where you're starting.** Default is a preset demo start point. Optional: "Use my location".
4. **Tap "Plan my parking".** Plan P picks the 3 best lots (shortest walk to the meeting) and labels them **Plan A, Plan B, Plan C**.
5. **See the snake.** One continuous driving route: Start → A → B → C. The part to the current target is bright; the backup part is faded.
6. **Drive (or simulate driving for the demo).** A car icon moves along the route toward Plan A.
7. **Plan A is full.** Driver taps the big red **"Lot is full"** button.
   - Plan A gets a red ✕.
   - The snake's head moves to Plan B. That segment becomes bright.
   - A calm message appears: *"No problem. Heading to Plan B: Sutter-Stockton Garage. 3 min drive, 4 min walk."*
8. **Open in Maps.** Button opens Apple Maps or Google Maps with directions to the current lot.
9. **Parked.** Driver taps **"I parked"**. Plan P shows the walking time to the meeting and a success screen.
10. **Every lot in the chain is full (edge case).** The snake grows: Plan P adds the next 3 best lots (Plan D, E, F) to the end of the chain and continues.

## 7. Features and acceptance criteria

### F1. Map of San Francisco with parking lots
- Map opens centered on downtown SF.
- All 12 fake garages appear as pins. Tapping a pin shows name, price per hour, and status (open / full).
- **Done when:** the map loads on a phone screen and all pins are visible and tappable.

### F2. Choose destination and start
- Dropdown with 3 preset meeting places + "tap on map to choose".
- Start defaults to a preset demo point. "Use my location" button is optional (works only on HTTPS, i.e. after deployment).
- **Done when:** the destination shows as a flag pin and the start shows as a car pin.

### F3. Build the backup chain (core logic)
- Calculate walking distance from each lot to the destination (straight-line distance; walking speed 80 meters per minute).
- Ignore lots marked "full" in the fake data and lots more than 15 minutes' walk away.
- Sort by shortest walk. Take the top 3 → Plan A, B, C.
- **Done when:** the chain is shown in a list with walk times, and the logic has simple automated tests.

### F4. Snake route
- Request one driving route through all stops (Start → A → B → C) from OSRM.
- Draw it as a thick line:
  - **Driven part:** solid grey.
  - **Current segment** (to the lot we're heading to): bright green, thick, with an animated "flowing" dash effect.
  - **Backup segments:** faded green.
- Lot pins labelled **A, B, C** on the map.
- If OSRM fails or is slow (over 5 seconds), draw straight lines and show a small "approximate route" note.
- **Done when:** the snake is visible and the current segment is clearly different from the backups.

### F5. "Lot is full" → move to next lot
- Big red button at the bottom of the screen, easy to hit with a thumb (at least 64 px tall).
- On tap: mark current lot full (red ✕), move the snake head to the next lot, update the message card, all in under 2 seconds.
- If there are no more lots in the chain: extend it with the next 3 best lots and redraw (the snake grows).
- **Done when:** tapping repeatedly walks through A → B → C → D… without errors.

### F6. Open in Apple Maps / Google Maps
- Button "Open in Maps". On iPhone, open Apple Maps; otherwise open Google Maps.
  - Apple: `https://maps.apple.com/?daddr=LAT,LNG&dirflg=d`
  - Google: `https://www.google.com/maps/dir/?api=1&destination=LAT,LNG&travelmode=driving`
- **Done when:** tapping it on a phone opens the maps app with the correct garage as the destination.

### F7. Simulate drive (demo mode)
- "Simulate drive" toggle moves the car icon along the route at a steady speed.
- When the car reaches the current lot, a popup asks: **"Is there space?"** → "Yes, I parked" / "Lot is full".
- **Done when:** a full demo can be run on a laptop without moving.

### F8. Calm, driver-friendly design
- Big text, few words, one main action at a time.
- Calm colors (green = go, red only for "full").
- Optional: spoken message using the browser's built-in voice ("Plan A is full. Heading to Plan B.").
- **Done when:** a non-technical person can run the demo without explanation.

## 8. Fake parking data (approximate coordinates)

Stored in one file, `src/data/lots.ts`. Coordinates are approximate and fine for the demo.

| ID | Name | Lat | Lng | $/hr | Starting status |
|---|---|---|---|---|---|
| L1 | Union Square Garage | 37.7880 | -122.4075 | 6 | open |
| L2 | Sutter-Stockton Garage | 37.7898 | -122.4068 | 5 | open |
| L3 | Ellis-O'Farrell Garage | 37.7856 | -122.4070 | 5 | open |
| L4 | Fifth & Mission Garage | 37.7835 | -122.4055 | 6 | open |
| L5 | Moscone Center Garage | 37.7840 | -122.4005 | 5 | open |
| L6 | Portsmouth Square Garage | 37.7948 | -122.4052 | 4 | open |
| L7 | St. Mary's Square Garage | 37.7920 | -122.4050 | 5 | full |
| L8 | Golden Gateway Garage | 37.7955 | -122.3990 | 7 | open |
| L9 | Embarcadero Center Garage | 37.7950 | -122.3975 | 8 | open |
| L10 | Civic Center Garage | 37.7795 | -122.4180 | 4 | open |
| L11 | Performing Arts Garage | 37.7770 | -122.4225 | 4 | open |
| L12 | Mission-Bartlett Garage | 37.7560 | -122.4195 | 3 | open |

**Preset meeting places:**
- Investor meeting — 1 Market St (37.7941, -122.3951)
- Salesforce Tower (37.7897, -122.3972)
- Moscone Center (37.7842, -122.4016)

**Preset demo start:** Fell St & Van Ness Ave (37.7765, -122.4200)

## 9. Out of scope for this slice

- Real-time parking availability data
- Automatic detection that a lot is full
- Reservations or payments
- User accounts, login, saved trips
- Native iPhone/Android app
- Address search (typing an address). Presets + tap-on-map only
- Cities other than San Francisco

## 10. Technical approach (simple and free)

| Piece | Choice | Why |
|---|---|---|
| App framework | **Next.js 16 + React + TypeScript** (reused from the previous project) | Already set up, building and deployable |
| Map | **Leaflet + react-leaflet**, OpenStreetMap tiles | Free, no key |
| Routing | **OSRM public demo server** (`router.project-osrm.org`) | Free, supports multiple stops in one request |
| Tests | **Vitest** | Quick to set up, works for plain logic files |
| Styling | Tailwind + shadcn/ui (mobile-first, reused) | Already set up with our dark design system |
| Hosting | **Netlify** (free, reused) | Gives an HTTPS link that works on any phone |

**Folder layout:**
```
plan-p/
  PRD.md
  CLAUDE.md
  src/
    data/lots.ts          (fake garages + presets)
    logic/chain.ts        (builds Plan A/B/C, extends chain)
    logic/chain.test.ts   (tests)
    logic/route.ts        (calls OSRM, straight-line fallback)
    components/MapView.tsx
    components/ControlPanel.tsx
    app/page.tsx          (landing page)
    app/plan/page.tsx     (the map app)
```

## 11. Build plan: small batches (8 hours)

Each batch ends with something you can **see working** and a **git commit** (a save point).

| # | Batch | Time | You can see… |
|---|---|---|---|
| 0 | Setup: project, tools, save point | 0:30 | A blank app running in the browser |
| 1 | Map + fake garages | 1:00 | SF map with 12 tappable pins |
| 2 | Destination/start + backup chain logic + tests | 1:00 | Plan A/B/C list with walk times |
| 3 | Snake route drawing | 1:30 | Bright current segment, faded backups |
| 4 | "Lot is full" button + chain extension | 1:00 | Tapping moves the snake head forward |
| 5 | Open in Maps + simulate drive | 1:00 | Full demo on a laptop |
| 6 | Calm mobile design + voice | 1:00 | Looks good on a phone |
| 7 | Test on phone, deploy, rehearse demo | 1:00 | A public HTTPS link |

## 12. Success criteria for the slice

- The full demo story (section 6) runs from start to finish without errors, 3 times in a row.
- From tapping "Lot is full" to seeing the new target: **under 2 seconds**.
- Works on an iPhone in Safari through the deployed link.
- A non-technical person can run the demo after one explanation.

## 13. Risks

| Risk | What we do |
|---|---|
| OSRM demo server is slow or down | Straight-line fallback (F4) |
| "Use my location" doesn't work on the phone over local Wi-Fi | Expected: phones require HTTPS. Use the preset start until deployed |
| Running out of time | Batches 6 and 7 can shrink; Batches 1–5 are the must-haves |
| Safety: driver touching the phone | One big button, voice messages, and in a real product a passenger or voice command would trigger it |

## 14. After the slice (next steps)

1. Real availability data (garage partners, SFMTA, or crowd reports).
2. Automatic "lot is full" detection (car stops moving near the entrance, then drives away).
3. Voice command: "Plan P, it's full."
4. Address search.
5. Reserve and pay for the backup spot in advance.