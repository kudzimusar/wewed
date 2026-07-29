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

  test('planner has a dedicated application route', async () => {
    const page = await source('src/app/planner/page.tsx')
    const layout = await source('src/app/planner/layout.tsx')

    expect(page).toContain('SecureWeddingPlanner')
    expect(layout).toContain("title: 'Wewed Planner Workspace'")
    expect(layout).toContain('index: false')
  })

  test('secure planner mounts one standalone application shell', async () => {
    const securePlanner = await source(
      'src/components/wedding/secure-wedding-planner.tsx'
    )

    expect(securePlanner).toContain('PlannerPortal')
    expect(securePlanner).not.toContain('<WeddingPlanner')
    expect(securePlanner).not.toContain('<WeddingContextControls')
  })

  test('portal owns viewport height and internal scrolling', async () => {
    const portal = await source('src/components/wedding/planner-portal.tsx')

    expect(portal).toContain('h-dvh')
    expect(portal).toContain('min-h-dvh')
    expect(portal).toContain('overflow-hidden')
    expect(portal).toContain('planner-portal-body')
    expect(portal).toContain('WeddingContextControls')
    expect(portal).toContain('WeddingPlanner')
    expect(portal).toContain('Wewed Planner Workspace')
    expect(portal).toContain("fetch('/api/auth/me'")
  })
})
