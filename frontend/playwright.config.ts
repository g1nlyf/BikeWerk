import { defineConfig } from '@playwright/test'

const baseURL = process.env.PW_BASE_URL || 'http://127.0.0.1:5175'
const backendURL = process.env.CRM_BACKEND_URL || 'http://127.0.0.1:8082'
const isCI = Boolean(process.env.CI)
const managedServersEnabled = process.env.PW_MANUAL_SERVERS !== '1'

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
  webServer: managedServersEnabled
    ? [
        {
          command: 'npm run start',
          cwd: '../backend',
          url: `${backendURL}/api/health`,
          reuseExistingServer: !isCI,
          timeout: 120000,
          env: {
            ...process.env,
            AUTH_RATE_LIMIT_MAX: process.env.AUTH_RATE_LIMIT_MAX || '100',
            ENABLE_AI_ROP_AUTOPILOT: process.env.ENABLE_AI_ROP_AUTOPILOT || '0',
            ENABLE_CRM_HOURLY_SYNC: process.env.ENABLE_CRM_HOURLY_SYNC || '0',
            ENABLE_METRICS_ANOMALY_DETECTOR: process.env.ENABLE_METRICS_ANOMALY_DETECTOR || '0',
            ENABLE_METRICS_DAILY_ALERTS: process.env.ENABLE_METRICS_DAILY_ALERTS || '0',
            ENABLE_METRICS_AUTO_OPTIMIZER: process.env.ENABLE_METRICS_AUTO_OPTIMIZER || '0',
            BOT_POLLING: process.env.BOT_POLLING || 'false',
            ADMIN_BOT_POLLING: process.env.ADMIN_BOT_POLLING || 'false',
          },
        },
        {
          command: 'npm run dev -- --host 127.0.0.1 --port 5175',
          url: baseURL,
          reuseExistingServer: !isCI,
          timeout: 120000,
        },
      ]
    : undefined,
  use: {
    baseURL,
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
