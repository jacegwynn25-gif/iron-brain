/* eslint-disable no-console */
const { chromium } = require('playwright');

const BASE_URL = process.env.QA_BASE_URL || 'http://localhost:3000';
const HISTORY_KEY = 'iron_brain_workout_history__default';

function workout(id, date, exerciseId, weight, reps, rpe) {
  return {
    id,
    programId: 'qa-insights',
    programName: 'QA Insights',
    cycleNumber: 1,
    weekNumber: 1,
    dayOfWeek: 'Monday',
    dayName: 'Strength',
    date,
    startTime: `${date}T12:00:00.000Z`,
    endTime: `${date}T13:00:00.000Z`,
    sets: [
      {
        id: `${id}_set`,
        exerciseId,
        exerciseName: 'Back Squat',
        setIndex: 1,
        prescribedReps: String(reps),
        actualWeight: weight,
        weightUnit: 'lbs',
        actualReps: reps,
        actualRPE: rpe,
        completed: true,
        setType: 'straight',
      },
    ],
    createdAt: `${date}T12:00:00.000Z`,
    updatedAt: `${date}T13:00:00.000Z`,
  };
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  await page.addInitScript(({ historyKey, workouts }) => {
    localStorage.clear();
    localStorage.setItem('iron_brain_onboarding_complete', 'true');
    localStorage.setItem('iron_brain_coach_marks_complete', 'true');
    localStorage.setItem(historyKey, JSON.stringify(workouts));
  }, {
    historyKey: HISTORY_KEY,
    workouts: [
      workout('qa_old_1', '2026-05-08', 'squat', 225, 5, 8),
      workout('qa_bogus', '2026-05-10', 'squat', 26, 4, 8),
      workout('qa_real_pr', '2026-05-12', 'squat', 275, 3, 8),
    ],
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.getByRole('link', { name: /Insights/i }).waitFor({ state: 'visible', timeout: 15000 });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByRole('link', { name: /Insights/i }).tap({ timeout: 15000 });
  await page.waitForFunction(() => window.location.pathname === '/analytics', null, { timeout: 30000 });
  await page.getByRole('heading', { name: /INSIGHTS/i }).waitFor({ state: 'visible', timeout: 15000 });

  const routeScrollY = await page.evaluate(() => window.scrollY);
  if (routeScrollY > 8) {
    throw new Error(`Insights route did not open at top on mobile. scrollY=${routeScrollY}`);
  }

  const visibleTabLabels = ['Overview', 'Recovery', 'Lifts', 'Profile'];
  if (await page.getByRole('button', { name: /Plan/i }).count() > 0) {
    visibleTabLabels.splice(1, 0, 'Plan');
  }

  for (const label of visibleTabLabels) {
    const tab = page.getByRole('button', { name: new RegExp(label, 'i') });
    await tab.waitFor({ state: 'visible', timeout: 5000 });
    const box = await tab.boundingBox();
    if (!box || box.x < 0 || box.x + box.width > 390) {
      throw new Error(`Insights tab "${label}" is not fully visible on mobile`);
    }
  }

  await page.getByText(/DATA AUDIT/i).waitFor({ state: 'visible', timeout: 15000 });
  const auditText = await page.locator('body').innerText();
  if (!/Included/i.test(auditText) || !/Excluded/i.test(auditText) || !/Top raw set contributors/i.test(auditText)) {
    throw new Error('Insights audit did not show included/excluded counts and raw contributors');
  }

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByRole('button', { name: /Lifts/i }).click();
  const tabScrollY = await page.evaluate(() => window.scrollY);
  if (tabScrollY > 8) {
    throw new Error(`Insights tab change did not reset scroll. scrollY=${tabScrollY}`);
  }
  await page.getByText(/ESTIMATED 1RMS/i).waitFor({ state: 'visible', timeout: 15000 });

  const body = await page.locator('body').innerText();
  if (!/Squat/i.test(body)) {
    throw new Error('Seeded squat did not appear on Insights strength page');
  }
  if (/158\s*lbs/i.test(body)) {
    throw new Error('Insights showed the bad 158 lbs squat estimate');
  }
  if (!/(30[1-9]|3[1-9][0-9])\s*lbs/i.test(body)) {
    throw new Error(`Insights did not show a 300+ lbs squat estimate. Body: ${body.slice(0, 500)}`);
  }
  if (!/questionable set excluded/i.test(body)) {
    throw new Error('Insights did not disclose excluded questionable set data');
  }

  console.log('✅ Insights browser QA passed');
  await browser.close();
})().catch(async (error) => {
  console.error('❌ Insights browser QA failed:', error);
  process.exit(1);
});
