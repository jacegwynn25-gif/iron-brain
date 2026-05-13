/* eslint-disable no-console */
const { chromium } = require('playwright');

const BASE_URL = process.env.QA_BASE_URL || 'http://localhost:3000';
const ACTIVE_SESSION_KEY = 'iron_brain_active_session_v1__default';
const ACTIVE_SESSION_CLEAR_MARKER_KEY = 'iron_brain_active_session_cleared_at';

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

async function waitForDashboardStartSession(page, timeout = 15000) {
  await page.getByRole('link', { name: /^START SESSION$/i }).first().waitFor({ state: 'visible', timeout });
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

  await expectHttpStatus('/api/training/recommendations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  }, 401);

  await expectHttpStatus('/api/app-version', { method: 'GET' }, 200);

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
  await waitForDashboardStartSession(page);
  await page.close();
  console.log('✅ corrupted active-session storage does not crash dashboard');
}

async function checkResumeDataIntegrity(browser) {
  const originalStartTime = new Date(Date.now() - 11 * 60 * 1000).toISOString();
  const snapshot = activeSessionSnapshot({ startTime: originalStartTime });
  const page = await newPage(
    browser,
    `localStorage.setItem('${ACTIVE_SESSION_KEY}', ${JSON.stringify(JSON.stringify(snapshot))});`
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
  if (saved.startTime !== originalStartTime) {
    throw new Error(`Resumed workout timer start changed: ${saved.startTime} !== ${originalStartTime}`);
  }
  const set = saved.blocks[0].exercises[0].sets.find((entry) => entry.id === 'set_resume');
  if (set.notes !== 'Keep elbows tucked on the descent.') {
    throw new Error('Set notes did not survive resume/unit update');
  }

  await page.close();
  console.log('✅ resume preserves display name, timer start, per-set units, converted weight, and notes');
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

  await page.getByRole('button', { name: /Clear stuck workout/i }).tap({ timeout: 10000 });
  await page.waitForFunction((key) => localStorage.getItem(key) === null, ACTIVE_SESSION_KEY, { timeout: 5000 });
  await waitForDashboardStartSession(page, 10000);

  await page.close();
  console.log(`✅ active workout mini bar sits above bottom nav and can clear stuck sessions (${Math.round(boxes.gap)}px gap)`);
}

async function checkActiveSessionTombstone(browser) {
  const oldSnapshot = activeSessionSnapshot({
    startTime: new Date(Date.now() - 60_000).toISOString(),
    savedAt: new Date(Date.now() - 30_000).toISOString(),
  });
  const staleSnapshot = activeSessionSnapshot({
    startTime: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
    savedAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
  });

  const tombstonePage = await newPage(
    browser,
    `localStorage.setItem('${ACTIVE_SESSION_CLEAR_MARKER_KEY}', String(Date.now()));
     localStorage.setItem('${ACTIVE_SESSION_KEY}', ${JSON.stringify(JSON.stringify(oldSnapshot))});`
  );
  await tombstonePage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await waitForDashboardStartSession(tombstonePage);
  const resurrected = await tombstonePage.evaluate((key) => localStorage.getItem(key), ACTIVE_SESSION_KEY);
  if (resurrected !== null) {
    throw new Error('Discard tombstone did not block an old active workout from resurrecting');
  }
  await tombstonePage.close();

  const stalePage = await newPage(
    browser,
    `localStorage.setItem('${ACTIVE_SESSION_KEY}', ${JSON.stringify(JSON.stringify(staleSnapshot))});`
  );
  await stalePage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await waitForDashboardStartSession(stalePage);
  const staleRaw = await stalePage.evaluate((key) => localStorage.getItem(key), ACTIVE_SESSION_KEY);
  if (staleRaw !== null) {
    throw new Error('Stale active workout was not auto-cleared');
  }
  await stalePage.close();

  console.log('✅ active-session tombstone blocks resurrection and stale sessions auto-clear');
}

async function checkAppResilienceStatus(browser) {
  const updatePage = await newPage(browser);
  await updatePage.route('**/api/app-version*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      body: JSON.stringify({
        version: 'qa-new-build',
        deployment: 'qa',
        checkedAt: new Date().toISOString(),
      }),
    });
  });

  await updatePage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await updatePage.getByTestId('app-resilience-update').waitFor({ state: 'visible', timeout: 15000 });
  const updateText = await updatePage.getByTestId('app-resilience-update').innerText();
  if (!/UPDATE READY/i.test(updateText) || !/Active workouts stay saved locally/i.test(updateText)) {
    throw new Error(`Update status copy is unclear: ${updateText}`);
  }
  await updatePage.getByLabel('Dismiss update notice').tap({ timeout: 10000 });
  await updatePage.getByTestId('app-resilience-update').waitFor({ state: 'hidden', timeout: 10000 });
  await updatePage.close();

  const offlinePage = await newPage(browser);
  await offlinePage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await offlinePage.context().setOffline(true);
  await offlinePage.evaluate(() => window.dispatchEvent(new Event('offline')));
  await offlinePage.getByTestId('app-resilience-offline').waitFor({ state: 'visible', timeout: 10000 });
  const offlineText = await offlinePage.getByTestId('app-resilience-offline').innerText();
  if (!/OFFLINE MODE/i.test(offlineText) || !/stay on this device|waiting to sync/i.test(offlineText)) {
    throw new Error(`Offline status copy is unclear: ${offlineText}`);
  }
  await offlinePage.context().setOffline(false);
  await offlinePage.close();

  console.log('✅ app resilience status covers stale builds and offline mode');
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

