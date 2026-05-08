import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const e2eTestDir = path.join(__dirname, 'tests/e2e');
const hasE2ETests =
  fs.existsSync(e2eTestDir) &&
  fs.readdirSync(e2eTestDir, { recursive: true }).some((entry) => {
    if (typeof entry !== 'string') {
      return false;
    }

    return /\.(spec|test)\.[cm]?[jt]sx?$/.test(entry);
  });

export default defineConfig({
  testDir: e2eTestDir,
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure'
  },
  webServer: hasE2ETests
    ? {
        command: 'npm run dev',
        url: 'http://127.0.0.1:3000',
        reuseExistingServer: !process.env.CI
      }
    : undefined,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
