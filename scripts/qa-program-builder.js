/* eslint-disable no-console */
const { chromium } = require('playwright');

const BASE_URL = 'http://127.0.0.1:3000';

async function expectVisible(locator, label) {
  await locator.waitFor({ state: 'visible', timeout: 15000 });
  console.log(`✅ ${label}`);
}

async function clickFirstByRole(page, role, options, label) {
  const target = page.getByRole(role, options).first();
  await target.click();
  if (label) console.log(`✅ ${label}`);
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const customExerciseName = `Codex QA Pushup ${Date.now()}`;
  const programName = `Builder QA ${Date.now()}`;

  await page.addInitScript(() => {
    localStorage.setItem('iron_brain_onboarding_complete', 'true');
    localStorage.setItem('iron_brain_coach_marks_complete', 'true');
  });

  console.log('▶️ Opening programs page...');
  await page.goto(`${BASE_URL}/programs`, { waitUntil: 'networkidle' });
  await expectVisible(page.getByRole('heading', { name: /Programs/i }), 'Programs page loaded');

  console.log('▶️ Starting new program...');
  await clickFirstByRole(page, 'button', { name: /New/i }, 'Opened program editor');
  await expectVisible(page.getByPlaceholder('Program name'), 'Editor opened');
  await page.getByPlaceholder('Program name').fill(programName);
  console.log(`✅ Program named "${programName}"`);

  console.log('▶️ Adding built-in exercise...');
  await clickFirstByRole(page, 'button', { name: /^Add Exercise$/i }, 'Opened exercise picker');
  await page.getByPlaceholder('Search exercises...').fill('Bench Press (Touch & Go)');
  await clickFirstByRole(page, 'button', { name: /Bench Press \(Touch & Go\)/i }, 'Inserted Bench Press');
  await expectVisible(page.getByText(/Bench Press \(Touch & Go\)/i).first(), 'Bench row visible');

  console.log('▶️ Creating custom exercise with metadata...');
  await clickFirstByRole(page, 'button', { name: /^Add Exercise$/i }, 'Opened picker for custom exercise');
  await page.getByPlaceholder('Search exercises...').fill(customExerciseName);
  await clickFirstByRole(page, 'button', { name: /Create "/i }, 'Entered custom exercise form');
  await expectVisible(page.getByText(/New Custom Exercise/i), 'Custom exercise form visible');
  await page.getByLabel('Exercise Name').fill(customExerciseName);
  const advancedToggle = page
    .getByRole('button', { name: /Add Movement \+ Muscles \(Optional\)|Hide Advanced Details/i })
    .first();
  if (await advancedToggle.isVisible().catch(() => false)) {
    await advancedToggle.click();
    await page.getByLabel('Primary Muscles').fill('chest, triceps');
  }
  await clickFirstByRole(page, 'button', { name: /Create and Use Exercise/i }, 'Created and inserted custom exercise');
  await expectVisible(page.getByText(new RegExp(customExerciseName, 'i')).first(), 'Custom exercise row visible');

  console.log('▶️ Removing and undoing custom exercise...');
  const customExerciseRow = page.locator('article', { hasText: new RegExp(customExerciseName, 'i') }).first();
  const focusToggle = customExerciseRow.getByRole('button', { name: /^(Edit Sets|Close)$/i }).first();
  const focusLabel = (await focusToggle.textContent()) ?? '';
  if (/Edit Sets/i.test(focusLabel)) {
    await focusToggle.click();
  }
  console.log('✅ Focused custom exercise');
  await customExerciseRow.getByRole('button', { name: /Exercise Actions/i }).first().click();
  await clickFirstByRole(page, 'button', { name: /Remove Exercise/i }, 'Removed exercise');
  await expectVisible(page.getByRole('button', { name: /Undo/i }), 'Undo prompt visible');
  await clickFirstByRole(page, 'button', { name: /Undo/i }, 'Undo applied');
  await expectVisible(page.getByText(new RegExp(customExerciseName, 'i')).first(), 'Custom exercise restored');

  console.log('▶️ Saving program...');
  await page.locator('header').getByRole('button', { name: /^Done$/i }).first().click();
  console.log('✅ Save submitted');
  await expectVisible(page.getByText(new RegExp(programName, 'i')).first(), 'Saved program visible in list');

  console.log('✅ Program builder QA flow passed');
  await browser.close();
})().catch((error) => {
  console.error('❌ Program builder QA flow failed:', error);
  process.exit(1);
});
