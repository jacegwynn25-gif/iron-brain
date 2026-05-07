# Iron Brain Release Runbook

This repo ships only when the release gate is green and there are no open ship-blocking bugs.

## Release Gate

Run:

```bash
npm run release:gate
```

The gate runs:

- ESLint
- production build and TypeScript compile
- high-severity production dependency audit
- static security audit
- workout logger browser QA
- program builder browser QA
- release hardening browser QA
- live production verifier for Supabase, Stripe, protected APIs, and public routes

For the deeper authenticated live checkout smoke test, run:

```bash
RUN_LIVE_CHECKOUT=1 npm run release:gate
```

That creates and deletes a temporary Supabase auth user and verifies the live checkout API returns a Stripe Checkout URL.

## Manual Device QA

Before a public launch, run these on a real phone and desktop browser:

- Sign up, log in, log out, and log back in.
- Finish onboarding.
- Start a workout, log sets, add notes, change RPE, change `lbs`/`kg`, leave the workout, resume it, and finish it.
- Create a custom exercise, add it to a workout, leave/resume, and confirm the human name still displays.
- Build and save a custom program.
- Confirm history shows the finished workout and set notes.
- Visit Settings and confirm unit/account controls work and no placeholder controls are exposed.
- Open Support, Cancel, and Success pages.
- Start Stripe Checkout with a real authenticated account before announcing paid access.

## Ship Criteria

Ship only when:

- `npm run release:gate` passes.
- Vercel production deployment is ready.
- `npm run verify-production` passes after deployment.
- Mobile bottom navigation works reliably on a real phone.
- The current release has no known security, payment, workout data-loss, or mobile navigation blockers.
- Stripe webhook endpoint is enabled for production.
- No secrets are committed.
- Any known bug has either been fixed or explicitly accepted as non-blocking.

## Rollback

If production breaks:

1. Open the Vercel project deployments list.
2. Promote the last known good production deployment.
3. Run `npm run verify-production`.
4. Check Stripe webhook delivery and Vercel function logs.
5. Open a fix branch from `main`, patch, run `npm run release:gate`, then redeploy.
