import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseUserFromRequest } from '@/app/lib/supabase/admin';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: '2025-12-15.clover' }) : null;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  // Authenticate the request
  const user = await getSupabaseUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  if (!stripe) {
    return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 });
  }

  if (!process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: 'App URL is not configured' }, { status: 500 });
  }

  let body: { tier?: 'lifetime' | 'monthly' };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const tier = body.tier;
  if (tier !== 'lifetime' && tier !== 'monthly') {
    return NextResponse.json({ error: 'Invalid tier. Must be "lifetime" or "monthly"' }, { status: 400 });
  }

  try {
    // Prevent already-Pro users from checking out again
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_pro, subscription_tier')
      .eq('id', user.id)
      .single();

    if (profile?.is_pro) {
      return NextResponse.json({ error: 'You already have an active subscription' }, { status: 409 });
    }

    // Check lifetime slots remaining
    if (tier === 'lifetime') {
      const { data: settings } = await supabase
        .from('app_settings')
        .select('lifetime_slots_remaining')
        .eq('id', 'singleton')
        .single();

      if (!settings || settings.lifetime_slots_remaining <= 0) {
        return NextResponse.json(
          { error: 'Lifetime slots sold out', redirectToMonthly: true },
          { status: 410 }
        );
      }
    }

    const priceId = tier === 'lifetime'
      ? process.env.STRIPE_PRICE_ID_LIFETIME
      : process.env.STRIPE_PRICE_ID_MONTHLY;

    if (!priceId) {
      return NextResponse.json({ error: 'Stripe price is not configured' }, { status: 500 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: tier === 'lifetime' ? 'payment' : 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/cancel`,
      client_reference_id: user.id,
      customer_email: user.email,
      metadata: {
        tier,
        user_id: user.id
      }
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
