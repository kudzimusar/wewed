import { describe, expect, test } from 'bun:test'

async function source(path: string): Promise<string> {
  return Bun.file(path).text()
}

describe('Stage 10 executable planner release gate', () => {
  test('worksheet tools and the visible planner module are synchronized', async () => {
    const shell = await source('src/components/wedding/planner-workspace-stage7.tsx')
    expect(shell).toContain('selectWorksheetModule')
    expect(shell).toContain('Planner workspace sections')
    expect(shell).toContain('captureWorkspaceTab')
    expect(shell).toContain('data-testid={`worksheet-module-${module.key}`}')
  })

  test('browser authentication bypass is production-inert', async () => {
    const authRoute = await source('src/app/api/auth/me/route.ts')
    for (const marker of [
      "process.env.WEWED_E2E_MODE === '1'",
      "process.env.CI === 'true'",
      '!process.env.VERCEL',
      "databaseUrl.includes('localhost')",
      "databaseUrl.includes('127.0.0.1')",
      'accessUserMatchesSession',
      'listAccessibleWeddings',
    ]) {
      expect(authRoute).toContain(marker)
    }
  })

  test('the destructive fixture is local-only and contains two populated weddings', async () => {
    const fixture = await source('tests/e2e/support/planner-fixture.ts')
    for (const marker of [
      'Refusing planner E2E fixture reset',
      "process.env.CI !== 'true'",
      'process.env.VERCEL',
      "tablename <> '_prisma_migrations'",
      'E2E_WEDDINGS.primary',
      'E2E_WEDDINGS.secondary',
      'prisma.plannerTask.create',
      'prisma.budgetItem.create',
      'prisma.vendor.create',
      'prisma.guest.create',
      'prisma.rSVP.create',
      'prisma.programmeItem.create',
      'prisma.seatingTable.create',
    ]) {
      expect(fixture).toContain(marker)
    }
  })

  test('the browser suite covers all previously unverified release areas', async () => {
    const browser = await source('tests/e2e/planner-release-gate.spec.ts')
    for (const marker of [
      "openModule(page, 'checklist')",
      "openModule(page, 'budget')",
      "openModule(page, 'vendors')",
      "openModule(page, 'guests')",
      "openModule(page, 'timeline')",
      "openModule(page, 'seating')",
      'XLSX.readFile',
      'Review import',
      'Import now',
      'Recent imports',
      'Roll back',
      'Print run sheet',
      'two populated weddings remain isolated',
      'keyboard navigation',
      '@mobile',
      'expectNoDocumentOverflow',
    ]) {
      expect(browser).toContain(marker)
    }
  })

  test('Playwright separates desktop and mobile Chromium gates', async () => {
    const config = await source('playwright.config.ts')
    expect(config).toContain("name: 'desktop-chromium'")
    expect(config).toContain("name: 'mobile-chromium'")
    expect(config).toContain("devices['Pixel 5']")
    expect(config).toContain("url: 'http://127.0.0.1:3000/planner'")
  })
})
