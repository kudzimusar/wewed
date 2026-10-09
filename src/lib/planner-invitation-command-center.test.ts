import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const manager = readFileSync('src/components/wedding/invitation-manager.tsx', 'utf8')
const tools = readFileSync('src/components/wedding/planner-invitation-tools.tsx', 'utf8')
const page = readFileSync('src/app/planner/invitations/page.tsx', 'utf8')
const deliveryRoute = readFileSync('src/app/api/planner/guests/invitations/delivery/route.ts', 'utf8')
const projection = readFileSync('src/lib/planner-invitation-projection.ts', 'utf8')
const telemetry = readFileSync('src/lib/guest-invitation-telemetry.ts', 'utf8')
const plannerRoute = readFileSync('src/app/api/planner/guests/invitations/route.ts', 'utf8')
const guestSession = readFileSync('src/app/api/weddings/[slug]/guest-session/route.ts', 'utf8')
const premiumRsvp = readFileSync('src/components/wedding/invitation-experience/premium-invitation-rsvp-dialog.tsx', 'utf8')
const legacyRsvp = readFileSync('src/components/wedding/invitation-rsvp-dialog.tsx', 'utf8')
const androidRsvp = readFileSync('apps/android/app/src/main/java/pro/wewed/app/ui/invitation/LiveGuestInvitationScreen.kt', 'utf8')
const inviteRoute = readFileSync('src/app/invite/[slug]/route.ts', 'utf8')
const inviteContinue = readFileSync('src/app/invite/[slug]/continue/route.ts', 'utf8')
const pendingInvitation = readFileSync('src/lib/pending-invitation.ts', 'utf8')
const plannerTimeline = readFileSync('src/app/api/planner/timeline/route.ts', 'utf8')
const weddingDayGuest = readFileSync('src/app/api/wedding-day/guest/route.ts', 'utf8')
const plannerPortal = readFileSync('src/components/wedding/planner-portal.tsx', 'utf8')
const adaptiveNavigation = readFileSync('src/components/navigation/planner-adaptive-navigation.tsx', 'utf8')
const invitationStudio = readFileSync('src/components/wedding/invitation-experience/premium-invitation-studio.tsx', 'utf8')
const individualActions = readFileSync('src/components/wedding/planner/planner-guest-invitation-actions.tsx', 'utf8')

