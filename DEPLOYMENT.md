# Deployment (Netlify)

Netlify detects Next.js automatically — no config file needed.

1. Go to [app.netlify.com/start](https://app.netlify.com/start) and sign in with GitHub.
2. Pick `hre4anyk/AI-Hacker-House-Equinox-Edition`. Leave the build settings Netlify suggests.
3. Before the first deploy, open **Site configuration → Environment variables** and add every key from [.env.example](.env.example) with the same values as your local `.env.local`.
4. Click **Deploy site**. Every push to `main` redeploys automatically.
5. In the Clerk dashboard, add your Netlify URL (e.g. `https://your-site.netlify.app`) under **Domains** so login works on the live site.

## Checklist before the demo

- [ ] Live URL loads and sign-up works
- [ ] No secrets committed (`.env.local` is gitignored)
- [ ] README links (PRD, demo) point somewhere real
