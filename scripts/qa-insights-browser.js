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
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

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

  await page.goto(`${BASE_URL}/analytics?view=strength`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Strength/i }).click();
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
