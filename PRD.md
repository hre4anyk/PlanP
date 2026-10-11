# Plan P — Product Requirements Document (v1.0, simplified)

> **One line:** Tell Plan P where your meeting is. It routes you there, shows every legal street-parking stretch on the way with the walk to the door in minutes, keeps a garage as Plan B, and coaches your pitch while you drive.

**Event:** Multi Model Hackathon, SF Tech Week, Sunday Oct 11 2026, Frontier Tower, San Francisco. Live demo this evening.
**Architecture:** [ARCHITECTURE.md](ARCHITECTURE.md) · **Submission draft:** [SUBMISSION.md](SUBMISSION.md) · **The user story we build for:** [idea.md](idea.md)

**What changed (2026-10-11 afternoon):** the founder simplified the product after testing. One mode only, **Park my car**. Park me (chairs) and the live street camera are removed (they stay in git history). Instead of our own camera, Plan P is a layer on top of **Google Street View**: Claude reads Street View photos along your route and marks where street parking is allowed.

---

## 1. The user (from idea.md)

**Nazar, a defense founder**, driving to a 1:1 with an investor in San Francisco at a set time and place. He has never been to SF, doesn't know where to park, must not be late, and hasn't had time to research the investor. He's stressed.

**Outcome:** he parks without circling, arrives on time, and walks in prepared for the most important pitch of his life.

## 2. The experience

1. **Open Plan P.** It finds where you are (GPS) right away.
2. **"Where's your meeting, and when?"** Say it to the copilot, or type it.
3. **The route appears**, and along its last stretch, **green P markers** for street parking that's allowed there (parking lane, meters, time-limited zones), each with **"4 min walk to your meeting"**. Red marks where you can't park (hydrant, red curb, driveway, bus stop). **Garage A, B, C** are the safety net.
4. **While you drive, the copilot coaches you:** "Who are you meeting?" It researches the investor live, then asks the questions that investor is likely to ask, and gives you short feedback.
5. **It also calls out parking as you approach:** "Street parking on your right in 200 metres, 4 minutes' walk." You see a free space on a green stretch and take it. If nothing's free, Garage A.
6. **"I parked."** Plan P shows the walk to the door and whether you're on time.

