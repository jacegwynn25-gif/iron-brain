import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: '2025-12-15.clover' }) : null;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function isEventProcessed(stripeEventId: string): Promise<boolean> {
  const { data } = await supabase
    .from('subscription_events')
    .select('id')
    .eq('stripe_event_id', stripeEventId)
    .maybeSingle();
  return !!data;
}

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe webhook secret is not configured' }, { status: 500 });
  }

  const body = await request.text();
  const sig = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }

  // Idempotency: skip if already processed
  if (await isEventProcessed(event.id)) {
    return NextResponse.json({ received: true, processed: false, reason: 'already_processed' });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      const tier = session.metadata?.tier as 'lifetime' | 'monthly';

      if (!userId) break;
      if (session.payment_status !== 'paid') break;

      // Determine new tier and expiration
      const newTier = tier === 'lifetime' ? 'pro_lifetime' : 'pro_monthly';
      const expiresAt = tier === 'monthly' && session.subscription
        ? null // Will be set by invoice.payment_succeeded or subscription.updated
        : null;

      // Update user profile
      await supabase
        .from('user_profiles')
        .update({
          is_pro: true,
          subscription_tier: newTier,
          stripe_customer_id: session.customer as string,
          subscription_started_at: new Date().toISOString(),
          subscription_expires_at: expiresAt
        })
        .eq('id', userId);

      // Decrement lifetime slots if applicable
      if (tier === 'lifetime') {
        await supabase.rpc('decrement_lifetime_slots');
      }

      // Log event
      await supabase
        .from('subscription_events')
        .insert({
          user_id: userId,
          event_type: 'upgrade',
          old_tier: 'free',
          new_tier: newTier,
          stripe_event_id: event.id
        });

      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = (invoice as unknown as { subscription?: string }).subscription;
      const customerId = invoice.customer as string;
      if (!subscriptionId || !customerId) break;

      // Fetch subscription to get current_period_end
      const subscription = await stripe.subscriptions.retrieve(subscriptionId) as unknown as Stripe.Subscription;
      const currentPeriodEnd = (subscription as unknown as { current_period_end: number }).current_period_end;

      // Find user by stripe_customer_id
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, subscription_tier')
        .eq('stripe_customer_id', customerId)
        .single();

      if (profile) {
        await supabase
          .from('user_profiles')
          .update({
            subscription_expires_at: new Date(currentPeriodEnd * 1000).toISOString(),
            is_pro: true
          })
          .eq('id', profile.id);

        await supabase
          .from('subscription_events')
          .insert({
            user_id: profile.id,
            event_type: 'renew',
            old_tier: profile.subscription_tier,
            new_tier: profile.subscription_tier,
            stripe_event_id: event.id
          });
      }

      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      if (!customerId) break;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, subscription_tier')
        .eq('stripe_customer_id', customerId)
        .single();

      if (profile) {
        // Don't immediately downgrade — give grace period. Just mark expires_at as now
        // so the app can show a "payment failed" message.
        await supabase
          .from('user_profiles')
          .update({
            subscription_expires_at: new Date().toISOString()
          })
          .eq('id', profile.id);

        await supabase
          .from('subscription_events')
          .insert({
            user_id: profile.id,
            event_type: 'payment_failed',
            old_tier: profile.subscription_tier,
            new_tier: profile.subscription_tier,
            stripe_event_id: event.id
          });
      }

      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const status = subscription.status;

      if (!customerId) break;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, subscription_tier')
        .eq('stripe_customer_id', customerId)
        .single();

      if (!profile) break;

      const subPeriodEnd = (subscription as unknown as { current_period_end: number }).current_period_end;

      if (status === 'active' || status === 'trialing') {
        await supabase
          .from('user_profiles')
          .update({
            is_pro: true,
            subscription_expires_at: new Date(subPeriodEnd * 1000).toISOString()
          })
          .eq('id', profile.id);
      } else if (status === 'canceled' || status === 'unpaid' || status === 'past_due') {
        // Keep is_pro true until the period ends, then let it expire naturally
        await supabase
          .from('user_profiles')
          .update({
            subscription_expires_at: new Date(subPeriodEnd * 1000).toISOString()
          })
          .eq('id', profile.id);
      }

      await supabase
        .from('subscription_events')
        .insert({
          user_id: profile.id,
          event_type: 'update',
          old_tier: profile.subscription_tier,
          new_tier: profile.subscription_tier,
          stripe_event_id: event.id,
          metadata: { status }
        });

      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, subscription_tier')
        .eq('stripe_customer_id', customerId)
        .single();

      if (profile) {
        await supabase
          .from('user_profiles')
          .update({
            is_pro: false,
            subscription_tier: 'free',
            subscription_expires_at: null
          })
          .eq('id', profile.id);

        await supabase
          .from('subscription_events')
          .insert({
            user_id: profile.id,
            event_type: 'cancel',
            old_tier: profile.subscription_tier,
            new_tier: 'free',
            stripe_event_id: event.id
          });
      }

      break;
    }
  }

  return NextResponse.json({ received: true });
}
