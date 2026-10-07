// SPDX-License-Identifier: AGPL-3.0-or-later
// Headless browser tests. Run with `npm run test:e2e` (builds the web UI first).
// Uses Playwright's bundled Chromium (`npx playwright install chromium`), or any local
// Chrome/Chromium via PW_CHROMIUM_PATH=/usr/bin/google-chrome.
import { defineConfig } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4898);
const executablePath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    headless: true,
    locale: 'en-US',
    colorScheme: 'light',
    viewport: { width: 1280, height: 900 },
    serviceWorkers: 'allow',
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: 'node_modules/.bin/tsx packages/cli/src/serve.ts',
    url: `http://127.0.0.1:${PORT}/healthz`,
    env: { STEPSLATE_PORT: String(PORT) },
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
