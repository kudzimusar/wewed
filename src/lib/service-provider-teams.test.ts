import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const schema = readFileSync('prisma/schema.prisma', 'utf8')
const migration = readFileSync(
  'prisma/migrations/20261001013000_service_provider_teams/migration.sql',
  'utf8',
)
const guestOps = readFileSync('src/lib/planner-guest-operations.ts', 'utf8')
const authority = readFileSync('src/lib/service-team-authority.ts', 'utf8')
const operations = readFileSync('src/lib/service-team-operations.ts', 'utf8')
const vendorRoster = readFileSync('src/app/api/vendor/service-teams/[id]/roster/route.ts', 'utf8')
const vendorMember = readFileSync('src/app/api/vendor/service-teams/[id]/roster/[memberId]/route.ts', 'utf8')
const rsvp = readFileSync('src/lib/guest-rsvp-mutation.ts', 'utf8')
const pass = readFileSync('src/lib/wedding-day.ts', 'utf8')
const manifest = readFileSync('src/lib/wedding-day-manifest.ts', 'utf8')
const guestDay = readFileSync('src/app/api/wedding-day/guest/route.ts', 'utf8')
const plannerProjection = readFileSync('src/lib/planner-invitation-projection.ts', 'utf8')
const convergenceWorkflow = readFileSync('.github/workflows/wedding-pass-convergence-ci.yml', 'utf8')
const plannerPanel = readFileSync(
  'src/components/wedding/planner/planner-service-teams-panel.tsx',
  'utf8',
)
const vendorPage = readFileSync('src/app/vendor/service-teams/page.tsx', 'utf8')