describe('Planner invitation command center', () => {
  test('has a durable planner route instead of a modal-only workspace', () => {
    expect(page).toContain('data-planner-invitations-page')
    expect(page).toContain('<PlannerInvitationTools embedded />')
    expect(page).toContain('<WeddingContextControls />')
    expect(tools).toContain('href="/planner/invitations"')
    expect(tools).not.toContain('<Dialog')
  })

  test('surfaces invitation delivery as a first-class planner destination', () => {
    expect(plannerPortal).toContain('data-planner-invitations-primary-link')
    expect(plannerPortal).toContain('href="/planner/invitations"')
    expect(adaptiveNavigation).toContain('Invitation delivery')
    expect(adaptiveNavigation).toContain('href="/planner/invitations"')
    expect(invitationStudio).toContain('Save invitation settings')
    expect(invitationStudio).toContain('children policy')
  })

  test('supports organizer-scale search, filters, selection and guest administration', () => {
    expect(manager).toContain('Invitation delivery command center')
    expect(manager).toContain('Search guest, role, allocation, table, sender')
    expect(manager).toContain('All RSVP states')
    expect(manager).toContain('All delivery states')
    expect(manager).toContain('All open states')
    expect(manager).toContain('All participant types')
    expect(manager).toContain('All allocations')
    expect(manager).toContain('All arrival states')
    expect(manager).toContain('All Pass states')
    expect(manager).toContain('Select all')
    expect(manager).toContain('Mark selected sent')
    expect(manager).toContain('async function addGuest')
    expect(manager).toContain('async function saveGuest')
    expect(manager).toContain('async function deleteGuest')
    expect(manager).toContain('PAGE_SIZE = 40')
  })

  test('sent tracking is audit-only and cannot mutate RSVP or guest business state', () => {
    // QRO08: the one implementation lives in planner-invitation-operations; the desktop (cookie)
    // and native (Bearer grant) delivery routes are both thin front doors to it.
    const operations = readFileSync('src/lib/planner-invitation-operations.ts', 'utf8')
    const delivery = operations.slice(
      operations.indexOf('export async function recordInvitationDelivery'),
      operations.indexOf('export async function repairMissingInvitationLinks'),
    )
    expect(delivery).toContain("action: 'guest.invitation_delivery_marked'")
    expect(delivery).toContain("action: 'guest.invitation_delivery_unmarked'")
    expect(delivery).toContain('db.auditEvent.createMany')
    expect(delivery).not.toContain('db.rSVP.update')
    expect(delivery).not.toContain('db.rSVP.create')
    expect(delivery).not.toContain('db.guest.update')
    expect(delivery).not.toContain('db.guest.delete')
    expect(delivery).not.toContain('guest.invitation_opened')

    const nativeDelivery = readFileSync('src/app/api/native/wedding/invitations/delivery/route.ts', 'utf8')
    for (const route of [deliveryRoute, nativeDelivery]) {
      expect(route).toContain('recordInvitationDelivery(')
      expect(route).toContain('resetInvitationDelivery(')
      expect(route).not.toMatch(/db\.(rSVP|guest|auditEvent)\./)
    }
  })

  test('actual invitation redemption is tracked separately without storing credentials', () => {
    expect(telemetry).toContain("action: 'guest.invitation_opened'")
    expect(telemetry).toContain("resourceType: 'guest_invitation'")
    expect(telemetry).not.toContain('rsvpToken')
    expect(telemetry).not.toContain('token:')
    expect(projection).toContain('openedAt')
    expect(projection).toContain("event.action === 'guest.invitation_opened'")
    expect(inviteContinue).toContain('recordGuestInvitationOpened')
    expect(inviteContinue).toContain('!pending.suppressOpenTracking')
    expect(inviteRoute).toContain("plannerPreview') === '1'")
    expect(pendingInvitation).toContain('suppressOpenTracking?: boolean')
    expect(individualActions).toContain("url.searchParams.set('plannerPreview', '1')")
    expect(manager).toContain('<PlannerGuestInvitationActions')
  })

  test('planner programme and children policy converge into the guest wedding-day projection', () => {
    expect(plannerTimeline).toContain('db.programmeItem')
    expect(weddingDayGuest).toContain('FROM public."ProgrammeItem"')
    expect(weddingDayGuest).toContain('sortTimelineItems(programmeRows)')
    expect(weddingDayGuest).toContain('loadWeddingChildrenPolicy(context.weddingId)')
    expect(weddingDayGuest).toContain("childrenPolicy !== 'adults_only'")
  })

  test('planner message, deadline and children policy are canonical server-backed settings', () => {
    expect(plannerRoute).toContain('invitationCardMessage: message || null')
    expect(plannerRoute).toContain('rsvpDeadline')
    expect(plannerRoute).toContain("section: 'rsvp'")
    expect(plannerRoute).toContain("field: 'childrenPolicy'")
    expect(plannerRoute).toContain("field: 'additionalAdultPolicy'")
    expect(guestSession).toContain('const [childrenPolicy, additionalAdultPolicy, serviceTeamMembership] = await Promise.all([')
    expect(guestSession).toContain('db.serviceTeamMember.findUnique({')
    expect(guestSession).toContain('loadWeddingChildrenPolicy(wedding.id)')
    expect(guestSession).toContain('loadWeddingAdditionalAdultPolicy(wedding.id)')
    expect(guestSession).toContain('invitationCardMessage: wedding.invitationCardMessage')
    expect(guestSession).toContain('rsvpDeadline: wedding.rsvpDeadline')
    expect(guestSession).toContain('childrenPolicy,')
    expect(guestSession).toContain('additionalAdultPolicy,')
    expect(premiumRsvp).toContain("data?.wedding.childrenPolicy === 'adults_only'")
    expect(legacyRsvp).toContain("data.wedding.childrenPolicy === 'adults_only'")
    expect(legacyRsvp).toContain('Children are not included in this RSVP')
    expect(androidRsvp).toContain('val adultsOnly = childrenPolicy == "adults_only"')
  })
})
