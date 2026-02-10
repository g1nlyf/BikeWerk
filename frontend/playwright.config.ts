import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  outputDir: 'test-results/artifacts',
  timeout: 180000,
  expect: {
    timeout: 15000,
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'test-results/playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: process.env.PW_BASE_URL || 'http://localhost:5175',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
})