describe('service-provider team admission authority', () => {
  test('service teams bind Vendor/ServiceEngagement to named canonical Guest identities', () => {
    expect(schema).toContain('model ServiceTeam')
    expect(schema).toContain('serviceEngagement ServiceEngagement')
    expect(schema).toContain('model ServiceTeamMember')
    expect(schema).toContain('guest       Guest')
    expect(schema).toContain('@@unique([weddingId, guestId])')
    expect(migration).toContain('ServiceTeamMember_weddingId_guestId_key')
    expect(guestOps).toContain("? 'service_provider'")
    expect(guestOps).toContain("? 'operational' as const")
    expect(guestOps).toContain('tx.serviceTeamMember.create')
  })

  test('allowed crew is locked transactionally before the Guest is created', () => {
    expect(authority).toContain('FOR UPDATE')
    expect(authority).toContain('registered >= team.allowedCrew')
    expect(authority).toContain('SERVICE_TEAM_CREW_LIMIT_EXCEEDED')
    const lockIndex = guestOps.indexOf('lockServiceTeamRosterSlot(tx')
    const createIndex = guestOps.indexOf('const created = await tx.guest.create')
    expect(lockIndex).toBeGreaterThan(0)
    expect(createIndex).toBeGreaterThan(lockIndex)
  })

  test('provider leader authority is limited to one explicit team and engagement grant', () => {
    expect(authority).toContain('team.leaderUserId !== session.userId')
    expect(authority).toContain("grant.workspaceKind === 'vendor'")
    expect(authority).toContain('grant.serviceEngagementIds.includes(team.serviceEngagementId)')
    expect(vendorPage).toContain('Manage only the wedding service teams where you are the designated leader.')
    expect(vendorPage).not.toContain('/planner/guests')
  })

  test('leader roster is editable only while draft; Planner owns approve/reopen', () => {
    expect(vendorRoster).toContain("access.team.rosterStatus !== 'draft'")
    expect(vendorMember.match(/access\.team\.rosterStatus !== 'draft'/g)?.length).toBe(2)
    expect(operations).toContain("team.rosterStatus !== 'draft'")
    expect(operations).toContain("team.rosterStatus !== 'submitted'")
    expect(plannerPanel).toContain("'approve'")
    expect(plannerPanel).toContain("'reopen'")
  })

  test('professional attendance cannot carry plus-one or child semantics', () => {
    expect(rsvp).toContain('guest.serviceProviderParticipant')
    expect(rsvp).toContain('SERVICE_PROVIDER_HOUSEHOLD_NOT_ALLOWED')
    expect(rsvp).toContain('data.plusOne = false')
    expect(rsvp).toContain('data.kidsAttending = false')
    expect(pass).toContain('!guest.serviceProviderParticipant')
    expect(pass).toContain('guest.plusOne')
    expect(pass).toContain('guest.kidsAttending')
    expect(manifest).toContain('!row.serviceProviderParticipant')
    expect(manifest).toContain('row.plusOne')
    expect(manifest).toContain('row.kidsAttending')
  })

  test('Planner approval is authoritative for Pass issuance and Gate admission', () => {
    expect(pass).toContain('guest.serviceProviderParticipant && !guest.serviceProviderApproved')
    expect(pass).toContain('SERVICE_PROVIDER_NOT_APPROVED')
    expect(pass).toContain('context.serviceProviderParticipant && !context.serviceProviderApproved')
    expect(operations).toContain('admissionApproved: Boolean(member.approvedAt)')
    expect(manifest).toContain('credential.serviceProviderApproved')
    expect(manifest).toContain('!credential.serviceProviderParticipant || credential.serviceProviderApproved')
  })

  test('provider classification cannot be toggled by generic Guest writes and survives stale role text', () => {
    expect(guestOps).toContain('Service providers must be added through the service-team roster.')
    expect(guestOps).toContain('Service-provider role is managed through the service-team roster.')
    expect(guestOps).toContain('Service-provider attendance allocation is managed through the service-team roster.')
    expect(rsvp).toContain('EXISTS (')
    expect(rsvp).toContain('FROM public."ServiceTeamMember" stm')
    expect(rsvp).toContain('AS "serviceProviderParticipant"')
    expect(pass).toContain('AS "serviceProviderParticipant"')
    expect(manifest).toContain('AS "serviceProviderParticipant"')
    expect(plannerProjection).toContain('guest.serviceTeamMemberships.length > 0')
    expect(plannerProjection).toContain('admissionApproved: serviceProviderParticipant')
    expect(operations).toContain("participantType: 'service_provider'")
  })

  test('Guest Wedding Day household follows the same provider/named-adult/children authority', () => {
    expect(guestDay).toContain('loadWeddingAdditionalAdultPolicy')
    expect(guestDay.match(/!context\.serviceProviderParticipant/g)?.length).toBe(2)
    expect(guestDay).toContain("additionalAdultPolicy !== 'named_guests_only'")
    expect(guestDay).toContain("childrenPolicy !== 'adults_only'")
  })

  test('legacy provider roster adoption preserves canonical Guest identity and removal preserves invitation history', () => {
    expect(operations).toContain('service_team.member_adopted')
    expect(operations).toContain('legacyProvider.id')
    expect(operations).toContain("attendanceAllocation: 'operational'")
    expect(vendorMember).toContain("action: 'service_team.member_adopted'")
    expect(vendorMember).toContain('preservedGuest: true')
    expect(vendorMember).toContain('tx.serviceTeamMember.delete')
  })

  test('Wedding Pass convergence CI watches provider authority and compatibility migrations', () => {
    for (const marker of [
      "src/lib/service-team-*.ts",
      "src/lib/service-provider-teams*.ts",
      "src/app/api/planner/service-teams/**",
      "src/app/api/vendor/service-teams/**",
      "prisma/migrations/20260930103000_guest_native_presence/**",
      "prisma/migrations/20261001003000_guest_attendance_allocation_capacity/**",
      "prisma/migrations/20261001013000_service_provider_teams/**",
    ]) {
      expect(convergenceWorkflow).toContain(marker)
    }
  })

  test('operations projection exposes the required event-day roll call', () => {
    for (const marker of [
      'allowedCrew',
      'registered:',
      'submitted:',
      'approved:',
      'confirmed:',
      'appActive:',
      'passReady:',
      'arrived:',
      'missing:',
    ]) {
      expect(operations).toContain(marker)
    }
    for (const marker of [
      'Allowed crew',
      'Submitted',
      'Approved',
      'App active',
      'Pass ready',
      'Arrived / missing',
    ]) {
      expect(plannerPanel).toContain(marker)
    }
  })

  test('service-team forms survive async saves and refresh after vendor inline sign-in', () => {
    expect(plannerPanel.match(/const formElement = event\.currentTarget/g)?.length).toBeGreaterThanOrEqual(2)
    expect(plannerPanel).not.toContain('event.currentTarget.reset()')
    expect(vendorPage).toContain('const formElement = event.currentTarget')
    expect(vendorPage).not.toContain('event.currentTarget.reset()')
    expect(vendorPage).toContain('ADMIN_AUTH_EVENT')
    expect(vendorPage).toContain('if (authorized) void load()')
  })

  test('duplicate teams are a conflict and crew function edits keep canonical Guest roleDetail aligned', () => {
    expect(operations).toContain('SERVICE_TEAM_ALREADY_EXISTS')
    expect(operations).toContain("error.code === 'P2002'")
    expect(vendorMember).toContain('roleDetail: serviceFunction')
    expect(vendorMember).toContain('data: { function: serviceFunction }')
  })

  test('service-provider Pass remains the existing WW2 credential, not a second pass system', () => {
    expect(schema.match(/model WeddingPassCredential/g)?.length).toBe(1)
    expect(operations).toContain('resolveWeddingPassCredentialAdminState')
    expect(pass).toContain('WW2_VERSION')
    expect(manifest).toContain('WW2_VERSION')
    expect(schema).not.toContain('ServiceProviderPass')
  })
})
