// SPDX-License-Identifier: AGPL-3.0-or-later
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** Fail the test if the page ever requests anything from another origin. */
function trackExternal(page: Page, baseURL: string): string[] {
  const external: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith(baseURL) && !url.startsWith('data:') && !url.startsWith('blob:'))
      external.push(url);
  });
  return external;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-init')) {
      localStorage.clear();
      sessionStorage.setItem('e2e-init', '1');
    }
  });
});

test('type → preview → step by step → show all → answer, with no external requests', async ({
  page,
  baseURL,
}) => {
  const external = trackExternal(page, baseURL!);
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#preview-status')).toContainText('Type a problem');
  await page.locator('#problem').fill('2(x+3)=5x-4');
  await expect(page.locator('#preview-math .katex')).toBeVisible();
  await expect(page.locator('#preview-status')).toContainText('Linear equation');
  await page.locator('#solve-btn').click();
  await expect(page.locator('#steps-card')).toBeVisible();
  await expect(page.locator('#step-list > li')).toHaveCount(0);
  await page.locator('#next-btn').click();
  await expect(page.locator('#step-list > li')).toHaveCount(1);
  await expect(page.locator('#step-list > li').first()).toContainText('Checked');
  await page.locator('#next-btn').click();
  await expect(page.locator('#step-list > li')).toHaveCount(2);
  await page.locator('#all-btn').click();
  const steps = page.locator('#step-list > li');
  expect(await steps.count()).toBeGreaterThan(3);
  await expect(steps.last()).toHaveAttribute('data-rule', 'check');
  await expect(page.locator('#answer')).toBeVisible();
  await expect(page.locator('#answer-math')).toContainText('x');
  await expect(page.locator('#next-btn')).toBeHidden();
  // the problem is in the URL fragment for sharing
  expect(decodeURIComponent(new URL(page.url()).hash)).toBe('#q=2(x+3)=5x-4');
  expect(external).toEqual([]);
  expect(errors).toEqual([]); // includes Content-Security-Policy violations
});

test('footer links to the source of this exact version (AGPL section 13)', async ({ page }) => {
  await page.goto('/');
  const href = await page.locator('#source-link').getAttribute('href');
  const version = (await page.locator('#app-version').textContent())?.trim();
  expect(version).toMatch(/^v\d+\.\d+\.\d+/);
  expect(href).toBe(`https://github.com/Kinfxhk/sumstair/tree/${version}`);
});

test('link previews: Open Graph / Twitter tags and a same-site 1200×630 image', async ({
  page,
  request,
}) => {
  await page.goto('/');
  const meta = (sel: string) => page.locator(`meta[${sel}]`).getAttribute('content');
  expect(await meta('property="og:title"')).toContain('步步解');
  expect(await meta('name="twitter:card"')).toBe('summary_large_image');
  const image = await meta('property="og:image"');
  expect(image).toMatch(/^https:\/\/.+\/social-card\.png$/);
  expect(await meta('name="twitter:image"')).toBe(image);
  const png = await (await request.get('/social-card.png')).body();
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
});

test('report link: pre-filled GitHub issue, opened only by the user', async ({ page, baseURL }) => {
  const external = trackExternal(page, baseURL!);
  await page.goto('/#q=' + encodeURIComponent('x^2-5x+6=0'));
  await expect(page.locator('#steps-card')).toBeVisible();
  const link = page.locator('#report-link');
  await expect(link).toBeVisible();
  const href = new URL((await link.getAttribute('href'))!);
  expect(`${href.origin}${href.pathname}`).toBe('https://github.com/Kinfxhk/sumstair/issues/new');
  expect(href.searchParams.get('template')).toBe('wrong-answer.yml');
  expect(href.searchParams.get('problem')).toBe('x^2-5x+6=0');
  expect(href.searchParams.get('version')).toMatch(/^v\d+\.\d+\.\d+/);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /noopener/);
  expect(external).toEqual([]); // nothing is contacted unless the user clicks
});

test('language switch translates the UI and the explanations', async ({ page }) => {
  await page.goto('/');
  await page.locator('#problem').fill('x^2-5x+6=0');
  await page.locator('#solve-btn').click();
  await page.locator('#all-btn').click();
  await expect(page.locator('#step-list')).toContainText('Factorise');
  await page.locator('#lang-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant-HK');
  await expect(page.locator('#solve-btn')).toHaveText('解題');
  await expect(page.locator('#step-list')).toContainText('因式分解');
  await expect(page.locator('#answer h3')).toHaveText('答案');
  // the choice is remembered
  await page.reload();
  await expect(page.locator('#solve-btn')).toHaveText('解題');
  await page.locator('#lang-toggle').click();
  await expect(page.locator('#solve-btn')).toHaveText('Solve');
});

test('shared link opens the problem and its steps', async ({ page }) => {
  await page.goto('/#q=' + encodeURIComponent('2x+y=7; x-y=2'));
  await expect(page.locator('#problem')).toHaveValue('2x+y=7; x-y=2');
  await expect(page.locator('#preview-status')).toContainText('Simultaneous');
  await page.locator('#all-btn').click();
  await expect(page.locator('#answer')).toBeVisible();
  await expect(page.locator('#step-list > li').last()).toHaveAttribute('data-rule', 'check');
});

