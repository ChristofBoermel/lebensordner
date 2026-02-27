import { defineConfig, devices } from '@playwright/test'

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ??
  process.env.E2E_BASE_URL ??
  'http://127.0.0.1:3000'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.test\.ts/,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: process.env.CI ? 'npm run start' : 'npm run dev -- --port 3000',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
