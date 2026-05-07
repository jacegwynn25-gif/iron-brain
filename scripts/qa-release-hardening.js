/* eslint-disable no-console */
const { chromium } = require('playwright');

const BASE_URL = process.env.QA_BASE_URL || 'http://localhost:3000';
const ACTIVE_SESSION_KEY = 'iron_brain_active_session_v1__default';

function activeSessionSnapshot(overrides = {}) {
  return {
    status: 'active',
    startTime: new Date().toISOString(),
    meta: {
      programId: 'qa-hardening',
      programName: 'QA Hardening',
      dayName: 'Resume Hardening',
      weightUnit: 'lbs',
      ...overrides.meta,
    },
    activeCell: {
      blockId: 'block_resume',
      exerciseId: 'custom_1348593_resume',
      setId: 'set_next',
      field: 'weight',
    },
    blocks: [
      {
        id: 'block_resume',
        type: 'single',
        exercises: [
          {
            id: 'custom_1348593_resume',
            name: 'Resume Custom Press',
            notes: '',
            historyNote: null,
            sets: [
              {
                id: 'set_resume',
                type: 'working',
                weight: 225,
                weightUnit: 'lbs',
                reps: 5,
                rpe: 8,
                touchedWeight: true,
                touchedReps: true,
                touchedRpe: true,
                tempo: null,
                supersetGroup: null,
                cluster: null,
                completed: true,
                previous: '225lbs x 5',
                previousNote: 'Last time: elbows stayed tight.',
                notes: 'Keep elbows tucked on the descent.',
              },
              {
                id: 'set_next',
                type: 'working',
                weight: 225,
                weightUnit: 'lbs',
                reps: 5,
                rpe: null,
                touchedWeight: false,
                touchedReps: false,
                touchedRpe: false,
                tempo: null,
                supersetGroup: null,
                cluster: null,
                completed: false,
                previous: '225lbs x 5',
                previousNote: 'Keep elbows tucked on the descent.',
                notes: '',
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

async function newPage(browser, initScript) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript((script) => {
    if (!sessionStorage.getItem('iron_brain_qa_bootstrapped')) {
      localStorage.clear();
      localStorage.setItem('iron_brain_onboarding_complete', 'true');
      localStorage.setItem('iron_brain_coach_marks_complete', 'true');
      sessionStorage.setItem('iron_brain_qa_bootstrapped', 'true');
    }
    if (script) {
      // eslint-disable-next-line no-eval
      eval(script);
    }
  }, initScript || '');
  const page = await context.newPage();
  const closePage = page.close.bind(page);
  page.close = async (...args) => {
    await closePage(...args).catch(() => {});
    await context.close().catch(() => {});
  };
  return page;
}

async function expectHttpStatus(path, init, expectedStatus) {
  const response = await fetch(`${BASE_URL}${path}`, init);
  if (response.status !== expectedStatus) {
    const body = await response.text().catch(() => '');
    throw new Error(`${path} expected ${expectedStatus}, got ${response.status}: ${body.slice(0, 160)}`);
  }
  console.log(`✅ ${path} returns ${expectedStatus}`);
}

async function checkUnauthenticatedApis() {
  await expectHttpStatus('/api/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ amountCents: 500 }),
  }, 401);

  await expectHttpStatus('/api/programs/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  }, 401);

  await expectHttpStatus('/api/oura/connect', { method: 'GET' }, 401);

  await expectHttpStatus('/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  }, 400);
}

async function checkCorruptedActiveSession(browser) {
  const page = await newPage(
    browser,
    `localStorage.setItem('${ACTIVE_SESSION_KEY}', '{not valid json');`
  );
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await page.getByText(/START SESSION/i).waitFor({ state: 'visible', timeout: 15000 });
  await page.close();
  console.log('✅ corrupted active-session storage does not crash dashboard');
}

async function checkResumeDataIntegrity(browser) {
  const page = await newPage(
    browser,
    `localStorage.setItem('${ACTIVE_SESSION_KEY}', ${JSON.stringify(JSON.stringify(activeSessionSnapshot()))});`
  );

  await page.goto(`${BASE_URL}/workout/new`, { waitUntil: 'networkidle' });
  await page.getByText('Resume Custom Press').waitFor({ state: 'visible', timeout: 15000 });

  const body = await page.locator('body').innerText();
  if (/custom_1348593_resume/i.test(body)) {
    throw new Error('Custom exercise ID leaked into resumed workout UI');
  }

  await page.getByText('Resume Custom Press').first().click();
  await page.getByText('LBS').first().waitFor({ state: 'visible', timeout: 15000 });
  await page.getByRole('button', { name: 'kg', exact: true }).click();
  await page.getByText('KG').first().waitFor({ state: 'visible', timeout: 15000 });

  await page.waitForFunction((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    const set = saved.blocks?.[0]?.exercises?.[0]?.sets?.find((entry) => entry.id === 'set_next');
    return set?.weightUnit === 'kg' && Math.abs(Number(set.weight) - 102.06) < 0.2;
  }, ACTIVE_SESSION_KEY, { timeout: 5000 });

  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), ACTIVE_SESSION_KEY);
  const set = saved.blocks[0].exercises[0].sets.find((entry) => entry.id === 'set_resume');
  if (set.notes !== 'Keep elbows tucked on the descent.') {
    throw new Error('Set notes did not survive resume/unit update');
  }

  await page.close();
  console.log('✅ resume preserves display name, per-set units, converted weight, and notes');
}

async function checkMiniBarLayout(browser) {
  const page = await newPage(
    browser,
    `localStorage.setItem('${ACTIVE_SESSION_KEY}', ${JSON.stringify(JSON.stringify(activeSessionSnapshot()))});`
  );

  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await page.getByText(/RESUME SESSION/i).waitFor({ state: 'visible', timeout: 15000 });
  await page.getByText('Resume Hardening').waitFor({ state: 'visible', timeout: 15000 });

  const boxes = await page.evaluate(() => {
    const nav = document.querySelector('.app-bottom-nav')?.getBoundingClientRect();
    const mini = Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Resume Hardening'))
      ?.getBoundingClientRect();
    return nav && mini ? { gap: nav.top - mini.bottom } : null;
  });

  if (!boxes) throw new Error('Could not measure active workout mini bar');
  if (boxes.gap < 6) throw new Error(`Active workout mini bar crowds bottom nav: ${boxes.gap}px gap`);
  if (boxes.gap > 14) throw new Error(`Active workout mini bar floats too far above bottom nav: ${boxes.gap}px gap`);

  await page.close();
  console.log(`✅ active workout mini bar sits above bottom nav (${Math.round(boxes.gap)}px gap)`);
}

async function checkWorkoutExitKeepsResume(browser) {
  const page = await newPage(browser);
  await page.goto(`${BASE_URL}/workout/new?type=empty`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Review Finish/i }).waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForFunction(() =>
    Object.keys(localStorage).some((key) =>
      key.includes('iron_brain_active_session_v1') &&
      localStorage.getItem(key)?.includes('"status":"active"')
    ),
    null,
    { timeout: 15000 }
  );
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await page.getByText(/RESUME SESSION/i).waitFor({ state: 'visible', timeout: 15000 });
  await page.close();
  console.log('✅ exiting an active workout keeps dashboard resume CTA visible');
}

async function checkWorkoutRouteChrome(browser) {
  const page = await newPage(browser);
  await page.goto(`${BASE_URL}/workout/new?type=empty`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Review Finish/i }).waitFor({ state: 'visible', timeout: 15000 });
  const navCount = await page.locator('.app-bottom-nav').count();
  if (navCount !== 0) throw new Error('Bottom nav should be hidden inside workout logger');
  await page.close();
  console.log('✅ workout logger hides bottom navigation');
}

async function checkSettingsPolish(browser) {
  const page = await newPage(browser);
  await page.goto(`${BASE_URL}/profile/settings`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: /Settings/i }).waitFor({ state: 'visible', timeout: 15000 });
  const body = await page.locator('body').innerText();
  if (/Apple Health|Simulate Crash|Coming soon/i.test(body)) {
    throw new Error('Settings exposes placeholder or developer-only controls');
  }
  await page.getByRole('button', { name: 'LBS', exact: true }).waitFor({ state: 'visible', timeout: 15000 });
  await page.getByRole('button', { name: 'KG', exact: true }).waitFor({ state: 'visible', timeout: 15000 });
  await page.close();
  console.log('✅ settings page avoids placeholder controls and exposes unit preferences');
}

async function checkBottomNavTapTargets(browser) {
  const page = await newPage(browser);
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await page.locator('.app-bottom-nav').waitFor({ state: 'visible', timeout: 15000 });

  const targetReport = await page.evaluate(() => {
    document.querySelectorAll('nextjs-portal').forEach((node) => {
      if (node instanceof HTMLElement) node.style.pointerEvents = 'none';
    });

    return Array.from(document.querySelectorAll('[data-nav-item]')).map((node) => {
      const link = node;
      const rect = link.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const topElement = document.elementFromPoint(x, y);
      return {
        id: link.getAttribute('data-nav-item'),
        width: rect.width,
        height: rect.height,
        topTag: topElement?.tagName ?? null,
        hit: Boolean(topElement && link.contains(topElement)),
      };
    });
  });

  const failed = targetReport.filter((target) => !target.hit || target.height < 56 || target.width < 48);
  if (failed.length > 0) {
    throw new Error(`Bottom nav tap target failure: ${JSON.stringify(failed)}`);
  }

  const routes = [
    ['log', '/start'],
    ['programs', '/programs'],
    ['history', '/history'],
    ['analytics', '/analytics'],
    ['dashboard', '/'],
  ];

  for (const [item, route] of routes) {
    await page.locator(`[data-nav-item="${item}"]`).tap({ timeout: 5000 });
    await page.waitForURL((url) => url.pathname === route, { timeout: 8000 });
    await page.locator('.app-bottom-nav').waitFor({ state: 'visible', timeout: 15000 });
  }

  await page.close();
  console.log('✅ bottom nav tap targets are unobstructed and navigate on mobile taps');
}

(async () => {
  await checkUnauthenticatedApis();

  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    await checkCorruptedActiveSession(browser);
    await checkResumeDataIntegrity(browser);
    await checkWorkoutExitKeepsResume(browser);
    await checkMiniBarLayout(browser);
    await checkWorkoutRouteChrome(browser);
    await checkSettingsPolish(browser);
    await checkBottomNavTapTargets(browser);
  } finally {
    await browser.close();
  }

  console.log('✅ Release hardening QA completed');
})().catch((error) => {
  console.error('❌ Release hardening QA failed:', error);
  process.exit(1);
});
