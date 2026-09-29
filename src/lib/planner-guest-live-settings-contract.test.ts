import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const source = (path: string) => readFileSync(path, 'utf8')

const plannerInvitations = source('src/app/api/planner/guests/invitations/route.ts')
const guestSession = source('src/app/api/weddings/[slug]/guest-session/route.ts')
const webRsvp = source('src/components/wedding/invitation-experience/premium-invitation-rsvp-dialog.tsx')
const weddingDay = source('src/app/api/wedding-day/guest/route.ts')
const androidSession = source('apps/android/app/src/main/java/pro/wewed/app/invitation/GuestSessionClient.kt')
const androidInvitation = source('apps/android/app/src/main/java/pro/wewed/app/ui/invitation/LiveGuestInvitationScreen.kt')
const iosSession = source('apps/ios/Wewed/Invitation/GuestSessionClient.swift')
const iosInvitation = source('apps/ios/Wewed/Views/Invitation/LiveGuestInvitationView.swift')

describe('Planner settings → Guest clients live authority', () => {
  test('persists invitation note, RSVP deadline and children policy from Planner', () => {
    expect(plannerInvitations).toContain('invitationCardMessage')
    expect(plannerInvitations).toContain('rsvpDeadline')
    expect(plannerInvitations).toContain("section: 'rsvp'")
    expect(plannerInvitations).toContain("field: 'childrenPolicy'")
  })

  test('serves the same settings through the invitation-bound guest session', () => {
    expect(guestSession).toContain('invitationCardMessage')
    expect(guestSession).toContain('rsvpDeadline')
    expect(guestSession).toContain('childrenPolicy')
    expect(guestSession).toContain('loadWeddingChildrenPolicy')
  })

  test('web RSVP hides child controls for an adults-only wedding', () => {
    expect(webRsvp).toContain("childrenPolicy === 'adults_only'")
    expect(webRsvp).toContain('With love, we kindly ask that this be an adults-only celebration.')
  })

  test('current Android source consumes the same invitation settings and adults-only policy', () => {
    expect(androidSession).toContain('childrenPolicy')
    expect(androidSession).toContain('invitationCardMessage')
    expect(androidSession).toContain('rsvpDeadline')
    expect(androidInvitation).toContain('childrenPolicy == "adults_only"')
    expect(androidInvitation).toContain('With love, we kindly ask that this be an adults-only celebration.')
  })

  test('current iOS source consumes the same invitation settings and adults-only policy', () => {
    expect(iosSession).toContain('childrenPolicy')
    expect(iosSession).toContain('invitationCardMessage')
    expect(iosSession).toContain('rsvpDeadline')
    expect(iosInvitation).toContain('childrenPolicy == "adults_only"')
  })

  test('Wedding Day programme is live database data rather than a bundled native schedule', () => {
    expect(weddingDay).toContain('ProgrammeItem')
    expect(weddingDay).toContain("export const dynamic = 'force-dynamic'")
    expect(weddingDay).toContain("'Cache-Control': 'private, no-store'")
  })
})
