import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-12-15.clover' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      const tier = session.metadata?.tier as 'lifetime' | 'monthly';

      if (!userId) break;

      // Update user profile
      await supabase
        .from('user_profiles')
        .update({
          is_pro: true,
          subscription_tier: tier === 'lifetime' ? 'pro_lifetime' : 'pro_monthly',
          stripe_customer_id: session.customer as string,
          subscription_started_at: new Date().toISOString(),
          subscription_expires_at: tier === 'monthly'
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            : null
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
          new_tier: tier === 'lifetime' ? 'pro_lifetime' : 'pro_monthly',
          stripe_event_id: event.id
        });

      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      // Find user by stripe_customer_id
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id')
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
            old_tier: 'pro_monthly',
            new_tier: 'free',
            stripe_event_id: event.id
          });
      }

      break;
    }
  }

  return NextResponse.json({ received: true });
}
