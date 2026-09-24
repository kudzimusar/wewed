import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: ['personal-invitation-browser-fallback.chromium.spec.mjs'],
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['line']],
  use: {
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
