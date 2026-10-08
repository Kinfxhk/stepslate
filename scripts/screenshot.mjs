#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Regenerate docs/screenshot.png (a synthetic example problem) against a running server.
// Usage: npm start (in another terminal), then
//   PW_CHROMIUM_PATH=/usr/bin/google-chrome npm run screenshot [-- http://127.0.0.1:4873]
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://127.0.0.1:4873';
const executablePath = process.env.PW_CHROMIUM_PATH;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage({
  viewport: { width: 1280, height: 1000 },
  deviceScaleFactor: 1,
  colorScheme: 'light',
  locale: 'en-US',
});
await page.addInitScript(() =>
  localStorage.setItem(
    'sumstair.settings.v1',
    JSON.stringify({ lang: 'en', theme: 'light', large: false }),
  ),
);
await page.goto(`${base}/#q=${encodeURIComponent('x^2 - 4x + 1 = 0')}`);
await page.click('#all-btn');
await page.locator('#answer').waitFor();
await page.screenshot({ path: 'docs/screenshot.png', fullPage: true });
await browser.close();
console.info('wrote docs/screenshot.png');
