import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const actions = readFileSync(
  'src/components/wedding/planner/planner-guest-invitation-actions.tsx',
  'utf8',
)
const guests = readFileSync(
  'src/components/wedding/planner/modules/planner-guests-module.tsx',
  'utf8',
)
const manager = readFileSync(
  'src/components/wedding/invitation-manager.tsx',
  'utf8',
)
const deliveryRoute = readFileSync(
  'src/app/api/planner/guests/invitations/delivery/route.ts',
  'utf8',
)
const operations = readFileSync(
  'src/lib/planner-invitation-operations.ts',
  'utf8',
)

describe('Guest-card invitation actions', () => {
  test('Guest register and Invitation Command Center render the same action component', () => {
    expect(guests).toContain('<PlannerGuestInvitationActions')
    expect(manager).toContain('<PlannerGuestInvitationActions')
    expect(actions).toContain('Invite / Share')
    expect(actions).toContain('Copy message')
    expect(actions).toContain('Copy link')
    expect(actions).toContain('Preview')
    expect(actions).toContain('Mark sent')
  })

  test('individual delivery actions call the existing delivery route', () => {
    expect(actions).toContain("fetch('/api/planner/guests/invitations/delivery'")
    expect(actions).toContain("method: markSent ? 'POST' : 'DELETE'")
    expect(deliveryRoute).toContain('recordInvitationDelivery(')
    expect(deliveryRoute).toContain('resetInvitationDelivery(')
    expect(operations).toContain('export async function recordInvitationDelivery')
    expect(operations).toContain('export async function resetInvitationDelivery')
  })

  test('Invitation Manager no longer owns duplicate individual copy/share/preview helpers', () => {
    expect(manager).not.toContain('async function copyLink')
    expect(manager).not.toContain('async function copyMessage')
    expect(manager).not.toContain('async function share(row')
    expect(manager).not.toContain('function plannerPreviewLink')
  })

  test('Guest register reads the canonical invitation projection rather than deriving links', () => {
    expect(guests).toContain("fetch('/api/planner/guests/invitations'")
    expect(guests).not.toContain('buildSmartInvitationUrl')
    expect(guests).not.toContain('rsvpToken')
  })
})
