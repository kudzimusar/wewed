import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const manager = readFileSync('src/components/wedding/invitation-manager.tsx', 'utf8')
const deliveryRoute = readFileSync('src/app/api/planner/guests/invitations/delivery/route.ts', 'utf8')
const stage = readFileSync('src/components/wedding/planner-workspace-stage7.tsx', 'utf8')

describe('Planner invitation operations desktop contract', () => {
  test('the invitation list is a first-class Planner workspace, not a modal-only block', () => {
    expect(stage).toContain("activeTool === 'invitations'")
    expect(stage).toContain('<PlannerInvitationOperationsWorkspace />')
    expect(manager).toContain('Open Invitation · guest-specific links & QR codes')
    expect(manager).toContain('Search guest, email, phone, table')
  })

  test('supports filters, selection, guest creation, removal and send tracking', () => {
    expect(manager).toContain('Select filtered')
    expect(manager).toContain('Mark selected sent')
    expect(manager).toContain('Remove selected')
    expect(manager).toContain("fetch('/api/planner/guests'")
    expect(manager).toContain("/api/planner/guests/invitations/delivery")
  })

  test('delivery audit stores a fingerprint rather than the private invitation URL or token', () => {
    const auditWriteStart = deliveryRoute.indexOf("action: INVITATION_DELIVERY_SENT_ACTION")
    const auditWriteEnd = deliveryRoute.indexOf("return json({", auditWriteStart)
    const auditWrite = deliveryRoute.slice(auditWriteStart, auditWriteEnd)

    expect(auditWrite).toContain('invitationFingerprint')
    expect(auditWrite).toContain("messageTemplate: 'wewed-personal-invitation-v1'")
    expect(auditWrite).not.toContain('invitationUrl')
    expect(auditWrite).not.toContain('rsvpToken:')
  })

  test('copy/share does not silently claim an invitation was delivered', () => {
    const shareStart = manager.indexOf('async function share(row: InvitationRow)')
    const deliveryStart = manager.indexOf('async function updateDelivery')
    const copyShareBlock = manager.slice(shareStart, deliveryStart)
    expect(copyShareBlock).not.toContain('mark_sent')
    expect(manager).toContain('Wewed records an invitation as sent only when you explicitly mark it sent.')
  })
})
