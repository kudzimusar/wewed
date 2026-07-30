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

  test('browser authentication and local cookies are production-inert', async () => {
    const [authRoute, session] = await Promise.all([
      source('src/app/api/auth/me/route.ts'),
      source('src/lib/app-session.ts'),
    ])
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
    expect(session).toContain('isLocalCiBrowserMode')
    expect(session).toContain("process.env.NODE_ENV === 'production' && !isLocalCiBrowserMode()")
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

  test('the modular browser suites cover all previously unverified release areas', async () => {
    const browser = (
      await Promise.all([
        source('tests/e2e/planner-crud.spec.ts'),
        source('tests/e2e/planner-data-workflows.spec.ts'),
        source('tests/e2e/planner-ux.spec.ts'),
        source('tests/e2e/support/planner-browser.ts'),
      ])
    ).join('\n')

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
      'Close notification',
      '@mobile',
      'expectNoDocumentOverflow',
      'browser/runtime errors',
    ]) {
      expect(browser).toContain(marker)
    }
  })

  test('notification close controls retain an accessible name', async () => {
    const toaster = await source('src/components/ui/toaster.tsx')
    expect(toaster).toContain('<ToastClose aria-label="Close notification" />')
  })

  test('Playwright separates desktop and mobile Chromium gates', async () => {
    const config = await source('playwright.config.ts')
    expect(config).toContain("name: 'desktop-chromium'")
    expect(config).toContain("name: 'mobile-chromium'")
    expect(config).toContain("devices['Pixel 5']")
    expect(config).toContain("url: 'http://127.0.0.1:3000/planner'")
  })
})