test('ambiguous input gets a warning; bad input shows where the problem is', async ({ page }) => {
  await page.goto('/');
  await page.locator('#problem').fill('1/2x');
  await expect(page.locator('[data-warning="ambiguous-division"]')).toBeVisible();
  await page.locator('#problem').fill('2x+');
  await expect(page.locator('#preview-status')).toHaveClass(/error/);
  await expect(page.locator('#preview-math mark')).toBeVisible();
  await page.locator('#problem').fill('x^3=8');
  await page.locator('#solve-btn').click();
  await expect(page.locator('#result-message')).toHaveClass(/warn/);
});

test('on-screen keyboard and examples', async ({ page }) => {
  await page.goto('/');
  await page.locator('#problem').click();
  for (const key of ['x', '^2']) await page.getByRole('button', { name: key, exact: true }).click();
  await page.locator('#problem').pressSequentially('=9');
  await expect(page.locator('#problem')).toHaveValue('x^2=9');
  await page.locator('#key-backspace').click();
  await expect(page.locator('#problem')).toHaveValue('x^2=');
  await page.locator('.chip').first().click();
  await expect(page.locator('#steps-card')).toBeVisible();
});

test('keyboard only: Enter solves, buttons reachable', async ({ page }) => {
  await page.goto('/');
  await page.locator('#problem').focus();
  await page.keyboard.type('3x+5=20');
  await page.keyboard.press('Enter');
  await expect(page.locator('#steps-card')).toBeVisible();
  await page.locator('#next-btn').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#step-list > li')).toHaveCount(1);
});

test('dark theme and large text toggles', async ({ page }) => {
  await page.goto('/');
  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('#large-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-large', 'true');
  await expect(page.locator('#large-toggle')).toHaveAttribute('aria-pressed', 'true');
});

test('KaTeX outputs MathML for screen readers', async ({ page }) => {
  await page.goto('/#q=' + encodeURIComponent('x^2-4x+1=0'));
  await page.locator('#all-btn').click();
  expect(await page.locator('#step-list math').count()).toBeGreaterThan(3);
});

test('offline pre-cache is small: woff2 fonts only, under 700 kB in total', async ({ request }) => {
  const sw = await (await request.get('/sw.js')).text();
  const urls = JSON.parse(/const URLS = (.*);/.exec(sw)![1]!) as string[];
  expect(urls.some((u) => /\.(ttf|woff)$/.test(u))).toBe(false);
  expect(urls.some((u) => u.endsWith('.woff2'))).toBe(true);
  let total = Buffer.byteLength(sw);
  for (const u of urls) {
    const res = await request.get(u.replace(/^\.\//, '/'));
    expect(res.ok(), u).toBe(true);
    total += (await res.body()).length;
  }
  console.info(`offline pre-cache: ${urls.length} files, ${total} bytes`);
  expect(total).toBeLessThan(700_000);
});

test('every KaTeX font the solver uses is pre-cached', async ({ page, request }) => {
  const sw = await (await request.get('/sw.js')).text();
  const cached = (JSON.parse(/const URLS = (.*);/.exec(sw)![1]!) as string[]).map((u) =>
    u.replace(/^\.\//, ''),
  );
  const used = new Set<string>();
  page.on('request', (r) => {
    const m = /assets\/(KaTeX_[^/?#]+)$/.exec(new URL(r.url()).pathname);
    if (m) used.add(`assets/${m[1]}`);
  });
  await page.goto('/');
  // one problem of each kind, covering fractions, powers, roots, ±, Δ and systems
  for (const q of [
    '1/2+3/4*2-(2/3)^2',
    '0.25^-2+2^10',
    '(x+2)^2-(x-1)(x+3)',
    '(2x-1)/3=(x+2)/4',
    'x^2-4x+1=0',
    '2x^2+3x-2=0',
    'x^2+x+1=0',
    '3x^2=5',
    '2x+y=7; x-y=2',
    'x+y=1; 2x+2y=2',
  ]) {
    await page.locator('#problem').fill(q);
    await page.locator('#solve-btn').click();
    if (await page.locator('#all-btn').isVisible()) await page.locator('#all-btn').click();
    await expect(page.locator('#answer')).toBeVisible();
  }
  await page.locator('#lang-toggle').click();
  await page.locator('[data-view="practice"]').click();
  await page.evaluate(() => document.fonts.ready);
  expect(used.size).toBeGreaterThan(0);
  for (const f of used) expect(cached, `${f} is used but not pre-cached`).toContain(f);
});

test('works offline after the first visit (service worker)', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // make sure the page is controlled before going offline
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page.locator('#problem').fill('x^2=2');
  await page.locator('#solve-btn').click();
  await page.locator('#all-btn').click();
  await expect(page.locator('#answer')).toBeVisible();
  await expect(page.locator('#step-list .katex').first()).toBeVisible();
  await context.setOffline(false);
});

for (const theme of ['light', 'dark'] as const) {
  test(`no serious accessibility problems (axe-core, ${theme})`, async ({ page }) => {
    await page.goto('/#q=' + encodeURIComponent('x^2-5x+6=0'));
    if (theme === 'dark') await page.locator('#theme-toggle').click();
    await page.locator('#all-btn').click();
    const results = await new AxeBuilder({ page }).exclude('.katex-html').analyze();
    const serious = results.violations.filter((v) =>
      ['serious', 'critical'].includes(v.impact ?? ''),
    );
    expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}
