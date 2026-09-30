import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { buildPlannerAttendanceSummary } from './planner-invitation-projection'

describe('canonical Planner invitation / RSVP / attendance summary', () => {
  test('Responded, response rate and named-person attendance use canonical Guest identities', () => {
    const rows = [
      {
        status: 'attending' as const,
        deliveryStatus: 'sent' as const,
        openedAt: '2026-09-30T00:00:00.000Z',
        checkedIn: true,
        email: 'one@example.com',
        phone: null,
        passState: 'active' as const,
      },
      {
        status: 'attending' as const,
        deliveryStatus: 'sent' as const,
        openedAt: null,
        checkedIn: false,
        email: null,
        phone: '+263700000000',
        passState: 'not_yet_issued' as const,
      },
      {
        status: 'declined' as const,
        deliveryStatus: 'not_sent' as const,
        openedAt: null,
        checkedIn: false,
        email: null,
        phone: null,
        passState: 'declined' as const,
      },
      {
        status: 'pending' as const,
        deliveryStatus: 'not_sent' as const,
        openedAt: null,
        checkedIn: false,
        email: 'pending@example.com',
        phone: null,
        passState: 'pending_rsvp' as const,
      },
    ]

    expect(buildPlannerAttendanceSummary(rows)).toEqual({
      registered: 4,
      sent: 2,
      notSent: 2,
      opened: 1,
      responded: 3,
      responseRate: 0.75,
      attending: 2,
      declined: 1,
      awaiting: 1,
      expectedNamedAttendees: 2,
      checkedIn: 1,
      notYetArrived: 1,
      missingContact: 1,
      passPendingRsvp: 1,
      passDeclined: 1,
      passNotYetIssuable: 0,
      passNotYetIssued: 1,
      passActive: 1,
      passRevoked: 0,
      passSuperseded: 0,
      passIssuanceClosed: 0,
    })
  })

  test('empty weddings have a zero response rate rather than NaN', () => {
    expect(buildPlannerAttendanceSummary([]).responseRate).toBe(0)
  })

  test('web and native Planner invitation APIs consume the same server projection', () => {
    const web = readFileSync('src/app/api/planner/guests/invitations/route.ts', 'utf8')
    const native = readFileSync('src/app/api/native/wedding/invitations/route.ts', 'utf8')
    expect(web).toContain('loadPlannerInvitationProjection(')
    expect(native).toContain('loadPlannerInvitationProjection(')
  })

  test('Invitation Manager renders server summary and does not recalculate canonical totals', () => {
    const manager = readFileSync('src/components/wedding/invitation-manager.tsx', 'utf8')
    expect(manager).toContain('setSummary(payload.summary ?? null)')
    expect(manager).toContain('data-testid="canonical-attendance-summary"')
    expect(manager).toContain("['responded', 'Responded', summary.responded]")
    expect(manager).toContain("['responseRate', 'Response rate'")
    expect(manager).not.toContain("const stats = useMemo(() => ({")
    expect(manager).not.toContain("rows.filter((row) => row.status === 'attending').length")
    expect(manager).toContain("row.passState !== passFilter")
    expect(manager).not.toContain('passEligible')
    expect(manager).not.toContain('passIssued')

    const register = readFileSync('src/components/wedding/planner/modules/planner-guests-module.tsx', 'utf8')
    expect(register).toContain('setAttendanceSummary(payload.summary ?? null)')
    expect(register).toContain('data-testid="guest-register-canonical-summary"')
    expect(register).not.toContain('guestStats.confirmed')
    expect(register).not.toContain('guestStats.heads')
    expect(register).toContain('Wedding Pass: {invitationActions[guest.id].passState')
    expect(register).not.toContain('passEligible')
    expect(register).not.toContain('passIssued')

    const workspace = readFileSync('src/components/wedding/planner-workspace.tsx', 'utf8')
    expect(workspace).toContain("['Attendance', api<{ summary:")
    expect(workspace).not.toContain('const guestStats = useMemo<GuestStats>')
    expect(workspace).not.toContain('const heads = guests.reduce')
  })
})
