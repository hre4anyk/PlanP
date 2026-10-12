# Deployment (Netlify + Anbaric Cloud)

Live: **https://getplanp.netlify.app/car**. Build settings live in [netlify.toml](netlify.toml), so Netlify needs no manual build config.

## Website (Netlify)

1. The site `getplanp` is connected to `hre4anyk/PlanP`. Every push to `main` redeploys production; every pull request gets a preview at `deploy-preview-N--getplanp.netlify.app`.
2. **Site configuration → Environment variables:** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_MAPS_API_KEY`, `ENGINE_TOKEN` (see [.env.example](.env.example)). Redeploy after changing them.
3. Netlify Blobs (the queue to the engine) needs no setup.

## Trip engine (Anbaric Cloud)

The engine in `engine/` is an Anbaric app (`planp-engine`). Anbaric apps sit behind Anbaric's login, so the engine calls the site, not the other way round: it polls each site's `/api/engine/queue` every 0.5 s and posts results to `/api/engine/result`.

```bash
cd engine
anbaric login
anbaric secrets set anthropic-key --app planp-engine   # paste the key on stdin
anbaric secrets set engine-token --app planp-engine    # same value as ENGINE_TOKEN on Netlify
anbaric secrets set site-urls --app planp-engine       # comma-separated, e.g. https://getplanp.netlify.app,https://deploy-preview-8--getplanp.netlify.app
anbaric app deploy        # first time (promo code SFTW26 on the subscribe page)
anbaric app update        # after changes
anbaric jobs list         # trips and pitch reviews, each an audited job
```

If the engine is down, the site waits 13 s and then scores the pitch with Claude directly, so the demo never stalls.

## Checklist before the demo

- [ ] https://getplanp.netlify.app/car loads on the iPhone in Safari (reload to get the latest)
- [ ] Microphone allowed (aA → Website Settings → Microphone → Allow)
- [ ] Say "2 South Park Street" → "Let's go?" → yes → four questions → pitch score before Plan A
- [ ] Loud room: tap **Mic off** while Plan P talks, **Mic on** to answer
- [ ] `anbaric jobs list` shows the trip and the pitch review
- [ ] No secrets committed (`.env.local` is gitignored)