**Important:** Street View photos are not live (they're months or years old). Plan P shows **where parking is allowed**; your eyes decide whether a space is free right now as you pass it.

## 3. How we win (judging rubric)

| Criterion | Weight | How Plan P scores |
|---|---|---|
| Multi-model integration | **25%** | Two AI models, each doing what it's best at, in one loop: **OpenAI Realtime** is the voice you talk to while driving; it calls **Claude Opus 5.5** as a tool to research the investor on the web and to read Street View photos for parking rules. Neither app alone could coach you *and* find parking hands-free. |
| Novel idea | 20% | Parking apps help you book a garage. Plan P turns Street View into a parking-rules layer along your exact route, measured in minutes from your meeting, plus a pitch coach for the drive. |
| Production-ready, economics | 15% | About $0.40 per trip at list prices, falling with caching (§6). Everything has a fallback; typed code with tests; Prelint reviews every PR; Anbaric audit trail of each trip (sponsor). |
| Demo under pressure | 20% | On stage: say the address, the route and green P markers appear with walk times; name the investor, the copilot researches and asks a tough question; answer it. |
| Problem people care about | 20% | SF drivers lose 83 hours a year looking for parking (INRIX); more than 4 in 10 Americans have missed an appointment because they couldn't park. And everyone has walked into a meeting unprepared. Live waitlist via Base44 QR. |

**Submission fields** are drafted in [SUBMISSION.md](SUBMISSION.md). **Sponsors:** Prelint (reviews every PR), Anbaric (backend audit trail, S5), Base44 (waitlist QR, built by the founder).

## 4. Models

| Role | Model | Does | Fallback |
|---|---|---|---|
| **Voice** | OpenAI `gpt-realtime-2.1-mini` | Speech-to-speech copilot: asks where/when and who, coaches the pitch, announces parking. Calls Plan P tools. | On-screen text box + buttons |
| **Brain + eyes** | Claude `claude-opus-5-5` | Reads Street View photos (parking allowed? meters, time limits, red curb, hydrant, driveway); researches the investor with web search and writes likely questions. | Garages only; generic defense-VC questions from idea.md |

## 5. Sub-batches (each ends with a test the founder runs)

| # | Sub-batch | What you can test |
|---|---|---|
| **S1** | **One mode, GPS, address → route.** Remove Park me and the street camera. Start = your GPS location. Type the meeting address (and optional time). Driving route on the map, arrival time, garage A/B/C near the destination with walk minutes. | On iPhone: open the link, allow location, the map centres on you. Type "1 Market St" → route from where you are, arrival time, Garage A/B/C with walk times. |
| **S2** | **Street View parking layer.** Along the last ~10 minutes' walk of the route, Plan P samples points every ~60 m, fetches the Street View photo facing the curb, and Claude marks each: parking allowed / not, with the reason and the walk to the destination. | Type an address → within ~15 s green/red P markers appear along the last stretch, each with "N min walk". Tap one → the Street View photo, Claude's reason, the photo's date. |
| **S3** | **Voice copilot.** "Start copilot" opens a live voice session. It asks where and when (sets the route), then who you're meeting (Claude researches them live), then coaches you with that investor's likely questions, one at a time, with short feedback. Founder context from idea.md. | Tap Start copilot, say "1 Market Street at 3pm" → route appears. Say who you're meeting → within ~15 s it says what it found and asks a question. Answer it → feedback + next question. |
| **S4** | **On the drive.** Follow GPS; the copilot calls out green parking stretches as you approach them ("on your right in 200 m, 4 min walk"); "I parked" → walk to the door and on-time status; Open in Apple/Google Maps. | Drive (or simulate on a laptop): announcements as you near green markers; tap I parked → "6 min walk, you'll arrive 4 min early". |
| **S5** | **Demo polish and sponsors.** Landing page for the new story, waitlist QR (Base44), Anbaric trip record, model trace, rehearsal, video, submission. | Full run-through on the stage setup, 3 times in a row. |

## 6. Unit economics (one trip, list prices)

| Step | Usage | Cost |
|---|---|---|
| Street View photos (Static API, ~$7 / 1,000) | ~15 photos along the last stretch | ~$0.11 |
| Claude reads the photos (Opus 5.5, $4 / $20 per M tokens) | ~15 photos, ~1.2k in + ~100 out each | ~$0.10 |
| Claude investor research (web search) | 1 call | ~$0.05 |
| OpenAI Realtime voice (mini) | ~10 min of conversation | ~$0.15 |
| **Total** | | **≈ $0.40 per trip** |

Street View results for a street are cached and reused by every driver, so the photo + Claude cost per trip falls as usage grows. At $9.99/month for founders and sales teams who drive to meetings, a heavy user (20 trips) costs ~$8 at today's prices, falling with caching.

## 7. Data

- **Garages:** the 12 SF garages (fake availability, made-up hours/clearance/rules), shown as Plan B near the destination.
- **Street parking:** derived per request from Google Street View photos by Claude; not live availability.
- **Founder context:** from idea.md (multi-polar world, cost of destruction → zero, Ukrainian drone experience, mesh network, 15,000 drones deployed, MOU with a German Mercedes-owned company, raising $5M for the unmanned "Black Manta" helicopter).

## 8. Out of scope

Live space availability, payments/reservations, accounts, native app, cities other than SF, training our own model (Claude reads photos directly; no training needed).

## 9. Risks

| Risk | What we do |
|---|---|
| Street View photos are old | Say so in the UI ("photo from 2024"); the product shows where parking is allowed, the driver's eyes judge free spaces |
| Google terms restrict extracting data from Street View | Fine for a hackathon demo; check before launch; Mapillary (open licence) is the alternative |
| Voice fails on stage | Text box + buttons do everything voice does |
| GPS denied or indoors | Start from a preset point (Fell & Van Ness), say so |
| Investor research finds nothing | Coach from idea.md with tough generic defense-VC questions |
| Running out of time | S1–S3 are the demo; S4–S5 shrink |

## 10. What we'd build next

Live availability by crowdsourcing (drivers' phones confirm free/taken), SFMTA parking-regulation data as a cross-check, reserve the backup garage, calendar integration (meeting address and investor pulled from the invite), and a partnership path with Nexar's dashcam network.
