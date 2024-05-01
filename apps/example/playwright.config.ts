import { defineConfig, devices } from '@playwright/test';

const IS_CI = !!process.env.CI;

export default defineConfig({
  testDir: './src/tests',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: IS_CI
    ? [['dot'], ['junit', { outputFile: 'junit.xml' }], ['html', { open: 'never' }]]
    : 'html',
  reportSlowTests: { max: 20, threshold: 10 },
  use: {
    trace: IS_CI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 30 * 1000,
    navigationTimeout: 30 * 1000,
    viewport: {
      width: 1380,
      height: 1224,
    },
  },
  timeout: 2.5 * 60 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /.*\.spec\.[jt]s/,
    },
  ],
  webServer: {
    command: 'tsx ./src/index.ts',
    url: 'http://localhost:8080/home',
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
