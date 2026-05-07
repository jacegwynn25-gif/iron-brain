import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: '2025-12-15.clover' }) : null;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function reserveStripeEvent(event: Stripe.Event): Promise<boolean> {
  const { error } = await supabase
    .from('subscription_events')
    .insert({
      event_type: event.type,
      stripe_event_id: event.id,
    });

  if (!error) return true;
  if (error.code === '23505') return false;
  throw error;
}

async function updateStripeEvent(
  stripeEventId: string,
  update: {
    user_id?: string;
    event_type: string;
    old_tier?: string | null;
    new_tier?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  await supabase
    .from('subscription_events')
    .update(update)
    .eq('stripe_event_id', stripeEventId);
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

  try {
    const reserved = await reserveStripeEvent(event);
    if (!reserved) {
      return NextResponse.json({ received: true, processed: false, reason: 'already_processed' });
    }
  } catch {
    return NextResponse.json({ error: 'Could not reserve webhook event' }, { status: 500 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      const purpose = session.metadata?.purpose;

      if (!userId) break;
      if (session.payment_status !== 'paid') break;
      if (purpose !== 'support') break;

      await supabase
        .from('user_profiles')
        .update({
          stripe_customer_id: session.customer as string,
        })
        .eq('id', userId);

      await updateStripeEvent(event.id, {
        user_id: userId,
        event_type: 'support',
        old_tier: null,
        new_tier: null,
        metadata: {
          amount_total: session.amount_total,
          currency: session.currency,
          checkout_session_id: session.id,
          payment_intent: session.payment_intent,
          purpose,
        },
      });

      break;
    }
  }

  return NextResponse.json({ received: true });
}
