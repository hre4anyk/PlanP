# Submission draft — Multi Model Hackathon (SF Tech Week)

One section per form field, ready to paste. Update the numbers after the final demo run.

## Project name

Plan P

## Pitch

Plan P is a hands-free parking co-pilot for drivers heading to meetings: it lines up backup garages before you leave, and when your phone's camera sees a "FULL" sign or you say "it's full", it instantly reroutes you to Plan B and tells you out loud. Built for anyone who has ever circled a full garage while their meeting started without them.

## Code repository

https://github.com/hre4anyk/PlanP

## Demo

- Live: _Netlify link_
- Video (4 min, filmed on real SF streets): _link_

## Models used and why

- **Claude Opus 5.5 (Anthropic): the planner.** Builds and re-plans the backup chain of garages. It weighs walk time, price, closing time vs. meeting length, height clearance and permit rules, and explains each pick in one sentence. It's the one hard reasoning step per trip, so we use the strongest model there.
- **Claude Haiku 5.5 (Anthropic): the reflex.** Turns what the driver says ("ugh, it's full", "they want monthly only") into an action in well under a second, for a fraction of a cent.
- **Gemini 2.5 Flash (Google): the eyes.** Reads garage entrance signs from the phone camera (FULL, permit-only, prices, clearance) and returns structured JSON. Fast and cheap enough to check a frame every two seconds as you approach.
- **gpt-4o-mini-transcribe (OpenAI): the ears.** Speech to text that copes with road noise, at about $0.003 per minute.
- **gpt-4o-mini-tts (OpenAI): the voice.** A calm spoken voice for every change of plan, so the driver's eyes stay on the road.

## Why multiple models beat multiple apps

The value is in the hand-off, inside one loop that takes under two seconds. A sign reader alone can see "Monthly permits only 7–10am", but only the planner, which knows it's 9:40 and your meeting runs until 11, can decide that this lot is full **for you**. A voice assistant alone can transcribe "they want forty bucks", but it takes the intent model plus the planner to turn that into a new route with a price cap. And the best plan is useless if a driver has to read a screen, which is why the voice model closes the loop. Separate apps would each force the driver to pick up the phone. Combining them makes the reroute hands-free.

Each model also runs where it's cheapest: the frequent calls (every camera frame, every voice command) go to fast, cheap models, and the rare hard decision goes to the strongest one. A full trip costs about $0.12 at standard list prices.

## Team contributions

- _Your name_ (solo): product, design and engineering, built with Claude Code

## What would you build next?

Real availability data from garage partners and SFMTA sensors, plus crowd-sourced "full" reports from other Plan P drivers' camera reads. Reserving and paying for the backup spot in advance, so Plan B is guaranteed. A fleet version for field-sales and home-service teams, where one missed appointment costs more than a year's subscription. Then CarPlay and Android Auto.
