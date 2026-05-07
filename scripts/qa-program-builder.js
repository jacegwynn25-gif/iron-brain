/* eslint-disable no-console */
const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:3000';

async function expectVisible(locator, label) {
  await locator.waitFor({ state: 'visible', timeout: 15000 });
  console.log(`✅ ${label}`);
}

async function clickFirstByRole(page, role, options, label) {
  const target = page.getByRole(role, options).first();
  await target.click();
  if (label) console.log(`✅ ${label}`);
}

async function expectNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  if (metrics.scrollWidth > metrics.clientWidth + 1) {
    throw new Error(`${label}: horizontal overflow ${metrics.scrollWidth}px > ${metrics.clientWidth}px`);
  }
  console.log(`✅ ${label}`);
}

async function expectSheetWithinViewport(page, selector, label) {
  const metrics = await page.locator(selector).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top,
      bottom: rect.bottom,
      height: rect.height,
      viewportHeight: window.innerHeight,
    };
  });
  if (metrics.top < -1 || metrics.bottom > metrics.viewportHeight + 1 || metrics.height > metrics.viewportHeight + 1) {
    throw new Error(
      `${label}: sheet outside viewport top=${metrics.top} bottom=${metrics.bottom} height=${metrics.height} viewport=${metrics.viewportHeight}`
    );
  }
  console.log(`✅ ${label}`);
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
  await page.getByText(/Loading Programs/i).waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  await expectNoHorizontalOverflow(page, 'Programs page has no horizontal overflow');

  console.log('▶️ Starting new program...');
  await clickFirstByRole(page, 'button', { name: /New/i }, 'Opened program editor');
  await expectVisible(page.getByPlaceholder('Program name'), 'Editor opened');
  await page.getByPlaceholder('Program name').fill(programName);
  console.log(`✅ Program named "${programName}"`);
  await expectNoHorizontalOverflow(page, 'Program editor has no horizontal overflow');

  console.log('▶️ Adding built-in exercise...');
  await clickFirstByRole(page, 'button', { name: /^Add Exercise$/i }, 'Opened exercise picker');
  await page.getByPlaceholder('Search exercises...').fill('Bench Press (Touch & Go)');
  await clickFirstByRole(page, 'button', { name: /Bench Press \(Touch & Go\)/i }, 'Inserted Bench Press');
  await expectVisible(page.getByText(/Bench Press \(Touch & Go\)/i).first(), 'Bench row visible');
  const benchRow = page.locator('article', { hasText: /Bench Press \(Touch & Go\)/i }).first();
  const benchFocusToggle = benchRow.getByRole('button', { name: /^(Edit Sets|Collapse)$/i }).first();
  const benchFocusLabel = (await benchFocusToggle.textContent()) ?? '';
  if (/Edit Sets/i.test(benchFocusLabel)) {
    await benchFocusToggle.click();
  }
  await benchRow.getByLabel(/Set 1 target/i).fill('7.5');
  await expectVisible(benchRow.getByText(/RPE 7\.5/i).first(), 'Simple-mode target updates set summary');
  await page.getByRole('button', { name: /^Advanced$/i }).first().click();
  await benchRow.getByRole('button', { name: /Prescription method/i }).first().click();
  await page.getByRole('option', { name: /Fixed Weight/i }).click();
  await benchRow.getByLabel(/Set 1 target/i).fill('225');
  await expectVisible(benchRow.getByText(/Weight 225/i).first(), 'Fixed-weight target updates set summary');

  console.log('▶️ Creating custom exercise with metadata...');
  await clickFirstByRole(page, 'button', { name: /^Add Exercise$/i }, 'Opened picker for custom exercise');
  await page.getByPlaceholder('Search exercises...').fill(customExerciseName);
  await clickFirstByRole(page, 'button', { name: /Create "/i }, 'Entered custom exercise form');
  await expectVisible(page.getByText(/New Custom Exercise/i), 'Custom exercise form visible');
  await expectSheetWithinViewport(
    page,
    '[data-program-exercise-picker-sheet="true"]',
    'Custom exercise sheet stays inside mobile viewport'
  );
  await page.getByLabel('Exercise Name').fill(customExerciseName);
  await clickFirstByRole(page, 'button', { name: /^Chest$/i }, 'Selected custom primary muscle chip');
  const advancedToggle = page
    .getByRole('button', { name: /Add Movement \+ Muscles \(Optional\)|Hide Advanced Details/i })
    .first();
  if (await advancedToggle.isVisible().catch(() => false)) {
    await advancedToggle.click();
    await clickFirstByRole(page, 'button', { name: /^Triceps$/i }, 'Selected another custom muscle chip');
  }
  await clickFirstByRole(page, 'button', { name: /Create and Use Exercise/i }, 'Created and inserted custom exercise');
  await expectVisible(page.getByText(new RegExp(customExerciseName, 'i')).first(), 'Custom exercise row visible');

  console.log('▶️ Removing and undoing custom exercise...');
  const customExerciseRow = page.locator('article', { hasText: new RegExp(customExerciseName, 'i') }).first();
  const focusToggle = customExerciseRow.getByRole('button', { name: /^(Edit Sets|Collapse)$/i }).first();
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
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText(/Loading Programs/i).waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  await expectVisible(page.getByText(new RegExp(programName, 'i')).first(), 'Saved program survives reload');

  console.log('✅ Program builder QA flow passed');
  await browser.close();
})().catch((error) => {
  console.error('❌ Program builder QA flow failed:', error);
  process.exit(1);
});
