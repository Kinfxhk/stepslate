// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test';
import { answerText, generateQuestion } from '../packages/core/src/index';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-init')) {
      localStorage.clear();
      sessionStorage.setItem('e2e-init', '1');
    }
  });
});

test('practice: wrong answer, hint, right answer, progress saved and cleared', async ({ page }) => {
  const q = generateQuestion('T3', 2, 12345);
  await page.goto('/#practice=T3-2-12345');
  await expect(page.locator('#view-practice')).toBeVisible();
  await expect(page.locator('#practice-question')).toContainText('T3-2-12345');
  await page.locator('#practice-answer').fill('x = 1000');
  await page.locator('#practice-check').click();
  await expect(page.locator('#practice-feedback')).toHaveClass(/bad/);
  await page.locator('#practice-hint').click();
  await expect(page.locator('#practice-steps > li')).toHaveCount(1);
  await page.locator('#practice-answer').fill('nonsense ((');
  await page.locator('#practice-check').click();
  await expect(page.locator('#practice-feedback')).toContainText('cannot read');
  await page.locator('#practice-answer').fill(answerText(q.solution));
  await page.locator('#practice-check').click();
  await expect(page.locator('#practice-feedback')).toHaveClass(/ok/);
  await expect(page.locator('#practice-progress')).toContainText('Correct: 1 of 1');
  await page.reload();
  await expect(page.locator('#practice-progress')).toContainText('Correct: 1 of 1');
  await page.locator('#practice-clear').click();
  await expect(page.locator('#practice-progress')).toContainText('Correct: 0 of 0');
  expect(await page.evaluate(() => localStorage.getItem('sumstair.practice.v1'))).toBeNull();
});

test('practice: every type generates a question; full solution can be revealed', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Practice' }).click();
  for (const t of ['T1', 'T2', 'T3', 'T4', 'T5']) {
    await page.locator('#practice-type').selectOption(t);
    await page.locator('#practice-level').selectOption('3');
    await page.locator('#practice-new').click();
    await expect(page.locator('#practice-question .katex').first()).toBeVisible();
    await page.locator('#practice-reveal').click();
    await expect(page.locator('#practice-answer-text')).toBeVisible();
  }
});

test('practice works in Chinese and answers like 0.5 = 1/2 are accepted', async ({ page }) => {
  const q = generateQuestion('T1', 1, 2);
  await page.goto('/#practice=T1-1-2');
  await page.locator('#lang-toggle').click();
  await expect(page.locator('#practice-check')).toHaveText('核對答案');
  const a = q.solution.answer;
  const decimal = a?.kind === 'value' ? a.value.toDecimalString() : undefined;
  await page.locator('#practice-answer').fill(decimal ?? answerText(q.solution));
  await page.locator('#practice-check').click();
  await expect(page.locator('#practice-feedback')).toHaveText('正確！');
});

test('practice page has no serious accessibility problems', async ({ page }) => {
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  await page.goto('/#practice=T4-3-77');
  await page.locator('#practice-hint').click();
  const results = await new AxeBuilder({ page }).exclude('.katex-html').analyze();
  const serious = results.violations.filter((v) =>
    ['serious', 'critical'].includes(v.impact ?? ''),
  );
  expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
