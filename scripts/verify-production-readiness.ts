import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
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

  const { error: supportColumnError } = await supabase
    .from('user_profiles')
    .select('stripe_customer_id', { head: true })
    .limit(1);
  add(
    'supabase:user_profiles:stripe_customer_id',
    !supportColumnError,
    supportColumnError ? `${supportColumnError.code} ${supportColumnError.message}` : 'present'
  );

  const { error: prescribedWeightColumnError } = await supabase
    .from('set_logs')
    .select('prescribed_weight')
    .limit(1);
  add(
    'supabase:set_logs:prescribed_weight',
    !prescribedWeightColumnError,
    prescribedWeightColumnError
      ? `${prescribedWeightColumnError.code} ${prescribedWeightColumnError.message}`
      : 'present'
  );
}

type BackendAuditRow = {
  check_name: string;
  ok: boolean;
  detail: string;
};

const BACKEND_SECURITY_SQL = `
WITH function_grants AS (
  SELECT
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS args,
    CASE WHEN grant_acl.grantee = 0 THEN 'PUBLIC' ELSE r.rolname END AS grantee
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) grant_acl
  LEFT JOIN pg_roles r ON r.oid = grant_acl.grantee
  WHERE n.nspname = 'public'
    AND grant_acl.privilege_type = 'EXECUTE'
),
table_grants AS (
  SELECT table_name, grantee, privilege_type
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
),
checks AS (
  SELECT
    'supabase:subscription_events:unique_stripe_event_id' AS check_name,
    to_regclass('public.idx_subscription_events_stripe_event_id_unique') IS NOT NULL AS ok,
    CASE
      WHEN to_regclass('public.idx_subscription_events_stripe_event_id_unique') IS NOT NULL
      THEN 'unique Stripe event id index present'
      ELSE 'missing unique Stripe event id index'
    END AS detail
  UNION ALL
  SELECT
    'supabase:user_profiles:subscription_update_trigger',
    EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'enforce_subscription_field_protection'
        AND tgrelid = 'public.user_profiles'::regclass
        AND NOT tgisinternal
    ),
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'enforce_subscription_field_protection'
        AND tgrelid = 'public.user_profiles'::regclass
        AND NOT tgisinternal
    ) THEN 'subscription update trigger present' ELSE 'subscription update trigger missing' END
  UNION ALL
  SELECT
    'supabase:user_profiles:subscription_insert_trigger',
    EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'enforce_subscription_insert_protection'
        AND tgrelid = 'public.user_profiles'::regclass
        AND NOT tgisinternal
    ),
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'enforce_subscription_insert_protection'
        AND tgrelid = 'public.user_profiles'::regclass
        AND NOT tgisinternal
    ) THEN 'subscription insert trigger present' ELSE 'subscription insert trigger missing' END
  UNION ALL
  SELECT
    'supabase:rpc:no_anon_sensitive_execute',
    NOT EXISTS (
      SELECT 1 FROM function_grants
      WHERE function_name IN (
        'calculate_acwr',
        'get_latest_context_data',
        'get_workout_history_for_recovery',
        'increment_user_model_stats',
        'get_model_performance_metrics',
        'get_or_build_hierarchical_model',
        'get_exercise_avg_sfr',
        'identify_junk_volume_exercises',
        'cleanup_expired_caches',
        'calculate_hours_since_training'
      )
      AND grantee IN ('PUBLIC', 'anon')
    ),
    COALESCE((
      SELECT 'unexpected grants: ' || string_agg(function_name || ':' || grantee, ', ')
      FROM function_grants
      WHERE function_name IN (
        'calculate_acwr',
        'get_latest_context_data',
        'get_workout_history_for_recovery',
        'increment_user_model_stats',
        'get_model_performance_metrics',
        'get_or_build_hierarchical_model',
        'get_exercise_avg_sfr',
        'identify_junk_volume_exercises',
        'cleanup_expired_caches',
        'calculate_hours_since_training'
      )
      AND grantee IN ('PUBLIC', 'anon')
    ), 'no anon/public execute on sensitive RPCs')
  UNION ALL
  SELECT
    'supabase:rpc:service_only_functions',
    NOT EXISTS (
      SELECT 1 FROM function_grants
      WHERE function_name IN (
        'decrement_lifetime_slots',
        'auto_confirm_user',
        'update_updated_at_column',
        'invalidate_model_cache_on_workout',
        'prevent_subscription_self_escalation',
        'prevent_subscription_field_injection'
      )
      AND grantee IN ('PUBLIC', 'anon', 'authenticated')
    ),
    COALESCE((
      SELECT 'unexpected grants: ' || string_agg(function_name || ':' || grantee, ', ')
      FROM function_grants
      WHERE function_name IN (
        'decrement_lifetime_slots',
        'auto_confirm_user',
        'update_updated_at_column',
        'invalidate_model_cache_on_workout',
        'prevent_subscription_self_escalation',
        'prevent_subscription_field_injection'
      )
      AND grantee IN ('PUBLIC', 'anon', 'authenticated')
    ), 'service-only and trigger functions are not public RPCs')
  UNION ALL
  SELECT
    'supabase:views:sfr_security_invoker',
    NOT EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN ('recent_sfr_trends', 'exercise_efficiency_leaderboard')
        AND COALESCE(c.reloptions::text, '') NOT LIKE '%security_invoker=true%'
    ),
    COALESCE((
      SELECT 'missing security_invoker: ' || string_agg(c.relname, ', ')
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN ('recent_sfr_trends', 'exercise_efficiency_leaderboard')
        AND COALESCE(c.reloptions::text, '') NOT LIKE '%security_invoker=true%'
    ), 'SFR views respect underlying RLS')
  UNION ALL
  SELECT
    'supabase:views:sfr_no_anon_select',
    NOT EXISTS (
      SELECT 1 FROM table_grants
      WHERE table_name IN ('recent_sfr_trends', 'exercise_efficiency_leaderboard')
        AND grantee = 'anon'
        AND privilege_type = 'SELECT'
    ),
    COALESCE((
      SELECT 'unexpected anon SELECT: ' || string_agg(table_name, ', ')
      FROM table_grants
      WHERE table_name IN ('recent_sfr_trends', 'exercise_efficiency_leaderboard')
        AND grantee = 'anon'
        AND privilege_type = 'SELECT'
    ), 'SFR views are not anonymous-readable')
  UNION ALL
  SELECT
    'supabase:rls:public_tables_enabled',
    NOT EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND NOT c.relrowsecurity
    ),
    COALESCE((
      SELECT 'RLS disabled: ' || string_agg(c.relname, ', ')
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND NOT c.relrowsecurity
    ), 'RLS enabled on all public tables')
  UNION ALL
  SELECT
    'supabase:fitness_tracker:no_active_oura',
    NOT EXISTS (
      SELECT 1 FROM fitness_tracker_connections
      WHERE provider = 'oura' AND is_active = true
    ),
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM fitness_tracker_connections
      WHERE provider = 'oura' AND is_active = true
    ) THEN 'no active Oura connections' ELSE 'active Oura connection still exists' END
)
SELECT check_name, ok, detail
FROM checks
ORDER BY check_name;
`;

