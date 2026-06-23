/* eslint-disable no-console */
const { spawn } = require('node:child_process');
const { rmSync } = require('node:fs');

const BASE_URL = process.env.QA_BASE_URL || 'http://localhost:3000';

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n▶ ${[command, ...args].join(' ')}`);
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      ...options,
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });
}

async function isServerReady() {
  try {
    const response = await fetch(BASE_URL, { redirect: 'manual' });
    return response.status >= 200 && response.status < 500;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isServerReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${BASE_URL}`);
}

async function withDevServer(fn) {
  if (await isServerReady()) {
    console.log(`\nℹ Using existing server at ${BASE_URL}`);
    await fn();
    return;
  }

  console.log(`\n▶ npm run dev`);
  rmSync('.next/dev', { recursive: true, force: true });
  const server = spawn('npm', ['run', 'dev'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });

  server.stdout.on('data', (chunk) => process.stdout.write(chunk));
  server.stderr.on('data', (chunk) => process.stderr.write(chunk));

  try {
    await waitForServer();
    await fn();
  } finally {
    server.kill('SIGINT');
  }
}

async function main() {
  const verifyProductionArgs = ['run', 'verify-production'];
  if (process.env.RUN_LIVE_CHECKOUT === '1') {
    verifyProductionArgs.push('--', '--live-checkout');
  }

  await run('npm', ['run', 'lint']);
  await run('npm', ['run', 'build']);
  await run('npm', ['audit', '--audit-level=high', '--omit=dev']);
  await run('npm', ['run', 'security:audit']);
  await run('npm', ['run', 'qa:catalog']);
  await run('npm', ['run', 'qa:smart']);

  await withDevServer(async () => {
    await run('npm', ['run', 'qa:workout']);
    await run('npm', ['run', 'qa:builder']);
    await run('npm', ['run', 'qa:hardening']);
  });

  await run('npm', verifyProductionArgs);

  console.log('\n✅ Release gate passed');
}

main().catch((error) => {
  console.error('\n❌ Release gate failed:', error);
  process.exit(1);
});
