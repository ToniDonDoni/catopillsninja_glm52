import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_PORT = parseInt(process.env.TEST_PORT || '8080', 10);

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // single browser, sequential for stable spawn timing
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: `http://localhost:${TEST_PORT}`,
    headless: true,
    // Auto-accept camera permission dialogs even in mouse-only test mode
    // (some Chromium builds still query the API on page load).
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
      ],
    },
    permissions: ['camera'],
  },
  webServer: {
    command: `node server.js`,
    port: TEST_PORT,
    timeout: 10000,
    reuseExistingServer: !process.env.CI,
    cwd: __dirname,
  },
});
