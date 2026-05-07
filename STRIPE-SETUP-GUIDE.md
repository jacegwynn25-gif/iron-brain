# Stripe Support Setup

Iron Brain is shipping as a free beta. Stripe is used only for optional support payments.

## Current Flow

- `/upgrade` lets authenticated users choose a custom support amount from `$1` to `$500`.
- `/api/checkout` creates a one-time Stripe Checkout Session with dynamic `price_data`.
- Checkout metadata uses `purpose: support`.
- `/api/webhooks/stripe` listens for `checkout.session.completed`, stores the Stripe customer ID, and records a support event in `subscription_events`.
- No app features are locked behind payment.

## Required Environment

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=https://iron-brain.vercel.app
```

No Stripe Price IDs are required for the current support flow.

## Webhook

Endpoint:

```text
https://iron-brain.vercel.app/api/webhooks/stripe
```

Required event:

```text
checkout.session.completed
```

## Verification

Run:

```bash
npm run verify-production
```

For an authenticated live checkout smoke test:

```bash
RUN_LIVE_CHECKOUT=1 npm run release:gate
```

Use Stripe test card `4242 4242 4242 4242` only in test mode.
