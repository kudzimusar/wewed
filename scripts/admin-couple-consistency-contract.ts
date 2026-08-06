import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

function includesAll(path: string, values: string[]) {
  const contents = source(path)
  for (const value of values) {
    assert.ok(contents.includes(value), `${path} must include ${JSON.stringify(value)}`)
  }
  return contents
}

const plan = includesAll('docs/product/admin-couple-responsive-consistency-plan-2026-08-06.md', [
  'Admin identity, onboarding, and invitation visibility',
  'Session-aware public wedding-site navigation',
  'Canonical Guest, invitation, QR, and RSVP verification',
  'No production database writes',
])
assert.ok(plan.indexOf('Delivery sequence') > plan.indexOf('Implementation workstreams'))

const weddingPage = includesAll('src/app/w/[slug]/page.tsx', [
  'resolveWeddingAccessFromTokens',
  'accessKind={resolution.accessKind}',
])
assert.ok(!weddingPage.includes('<WeddingHome slug={slug} />'))

const weddingHome = includesAll('src/components/wedding/wedding-home.tsx', [
  'accessKind?: PublicWeddingAccessKind',
  '<DataBackedWeddingExperience />',
  '<GlobalWeddingTools accessKind={accessKind} />',
])
assert.equal(
  weddingHome.split('<GlobalWeddingTools accessKind={accessKind} />').length - 1,
  2,
  'Both data-backed and flagship wedding experiences must mount access-aware controls.',
)

includesAll('src/components/wedding/global-wedding-tools.tsx', [
  'accessKind: PublicWeddingAccessKind',
  '<CoupleLogin accessKind={accessKind} />',
])

const coupleLogin = includesAll('src/components/wedding/couple-login.tsx', [
  "accessKind === 'couple_owner' || accessKind === 'wedding_member'",
  "accessKind === 'couple_owner'",
  "label: 'Couple dashboard'",
  "label: 'Planner workspace'",
  "label: 'Admin console'",
  'window.location.reload()',
  "serverConfirmedOwner && dashboardRole === 'couple'",
])
assert.ok(
  coupleLogin.indexOf('window.location.reload()') < coupleLogin.indexOf("toast.info('Signed out."),
  'Successful sign-in must be re-resolved by the server before edit controls are shown.',
)

const adminRoute = includesAll('src/app/api/admin/account-identity/route.ts', [
  "requireWewedAdmin(request, 'admin.accounts.read')",
  'public."WeddingMembership"',
  'public."PlannerEngagement"',
  'pendingInvitations',
  'workspace_membership_without_engagement',
  'engagement_without_matching_workspace_membership',
])
for (const mutatingHandler of ['POST', 'PUT', 'PATCH', 'DELETE']) {
  assert.ok(!adminRoute.includes(`export async function ${mutatingHandler}`), `Account identity diagnostics must remain read-only; found ${mutatingHandler}.`)
}
for (const mutation of ['.create(', '.createMany(', '.update(', '.updateMany(', '.delete(', '.deleteMany(', '.upsert(']) {
  assert.ok(!adminRoute.includes(mutation), `Account identity diagnostics must not mutate data; found ${mutation}.`)
}

includesAll('src/components/admin/admin-account-identity-review.tsx', [
  'Read-only account review',
  'owner.email',
  'pendingInvitations',
  'Planner relationship',
  'This panel does not change access.',
  'data-admin-identity-review-trigger="true"',
])

const plannerGuests = includesAll('src/app/api/planner/guests/route.ts', [
  'db.guest.findMany',
  'include: {',
  'rsvp: true',
  'await tx.rSVP.create({ data: { token: randomUUID(), guestId: created.id } })',
  'data: guests.map(formatGuest)',
])
assert.ok(plannerGuests.includes('where: { weddingId: access.context.weddingId }'), 'Planner guests must remain scoped to the active wedding.')

const invitations = includesAll('src/app/api/planner/guests/invitations/route.ts', [
  "requireWeddingPermission(request, 'guests.view')",
  'db.guest.findMany',
  'include: { rsvp: { select: { token: true, attending: true, checkedIn: true } } }',
  'id: guest.id',
  'token: guest.rsvp.token',
  'qrValue: invitationUrl',
  'db.rSVP.createMany',
  'guestId: guest.id',
])
assert.ok(invitations.includes('where: { weddingId: access.context.weddingId }'), 'Invitation rows must be sourced from the same active-wedding Guest records.')

includesAll('src/app/api/weddings/[slug]/guest-session/exchange/route.ts', [
  'db.rSVP.findUnique',
  'where: { token }',
  'guestId: rsvp.guest.id',
  'rsvpToken: rsvp.token',
])

includesAll('src/app/api/weddings/[slug]/guest-session/route.ts', [
  'resolveGuestSessionForWedding',
  'guest: {',
  'id: guest.id',
  'rsvp: {',
  'where: { token: guest.rsvpToken }',
  'data,',
  'select:',
])

const plannerCss = includesAll('src/app/planner/planner-responsive.css', [
  '@media (max-width: 639px)',
  'grid-template-columns: repeat(2, minmax(0, 1fr))',
  '@media (min-width: 640px) and (max-width: 1279px)',
  'grid-template-columns: repeat(4, minmax(0, 1fr))',
  '[data-active-planner-module="overview"]',
])
assert.ok(!plannerCss.includes('@media (min-width: 1280px)'))

includesAll('src/app/planner/layout.tsx', ["import './planner-responsive.css'"])
includesAll('src/components/couple/couple-dashboard.tsx', [
  'data-couple-dashboard="true"',
  'grid grid-cols-2 gap-2',
  'p-3 backdrop-blur',
  'min-h-11',
])

console.log('Admin/Couple/Planner consistency contract passed.')
