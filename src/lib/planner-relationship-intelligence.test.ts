import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import {
  buildWeddingAttentionItems,
  deriveWeddingHealth,
} from '@/lib/planner-relationship-intelligence'

function source(path: string) {
  return readFileSync(path, 'utf8')
}

const portfolioRoute = source('src/app/api/planner/portfolio/route.ts')
const portfolioUi = source('src/components/wedding/planner-portfolio-command-centre.tsx')
const plannerLanding = source('src/app/planner/page.tsx')
const plannerPortfolioPage = source('src/app/planner/portfolio/page.tsx')
const adminRoute = source('src/app/api/admin/planner-profiles/route.ts')
const adminUi = source('src/components/marketplace/admin-planner-profiles.tsx')
const weddingAccess = source('src/lib/wedding-access.ts')
const appSession = source('src/lib/app-session.ts')
const signInRoute = source('src/app/api/auth/signin/route.ts')
const authMeRoute = source('src/app/api/auth/me/route.ts')

describe('planner relationship and portfolio intelligence', () => {
  test('marks close weddings with overdue work as at risk and explains why', () => {
    const health = deriveWeddingHealth(
      {
        weddingDate: '2026-08-19T12:00:00.000Z',
        overdueTasks: 2,
        blockedTasks: 0,
        pendingRsvps: 0,
        pendingVendorContracts: 0,
        overdueBudgetPayments: 0,
        timelineItems: 5,
      },
      new Date('2026-08-09T00:00:00.000Z'),
    )

    expect(health.state).toBe('at_risk')
    expect(health.daysUntilWedding).toBe(10)
    expect(health.reasons.join(' ')).toContain('2 overdue tasks')
  })

  test('keeps non-critical overdue work visible as attention rather than hiding it in a score', () => {
    const health = deriveWeddingHealth(
      {
        weddingDate: '2026-11-30T12:00:00.000Z',
        overdueTasks: 1,
        blockedTasks: 0,
        pendingRsvps: 50,
        pendingVendorContracts: 0,
        overdueBudgetPayments: 0,
        timelineItems: 0,
      },
      new Date('2026-08-09T00:00:00.000Z'),
    )

    expect(health.state).toBe('attention')
    expect(health.reasons).toEqual(['1 overdue task'])
  })

  test('treats a missing wedding-day timeline inside fourteen days as a transparent critical signal', () => {
    const health = deriveWeddingHealth(
      {
        weddingDate: '2026-08-16T12:00:00.000Z',
        overdueTasks: 0,
        blockedTasks: 0,
        pendingRsvps: 0,
        pendingVendorContracts: 0,
        overdueBudgetPayments: 0,
        timelineItems: 0,
      },
      new Date('2026-08-09T00:00:00.000Z'),
    )

    expect(health.state).toBe('at_risk')
    expect(health.reasons).toContain('Wedding-day timeline has not been started')
  })

  test('maps operational signals to the worksheet where the planner can act', () => {
    const health = {
      state: 'at_risk' as const,
      daysUntilWedding: 8,
      reasons: ['2 overdue tasks'],
    }
    const items = buildWeddingAttentionItems({
      health,
      tasks: { overdue: 2, blocked: 1 },
      budget: { overduePayments: 1 },
      guests: { pending: 12 },
      vendors: { pendingContracts: 1 },
      timeline: { items: 0 },
    })

    expect(items.some((item) => item.module === 'tasks' && item.severity === 'critical')).toBe(true)
    expect(items.some((item) => item.module === 'guests' && item.message.includes('12 RSVPs'))).toBe(true)
    expect(items.some((item) => item.module === 'timeline')).toBe(true)
  })

  test('planner portfolio is authorization-derived and counts only active planner/coordinator relationships', () => {
    expect(portfolioRoute).toContain('listAccessibleWeddings(session.userId, session.role)')
    expect(portfolioRoute).toContain("wedding.membershipStatus === 'active'")
    expect(portfolioRoute).toContain("['planner', 'coordinator'].includes(wedding.membershipRole)")
    expect(weddingAccess).toContain('GOVERNED_WEDDING_ACCESS')
  })

  test('planner landing opens the portfolio command centre before the single-wedding workspace', () => {
    expect(plannerLanding).toContain("redirect('/planner/portfolio')")
    expect(plannerPortfolioPage).toContain("allowedRoles={['planner']}")
    expect(portfolioUi).toContain('Your wedding command centre')
    expect(portfolioUi).toContain("router.push(`/planner/${module}#planner-workspace`)")
    expect(portfolioUi).toContain("fetch('/api/auth/wedding'")
  })

  test('approved planners remain authorized before their first client wedding', () => {
    expect(appSession).toContain('PLANNER_PORTFOLIO_SESSION_ID')
    expect(signInRoute).toContain("weddings.length === 0 && accessUser.role === 'planner'")
    expect(signInRoute).toContain("workspace: 'planner_portfolio'")
    expect(signInRoute).toContain('activeWeddingId: PLANNER_PORTFOLIO_SESSION_ID')
    expect(authMeRoute).toContain("activeWeddings.length === 0 && dashboardRole === 'planner'")
    expect(authMeRoute).toContain("workspace: 'planner_portfolio'")
    expect(authMeRoute).toContain('activeWeddingId: PLANNER_PORTFOLIO_SESSION_ID')
    expect(signInRoute).toContain("if (weddings.length === 0) {")
    expect(authMeRoute).toContain('if (activeWeddings.length === 0) return signedOutResponse()')
  })

  test('admin relationship view reads the same WeddingMembership graph in both directions', () => {
    expect(adminRoute).toContain('public."WeddingMembership" membership')
    expect(adminRoute).toContain("membership.role IN ('planner','coordinator')")
    expect(adminRoute).toContain('managedWeddings')
    expect(adminRoute).toContain('activePlanningTeam')
    expect(adminUi).toContain('Clients & weddings')
    expect(adminUi).toContain('Couples & planning teams')
    expect(adminUi).toContain('No planner currently assigned')
  })

  test('marketplace profile state remains visibly separate from wedding relationship state', () => {
    expect(adminUi).toContain('Marketplace profile lifecycle and wedding authority are shown separately.')
    expect(adminRoute).toContain('relationshipStatus')
    expect(adminRoute).toContain('profileState')
  })
})
