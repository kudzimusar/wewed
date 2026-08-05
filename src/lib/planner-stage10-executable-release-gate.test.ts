import { describe, expect, test } from 'bun:test'

async function source(path: string): Promise<string> {
  return Bun.file(path).text()
}

describe('Stage 10 executable planner release gate', () => {
  test('worksheet tools and the visible planner module are synchronized by durable routes', async () => {
    const [shell, routes, filters, worksheetBar] = await Promise.all([
      source('src/components/wedding/planner-workspace-stage7.tsx'),
      source('src/lib/planner-route-state.ts'),
      source('src/lib/planner-filter-state.ts'),
      source('src/components/wedding/import-export-bar.tsx'),
    ])
    for (const marker of [
      'selectWorkspaceTab',
      "searchParams.get('module')",
      'plannerModuleFromPath(pathname, legacyModule)',
      'plannerModulePath(activeTab, activeTool)',
      "next.delete('module')",
      "data-testid={`worksheet-module-${module.worksheetKey ?? 'overview'}`}",
      'onActiveTabChange={selectWorkspaceTab}',
      'routeTool={activeTool}',
      'onRouteToolChange={selectWorkspaceTool}',
      "window.history.scrollRestoration = 'manual'",
    ]) expect(shell).toContain(marker)
    expect(routes).toContain('return `/planner/${module}${tool ? `/${tool}` : \'\'}`')
    expect(routes).toContain('plannerToolFromPath')
    expect(filters).toContain('`filter_${key}`')
    expect(filters).toContain('router.replace(')
    expect(worksheetBar).toContain("routeTool === 'import'")
    expect(worksheetBar).toContain("routeTool === 'imports'")
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

  test('production health validates the same server-side signing fallback used by sessions', async () => {
    const health = await source('src/app/api/health/route.ts')
    expect(health).toContain(
      'sessionSecret: process.env.WEWED_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY',
    )
    expect(health).toContain('serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY')
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
        source('tests/e2e/planner-gap-closure.spec.ts'),
        source('tests/e2e/planner-seating-operations.spec.ts'),
        source('tests/e2e/planner-deep-link-navigation.spec.ts'),
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
      'seating tables expose operational type, zone, green/red status, bulk moves, and safe deletion',
      'server rejects over-capacity individual and bulk moves atomically',
      'a 230-seat Imba Manor plan remains usable on desktop and mobile',
      'guest core fields edit directly',
      'module, task filter, and full task edits',
      'planner modules, filters, tools, history, and scroll position have durable URLs',
      'planner\\/guests\\/import',
      'data-planner-primary-scroll',
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