import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSupabaseUserFromRequest } from '@/app/lib/supabase/admin';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: '2025-12-15.clover' }) : null;

const MIN_SUPPORT_AMOUNT_CENTS = 100;
const MAX_SUPPORT_AMOUNT_CENTS = 50000;

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

  let body: { amountCents?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const amountCents = body.amountCents;
  if (
    typeof amountCents !== 'number' ||
    !Number.isInteger(amountCents) ||
    amountCents < MIN_SUPPORT_AMOUNT_CENTS ||
    amountCents > MAX_SUPPORT_AMOUNT_CENTS
  ) {
    return NextResponse.json(
      { error: 'Support amount must be between $1 and $500.' },
      { status: 400 }
    );
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      submit_type: 'donate',
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: {
            name: 'Support Iron Brain',
            description: 'Optional support for Iron Brain hosting and future development.',
          },
        },
        quantity: 1,
      }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/cancel`,
      client_reference_id: user.id,
      customer_email: user.email,
      metadata: {
        purpose: 'support',
        amount_cents: String(amountCents),
        user_id: user.id,
      }
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
