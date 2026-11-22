import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  // Local only: e2e is not run in CI. Visual baselines are created with `pnpm test:e2e:update`.
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
  projects: [
    {
      name: 'chromium',
      testIgnore: /visual\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], headless: true },
    },
    {
      name: 'desktop-1440',
      testMatch: /visual\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, headless: true },
    },
    {
      name: 'tablet-1024',
      testMatch: /visual\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 }, headless: true },
    },
    {
      name: 'mobile-390',
      testMatch: /visual\.spec\.ts/,
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, headless: true },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
