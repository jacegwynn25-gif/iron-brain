import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: '2025-12-15.clover' }) : null;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tier = searchParams.get('tier') as 'lifetime' | 'monthly' | null;
  const userId = searchParams.get('user_id');

  if (!stripe) {
    return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 });
  }

  if (!process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: 'App URL is not configured' }, { status: 500 });
  }

  if (tier !== 'lifetime' && tier !== 'monthly') {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }

  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 400 });
  }

  try {
    // Check lifetime slots remaining
    if (tier === 'lifetime') {
      const { data: settings } = await supabase
        .from('app_settings')
        .select('lifetime_slots_remaining')
        .eq('id', 'singleton')
        .single();

      if (!settings || settings.lifetime_slots_remaining <= 0) {
        return NextResponse.redirect(new URL('/api/checkout?tier=monthly', request.url));
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
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/`,
      client_reference_id: userId,
      metadata: {
        tier,
        user_id: userId
      }
    });

    return NextResponse.redirect(session.url!);
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
