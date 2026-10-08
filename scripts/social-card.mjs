#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Regenerate packages/web/public/social-card.png: the 1200×630 link-preview image
// (Open Graph / Twitter card). Original artwork drawn from HTML/CSS below and the
// project's own icon; no third-party images. Text is rendered with locally installed
// system fonts (the picture contains no font files).
// Usage: PW_CHROMIUM_PATH=/usr/bin/google-chrome node scripts/social-card.mjs
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const icon = readFileSync('packages/web/public/icon.svg', 'utf8').replace(
  '<svg ',
  '<svg width="120" height="120" ',
);

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  html, body { margin: 0; width: 1200px; height: 630px; }
  body {
    background: #f6f4ef; color: #1d2730; display: flex; align-items: center;
    font-family: 'Noto Sans', 'DejaVu Sans', sans-serif; box-sizing: border-box;
    padding: 0 64px; gap: 44px;
  }
  .left { flex: 1.15; min-width: 0; }
  .brand { display: flex; align-items: center; gap: 28px; }
  h1 {
    font-family: 'Noto Serif CJK HK', 'Noto Serif CJK TC', serif; font-size: 104px;
    margin: 0; letter-spacing: 4px; color: #2f4858; white-space: nowrap;
  }
  .tag { font-size: 30px; margin: 30px 0 12px; line-height: 1.35; }
  .tag-zh {
    font-family: 'Noto Serif CJK HK', 'Noto Serif CJK TC', serif; font-size: 28px;
    color: #2f6f6a; margin: 0;
  }
  .pills { margin-top: 30px; display: flex; gap: 14px; flex-wrap: wrap; }
  .pill {
    font-size: 22px; border: 2px solid #2f6f6a; color: #2f6f6a; border-radius: 999px;
    padding: 6px 18px;
  }
  .card {
    flex: 0.85; background: #fff; border: 2px solid #d9d4c8; border-radius: 22px;
    padding: 30px 34px; box-shadow: 0 10px 30px rgba(29, 39, 48, 0.08);
  }
  .step { display: flex; align-items: baseline; gap: 16px; padding: 10px 0;
    border-bottom: 1px solid #ece8de; font-size: 32px; }
  .step:last-child { border-bottom: 0; }
  .n { width: 0; }
  .m { font-family: 'DejaVu Serif', 'Noto Serif', serif; flex: 1; }
  .ok { color: #1f6b3a; font-size: 30px; }
  .ans { background: #fff0b3; border-radius: 8px; padding: 0 8px; }
</style></head><body>
  <div class="left">
    <div class="brand">${icon}<h1>步步解</h1></div>
    <p class="tag">Free, offline, step-by-step maths.<br>Every step is checked before it is shown.</p>
    <p class="tag-zh">免費、離線的逐步解題，每一步都經驗證。</p>
    <div class="pills"><span class="pill">No ads</span><span class="pill">No tracking</span><span class="pill">No subscription</span><span class="pill">Open source</span></div>
  </div>
  <div class="card" aria-hidden="true">
    <div class="step"><span class="n"></span><span class="m">2(<i>x</i> + 3) = 5<i>x</i> − 4</span></div>
    <div class="step"><span class="n"></span><span class="m">2<i>x</i> + 6 = 5<i>x</i> − 4</span><span class="ok">✓</span></div>
    <div class="step"><span class="n"></span><span class="m">2<i>x</i> − 5<i>x</i> = −4 − 6</span><span class="ok">✓</span></div>
    <div class="step"><span class="n"></span><span class="m">−3<i>x</i> = −10</span><span class="ok">✓</span></div>
    <div class="step"><span class="n"></span><span class="m"><span class="ans"><i>x</i> = 10/3</span></span><span class="ok">✓</span></div>
  </div>
</body></html>`;

const executablePath = process.env.PW_CHROMIUM_PATH;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});
await page.setContent(html);
await page.evaluate(() => globalThis.document.fonts.ready);
await page.screenshot({ path: 'packages/web/public/social-card.png', type: 'png' });
await browser.close();
console.info('wrote packages/web/public/social-card.png');
