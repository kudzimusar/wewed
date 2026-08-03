import { describe, expect, test } from 'bun:test'

async function source(path: string): Promise<string> {
  return Bun.file(path).text()
}

describe('Phase 4 independent planner portal', () => {
  test('public planner trigger navigates instead of mounting the dashboard', async () => {
    const trigger = await source('src/components/wedding/planner-trigger.tsx')

    expect(trigger).toContain('href="/planner"')
    expect(trigger).not.toContain('useState')
    expect(trigger).not.toContain('SecureWeddingPlanner')
  })

  test('planner has a dedicated application route with isolated metadata', async () => {
    const page = await source('src/app/planner/page.tsx')
    const layout = await source('src/app/planner/layout.tsx')

    expect(page).toContain('SecureWeddingPlanner')
    expect(layout).toContain("const title = 'Wewed Planner Workspace'")
    expect(layout).toContain('keywords:')
    expect(layout).toContain('openGraph:')
    expect(layout).toContain('twitter:')
    expect(layout).toContain('index: false')
    expect(layout).toContain('follow: false')
    expect(layout).not.toContain('Charity &')
    expect(layout).not.toContain('Imba Manor')
  })

  test('secure planner mounts one standalone application shell', async () => {
    const securePlanner = await source(
      'src/components/wedding/secure-wedding-planner.tsx',
    )

    expect(securePlanner).toContain('PlannerPortal')
    expect(securePlanner).not.toContain('<WeddingPlanner')
    expect(securePlanner).not.toContain('<WeddingContextControls')
  })

  test('portal owns viewport height and uses the non-modal workspace', async () => {
    const portal = await source('src/components/wedding/planner-portal.tsx')

    expect(portal).toContain('h-dvh')
    expect(portal).toContain('min-h-dvh')
    expect(portal).toContain('overflow-hidden')
    expect(portal).toContain('planner-portal-body')
    expect(portal).toContain('WeddingContextControls')
    expect(portal).toContain('PlannerWorkspace')
    expect(portal).not.toContain('WeddingPlanner')
    expect(portal).toContain('Wewed Planner Workspace')
    expect(portal).toContain("fetch('/api/auth/me'")
  })

  test('workspace has real empty states and no couple-specific auto-seeding', async () => {
    const activeSurface = (
      await Promise.all([
        source('src/components/wedding/planner-workspace.tsx'),
        source('src/components/wedding/planner/modules/planner-tasks-module.tsx'),
        source('src/components/wedding/planner/modules/planner-budget-module.tsx'),
        source('src/components/wedding/planner/modules/planner-vendors-module.tsx'),
        source('src/components/wedding/planner/modules/planner-guests-module.tsx'),
        source('src/components/wedding/planner/modules/planner-timeline-module.tsx'),
        source('src/components/wedding/planner/modules/planner-seating-module.tsx'),
      ])
    ).join('\n')

    expect(activeSurface).toContain('This workspace uses only the selected wedding’s saved records.')
    expect(activeSurface).toContain('weddings stay empty until a planner adds data')
    expect(activeSurface).toContain('No couple-specific sample data is inserted automatically')
    expect(activeSurface).not.toContain('SEED_')
    expect(activeSurface).not.toContain('Charity')
    expect(activeSurface).not.toContain('Kudzie')
    expect(activeSurface).not.toContain('<Dialog')
  })
})
