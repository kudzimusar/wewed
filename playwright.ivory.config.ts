import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'ivory-artwork.spec.ts',
  workers: 1,
  use: {
    baseURL: process.env.IVORY_UAT_URL || 'http://localhost:3018',
    viewport: { width: 390, height: 844 },
  },
  reporter: 'list',
})
