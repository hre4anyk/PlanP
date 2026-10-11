# Submission draft — Multi Model Hackathon (SF Tech Week)

One section per form field, ready to paste. Update the numbers after the final demo run.

## Project name

Plan P

## Pitch

Plan P is a hands-free parking co-pilot: it lines up backup spots before you arrive, and when a camera sees your spot get taken or you say "it's full", it instantly reroutes you to Plan B and tells you out loud. It works for your car (a backup chain of garages near your meeting) and, in our live demo, for you (finding a free chair in a crowded room).

## Code repository

https://github.com/hre4anyk/PlanP

## Demo

- Live: _Netlify link_
- Video (4 min: Park me in a real room, Park my car on real SF streets): _link_

## Models used and why

- **EfficientDet-Lite0 via MediaPipe (Google, runs on the phone): the fast eyes.** Finds chairs and people in every camera frame, 10+ times a second, for free. Only an on-device model is fast and cheap enough to watch continuously.
- **Gemini 2.5 Flash (Google): the smart eyes.** Called only when something changes. Recognises whether the person who just sat in your chair is you or someone else (from a clothing description, no faces), and spots seats that look free but aren't (a bag on the chair). Fast, cheap multimodal reasoning.
- **Claude Opus 5.5 (Anthropic): the planner.** Picks the backup chain and explains each choice in one sentence. For chairs: closest, unblocked, matching your wish ("near the window"). For garages: walk time vs. price, closing time vs. meeting length, height clearance, permit rules. The one hard reasoning step, so it gets the strongest model.
- **Claude Haiku 5.5 (Anthropic): the reflex.** Turns speech ("find me a spot near the window", "ugh, it's full") into an action in well under a second, for a fraction of a cent.
- **gpt-4o-mini-transcribe (OpenAI): the ears.** Speech to text that copes with background noise, about $0.003 per minute.
- **gpt-4o-mini-tts (OpenAI): the voice.** Speaks every change of plan, calm in the car and playful in the room ("Great landing").

## Why multiple models beat multiple apps

The value is in the hand-off between models, inside one loop that runs in a couple of seconds. The on-device detector sees a person sit in your Plan A chair instantly, but can't tell who it is. Gemini can, but it's too slow and costly to run on every frame. So the detector notices the change and Gemini is asked one precise question at exactly that moment. Then Claude decides what happens next and the voice tells you, so you never look at a screen. Separate apps would each need you to stop, look and tap; one system makes the reroute hands-free.

Each model also runs where it's cheapest: free on-device detection for every frame, cheap Gemini and Haiku for frequent questions, Opus only for the rare hard decision. A Park me session costs about $0.08 and a car trip about $0.11 at standard list prices.

## Team contributions

- _Your name_ (solo): product, design and engineering, built with Claude Code

## What would you build next?

Lot-side cameras: the same engine on existing garage cameras or a cheap phone on a pole, giving real-time free-space counts. That is how we get real availability data, alongside garage partners, SFMTA sensors and crowd-sourced "full" reports from other Plan P drivers' camera reads. Reserving and paying for the backup spot in advance, so Plan B is guaranteed. A fleet version for field-sales and home-service teams, where one missed appointment costs more than a year's subscription. Then CarPlay and Android Auto.
