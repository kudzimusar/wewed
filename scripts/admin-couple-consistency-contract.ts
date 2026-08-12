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
  'viewerRole={viewerRole}',
  "appSession?.activeWeddingId === wedding.id ? appSession.role : null",
])
assert.ok(!weddingPage.includes('<WeddingHome slug={slug} />'))

const weddingHome = includesAll('src/components/wedding/wedding-home.tsx', [
  'accessKind?: PublicWeddingAccessKind',
  'viewerRole?: WeddingViewerRole',
  '<WeddingHomeContent accessKind={accessKind} viewerRole={viewerRole} />',
  '<Navbar accessKind={accessKind} viewerRole={viewerRole} />',
  "const isCoupleOwner = accessKind === 'couple_owner' && viewerRole === 'couple'",
  "const canContribute = accessKind !== 'public' && accessKind !== null",
  '{canContribute && <MediaUpload />}',
  '<LiveWall canPost={canContribute} />',
  '<GlobalWeddingTools accessKind={accessKind} viewerRole={viewerRole} />',
])
assert.ok(
  !weddingHome.includes('DataBackedWeddingExperience'),
  'All weddings must use the same canonical rich renderer; the reduced data-backed renderer must not return.',
)
assert.ok(
  !weddingHome.includes('if (!isFlagship)'),
  'The canonical renderer must not branch into a reduced non-flagship wedding experience.',
)
assert.equal(
  weddingHome.split('<GlobalWeddingTools accessKind={accessKind} viewerRole={viewerRole} />').length - 1,
  1,
  'The canonical wedding experience must mount one role-aware utility bundle.',
)
assert.ok(
  weddingHome.includes('{isCoupleOwner && <PlannerMarketplaceInvitation />}'),
  'Planner marketplace owner controls must remain couple-owner only.',
)

const globalTools = includesAll('src/components/wedding/global-wedding-tools.tsx', [
  'accessKind: PublicWeddingAccessKind',
  'viewerRole: WeddingViewerRole',
  "const isCoupleOwner = accessKind === 'couple_owner' && viewerRole === 'couple'",
  "const isAdmin = viewerRole === 'admin'",
  'const showOwnerUtilities = isCoupleOwner || isAdmin',
  '{showOwnerUtilities && <AiTrigger />}',
  '{isAdmin && <AdminTrigger />}',
  '{isCoupleOwner && <CoupleLogin accessKind={accessKind} />}',
  '{showOwnerUtilities && <KeyboardSectionNav />}',
  '{showOwnerUtilities && <KeyboardShortcutsHelp />}',
])
assert.ok(
  !globalTools.includes('<AiTrigger />\n      <AdminTrigger />'),
  'AI and admin controls must not mount unconditionally for guests.',
)

const coupleLogin = includesAll('src/components/wedding/couple-login.tsx', [
  "if (accessKind !== 'couple_owner') return null",
  'data-testid="couple-owner-controls"',
  'aria-label="Couple dashboard"',
  "href=\"/couple\"",
  "setEditMode(false)",
  'window.location.reload()',
])
assert.ok(
  !coupleLogin.includes('Planner workspace'),
  'The couple owner dock must not expose planner workspace navigation.',
)
assert.ok(
  !coupleLogin.includes('Admin console'),
  'The couple owner dock must not expose admin console navigation.',
)
assert.ok(
  coupleLogin.indexOf('setEditMode(false)') < coupleLogin.indexOf('window.location.reload()'),
  'Signing out must disable edit mode before the page is re-resolved by the server.',
)

const adminRoute = includesAll('src/app/api/admin/account-identity/route.ts', [
  "const context = await requireWewedAdmin(request, 'admin.accounts.read')",
  "buildBusinessAccountScopeSql(context, 'ba', 1)",
  'AND (${accountScope.clause})',
  'public."WeddingMembership"',
  'public."PlannerEngagement"',
  'pendingInvitations',
  'workspace_membership_without_engagement',
  'inactive_engagement_with_active_workspace_membership',
  'engagement_without_matching_workspace_membership',
  "if (!diagnosticsAvailable) return 'unavailable'",
  "engagement.status !== 'active'",
  "AND pe.status IN ('requested', 'planner_accepted', 'active', 'paused')",
])
assert.ok(
  adminRoute.includes('WHERE wm."weddingId" = ANY($1::text[])'),
  'Admin identity membership diagnostics must stay within weddings from the scoped account query.',
)
assert.ok(
  adminRoute.includes('WHERE pe."weddingId" = ANY($1::text[])'),
  'Planner engagement diagnostics must stay within weddings from the scoped account query.',
)
assert.ok(
  adminRoute.includes('plannerDiagnosticsAvailable = false'),
  'A failed PlannerEngagement diagnostic source must become explicitly unavailable, not an empty relationship set.',
)
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
