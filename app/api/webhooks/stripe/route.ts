import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSupabaseAdmin } from '@/app/lib/supabase/admin';
import type { Json } from '@/app/lib/supabase/database.types';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: '2025-12-15.clover' }) : null;
type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

async function reserveStripeEvent(supabase: SupabaseAdmin, event: Stripe.Event): Promise<boolean> {
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
  supabase: SupabaseAdmin,
  stripeEventId: string,
  update: {
    user_id?: string;
    event_type: string;
    old_tier?: string | null;
    new_tier?: string | null;
    metadata?: Json;
  }
) {
  const { error } = await supabase
    .from('subscription_events')
    .update(update)
    .eq('stripe_event_id', stripeEventId);

  if (error) throw error;
}

async function releaseStripeEventReservation(supabase: SupabaseAdmin, stripeEventId: string) {
  const { error } = await supabase
    .from('subscription_events')
    .delete()
    .eq('stripe_event_id', stripeEventId);

  if (error) {
    console.error('Failed to release Stripe webhook reservation:', error);
  }
}

async function processCheckoutSessionCompleted(
  supabase: SupabaseAdmin,
  eventId: string,
  session: Stripe.Checkout.Session
) {
  const userId = session.client_reference_id;
  const purpose = session.metadata?.purpose;

  if (!userId) return;
  if (session.payment_status !== 'paid') return;
  if (purpose !== 'support') return;

  const customerId = typeof session.customer === 'string' ? session.customer : null;
  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id ?? null;

  if (customerId) {
    const { error } = await supabase
      .from('user_profiles')
      .update({
        stripe_customer_id: customerId,
      })
      .eq('id', userId);

    if (error) throw error;
  }

  await updateStripeEvent(supabase, eventId, {
    user_id: userId,
    event_type: 'support',
    old_tier: null,
    new_tier: null,
    metadata: {
      amount_total: session.amount_total,
      currency: session.currency,
      customer_id: customerId,
      checkout_session_id: session.id,
      payment_intent: paymentIntentId,
      purpose,
    },
  });
}

export async function POST(request: NextRequest) {
  const sig = request.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 });
  }

  if (!stripe) {
    return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe webhook secret is not configured' }, { status: 500 });
  }

  const body = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }

  let supabase: SupabaseAdmin;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'Supabase admin is not configured' }, { status: 500 });
  }

  try {
    const reserved = await reserveStripeEvent(supabase, event);
    if (!reserved) {
      return NextResponse.json({ received: true, processed: false, reason: 'already_processed' });
    }
  } catch {
    return NextResponse.json({ error: 'Could not reserve webhook event' }, { status: 500 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await processCheckoutSessionCompleted(
          supabase,
          event.id,
          event.data.object as Stripe.Checkout.Session
        );
        break;
    }
  } catch (error) {
    console.error('Stripe webhook processing failed:', error);
    await releaseStripeEventReservation(supabase, event.id);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