async function checkResumedWorkoutDiscard(browser) {
  const page = await newPage(
    browser,
    `localStorage.setItem('${ACTIVE_SESSION_KEY}', ${JSON.stringify(JSON.stringify(activeSessionSnapshot()))});`
  );
  await page.goto(`${BASE_URL}/workout/new`, { waitUntil: 'networkidle' });
  await page.getByText('Resume Custom Press').waitFor({ state: 'visible', timeout: 15000 });
  await page.getByRole('button', { name: /Discard Session/i }).first().tap({ timeout: 10000 });
  await page.getByText(/Discard Session\?/i).waitFor({ state: 'visible', timeout: 10000 });
  await page.getByRole('button', { name: /Keep Training/i }).tap({ timeout: 10000 });
  await page.getByText(/Discard Session\?/i).waitFor({ state: 'hidden', timeout: 10000 });
  await page.getByText('Resume Custom Press').waitFor({ state: 'visible', timeout: 15000 });
  await page.getByRole('button', { name: /Discard Session/i }).first().tap({ timeout: 10000 });
  await page.getByText(/Discard Session\?/i).waitFor({ state: 'visible', timeout: 10000 });
  await page.getByRole('button', { name: /^Discard$/i }).tap({ timeout: 10000 });
  await page.waitForURL((url) => url.pathname === '/', { timeout: 10000 });
  await waitForDashboardStartSession(page);

  const raw = await page.evaluate((key) => localStorage.getItem(key), ACTIVE_SESSION_KEY);
  if (raw !== null) {
    throw new Error('Discarding a resumed workout did not clear active-session storage');
  }

  await page.close();
  console.log('✅ resumed workout discard clears storage and returns to Start Session CTA');
}

async function checkForceDiscardRoute(browser) {
  const page = await newPage(
    browser,
    `localStorage.setItem('${ACTIVE_SESSION_KEY}', ${JSON.stringify(JSON.stringify(activeSessionSnapshot()))});`
  );
  await page.goto(`${BASE_URL}/workout/new?discard=1`, { waitUntil: 'networkidle' });
  await page.waitForURL((url) => url.pathname === '/', { timeout: 10000 });
  await waitForDashboardStartSession(page);
  const raw = await page.evaluate((key) => localStorage.getItem(key), ACTIVE_SESSION_KEY);
  if (raw !== null) {
    throw new Error('Force-discard route did not clear active-session storage');
  }
  await page.close();
  console.log('✅ force-discard URL clears active workout storage');
}

