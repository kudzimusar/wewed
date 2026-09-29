import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const launcher = readFileSync('src/components/wedding/planner-invitation-tools.tsx', 'utf8')
const manager = readFileSync('src/components/wedding/invitation-manager.tsx', 'utf8')
const studio = readFileSync('src/components/wedding/invitation-experience/premium-invitation-studio.tsx', 'utf8')
const route = readFileSync('src/app/planner/invitations/page.tsx', 'utf8')
const api = readFileSync('src/app/api/planner/guests/invitations/route.ts', 'utf8')
const migration = readFileSync('prisma/migrations/20260929094500_guest_invitation_delivery_tracking/migration.sql', 'utf8')

describe('Planner Invitation Desk', () => {
  test('has a stable bookmarkable planner route instead of a modal-only launcher', () => {
    expect(route).toContain('PlannerInvitationWorkspace')
    expect(route).toContain('Invitation Desk')
    expect(launcher).toContain('href="/planner/invitations"')
    expect(launcher).not.toContain('<Dialog')
    expect(launcher).toContain('export function PlannerInvitationWorkspace')
  })

  test('organises guest delivery with search, filters, selection and editing controls', () => {
    expect(manager).toContain('Search name, email, phone, recipient or table')
    expect(manager).toContain('Filter by RSVP')
    expect(manager).toContain('Filter by delivery')
    expect(manager).toContain('Filter by channel')
    expect(manager).toContain('Select visible')
    expect(manager).toContain('Add guest')
    expect(manager).toContain('startEdit')
    expect(manager).toContain('deleteGuest')
    expect(manager).toContain("action: 'mark_sent'")
  })

  test('does not pretend copy/share means delivered', () => {
    const copyStart = manager.indexOf('async function copyLink')
    const deliveryStart = manager.indexOf('async function markSent')
    const shareAndCopy = manager.slice(copyStart, deliveryStart)

    expect(shareAndCopy).not.toContain("action: 'mark_sent'")
    expect(manager).toContain('planner recorded the handoff')
    expect(manager).toContain('does not claim WhatsApp/SMS delivery')
  })

  test('records invitation delivery separately from RSVP authority', () => {
    expect(migration).toContain('CREATE TABLE "GuestInvitationDelivery"')
    expect(migration).toContain('"GuestInvitationDelivery_guestId_weddingId_fkey"')
    expect(migration).toContain('"invitationVersionFingerprint"')
    expect(migration).toContain('"invitationStyle"')
    expect(migration).toContain('"invitationMessage"')
    expect(migration).toContain('"rsvpDeadline"')
    expect(migration).toContain('"childrenPolicy"')
    expect(migration).not.toMatch(/UPDATE\s+"RSVP"/i)
    expect(migration).not.toMatch(/UPDATE\s+"Guest"/i)
    expect(migration).not.toMatch(/WeddingPassCredential.*UPDATE/i)

    expect(api).toContain("action: 'guest.invitation_marked_sent'")
    expect(api).toContain('guestInvitationDelivery.createMany')
    expect(api).toContain('invitationDeliveryVersionFingerprint')
    expect(api).toContain('invitationMessage: wedding.invitationCardMessage')
    expect(api).not.toContain('deliveryConfirmed')
  })

  test('shows stale sends when a private link or invitation settings change', () => {
    expect(manager).toContain('Private link rotated since this send.')
    expect(manager).toContain('Invitation settings changed since this send.')
    expect(manager).toContain('lastSentInvitationStyle')
    expect(manager).toContain('lastSentChildrenPolicy')
  })

  test('makes preview versus persisted live settings explicit', () => {
    expect(studio).toContain('preview-only until you save')
    expect(studio).toContain('Save & make live')
    expect(studio).toContain('Saved to the wedding')
    expect(studio).toContain('children policy')
    expect(studio).toContain('current native Guest clients')
  })
})
