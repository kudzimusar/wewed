import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'bun:test'

const source = (path: string) => readFileSync(path, 'utf8')

const layout = source('src/app/layout.tsx')
const plannerCss = source('src/app/planner-ux.css')
const portal = source('src/components/wedding/planner-portal.tsx')
const commandCenter = source('src/components/wedding/planner/planner-worksheet-command-center.tsx')
const documentContract = source('src/lib/planner-document.ts')
const orderApi = source('src/app/api/planner/worksheet-order/route.ts')
const orderStore = source('src/lib/planner-worksheet-order.ts')
const inviteContract = source('src/lib/team-invite.ts')
const inviteApi = source('src/app/api/weddings/team-invites/route.ts')
const joinApi = source('src/app/api/join/[token]/route.ts')
const joinPage = source('src/app/join/[token]/page.tsx')
const invitationTools = source('src/components/wedding/planner-invitation-tools.tsx')
const teamManager = source('src/components/wedding/planner/planner-team-invite-manager.tsx')

describe('WW-PLANNER-UX-2026-08-17-01 release contract', () => {
  test('governs the permanently-dark Planner form surface independent of system theme', () => {
    expect(portal).toContain('data-planner-portal')
    expect(layout).toContain("import './planner-ux.css'")
    expect(plannerCss).toContain('[data-planner-portal]')
    expect(plannerCss).toContain('-webkit-text-fill-color: var(--planner-field-text) !important;')
    expect(plannerCss).toContain('caret-color: var(--planner-field-text) !important;')
    expect(plannerCss).toContain('color-scheme: dark;')
    expect(plannerCss).toContain('input:-webkit-autofill')
    expect(plannerCss).toContain("input[type='date']")
    expect(plannerCss).toContain('::-webkit-calendar-picker-indicator')
  })

  test('mounts one shared worksheet command centre rather than six page-specific copies', () => {
    expect(layout).toContain('PlannerWorksheetCommandCenter')
    expect(layout).toContain('<PlannerWorksheetCommandCenter />')
    for (const worksheet of ['tasks', 'budget', 'vendors', 'guests', 'timeline', 'seating']) {
      expect(commandCenter).toContain(`'${worksheet}'`)
    }
    expect(commandCenter).toContain('Print · Arrange · Select')
  })

  test('uses one A4 print/save-PDF document contract with paged-media safeguards', () => {
    expect(documentContract).toContain('@page { size: A4 ${orientation};')
    expect(documentContract).toContain('thead { display: table-header-group; }')
    expect(documentContract).toContain('break-inside: avoid')
    expect(documentContract).toContain('overflow-wrap: anywhere')
    expect(commandCenter).toContain('Print / Save PDF')
    expect(commandCenter).toContain("printRecords('full')")
    expect(commandCenter).toContain("printRecords('current')")
    expect(commandCenter).toContain("printRecords('selected')")
    expect(commandCenter).toContain('Full guest list')
    expect(commandCenter).toContain('Catering / dietary list')
    expect(commandCenter).toContain('Check-in list')
  })

  test('provides drag, keyboard and non-drag reorder paths and persists only presentation order', () => {
    expect(commandCenter).toContain('DndContext')
    expect(commandCenter).toContain('KeyboardSensor')
    expect(commandCenter).toContain('sortableKeyboardCoordinates')
    expect(commandCenter).toContain("onMove('top')")
    expect(commandCenter).toContain("onMove('up')")
    expect(commandCenter).toContain("onMove('down')")
    expect(commandCenter).toContain("onMove('bottom')")
    expect(orderStore).toContain("PLANNER_WORKSHEET_ORDER_SECTION = 'planner_worksheet_order'")
    expect(orderStore).toContain("kind: 'presentation_order'")
    expect(orderApi).toContain("action: 'planner.worksheet_reorder'")
    expect(orderApi).not.toContain('paidAmount')
    expect(orderApi).not.toContain('actualCost')
    expect(orderApi).not.toContain('updates.time')
  })

  test('validates reorder record ownership and preserves missing historical records deterministically', () => {
    expect(orderApi).toContain('One or more records do not belong to the active wedding.')
    expect(orderApi).toContain('Worksheet order contains duplicate records.')
    expect(orderApi).toContain('mergePlannerWorksheetOrder(requested, ids)')
    expect(orderStore).toContain('const missing = currentIds.filter')
  })

  test('provides shared current-view selection, safe bulk actions and consequence-aware deletion', () => {
    expect(commandCenter).toContain('Select all in current view')
    expect(commandCenter).toContain('Clear selection')
    expect(commandCenter).toContain('selectedIds.size')
    expect(commandCenter).toContain("['status', 'Change status']")
    expect(commandCenter).toContain("['priority', 'Change priority']")
    expect(commandCenter).toContain("['contractStatus', 'Change contract status']")
    expect(commandCenter).toContain("['paymentStatus', 'Change payment status']")
    expect(commandCenter).toContain("['table', 'Assign / unassign table']")
    expect(commandCenter).toContain('This action is not reversible from this screen.')
    expect(commandCenter).toContain('Financial paid/actual values and timeline event times are deliberately excluded')
  })

  test('keeps guest RSVP QR and project-team access QR as separate user choices', () => {
    expect(invitationTools).toContain('Guest cards, RSVP & guest QR')
    expect(invitationTools).toContain('Invite project team member')
    expect(invitationTools).toContain('<InvitationManager compact />')
    expect(invitationTools).toContain('<PlannerTeamInviteManager />')
  })

  test('stores only a SHA-256 team invite token hash and excludes platform-admin invitations', () => {
    expect(inviteContract).toContain("randomBytes(32).toString('base64url')")
    expect(inviteContract).toContain("createHash('sha256')")
    expect(inviteContract).toContain("TEAM_INVITE_ROLES = ['owner', 'planner', 'coordinator', 'viewer']")
    expect(inviteContract).not.toContain("TEAM_INVITE_ROLES = ['admin'")
    expect(inviteApi).toContain('field: tokenHash')
    expect(inviteApi).not.toContain('field: token,')
    expect(inviteApi).toContain('rawLinkShownOnce: true')
    expect(teamManager).toContain('Raw join links are not stored')
  })

  test('requires explicit signed-in acceptance, single-use locking, audit and active wedding routing', () => {
    expect(joinPage).toContain('Scanning or opening this page does not grant access')
    expect(joinPage).toContain('Accept invitation')
    expect(joinApi).toContain('readAppSession(request)')
    expect(joinApi).toContain("code: 'SIGN_IN_REQUIRED'")
    expect(joinApi).toContain('FOR UPDATE OF wc')
    expect(joinApi).toContain("status: 'accepted'")
    expect(joinApi).toContain("action: 'team_invite.accepted'")
    expect(joinApi).toContain('setAppSessionCookie(response')
    expect(joinApi).toContain('activeWeddingId: result.invite.weddingId')
    expect(joinApi).toContain('syncPlannerMembershipBusinessLink')
  })

  test('rate-limits invitation creation and known-token acceptance attempts', () => {
    expect(inviteApi).toContain('MAX_INVITES_PER_HOUR')
    expect(inviteApi).toContain('MAX_PENDING_INVITES')
    expect(joinApi).toContain('state.attemptCount >= 10')
    expect(joinApi).toContain("reason: 'attempt_limit'")
  })
})
