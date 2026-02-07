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
  });

  console.log('▶️  Opening workout logger...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await expectVisible(page.getByRole('button', { name: /Finish Workout/i }), 'Overview loaded');

  console.log('▶️  Adding exercise...');
  await page.getByRole('button', { name: /Add Exercise/i }).click();
  await expectVisible(page.getByText(/ADD MOVEMENT/i), 'Add movement modal opened');
  await page.getByText(/Bench Press/i).first().click();
  await expectVisible(page.getByText(/Bench Press/i).first(), 'Exercise appears in overview');

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

  console.log('▶️  Logging bonus set...');
  await page.getByRole('button', { name: /LOG SET/i }).click();
  await expectVisible(page.getByRole('button', { name: /Skip Rest/i }), 'Rest timer after bonus set');
  await page.getByRole('button', { name: /Skip Rest/i }).click();
  await expectVisible(page.getByRole('button', { name: /Finish Workout/i }), 'Back to overview');

  console.log('▶️  Editing previous set...');
  const setChip = page.getByRole('button', { name: /185/i }).first();
  await setChip.click();
  await expectVisible(page.getByRole('button', { name: /SAVE CHANGES/i }), 'Editing set in cockpit');
  await page.getByRole('button', { name: /SAVE CHANGES/i }).click();
  await expectVisible(page.getByRole('button', { name: /Skip Rest/i }), 'Rest timer after edit');
  await page.getByRole('button', { name: /Skip Rest/i }).click();
  await expectVisible(page.getByRole('button', { name: /Finish Workout/i }), 'Returned to overview after edit');

  console.log('▶️  Opening summary...');
  await page.getByRole('button', { name: /Finish Workout/i }).click();
  await expectVisible(page.getByText(/SESSION REPORT/i), 'Summary modal shown');

  console.log('▶️  Finishing workout...');
  await page.getByRole('button', { name: /^Finish$/i }).click();
  await page.waitForURL('http://localhost:3000/', { timeout: 15000 });
  console.log('✅ Returned to dashboard');

  console.log('▶️  Checking history...');
  await page.goto('http://localhost:3000/history', { waitUntil: 'networkidle' });
  await expectVisible(page.getByRole('heading', { name: /Workout History/i }).first(), 'History page loaded');

  console.log('✅ QA sweep completed');
  await browser.close();
})().catch(async (err) => {
  console.error('❌ QA sweep failed:', err);
  process.exit(1);
});
