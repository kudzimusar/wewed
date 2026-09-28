import { describe, expect, mock, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import {
  DESKTOP_DASHBOARD_ACCOUNT_CLASSES,
  desktopDashboardAdmission,
  desktopMembershipResolves,
  membershipWorkspaceGrant,
  WEDDING_RELATIONSHIP_POLICY_DECISIONS,
  workspaceKindForMembershipRole,
} from '@/lib/wedding-relationship-eligibility'

/**
 * P13-LIVE-8 foundation — desktop/native wedding-relationship parity matrix.
 *
 * Every (account class × membership role × membership status × governed) combination is resolved
 * by the desktop rules and the native rules. Where they disagree, the disagreement must be one of
 * the recorded open policy decisions — any other divergence fails, and a recorded divergence that
 * silently disappears also fails (the decision record must then be updated).
 */

mock.module('server-only', () => ({}))
const { isDashboardRole } = await import('@/lib/app-session')

const ACCOUNT_CLASSES = ['couple', 'planner', 'admin', 'vendor', 'viewer', 'usher'] as const
const MEMBERSHIP_ROLES = ['owner', 'planner', 'coordinator', 'viewer'] as const
const STATUSES = ['active', 'invited', 'revoked'] as const

type Divergence = keyof typeof WEDDING_RELATIONSHIP_POLICY_DECISIONS

function classify(accountClass: string, role: string, status: string, governed: boolean): Divergence | null | 'UNEXPECTED' {
  const membership = { role, status, governedAccess: governed }
  const native = membershipWorkspaceGrant(membership).grants
  const admission = desktopDashboardAdmission({ role: accountClass, isActive: true })
  const desktop = admission.admitted
    && desktopMembershipResolves({ accountClass: admission.accountClass, membership, signInAcceptsInvitation: true })
  if (desktop === native) return null
  const grantingRole = workspaceKindForMembershipRole(role) !== null
  if (native && !desktop && governed && status === 'active' && grantingRole
    && (!admission.admitted || accountClass === 'vendor')) return 'D-COORD-ACCOUNT-CLASS'
  if (desktop && !native && status === 'invited' && governed && grantingRole) return 'D-COORD-INVITATION-LIFECYCLE'
  if (desktop && !native && role === 'viewer' && governed && status !== 'revoked') return 'D-VIEWER-WORKSPACE'
  return 'UNEXPECTED'
}

describe('desktop/native wedding-relationship eligibility', () => {
  test('the desktop dashboard account classes are exactly the session DashboardRole set', () => {
    for (const role of ['admin', 'couple', 'planner', 'vendor', 'viewer', 'usher', 'coordinator', '']) {
      expect((DESKTOP_DASHBOARD_ACCOUNT_CLASSES as readonly string[]).includes(role)).toBe(isDashboardRole(role))
    }
  })

  test('a Coordinator is a wedding membership, never a global account class', () => {
    expect(workspaceKindForMembershipRole('coordinator')).toBe('coordinator')
    expect((DESKTOP_DASHBOARD_ACCOUNT_CLASSES as readonly string[]).includes('coordinator')).toBe(false)
  })

  test('an active governed Coordinator resolves identically on desktop and native for dashboard account classes', () => {
    for (const accountClass of ['couple', 'planner', 'admin'] as const) {
      const membership = { role: 'coordinator', status: 'active', governedAccess: true }
      expect(membershipWorkspaceGrant(membership)).toEqual({ grants: true, kind: 'coordinator' })
      expect(desktopMembershipResolves({ accountClass, membership, signInAcceptsInvitation: true })).toBe(true)
      expect(desktopMembershipResolves({ accountClass, membership, signInAcceptsInvitation: false })).toBe(true)
    }
  })

  test('ungoverned or revoked relationships resolve on neither transport', () => {
    for (const accountClass of ['couple', 'planner'] as const) {
      for (const membership of [
        { role: 'coordinator', status: 'active', governedAccess: false },
        { role: 'coordinator', status: 'revoked', governedAccess: true },
      ]) {
        expect(membershipWorkspaceGrant(membership).grants).toBe(false)
        expect(desktopMembershipResolves({ accountClass, membership, signInAcceptsInvitation: true })).toBe(false)
      }
    }
  })

  test('every divergence in the full matrix is a recorded open policy decision, and each one still occurs', () => {
    const seen = new Set<string>()
    const unexpected: string[] = []
    for (const accountClass of ACCOUNT_CLASSES) {
      for (const role of MEMBERSHIP_ROLES) {
        for (const status of STATUSES) {
          for (const governed of [true, false]) {
            const result = classify(accountClass, role, status, governed)
            if (result === 'UNEXPECTED') unexpected.push(`${accountClass}/${role}/${status}/${governed}`)
            else if (result) seen.add(result)
          }
        }
      }
    }
    expect(unexpected).toEqual([])
    expect([...seen].sort()).toEqual(Object.keys(WEDDING_RELATIONSHIP_POLICY_DECISIONS).sort())
  })

  test('Preview sign-in that accepts nothing removes the invitation-lifecycle divergence for that deployment', () => {
    const membership = { role: 'coordinator', status: 'invited', governedAccess: true }
    expect(desktopMembershipResolves({ accountClass: 'planner', membership, signInAcceptsInvitation: false }))
      .toBe(membershipWorkspaceGrant(membership).grants)
  })

  test('both transports consume the shared rules', () => {
    expect(readFileSync('src/lib/production-authority/grants.ts', 'utf8')).toContain('membershipWorkspaceGrant(m)')
    expect(readFileSync('src/app/api/auth/signin/route.ts', 'utf8')).toContain('desktopDashboardAdmission(accessUser)')
    expect(readFileSync('src/lib/wedding-access.ts', 'utf8')).toContain('GOVERNED_WEDDING_ACCESS')
    expect(readFileSync('src/lib/production-authority/resolver.ts', 'utf8')).toContain('GOVERNED_WEDDING_ACCESS')
  })
})
