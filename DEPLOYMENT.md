# Deployment (Netlify)

Build settings live in [netlify.toml](netlify.toml), so Netlify needs no manual build config.

1. Go to [app.netlify.com/start](https://app.netlify.com/start) and sign in with GitHub.
2. Pick `hre4anyk/PlanP`. Leave the build settings Netlify suggests.
3. Before the first deploy, open **Site configuration → Environment variables** and add every key from [.env.example](.env.example) with the same values as your local `.env.local`.
4. Click **Deploy site**. Every push to `main` redeploys automatically.
5. In the Clerk dashboard, add your Netlify URL (e.g. `https://your-site.netlify.app`) under **Domains**.

## Checklist before the demo

- [ ] Live URL loads on an iPhone in Safari
- [ ] "Use my location" works on the live link (needs HTTPS)
- [ ] No secrets committed (`.env.local` is gitignored)