function parseSupabaseQueryRows(output: string): BackendAuditRow[] {
  const start = output.indexOf('{');
  const end = output.lastIndexOf('}');
  if (start < 0 || end < start) {
    throw new Error('Supabase CLI did not return JSON output');
  }

  const payload = JSON.parse(output.slice(start, end + 1)) as { rows?: BackendAuditRow[] };
  return payload.rows ?? [];
}

async function checkBackendDatabaseSecurity() {
  try {
    const output = execFileSync(
      'npx',
      ['supabase', 'db', 'query', '--linked', BACKEND_SECURITY_SQL],
      {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 30000,
      }
    );

    const rows = parseSupabaseQueryRows(output);
    if (rows.length === 0) {
      add('supabase:backend-security', false, 'no backend audit rows returned');
      return;
    }

    rows.forEach((row) => {
      add(row.check_name, row.ok, row.detail);
    });
  } catch (error) {
    add(
      'supabase:backend-security',
      false,
      error instanceof Error ? error.message : 'Supabase backend audit failed'
    );
  }
}

async function checkStripe() {
  if (!process.env.STRIPE_SECRET_KEY || isPlaceholder(process.env.STRIPE_SECRET_KEY)) {
    add('stripe:api', false, 'missing STRIPE_SECRET_KEY');
    return;
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const isLiveSecretKey = stripeSecretKey.startsWith('sk_live_');
  add('stripe:mode:live_secret_key', isLiveSecretKey, isLiveSecretKey ? 'live mode' : 'test mode or unknown');

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2025-12-15.clover',
  });

  const requiredWebhookEvents = [
    'checkout.session.completed',
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
      Boolean(endpoint) && hasAllEvents && endpoint?.livemode === true,
      endpoint
        ? hasAllEvents && endpoint.livemode
          ? 'enabled with required events in live mode'
          : !endpoint.livemode
            ? 'enabled with required events but in test mode'
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
    body: JSON.stringify({ amountCents: 500 }),
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
      body: JSON.stringify({ amountCents: 500 }),
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
  await checkBackendDatabaseSecurity();
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
