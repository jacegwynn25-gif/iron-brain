/* eslint-disable no-console */
const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:3000/workout/new';

async function expectVisible(locator, label) {
  await locator.waitFor({ state: 'visible', timeout: 15000 });
  console.log(`✅ ${label}`);
}

async function swipeRowLeft(page, row, label) {
  const box = await row.boundingBox();
  if (!box) {
    throw new Error(`Could not find row bounds for ${label}`);
  }
  await row.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
}

async function installWorkoutQaBootstrap(page) {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('iron_brain_workout_qa_bootstrapped')) {
      localStorage.clear();
      sessionStorage.setItem('iron_brain_workout_qa_bootstrapped', 'true');
    }
    localStorage.setItem('iron_brain_onboarding_complete', 'true');
    localStorage.setItem('iron_brain_coach_marks_complete', 'true');
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (payload) => {
        window.__ironBrainShared = payload;
      },
    });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: (payload) => Boolean(payload?.files?.length),
    });
  });
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  let page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  await installWorkoutQaBootstrap(page);

  console.log('▶️  Checking smart workout-start prefill...');
  await page.goto('http://localhost:3000', { waitUntil: 'load' });
  await page.evaluate(() => {
    const now = new Date().toISOString();
    const program = {
      id: 'qa_smart_start_program',
      name: 'QA Smart Start Program',
      description: 'QA program for smart startup targets',
      goal: 'strength',
      experienceLevel: 'intermediate',
      daysPerWeek: 1,
      weekCount: 1,
      intensityMethod: 'rpe',
      isCustom: true,
      weeks: [
        {
          weekNumber: 1,
          days: [
            {
              dayOfWeek: 'Mon',
              name: 'Smart Start Day',
              sets: [
                {
                  exerciseId: 'bench_tng',
                  setIndex: 1,
                  prescribedReps: '6',
                  prescriptionMethod: 'rpe',
                  targetRPE: 8,
                  fixedWeight: 185,
                  restSeconds: 120,
                  setType: 'straight',
                },
              ],
              blocks: [],
            },
          ],
        },
      ],
    };
    const history = [
      {
        id: 'qa_smart_start_history',
        programId: 'qa_history',
        programName: 'QA History',
        cycleNumber: 1,
        weekNumber: 1,
        dayOfWeek: 'Mon',
        dayName: 'History Day',
        date: now.split('T')[0],
        startTime: now,
        endTime: now,
        durationMinutes: 45,
        sets: [
          {
            id: 'qa_bench_history_set',
            exerciseId: 'bench_tng',
            exerciseName: 'Bench Press (Touch & Go)',
            setIndex: 1,
            prescribedReps: '6',
            prescribedRPE: 8,
            actualWeight: 200,
            weightUnit: 'lbs',
            actualReps: 6,
            actualRPE: 8,
            completed: true,
            skipped: false,
            e1rm: 240,
            volumeLoad: 1200,
            timestamp: now,
          },
        ],
        totalVolumeLoad: 1200,
        averageRPE: 8,
        createdAt: now,
        updatedAt: now,
      },
    ];

    localStorage.clear();
    sessionStorage.setItem('iron_brain_workout_qa_bootstrapped', 'true');
    localStorage.setItem('iron_brain_onboarding_complete', 'true');
    localStorage.setItem('iron_brain_coach_marks_complete', 'true');
    localStorage.setItem('iron_brain_user_programs__guest', JSON.stringify([program]));
    localStorage.setItem('iron_brain_selected_program__guest', program.id);
    localStorage.setItem('iron_brain_workout_history__default', JSON.stringify(history));
  });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await expectVisible(page.getByTestId('dashboard-command-center'), 'Dashboard command center loaded');
  await expectVisible(page.getByTestId('dashboard-smart-action').getByText(/Smart Start Day/i), 'Dashboard smart action shows planned session');
  await expectVisible(page.getByTestId('dashboard-smart-action').getByText(/^START$/i), 'Dashboard smart action has compact start button');
  await expectVisible(page.getByTestId('dashboard-next-session').getByText(/Smart Start Day/i), 'Dashboard next session shows selected program day');
  await expectVisible(page.getByTestId('dashboard-training-pulse').getByText(/^Sets$/i).first(), 'Dashboard training pulse loaded');
  await page.goto(`${BASE_URL}?program_id=qa_smart_start_program`, { waitUntil: 'networkidle' });
  await page.getByText(/Bench Press \(Touch & Go\)/i).tap({ timeout: 10000 });
  await expectVisible(page.getByText(/SMART TARGET/i), 'Smart target card shown for program-start set');
  await expectVisible(page.getByText(/200 LBS X 6 REPS/i), 'Workout start prefill prefers recent history over stale fixed program weight');
  await page.getByRole('button', { name: /Back/i }).click();
  await page.close();
  page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await installWorkoutQaBootstrap(page);

  console.log('▶️  Opening workout logger...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await expectVisible(page.getByRole('button', { name: /Review Finish/i }), 'Overview loaded');

  console.log('▶️  Checking custom add/cancel/remove flow...');
  await page.getByRole('button', { name: /Add Exercise/i }).click();
  await expectVisible(page.getByText(/ADD MOVEMENT/i), 'Add movement modal opened for custom flow');
  await page.getByPlaceholder(/Search/i).fill('QA Logger Row');
  await page.getByRole('button', { name: /Create "QA Logger Row"/i }).click();
  await expectVisible(page.getByRole('button', { name: /ADD \d+ SETS/i }), 'Custom set count step opened');
  await page.getByRole('button', { name: /Back/i }).click();
  await expectVisible(page.getByText(/ADD MOVEMENT/i), 'Set count back returns to search');
  await page.getByPlaceholder(/Search/i).fill('QA Logger Row');
  await page.getByRole('button', { name: /Create "QA Logger Row"/i }).click();
  await page.getByRole('button', { name: '1', exact: true }).click();
  await page.getByRole('button', { name: /ADD \d+ SET/i }).click();
  await page.getByText(/How many sets\?/i).waitFor({ state: 'hidden', timeout: 10000 });
  await expectVisible(page.getByText(/QA Logger Row/i).first(), 'Custom movement added to overview');
  const customRow = page.locator('[data-testid="logger-exercise-row"]').filter({ hasText: /QA Logger Row/i }).first();
  const customRowBox = await customRow.boundingBox();
  const hiddenDeleteBox = await page.getByRole('button', { name: /Delete QA Logger Row/i }).boundingBox();
  if (!customRowBox || !hiddenDeleteBox || hiddenDeleteBox.x < customRowBox.x + customRowBox.width) {
    throw new Error('Logger exercise delete action is visible before swipe');
  }
  await swipeRowLeft(page, customRow, 'QA Logger Row');
  await page.getByRole('button', { name: /Delete QA Logger Row/i }).tap({ timeout: 10000 });
  await page.getByText(/QA Logger Row/i).waitFor({ state: 'hidden', timeout: 10000 });
  await page.waitForFunction(() => {
    const activeKey = Object.keys(localStorage).find((key) => key.includes('iron_brain_active_session_v1'));
    if (!activeKey) return false;
    const raw = localStorage.getItem(activeKey);
    if (!raw) return false;
    return !raw.includes('QA Logger Row');
  }, undefined, { timeout: 5000 });
  console.log('✅ Custom logger exercise can be added, backed out, and removed cleanly');

  console.log('▶️  Adding exercise...');
  await page.getByRole('button', { name: /Add Exercise/i }).click();
  await expectVisible(page.getByText(/ADD MOVEMENT/i), 'Add movement modal opened');
  await page.getByText(/Bench Press/i).first().click();
  await expectVisible(page.getByRole('button', { name: /ADD \d+ SETS/i }), 'Set count modal opened');
  await page.getByRole('button', { name: '2', exact: true }).click();
  await page.getByRole('button', { name: /ADD \d+ SETS/i }).click();
  await page.getByText(/How many sets\?/i).waitFor({ state: 'hidden', timeout: 10000 });
  await expectVisible(page.getByText(/Bench Press/i).first(), 'Exercise appears in overview');
  await page.waitForFunction(() => {
    const activeKey = Object.keys(localStorage).find((key) => key.includes('iron_brain_active_session_v1'));
    if (!activeKey) return false;
    const raw = localStorage.getItem(activeKey);
    if (!raw || !raw.includes('Bench Press') || raw.includes('QA Logger Row')) return false;
    try {
      const snapshot = JSON.parse(raw);
      const sets = snapshot.blocks?.[0]?.exercises?.[0]?.sets ?? [];
      return sets.length > 0 && sets.every((set) => set.prescribedRPE === 8 && set.rpe === null);
    } catch {
      return false;
    }
  }, null, { timeout: 5000 });
  const originalStartTime = await page.evaluate(() => {
    const activeKey = Object.keys(localStorage).find((key) => key.includes('iron_brain_active_session_v1'));
    const raw = activeKey ? localStorage.getItem(activeKey) : null;
    return raw ? JSON.parse(raw).startTime : null;
  });
  console.log('✅ Quick Start sets use RPE 8 target while actual RPE stays blank');

  console.log('▶️  Checking skip-set audit flow...');
  await page.getByRole('button', { name: /Add Exercise/i }).click();
  await expectVisible(page.getByText(/ADD MOVEMENT/i), 'Add movement modal opened for skip flow');
  await page.getByText(/Bicep Curl/i).first().click();
  await expectVisible(page.getByRole('button', { name: /ADD \d+ SETS/i }), 'Skip flow set count modal opened');
  await page.getByRole('button', { name: '1', exact: true }).click();
  await page.getByRole('button', { name: /ADD \d+ SET/i }).click();
  await page.getByText(/How many sets\?/i).waitFor({ state: 'hidden', timeout: 10000 });
  await page.getByText(/Bicep Curl/i).first().tap({ timeout: 10000 });
  await expectVisible(page.getByRole('button', { name: /Skip Set/i }), 'Skip set button visible');
  await page.getByRole('button', { name: /Skip Set/i }).click();
  await expectVisible(page.getByRole('button', { name: /Skip Rest/i }), 'Rest timer shown after skipped set');
  await page.getByRole('button', { name: /Skip Rest/i }).click();
  await expectVisible(page.getByRole('button', { name: /Review Finish/i }), 'Returned to overview after skipped set');
  await expectVisible(page.getByRole('button', { name: /Skipped/i }).first(), 'Skipped set chip visible');
  await page.waitForFunction(() => {
    const activeKey = Object.keys(localStorage).find((key) => key.includes('iron_brain_active_session_v1'));
    const raw = activeKey ? localStorage.getItem(activeKey) : null;
    if (!raw) return false;
    const snapshot = JSON.parse(raw);
    const sets = snapshot.blocks?.flatMap((block) => block.exercises?.flatMap((exercise) => exercise.sets ?? []) ?? []) ?? [];
    return sets.some((set) => set.skipped === true && set.completed === true);
  }, null, { timeout: 5000 });
  const activeSkipMarker = await page.evaluate(() => {
    const activeKey = Object.keys(localStorage).find((key) => key.includes('iron_brain_active_session_v1'));
    const raw = activeKey ? localStorage.getItem(activeKey) : null;
    if (!raw) return null;
    const snapshot = JSON.parse(raw);
    const sets = snapshot.blocks?.flatMap((block) => block.exercises?.flatMap((exercise) => exercise.sets ?? []) ?? []) ?? [];
    const skipped = sets.find((set) => set.skipped === true);
    return skipped ? { completed: skipped.completed, skipped: skipped.skipped } : null;
  });
  if (!activeSkipMarker?.completed || !activeSkipMarker?.skipped) {
    throw new Error('Skipped active set did not retain completed=true/skipped=true marker');
  }
  console.log('✅ Skip Set records a skipped marker in the active session');

  console.log('▶️  Checking leave/resume/back-forward session integrity...');
  for (let index = 0; index < 3; index += 1) {
    await page.getByText(/Bench Press/i).first().tap({ timeout: 10000 });
    await expectVisible(page.getByRole('button', { name: /LOG SET/i }), `Cockpit loop ${index + 1} opened`);
    await page.getByRole('button', { name: /^Back$/i }).first().tap({ timeout: 10000 });
    await expectVisible(page.getByText(/Bench Press/i).first(), `Cockpit loop ${index + 1} returned to overview`);
  }
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await expectVisible(page.getByTestId('dashboard-smart-action').getByText(/^RESUME$/i), 'Dashboard resume CTA survives leaving logger');
  await page.goto(`${BASE_URL}?type=empty`, { waitUntil: 'networkidle' });
  await expectVisible(page.getByText(/Bench Press/i).first(), 'Stale quick-start URL resumes existing active workout');
  const resumedStartTime = await page.evaluate(() => {
    const activeKey = Object.keys(localStorage).find((key) => key.includes('iron_brain_active_session_v1'));
    const raw = activeKey ? localStorage.getItem(activeKey) : null;
    return raw ? JSON.parse(raw).startTime : null;
  });
  if (!originalStartTime || resumedStartTime !== originalStartTime) {
    throw new Error('Active workout timer/start time changed after leave/resume/stale quick-start flow');
  }
  console.log('✅ Leaving, resuming, stale quick-start revisit, and cockpit back loops preserve the workout');

  console.log('▶️  Opening cockpit...');
  await page.getByText(/Bench Press/i).first().click();
  await expectVisible(page.getByRole('button', { name: /LOG SET/i }), 'Cockpit opened');

  console.log('▶️  Using keypad to enter weight...');
  const weightButton = page.getByRole('button', { name: /\d.*LBS/i }).first();
  await weightButton.click();
  const keypad = page.locator('div.fixed.bottom-0.left-0.right-0');
  await expectVisible(keypad.getByRole('button', { name: /Done/i }), 'Keypad opened');
  await keypad.getByRole('button', { name: '1', exact: true }).click();
  await keypad.getByRole('button', { name: '8', exact: true }).click();
  await keypad.getByRole('button', { name: '5', exact: true }).click();
  await keypad.getByRole('button', { name: /Done/i }).click();

  console.log('▶️  Checking competitive logger tools...');
  await page.getByRole('button', { name: /Open plate calculator/i }).click();
  await expectVisible(page.getByTestId('load-calculator'), 'Plate calculator opened');
  await expectVisible(page.getByTestId('plate-load-result').getByText(/45LBS/i).first(), 'Plate calculator shows per-side loading');
  await page.getByRole('button', { name: /Close tool/i }).click();
  await page.getByRole('button', { name: /Open warm-up calculator/i }).click();
  await expectVisible(page.getByTestId('warmup-calculator'), 'Warm-up calculator opened');
  await expectVisible(page.getByTestId('warmup-plan-result').getByText(/75LBS x 8/i), 'Warm-up ladder renders conservative targets');
  await page.getByRole('button', { name: /Close tool/i }).click();

  console.log('▶️  Logging set...');
  await page.getByRole('button', { name: /LOG SET/i }).click();
  await expectVisible(page.getByRole('button', { name: /Skip Rest/i }), 'Rest timer shown');

  const bonusToggle = page.getByRole('button', { name: /Add Bonus Set/i });
  if (await bonusToggle.isVisible().catch(() => false)) {
    console.log('▶️  Adding bonus set...');
    await bonusToggle.click();
  }
  await page.getByRole('button', { name: /Skip Rest/i }).click();
  await expectVisible(page.getByRole('button', { name: /LOG SET/i }), 'Returned to cockpit for bonus set');

  console.log('▶️  Logging second set...');
  await page.getByRole('button', { name: /LOG SET/i }).click();
  await expectVisible(page.getByRole('button', { name: /Skip Rest/i }), 'Rest timer after bonus set');
  await page.getByRole('button', { name: /Skip Rest/i }).click();
  await expectVisible(page.getByRole('button', { name: /Review Finish/i }), 'Back to overview');

  console.log('▶️  Editing previous set...');
  const setChip = page.getByRole('button', { name: /185/i }).first();
  await setChip.click();
  await expectVisible(page.getByRole('button', { name: /SAVE CHANGES/i }), 'Editing set in cockpit');
  await page.getByRole('button', { name: /SAVE CHANGES/i }).click();
  await expectVisible(page.getByRole('button', { name: /Skip Rest/i }), 'Rest timer after edit');
  await page.getByRole('button', { name: /Skip Rest/i }).click();
  await expectVisible(page.getByRole('button', { name: /Review Finish/i }), 'Returned to overview after edit');

  console.log('▶️  Opening summary...');
  await page.getByRole('button', { name: /Review Finish/i }).click();
  await expectVisible(page.getByText(/SESSION REPORT/i), 'Summary modal shown');
  await expectVisible(page.getByTestId('workout-summary-totals'), 'Summary totals visible without scrolling');
  const summaryBox = await page.getByTestId('workout-summary-totals').boundingBox();
  const viewport = page.viewportSize();
  if (!summaryBox || !viewport || summaryBox.y + summaryBox.height > viewport.height - 120) {
    throw new Error('Workout summary totals are not visible within the initial mobile viewport');
  }
  await page.getByRole('button', { name: /^Share$/i }).click();
  await expectVisible(page.getByTestId('workout-summary-status').getByText(/Share (card|sheet) opened/i), 'Share sheet wired');
  const sharedPayload = await page.evaluate(() => ({
    text: window.__ironBrainShared?.text,
    fileCount: window.__ironBrainShared?.files?.length ?? 0,
    fileName: window.__ironBrainShared?.files?.[0]?.name ?? null,
    fileType: window.__ironBrainShared?.files?.[0]?.type ?? null,
  }));
  if (!sharedPayload?.text?.includes('IRON BRAIN SESSION')) {
    throw new Error('Share payload was not populated with the workout summary');
  }
  if (sharedPayload.fileCount !== 1 || sharedPayload.fileName !== 'iron-brain-session.png' || sharedPayload.fileType !== 'image/png') {
    throw new Error('Share card image was not attached to the workout summary');
  }

  console.log('▶️  Finishing workout...');
  await page.getByRole('button', { name: /^Complete Workout$/i }).click();
  await page.waitForURL('http://localhost:3000/', { timeout: 15000 });
  console.log('✅ Returned to dashboard');

  const savedSkippedSet = await page.evaluate(() => {
    const historyKey = Object.keys(localStorage).find((key) => key.includes('iron_brain_workout_history'));
    const raw = historyKey ? localStorage.getItem(historyKey) : null;
    if (!raw) return null;
    const history = JSON.parse(raw);
    const latest = history[history.length - 1];
    const skipped = latest?.sets?.find((set) => set.skipped === true);
    return skipped
      ? {
        completed: skipped.completed,
        skipped: skipped.skipped,
        actualWeight: skipped.actualWeight ?? null,
        actualReps: skipped.actualReps ?? null,
        actualRPE: skipped.actualRPE ?? null,
        e1rm: skipped.e1rm ?? null,
        volumeLoad: skipped.volumeLoad ?? null,
      }
      : null;
  });
  if (
    !savedSkippedSet?.skipped ||
    savedSkippedSet.completed !== false ||
    savedSkippedSet.actualWeight !== null ||
    savedSkippedSet.actualReps !== null ||
    savedSkippedSet.actualRPE !== null ||
    savedSkippedSet.e1rm !== null ||
    savedSkippedSet.volumeLoad !== null
  ) {
    throw new Error(`Skipped set was saved with fake performance: ${JSON.stringify(savedSkippedSet)}`);
  }
  console.log('✅ Finished workout saves skipped sets without fake performance numbers');

  console.log('▶️  Checking history...');
  await page.goto('http://localhost:3000/history', { waitUntil: 'networkidle' });
  await expectVisible(page.getByRole('heading', { name: /Workout History/i }).first(), 'History page loaded');
  await page.getByRole('button', { name: /View details/i }).first().click();
  await expectVisible(page.getByTestId('history-session-details').first(), 'History details expand on first tap');
  await page.getByRole('button', { name: /Delete workout/i }).first().tap({ timeout: 10000 });
  await expectVisible(page.getByText(/MOVE WORKOUT TO TRASH/i), 'History delete confirmation opened');
  await page.getByRole('button', { name: /Cancel/i }).click();
  await page.getByText(/MOVE WORKOUT TO TRASH/i).waitFor({ state: 'hidden', timeout: 10000 });
  await page.getByRole('button', { name: /Delete workout/i }).first().tap({ timeout: 10000 });
  await expectVisible(page.getByText(/MOVE WORKOUT TO TRASH/i), 'History delete confirmation reopened');
  await page.getByRole('button', { name: /MOVE TO TRASH/i }).click();
  await page.getByText(/MOVE WORKOUT TO TRASH/i).waitFor({ state: 'hidden', timeout: 15000 });
  await page.waitForFunction(() => !document.body.innerText.includes('Bench Press'), null, { timeout: 15000 });
  console.log('✅ History workout delete-to-trash opens, cancels, confirms, and removes the session');

  console.log('✅ QA sweep completed');
  await browser.close();
})().catch(async (err) => {
  console.error('❌ QA sweep failed:', err);
  process.exit(1);
});
