# Stripe Setup Guide - Iron Brain Pro Monetization

## Overview

This guide walks you through setting up Stripe for Iron Brain's subscription system, including:
- Creating Stripe products and prices
- Configuring webhooks
- Testing the payment flow
- Going live in production

---

## Prerequisites

- ✅ Stripe account (sign up at https://stripe.com)
- ✅ Stripe API keys (test & live)
- ✅ Database migration `003_subscription_system.sql` applied
- ✅ Environment variables set in `.env.local`

---

## Step 1: Create Stripe Products

### 1.1 Create Lifetime Product

1. Go to https://dashboard.stripe.com/test/products
2. Click **"+ Add product"**
3. Fill in:
   - **Name**: `Iron Pro Lifetime`
   - **Description**: `Lifetime access to Iron Brain Pro features - never pay again`
   - **Pricing model**: `Standard pricing`
   - **Price**: `$149.00 USD`
   - **Billing period**: `One time`
4. Click **"Save product"**
5. **Copy the Price ID** (starts with `price_...`)
6. Save it as `STRIPE_PRICE_ID_LIFETIME` in `.env.local`

### 1.2 Create Monthly Subscription Product

1. Go to https://dashboard.stripe.com/test/products
2. Click **"+ Add product"**
3. Fill in:
   - **Name**: `Iron Pro Monthly`
   - **Description**: `Monthly subscription to Iron Brain Pro features`
   - **Pricing model**: `Standard pricing`
   - **Price**: `$12.99 USD`
   - **Billing period**: `Monthly`
4. Click **"Save product"**
5. **Copy the Price ID** (starts with `price_...`)
6. Save it as `STRIPE_PRICE_ID_MONTHLY` in `.env.local`

---

## Step 2: Configure Webhook Endpoint

### 2.1 Create Webhook in Stripe

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click **"+ Add endpoint"**
3. Enter endpoint URL:
   - **Local testing**: Use ngrok (see Step 2.2)
   - **Production**: `https://yourdomain.com/api/webhooks/stripe`
4. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
5. Click **"Add endpoint"**
6. **Copy the Signing Secret** (starts with `whsec_...`)
7. Save it as `STRIPE_WEBHOOK_SECRET` in `.env.local`

### 2.2 Local Testing with ngrok

For local development, use ngrok to expose your local server:

```bash
# Install ngrok (if not installed)
brew install ngrok/ngrok/ngrok

# Start your Next.js dev server
npm run dev

# In a new terminal, start ngrok
ngrok http 3000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Use this as your webhook endpoint: https://abc123.ngrok.io/api/webhooks/stripe
```

---

## Step 3: Update Environment Variables

Update your `.env.local` file with the Stripe credentials:

```env
# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_... # Already set
STRIPE_SECRET_KEY=sk_test_...                   # Already set
STRIPE_WEBHOOK_SECRET=whsec_...                 # From Step 2.1
STRIPE_PRICE_ID_LIFETIME=price_...              # From Step 1.1
STRIPE_PRICE_ID_MONTHLY=price_...               # From Step 1.2

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000       # Or your ngrok URL for testing
```

**Restart your dev server** after updating environment variables:

```bash
npm run dev
```

---

## Step 4: Test the Payment Flow

### 4.1 Create a Test User

1. Sign up for a new account in your app
2. Navigate to any Pro feature (e.g., `/recovery`)
3. Click "Upgrade to Iron Pro"

### 4.2 Test Lifetime Purchase

1. In the paywall, click **"Become a Founding Member"**
2. You'll be redirected to Stripe Checkout
3. Use Stripe test card:
   - **Card number**: `4242 4242 4242 4242`
   - **Expiry**: Any future date (e.g., `12/25`)
   - **CVC**: Any 3 digits (e.g., `123`)
   - **ZIP**: Any 5 digits (e.g., `12345`)
4. Complete the purchase
5. Verify:
   - Redirected to success page
   - `user_profiles.is_pro` = true
   - `user_profiles.subscription_tier` = 'pro_lifetime'
   - `app_settings.lifetime_slots_remaining` = 199
   - `subscription_events` table has an 'upgrade' event

### 4.3 Test Monthly Subscription

1. Create another test account
2. In the paywall, click **"Subscribe Monthly"**
3. Use the same test card: `4242 4242 4242 4242`
4. Complete the subscription
5. Verify:
   - User is marked as Pro
   - `subscription_tier` = 'pro_monthly'
   - `subscription_expires_at` = 30 days from now

### 4.4 Test Subscription Cancellation

1. Go to https://dashboard.stripe.com/test/subscriptions
2. Find the test subscription
3. Click **"Cancel subscription"** → **"Cancel immediately"**
4. Verify webhook fires and:
   - `is_pro` = false
   - `subscription_tier` = 'free'
   - `subscription_events` has a 'cancel' event

---

## Step 5: Verify Feature Gating

### 5.1 Test as Free User

1. Create a new account
2. Go to `/start` and try to start a workout
3. Pre-workout readiness should show:
   - Overall score (rounded, no decimals)
   - Generic recommendations
   - "Upgrade to Iron Pro" messages
   - Blurred muscle recovery section

### 5.2 Test as Pro User

1. Log in with an account that purchased Pro
2. Go to `/start` and start a workout
3. Pre-workout readiness should show:
   - Detailed ACWR score
   - Muscle-by-muscle recovery
   - Specific injury warnings
   - Personalized recommendations

4. During workout:
   - Set recommendations should include dynamic weight adjustments
   - Session fatigue alerts should trigger with detailed analysis

---

## Step 6: Production Setup

### 6.1 Switch to Live Mode

1. Go to https://dashboard.stripe.com (remove `/test` from URL)
2. Click **"Activate account"** if you haven't already
3. Complete Stripe's business verification

### 6.2 Create Live Products

Repeat Step 1 in **Live mode**:
- Create `Iron Pro Lifetime` product ($149)
- Create `Iron Pro Monthly` product ($12.99)
- Copy the **live** price IDs

### 6.3 Create Live Webhook

Repeat Step 2 in **Live mode**:
- Use your production URL: `https://yourdomain.com/api/webhooks/stripe`
- Copy the **live** webhook signing secret

### 6.4 Update Production Environment

Update your production environment variables (e.g., Vercel):

```env
# Stripe Live Keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_LIFETIME=price_...  # Live price ID
STRIPE_PRICE_ID_MONTHLY=price_...   # Live price ID

# Production URL
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

---

## Troubleshooting

### Webhook Not Firing

1. Check webhook logs in Stripe Dashboard
2. Verify `STRIPE_WEBHOOK_SECRET` matches
3. Ensure endpoint is publicly accessible (use ngrok for local)
4. Check server logs for webhook signature verification errors

### User Not Marked as Pro After Payment

1. Check `subscription_events` table for the event
2. Verify `client_reference_id` in Stripe Checkout matches `user.id`
3. Check webhook handler logs for errors
4. Manually update user in Supabase if needed:

```sql
UPDATE user_profiles
SET is_pro = true,
    subscription_tier = 'pro_lifetime',
    subscription_started_at = NOW()
WHERE id = 'user-uuid-here';
```

### Lifetime Slots Not Decrementing

1. Verify RPC function exists:

```sql
SELECT decrement_lifetime_slots();
```

2. Check current slot count:

```sql
SELECT * FROM app_settings WHERE id = 'singleton';
```

3. Manually decrement if needed:

```sql
UPDATE app_settings
SET lifetime_slots_remaining = lifetime_slots_remaining - 1
WHERE id = 'singleton';
```

---

## Security Checklist

Before going live:

- [ ] Verify webhook signature in `/api/webhooks/stripe/route.ts`
- [ ] Use environment variables (never hardcode keys)
- [ ] Enable HTTPS in production
- [ ] Set up Stripe webhook IP allowlist (optional)
- [ ] Review Supabase RLS policies for `user_profiles`
- [ ] Test failed payment scenarios
- [ ] Set up Stripe email receipts
- [ ] Configure tax settings (if applicable)

---

## Monitoring

### Key Metrics to Track

1. **Lifetime Slots Remaining**
   ```sql
   SELECT lifetime_slots_remaining FROM app_settings WHERE id = 'singleton';
   ```

2. **Pro User Count**
   ```sql
   SELECT COUNT(*) FROM user_profiles WHERE is_pro = true;
   ```

3. **Subscription Events**
   ```sql
   SELECT event_type, COUNT(*)
   FROM subscription_events
   GROUP BY event_type;
   ```

4. **Revenue**
   - View in Stripe Dashboard: https://dashboard.stripe.com/payments

---

## Support

### Stripe Resources

- [Stripe Dashboard](https://dashboard.stripe.com)
- [Stripe Docs](https://stripe.com/docs)
- [Webhook Testing](https://stripe.com/docs/webhooks/test)
- [Test Cards](https://stripe.com/docs/testing)

### Iron Brain Resources

- [Migration 003](supabase/migrations/003_subscription_system.sql)
- [Checkout API](app/api/checkout/route.ts)
- [Webhook Handler](app/api/webhooks/stripe/route.ts)
- [Feature Gating](app/lib/auth/subscription.ts)

---

## Next Steps

After Stripe is set up:

1. Test the complete flow with real test cards
2. Verify all webhook events are handled correctly
3. Test feature gating across all Pro features
4. Set up Stripe fraud prevention rules
5. Configure email notifications (Stripe + app)
6. Plan marketing campaign for Founding Members

**You're ready to monetize!** 🚀
