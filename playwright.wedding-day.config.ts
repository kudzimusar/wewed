import { defineConfig, devices } from '@playwright/test'

const databaseUrl = process.env.WEDDING_DAY_TEST_DATABASE_URL?.trim() || ''
if (!databaseUrl) {
  throw new Error(
    'WEDDING_DAY_TEST_DATABASE_URL is required. It must point to the isolated wewed_wedding_day_test database.',
  )
}

let parsedDatabaseUrl: URL
try {
  parsedDatabaseUrl = new URL(databaseUrl)
} catch {
  throw new Error('WEDDING_DAY_TEST_DATABASE_URL is not a valid PostgreSQL URL.')
}

const localHost =
  parsedDatabaseUrl.hostname === 'localhost' ||
  parsedDatabaseUrl.hostname === '127.0.0.1'
if (!localHost || parsedDatabaseUrl.pathname.replace(/^\//, '') !== 'wewed_wedding_day_test') {
  throw new Error(
    `Refusing Wedding Day E2E database ${parsedDatabaseUrl.hostname}${parsedDatabaseUrl.pathname}. Expected local database wewed_wedding_day_test.`,
  )
}

const port = 3107
const baseURL = `http://127.0.0.1:${port}`
const sessionSecret = 'wewed-wedding-day-isolated-e2e-session-secret'
const ww2PrivateKey = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQglT+cbNcoCgAydC2C
SoxwRH4QxjlxDqA1y1vS3LHSaKihRANCAASngxtbMp6BNcd941jWYI7Mj9VblYT2
OSuFfS0JN6pyg/j7YeeK/yU3HhGwqxOiCkGzBDA5xzktMeorCiBGZno7
-----END PRIVATE KEY-----`
const rootPrivateKey = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQga+X7+VEcRaPEDC/y
8WrJRLEoAYg7DEmu9BpGvWZuXe6hRANCAATQDsT5EwXYpbZqumdIsxPR3MlK5N3l
0uMSngz2zV06cEk6v9A0l+eG6t9Qa0dRQi5dpPJKSVsXLUJhQm5SYgKi
-----END PRIVATE KEY-----`

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /wedding-day-application-e2e\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'wedding-day-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `bunx prisma migrate deploy --schema prisma && bunx next dev -p ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      DIRECT_URL: databaseUrl,
      WEWED_SESSION_SECRET: sessionSecret,
      WEWED_E2E_MODE: '1',
      CI: 'true',
      WEDDING_DAY_WW2_PRIVATE_KEY_PEM: ww2PrivateKey,
      WEDDING_DAY_WW2_KEY_ID: 'ww2-isolated-e2e-v1',
      WEDDING_DAY_ROOT_PRIVATE_KEY_PEM: rootPrivateKey,
      WEDDING_DAY_ROOT_KEY_ID: 'wewed-root-isolated-e2e-v1',
    },
  },
})
