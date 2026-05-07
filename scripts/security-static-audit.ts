import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

type Check = {
  name: string;
  ok: boolean;
  detail: string;
};

const ROOT = process.cwd();
const checks: Check[] = [];

function add(name: string, ok: boolean, detail: string) {
  checks.push({ name, ok, detail });
}

function gitFiles() {
  const output = execFileSync('git', ['ls-files', '-z'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return output.split('\0').filter(Boolean);
}

function readTrackedTextFiles() {
  return gitFiles()
    .filter((file) => {
      const ext = path.extname(file).toLowerCase();
      if (['.png', '.jpg', '.jpeg', '.webp', '.ico', '.pdf', '.woff', '.woff2'].includes(ext)) return false;
      if (file.startsWith('.next/')) return false;
      if (!fs.existsSync(path.join(ROOT, file))) return false;
      return true;
    })
    .map((file) => ({
      file,
      text: fs.readFileSync(path.join(ROOT, file), 'utf8'),
    }));
}

function checkEnvFiles() {
  const tracked = new Set(gitFiles());
  add('git:env-local-untracked', !tracked.has('.env.local'), '.env.local is not tracked');
}

function checkSecretLiterals(files: Array<{ file: string; text: string }>) {
  const secretPatterns = [
    /sk_(?:live|test)_[A-Za-z0-9]{12,}/g,
    /rk_(?:live|test)_[A-Za-z0-9]{12,}/g,
    /whsec_[A-Za-z0-9]{12,}/g,
    /supabase_service_role_[A-Za-z0-9_-]{12,}/gi,
  ];

  const offenders: string[] = [];
  for (const { file, text } of files) {
    if (file === '.env.example') continue;
    if (file.startsWith('docs/')) continue;
    for (const pattern of secretPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(text)) {
        offenders.push(file);
        break;
      }
    }
  }

  add(
    'secrets:no-tracked-secret-literals',
    offenders.length === 0,
    offenders.length === 0 ? 'no tracked Stripe/Supabase secret literals found' : offenders.join(', ')
  );
}

function checkServiceRoleIsolation(files: Array<{ file: string; text: string }>) {
  const executableExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
  const allowed = (file: string) =>
    file.startsWith('app/api/') ||
    file.startsWith('scripts/') ||
    file === 'app/lib/supabase/admin.ts';

  const offenders = files
    .filter(({ file, text }) =>
      executableExts.has(path.extname(file).toLowerCase()) &&
      text.includes('SUPABASE_SERVICE_ROLE_KEY') &&
      !allowed(file)
    )
    .map(({ file }) => file);

  add(
    'secrets:service-role-server-only',
    offenders.length === 0,
    offenders.length === 0 ? 'service role key references are isolated to server/scripts' : offenders.join(', ')
  );
}

function checkProtectedApiRoutes(files: Array<{ file: string; text: string }>) {
  const requiredAuthRoutes = [
    'app/api/calendar/events/route.ts',
    'app/api/checkout/route.ts',
    'app/api/collab/assignments/route.ts',
    'app/api/collab/links/[id]/route.ts',
    'app/api/collab/links/route.ts',
    'app/api/oura/connect/route.ts',
    'app/api/oura/disconnect/route.ts',
    'app/api/oura/sync/route.ts',
    'app/api/programs/generate/route.ts',
  ];

  const byFile = new Map(files.map((entry) => [entry.file, entry.text]));
  const offenders = requiredAuthRoutes.filter((file) => {
    const text = byFile.get(file) ?? '';
    return !text.includes('getSupabaseUserFromRequest') || !/if\s*\(!user\)/.test(text);
  });

  add(
    'api:protected-routes-authenticate-user',
    offenders.length === 0,
    offenders.length === 0 ? 'all protected API routes require bearer auth' : offenders.join(', ')
  );
}

function checkStripeHardening(files: Array<{ file: string; text: string }>) {
  const checkout = files.find((entry) => entry.file === 'app/api/checkout/route.ts')?.text ?? '';
  const webhook = files.find((entry) => entry.file === 'app/api/webhooks/stripe/route.ts')?.text ?? '';

  add(
    'stripe:checkout-uses-auth-user',
    checkout.includes('client_reference_id: user.id') &&
      checkout.includes('metadata:') &&
      !checkout.includes("searchParams.get('user_id')") &&
      !checkout.includes('searchParams.get("user_id")'),
    'checkout ties Stripe session to authenticated Supabase user'
  );

  add(
    'stripe:webhook-verifies-signature',
    webhook.includes('stripe.webhooks.constructEvent') && webhook.includes('STRIPE_WEBHOOK_SECRET'),
    'webhook verifies Stripe signature with webhook secret'
  );

  add(
    'stripe:webhook-idempotency',
    webhook.includes('reserveStripeEvent') && webhook.includes('stripe_event_id'),
    'webhook reserves Stripe event IDs before processing'
  );
}

function checkLegacyFitnessTrackerDisabled(files: Array<{ file: string; text: string }>) {
  const connect = files.find((entry) => entry.file === 'app/api/oura/connect/route.ts')?.text ?? '';
  const callback = files.find((entry) => entry.file === 'app/api/oura/callback/route.ts')?.text ?? '';
  const sync = files.find((entry) => entry.file === 'app/api/oura/sync/route.ts')?.text ?? '';
  const combined = `${connect}\n${callback}\n${sync}`;

  add(
    'fitness-tracker:legacy-integration-disabled',
    connect.includes('status: 410') &&
      sync.includes('status: 410') &&
      callback.includes("'disabled'") &&
      !combined.includes('OURA_AUTHORIZE_URL') &&
      !combined.includes('OURA_TOKEN_URL') &&
      !combined.includes('OURA_API_BASE_URL') &&
      !combined.includes('access_token'),
    'legacy OAuth and sync endpoints are disabled'
  );
}

function main() {
  checkEnvFiles();
  const files = readTrackedTextFiles();
  checkSecretLiterals(files);
  checkServiceRoleIsolation(files);
  checkProtectedApiRoutes(files);
  checkStripeHardening(files);
  checkLegacyFitnessTrackerDisabled(files);

  for (const check of checks) {
    console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name} - ${check.detail}`);
  }

  const failed = checks.filter((check) => !check.ok);
  if (failed.length > 0) {
    console.error(`\n${failed.length} security audit check(s) failed.`);
    process.exit(1);
  }
}

main();