async function checkStandaloneResetWorkoutRoute(browser) {
  const page = await newPage(
    browser,
    `if (!sessionStorage.getItem('iron_brain_reset_workout_seeded')) {
      localStorage.setItem('${ACTIVE_SESSION_KEY}', ${JSON.stringify(JSON.stringify(activeSessionSnapshot()))});
      sessionStorage.setItem('iron_brain_reset_workout_seeded', 'true');
    }`
  );
  await page.goto(`${BASE_URL}/reset-workout`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL((url) => url.pathname === '/', { timeout: 10000 });
  await waitForDashboardStartSession(page);
  const raw = await page.evaluate((key) => localStorage.getItem(key), ACTIVE_SESSION_KEY);
  if (raw !== null) {
    throw new Error('Standalone reset-workout route did not clear active-session storage');
  }
  await page.close();
  console.log('✅ standalone reset-workout page clears active workout storage before app boot');
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

async function checkStartPageLaunchpad(browser) {
  const page = await newPage(
    browser,
    "localStorage.setItem('iron_brain_selected_program__guest', 'starting_strength_v1');"
  );

  await page.goto(`${BASE_URL}/start`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: /START SESSION/i }).waitFor({ state: 'visible', timeout: 15000 });
  await page.getByText(/START PROGRAM SESSION/i).waitFor({ state: 'visible', timeout: 15000 });
  await page.getByText(/QUICK LOG/i).waitFor({ state: 'visible', timeout: 15000 });

  const report = await page.evaluate(() => {
    const text = document.body.innerText;
    const controls = Array.from(document.querySelectorAll('button'))
      .filter((button) => {
        const label = button.textContent ?? '';
        return /DAY|PROGRAM|EMPTY/i.test(label) && !/START/i.test(label);
      })
      .map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          text: button.textContent?.replace(/\s+/g, ' ').trim() ?? '',
          top: rect.top,
          width: rect.width,
          height: rect.height,
        };
      });

    return {
      viewportWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      hasOldLabels: /Gym Floor|Current Program|Recent Programs|QUICK START/.test(text),
      hasQuickLog: /QUICK LOG/.test(text),
      controls,
    };
  });

  if (report.scrollWidth > report.viewportWidth + 1) {
    throw new Error(`Start page has horizontal overflow: ${report.scrollWidth}px > ${report.viewportWidth}px`);
  }
  if (report.hasOldLabels) {
    throw new Error('Start page still exposes removed filler labels');
  }
  if (!report.hasQuickLog) {
    throw new Error('Start page quick-log action is missing or clipped');
  }
  if (report.controls.length < 3) {
    throw new Error(`Start page expected 3 compact launch controls, found ${report.controls.length}`);
  }
  const controlTops = report.controls.slice(0, 3).map((control) => control.top);
  if (Math.max(...controlTops) - Math.min(...controlTops) > 2) {
    throw new Error(`Start page launch controls are not aligned: ${JSON.stringify(report.controls)}`);
  }
  const undersized = report.controls.slice(0, 3).filter((control) => control.height < 48 || control.width < 88);
  if (undersized.length > 0) {
    throw new Error(`Start page launch controls are undersized: ${JSON.stringify(undersized)}`);
  }

  await page.getByRole('button', { name: /QUICK LOG/i }).tap({ timeout: 10000 });
  await page.getByTestId('quick-log-confirm').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByTestId('quick-log-confirm-start').tap({ timeout: 10000 });
  await page.waitForURL(/\/workout\/new\?type=empty/, { timeout: 10000 });

  await page.close();
  console.log('✅ start page launchpad is compact, aligned, confirms quick log, and free of old filler labels');
}

