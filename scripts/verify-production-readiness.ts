import fs from 'node:fs';
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, '.env.local');
const DEFAULT_APP_URL = 'https://iron-brain.vercel.app';

loadDotenv({ path: ENV_PATH, quiet: true });

type Check = {
  name: string;
  ok: boolean;
  detail: string;
};

const checks: Check[] = [];

function add(name: string, ok: boolean, detail: string) {
  checks.push({ name, ok, detail });
}

function isPlaceholder(value: string | undefined) {
  return !value || /your-|example|sk_test_your|price_your|whsec_your/.test(value);
}

function appUrl() {
  return process.env.PRODUCTION_APP_URL || DEFAULT_APP_URL;
}

async function checkHttp(
  name: string,
  input: string,
  expectedStatus: number,
  init?: RequestInit
) {
  try {
    const response = await fetch(input, init);
    add(name, response.status === expectedStatus, `status=${response.status}`);
    return response;
  } catch (error) {
    add(name, false, error instanceof Error ? error.message : 'request failed');
    return null;
  }
}

async function checkLocalEnv() {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_PRICE_ID_LIFETIME',
    'STRIPE_PRICE_ID_MONTHLY',
    'STRIPE_WEBHOOK_SECRET',
  ];

  add('env:file', fs.existsSync(ENV_PATH), fs.existsSync(ENV_PATH) ? '.env.local found' : '.env.local missing');

  required.forEach((key) => {
    const value = process.env[key];
    add(`env:${key}`, Boolean(value) && !isPlaceholder(value), value ? 'present' : 'missing');
  });
}

async function checkSupabase() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    add('supabase:client', false, 'missing env');
    return;
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  const tables = [
    'user_profiles',
    'app_settings',
    'subscription_events',
    'workout_sessions',
    'set_logs',
    'custom_programs',
    'custom_exercises',
    'user_maxes',
    'user_context_data',
    'fitness_tracker_connections',
  ];

  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .limit(1);
    add(`supabase:table:${table}`, !error, error ? `${error.code} ${error.message}` : 'reachable');
  }

  const { error: subscriptionColumnError } = await supabase
    .from('user_profiles')
    .select('is_pro,subscription_tier,stripe_customer_id,subscription_started_at,subscription_expires_at', { head: true })
    .limit(1);
  add(
    'supabase:user_profiles:subscription_columns',
    !subscriptionColumnError,
    subscriptionColumnError ? `${subscriptionColumnError.code} ${subscriptionColumnError.message}` : 'present'
  );
}

async function checkStripe() {
  if (!process.env.STRIPE_SECRET_KEY || isPlaceholder(process.env.STRIPE_SECRET_KEY)) {
    add('stripe:api', false, 'missing STRIPE_SECRET_KEY');
    return;
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-12-15.clover',
  });

  for (const [label, priceId] of [
    ['lifetime', process.env.STRIPE_PRICE_ID_LIFETIME],
    ['monthly', process.env.STRIPE_PRICE_ID_MONTHLY],
  ] as const) {
    if (!priceId || isPlaceholder(priceId)) {
      add(`stripe:price:${label}`, false, 'missing price id');
      continue;
    }

    try {
      const price = await stripe.prices.retrieve(priceId);
      add(
        `stripe:price:${label}`,
        Boolean(price.active),
        `${price.active ? 'active' : 'inactive'} ${price.currency} ${price.type}`
      );
    } catch (error) {
      add(`stripe:price:${label}`, false, error instanceof Error ? error.message : 'Stripe lookup failed');
    }
  }

  const requiredWebhookEvents = [
    'checkout.session.completed',
    'invoice.payment_succeeded',
    'invoice.payment_failed',
    'customer.subscription.updated',
    'customer.subscription.deleted',
  ];
  const webhookUrl = `${appUrl()}/api/webhooks/stripe`;

  try {
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
    const endpoint = endpoints.data.find(
      (candidate) => candidate.url === webhookUrl && candidate.status === 'enabled'
    );
    const enabledEvents = new Set(endpoint?.enabled_events ?? []);
    const hasAllEvents = requiredWebhookEvents.every(
      (eventName) => enabledEvents.has(eventName) || enabledEvents.has('*')
    );

    add(
      'stripe:webhook:production',
      Boolean(endpoint) && hasAllEvents,
      endpoint
        ? hasAllEvents
          ? 'enabled with required events'
          : 'enabled but missing required events'
        : `missing enabled endpoint for ${webhookUrl}`
    );
  } catch (error) {
    add('stripe:webhook:production', false, error instanceof Error ? error.message : 'Stripe webhook lookup failed');
  }
}

async function checkLiveRoutes() {
  const base = appUrl();
  await checkHttp('live:/', `${base}/`, 200);
  await checkHttp('live:/upgrade', `${base}/upgrade`, 200);
  await checkHttp('live:/success', `${base}/success?session_id=smoke`, 200);
  await checkHttp('live:/cancel', `${base}/cancel`, 200);
  await checkHttp('live:/api/programs/generate:unauth', `${base}/api/programs/generate`, 401, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  await checkHttp('live:/api/checkout:unauth', `${base}/api/checkout`, 401, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tier: 'monthly' }),
  });
}

async function checkLiveCheckout() {
  if (!process.argv.includes('--live-checkout')) return;

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    add('live:checkout', false, 'missing Supabase env');
    return;
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );

  const email = `checkout-smoke-${Date.now()}@iron-brain.local`;
  const password = `Smoke-${Date.now()}-${Math.random().toString(36).slice(2)}!`;
  let userId: string | undefined;

  try {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { smoke_test: true },
    });
    if (created.error) throw created.error;
    userId = created.data.user.id;

    await admin.from('user_profiles').upsert({
      id: userId,
      experience_level: 'intermediate',
    });
    await admin.from('user_settings').upsert({ user_id: userId });

    const signedIn = await anon.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw signedIn.error;

    const token = signedIn.data.session?.access_token;
    if (!token) throw new Error('No access token returned');

    const response = await fetch(`${appUrl()}/api/checkout`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ tier: 'monthly' }),
    });
    const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
    add(
      'live:checkout:authenticated',
      response.ok && typeof payload.url === 'string' && payload.url.startsWith('https://checkout.stripe.com/'),
      response.ok ? 'Stripe checkout URL returned' : `status=${response.status} ${payload.error || 'unknown'}`
    );
  } catch (error) {
    add('live:checkout:authenticated', false, error instanceof Error ? error.message : 'checkout smoke failed');
  } finally {
    if (userId) {
      await admin.auth.admin.deleteUser(userId);
    }
  }
}

async function main() {
  await checkLocalEnv();
  await checkSupabase();
  await checkStripe();
  await checkLiveRoutes();
  await checkLiveCheckout();

  for (const check of checks) {
    console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name} - ${check.detail}`);
  }

  const failed = checks.filter((check) => !check.ok);
  if (failed.length > 0) {
    console.error(`\n${failed.length} production readiness check(s) failed.`);
    process.exit(1);
  }
}

void main();
