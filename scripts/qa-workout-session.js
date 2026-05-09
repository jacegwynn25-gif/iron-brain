/* eslint-disable no-console */
const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:3000/workout/new';

async function expectVisible(locator, label) {
  await locator.waitFor({ state: 'visible', timeout: 15000 });
  console.log(`✅ ${label}`);
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.addInitScript(() => {
    localStorage.setItem('iron_brain_onboarding_complete', 'true');
    localStorage.setItem('iron_brain_coach_marks_complete', 'true');
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (payload) => {
        window.__ironBrainShared = payload;
      },
    });
  });

  console.log('▶️  Opening workout logger...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await expectVisible(page.getByRole('button', { name: /Review Finish/i }), 'Overview loaded');

  console.log('▶️  Adding exercise...');
  await page.getByRole('button', { name: /Add Exercise/i }).click();
  await expectVisible(page.getByText(/ADD MOVEMENT/i), 'Add movement modal opened');
  await page.getByText(/Bench Press/i).first().click();
  await expectVisible(page.getByRole('button', { name: /ADD \d+ SETS/i }), 'Set count modal opened');
  await page.getByRole('button', { name: '2', exact: true }).click();
  await page.getByRole('button', { name: /ADD \d+ SETS/i }).click();
  await expectVisible(page.getByText(/Bench Press/i).first(), 'Exercise appears in overview');
  await page.waitForFunction(() => {
    const activeKey = Object.keys(localStorage).find((key) => key.includes('iron_brain_active_session_v1'));
    if (!activeKey) return false;
    const raw = localStorage.getItem(activeKey);
    if (!raw) return false;
    try {
      const snapshot = JSON.parse(raw);
      const sets = snapshot.blocks?.[0]?.exercises?.[0]?.sets ?? [];
      return sets.length > 0 && sets.every((set) => set.prescribedRPE === 8 && set.rpe === null);
    } catch {
      return false;
    }
  }, null, { timeout: 5000 });
  console.log('✅ Quick Start sets use RPE 8 target while actual RPE stays blank');

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
  await expectVisible(page.getByTestId('workout-summary-status').getByText(/Share sheet opened/i), 'Share sheet wired');
  const sharedPayload = await page.evaluate(() => window.__ironBrainShared);
  if (!sharedPayload?.text?.includes('IRON BRAIN SESSION')) {
    throw new Error('Share payload was not populated with the workout summary');
  }

  console.log('▶️  Finishing workout...');
  await page.getByRole('button', { name: /^Complete Workout$/i }).click();
  await page.waitForURL('http://localhost:3000/', { timeout: 15000 });
  console.log('✅ Returned to dashboard');

  console.log('▶️  Checking history...');
  await page.goto('http://localhost:3000/history', { waitUntil: 'networkidle' });
  await expectVisible(page.getByRole('heading', { name: /Workout History/i }).first(), 'History page loaded');
  await page.getByRole('button', { name: /View details/i }).first().click();
  await expectVisible(page.getByTestId('history-session-details').first(), 'History details expand on first tap');

  console.log('✅ QA sweep completed');
  await browser.close();
})().catch(async (err) => {
  console.error('❌ QA sweep failed:', err);
  process.exit(1);
});