async function checkProgramsNoFalseReadinessTuneUp(browser) {
  const page = await newPage(
    browser,
    "localStorage.setItem('iron_brain_selected_program__guest', 'starting_strength_v1');"
  );

  await page.goto(`${BASE_URL}/programs`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'PROGRAMS' }).waitFor({ state: 'visible', timeout: 15000 });
  await page.getByText(/Starting Strength/i).first().waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(500);

  const report = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      viewportWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      hasFalseReadinessZero: /readiness is 0/i.test(text),
      hasTuneUpWithoutEvidence: /PROGRAM TUNE-UP/i.test(text),
      hasSetActiveAction: /SET ACTIVE/i.test(text),
    };
  });

  if (report.scrollWidth > report.viewportWidth + 1) {
    throw new Error(`Programs page has horizontal overflow: ${report.scrollWidth}px > ${report.viewportWidth}px`);
  }
  if (report.hasFalseReadinessZero) {
    throw new Error('Programs page shows a fake readiness=0 tune-up when readiness is missing');
  }
  if (report.hasTuneUpWithoutEvidence) {
    throw new Error('Programs page shows Program Tune-Up without workout/readiness evidence');
  }
  if (!report.hasSetActiveAction) {
    throw new Error('Programs page program selection action should read Set Active');
  }

  await page.close();
  console.log('✅ programs page avoids false tune-ups and uses clear Set Active actions');
}

async function checkSmartTrainingTargets(browser) {
  const snapshot = activeSessionSnapshot();
  const exercise = snapshot.blocks[0].exercises[0];
  exercise.sets[0].rpe = 10;
  exercise.sets[0].prescribedRPE = 8;
  exercise.sets[1].prescribedRPE = 8;
  exercise.sets.push({
    id: 'set_third',
    type: 'working',
    weight: 225,
    weightUnit: 'lbs',
    reps: 5,
    rpe: null,
    prescribedRPE: 8,
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
  });

  const page = await newPage(
    browser,
    `localStorage.setItem('${ACTIVE_SESSION_KEY}', ${JSON.stringify(JSON.stringify(snapshot))});`
  );

  await page.goto(`${BASE_URL}/workout/new`, { waitUntil: 'networkidle' });
  await page.getByText('Resume Custom Press').waitFor({ state: 'visible', timeout: 15000 });
  await page.getByText('Resume Custom Press').first().click();
  await page.getByTestId('smart-target-card').waitFor({ state: 'visible', timeout: 15000 });
  const smartTargetText = await page.getByTestId('smart-target-card').innerText();
  if (!/(current session|direct history|similar movement|readiness|load pressure|program prescription|baseline)/i.test(smartTargetText)) {
    throw new Error(`Smart target did not expose its evidence source: ${smartTargetText}`);
  }
  if (!/(confidence|limited|enough|high|baseline)/i.test(smartTargetText)) {
    throw new Error(`Smart target did not expose confidence/data sufficiency: ${smartTargetText}`);
  }
  await page.getByTestId('smart-target-apply').tap({ timeout: 10000 });

  await page.waitForFunction((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    const set = saved.blocks?.[0]?.exercises?.[0]?.sets?.find((entry) => entry.id === 'set_next');
    return Number(set?.weight) > 0 && Number(set?.weight) < 225;
  }, ACTIVE_SESSION_KEY, { timeout: 5000 });

  await page.getByRole('button', { name: /LOG SET/i }).tap({ timeout: 10000 });
  await page.getByTestId('smart-rest-target').waitFor({ state: 'visible', timeout: 15000 });
  await page.getByTestId('smart-rest-apply').tap({ timeout: 10000 });
  await page.waitForTimeout(500);
  if (!(await page.getByTestId('smart-rest-target').isVisible())) {
    throw new Error('Applying a smart target during rest should keep the rest timer open');
  }
  const logSetVisible = await page.getByRole('button', { name: /LOG SET/i }).isVisible().catch(() => false);
  if (logSetVisible) {
    throw new Error('Applying a smart target during rest advanced back to the set logger');
  }
  await page.close();
  console.log('✅ smart target appears, applies to selected set, and rest apply keeps the timer open');
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
    await checkResumedWorkoutDiscard(browser);
    await checkForceDiscardRoute(browser);
    await checkStandaloneResetWorkoutRoute(browser);
    await checkMiniBarLayout(browser);
    await checkActiveSessionTombstone(browser);
    await checkAppResilienceStatus(browser);
    await checkWorkoutRouteChrome(browser);
    await checkStartPageLaunchpad(browser);
    await checkProgramsNoFalseReadinessTuneUp(browser);
    await checkSmartTrainingTargets(browser);
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
