import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

function source(path: string) {
  return readFileSync(path, 'utf8')
}

describe('planner invitation operations convergence', () => {
  test('invitation operations have a durable planner route', () => {
    const routes = source('src/lib/planner-route-state.ts')
    const tools = source('src/components/wedding/planner-invitation-tools.tsx')
    const workspace = source('src/components/wedding/planner-workspace.tsx')

    expect(routes).toContain("| 'invitations'")
    expect(tools).toContain('href="/planner/invitations#planner-workspace"')
    expect(tools).toContain('PlannerInvitationWorkspace')
    expect(workspace).toContain("activeTab === 'invitations'")
  })

  test('guest delivery desk supports search selection administration and tracking', () => {
    const manager = source('src/components/wedding/invitation-manager.tsx')

    expect(manager).toContain('Search name, email or phone')
    expect(manager).toContain('Select all shown')
    expect(manager).toContain('invitation-quick-add-guest')
    expect(manager).toContain('Edit contact')
    expect(manager).toContain('Remove guest')
    expect(manager).toContain('/api/planner/guests/invitations/delivery')
    expect(manager).toContain('Mark sent')
    expect(manager).toContain('Opened')
  })

  test('delivery tracking never stores the private invitation link', () => {
    const route = source('src/app/api/planner/guests/invitations/delivery/route.ts')
    const tracking = source('src/lib/invitation-delivery-tracking.ts')

    expect(route).toContain("resourceType: 'Guest'")
    expect(route).toContain("guest.invitation_marked_sent")
    expect(tracking).toContain("guest.invitation_opened")
    expect(route).not.toContain('invitationUrl')
    expect(route).not.toContain('rsvpToken')
    expect(tracking).not.toContain('rsvpToken')
  })

  test('saved adults-only policy is enforced in both web RSVP paths', () => {
    const legacy = source('src/components/wedding/invitation-rsvp-dialog.tsx')
    const premium = source('src/components/wedding/invitation-experience/premium-invitation-rsvp-dialog.tsx')
    const session = source('src/app/api/weddings/[slug]/guest-session/route.ts')

    expect(legacy).toContain("childrenPolicy: 'welcome' | 'adults_only'")
    expect(legacy).toContain("data.wedding.childrenPolicy === 'adults_only'")
    expect(legacy).toContain('Children are not included in this RSVP')
    expect(premium).toContain("childrenPolicy === 'adults_only'")
    expect(session).toContain('childrenPolicy')
    expect(session).toContain("kidsAttending: childrenPolicy === 'adults_only' ? false")
  })

  test('planner invitation settings are stored and projected back to guest clients', () => {
    const planner = source('src/app/api/planner/guests/invitations/route.ts')
    const session = source('src/app/api/weddings/[slug]/guest-session/route.ts')
    const android = source('apps/android/app/src/main/java/pro/wewed/app/invitation/GuestSessionClient.kt')

    expect(planner).toContain('invitationCardMessage')
    expect(planner).toContain('rsvpDeadline')
    expect(planner).toContain("field: 'childrenPolicy'")
    expect(session).toContain('invitationCardMessage: wedding.invitationCardMessage')
    expect(session).toContain('rsvpDeadline: wedding.rsvpDeadline')
    expect(android).toContain('val invitationCardMessage: String?')
    expect(android).toContain('val childrenPolicy: String?')
  })

  test('guest Wedding Day uses the same chronological programme ordering as Planner', () => {
    const planner = source('src/app/api/planner/timeline/route.ts')
    const guest = source('src/app/api/wedding-day/guest/route.ts')

    expect(planner).toContain('sortTimelineItems(items)')
    expect(guest).toContain('sortTimelineItems(programmeRows)')
  })
})
