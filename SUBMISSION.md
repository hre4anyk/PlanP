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

- **Claude Opus 5.5 (Anthropic): the brain.** Picks the backup chain and explains each choice in one sentence: for chairs, closest, unblocked and matching your wish ("near the window"); for garages, walk time vs. price, closing time vs. meeting length, height clearance and permit rules. It also reads photos: when someone sits in your chair, it decides whether that's you or someone else (from a clothing description, no faces). It's the strongest reasoner with vision, and it's called only when something changes.
- **OpenAI gpt-realtime-2.1-mini (OpenAI): the voice.** Speech in and speech out in one model, fast and interruptible, so a stressed driver can just talk. It turns "find me a spot" or "ugh, it's full" into tool calls on Plan P, and speaks every change of plan. The mini version keeps voice to a few cents per session.
- Plus a free on-device vision tool (MediaPipe object detector) that watches the camera for chairs and people, so neither AI model has to look at every frame.

## Why multiple models beat multiple apps

A voice isn't a brain, and a brain isn't a voice. The speech-to-speech model gives a natural, interruptible conversation but isn't the strongest at weighing prices, closing times and rules; Claude is, but it can't hold a live spoken conversation. In Plan P the voice model calls Claude as a tool mid-conversation, so the driver gets Claude's judgement at the speed of speech. The same goes for watching: the on-device detector notices instantly that someone sat in your Plan A chair but can't tell who it is, so Claude is asked one precise question at exactly that moment. Separate apps would each make you stop, look and tap. One system makes the reroute hands-free. Every decision, and which model made it, is recorded as an audited workflow on Anbaric.

A Park me session costs about $0.08 and a car trip about $0.13 at standard list prices.

## Team contributions

- _Your name_ (solo): product, design and engineering, built with Claude Code

## What would you build next?

Lot-side cameras: the same engine on existing garage cameras or a cheap phone on a pole, giving real-time free-space counts. That is how we get real availability data, alongside garage partners, SFMTA sensors and crowd-sourced "full" reports from other Plan P drivers' camera reads. Reserving and paying for the backup spot in advance, so Plan B is guaranteed. A fleet version for field-sales and home-service teams, where one missed appointment costs more than a year's subscription. Then CarPlay and Android Auto.
