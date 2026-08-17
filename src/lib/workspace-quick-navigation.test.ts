import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const navigation = readFileSync('src/components/navigation/workspace-quick-navigation.tsx', 'utf8')
const portfolio = readFileSync('src/app/planner/portfolio/page.tsx', 'utf8')
const rootLayout = readFileSync('src/app/layout.tsx', 'utf8')

describe('compact authenticated workspace navigation', () => {
  test('mounts once from the root layout', () => {
    expect(rootLayout).toContain("import { WorkspaceQuickNavigation } from '@/components/navigation/workspace-quick-navigation'")
    expect(rootLayout).toContain('<WorkspaceQuickNavigation />')
  })

  test('provides compact back, forward, switch-account and sign-out actions', () => {
    expect(navigation).toContain('window.history.back()')
    expect(navigation).toContain('window.history.forward()')
    expect(navigation).toContain('Switch account')
    expect(navigation).toContain('Sign out')
    expect(navigation).toContain("fetch('/api/auth/sign-out'")
    expect(navigation).toContain("endSession('/sign-in')")
    expect(navigation).toContain("endSession('/')")
  })

  test('covers authenticated role workspaces without becoming guest/public chrome', () => {
    for (const prefix of ["'/admin'", "'/couple'", "'/planner'", "'/vendor'", "'/messages'", "'/billing'"]) {
      expect(navigation).toContain(prefix)
    }
    expect(navigation).toContain("pathname === '/vendors/manage'")
    expect(navigation).toContain('isPrivateWorkspace(pathname)')
    expect(navigation).toContain('plannerUsesEmbeddedAdaptiveNavigation(pathname)')
    expect(navigation).not.toContain("'/wedding/'")
    expect(navigation).not.toContain("'/guest'")
  })

  test('keeps Planner portfolio inside the embedded adaptive navigation contract', () => {
    expect(navigation).toContain('timeline|seating|portfolio')
    expect(portfolio).toContain("import { PlannerAdaptiveNavigation } from '@/components/navigation/planner-adaptive-navigation'")
    expect(portfolio).toContain('<PlannerAdaptiveNavigation role="planner" showPortfolioLink={false} />')
    expect(portfolio).toContain('data-planner-portfolio-shell')
  })

  test('keeps the persistent footprint icon-only and touch friendly outside embedded Planner surfaces', () => {
    expect(navigation).toContain('size-9')
    expect(navigation).toContain('aria-label="Go back"')
    expect(navigation).toContain('aria-label="Go forward"')
    expect(navigation).toContain('aria-label="Open account menu"')
    expect(navigation).toContain('bottom-[calc(env(safe-area-inset-bottom)+5.25rem)]')
  })
})
