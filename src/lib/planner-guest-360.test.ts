import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const projection = readFileSync('src/lib/planner-guest-360.ts', 'utf8')
const route = readFileSync('src/app/api/planner/guests/[id]/360/route.ts', 'utf8')
const dialog = readFileSync(
  'src/components/wedding/planner/planner-guest-360-dialog.tsx',
  'utf8',
)
const register = readFileSync(
  'src/components/wedding/planner/modules/planner-guests-module.tsx',
  'utf8',
)
const manager = readFileSync('src/components/wedding/invitation-manager.tsx', 'utf8')
const schema = readFileSync('prisma/schema.prisma', 'utf8')

describe('Planner Guest 360 projection', () => {
  test('reuses the canonical invitation/native/Pass projection instead of recalculating it', () => {
    expect(projection).toContain('loadPlannerInvitationProjection(weddingId, siteUrl)')
    expect(projection).toContain('invitation.passState')
    expect(projection).toContain('invitation.nativeActivated')
    expect(projection).toContain('invitation.nativePlatforms')
    expect(projection).toContain('invitation.deliveryStatus')
    expect(projection).not.toContain('resolveWeddingPassCredentialAdminState')
    expect(projection).not.toContain('buildDigitalInvitationMessage')
  })

  test('contains the full per-person operational chain', () => {
    for (const marker of [
      'identity:',
      'contact:',
      'invitation:',
      'rsvp:',
      'nativeActivation:',
      'seating:',
      'weddingPass:',
      'checkIn:',
    ]) {
      expect(projection).toContain(marker)
    }
    expect(projection).toContain('serviceProvider:')
    expect(projection).toContain('db.weddingCheckIn.findMany')
    expect(projection).toContain("eventKey: 'wedding-day'")
  })

  test('does not create a second source of truth', () => {
    expect(schema).not.toContain('model Guest360')
    expect(schema).not.toContain('model GuestOperationalView')
    expect(projection).not.toContain('.create(')
    expect(projection).not.toContain('.update(')
    expect(projection).not.toContain('.upsert(')
  })

  test('endpoint is wedding-scoped and permission protected', () => {
    expect(route).toContain("requireWeddingPermission(request, 'guests.view')")
    expect(route).toContain('access.context.weddingId')
    expect(route).toContain('Cache-Control')
    expect(route).toContain('private, no-store')
  })

  test('shared dialog renders identity through Gate arrival without client-side state invention', () => {
    expect(dialog).toContain('data-testid="planner-guest-360"')
    expect(dialog).toContain('Identity & classification')
    expect(dialog).toContain('Contact')
    expect(dialog).toContain('Invitation')
    expect(dialog).toContain('RSVP')
    expect(dialog).toContain('Native activation')
    expect(dialog).toContain('Seating')
    expect(dialog).toContain('Wedding Pass')
    expect(dialog).toContain('Gate & arrival')
    expect(dialog).toContain('data.weddingPass.state')
    expect(dialog).toContain('data.nativeActivation.active')
  })

  test('the same Guest 360 component is available from both Planner Guest surfaces', () => {
    expect(register).toContain('PlannerGuest360Dialog')
    expect(register).toContain('guestId={guest.id}')
    expect(manager).toContain('PlannerGuest360Dialog')
    expect(manager).toContain('guestId={row.id}')
  })

  test('service-team classification is a relationship over the same canonical Guest', () => {
    expect(projection).toContain('db.serviceTeamMember.findFirst')
    expect(projection).toContain('guestId, weddingId')
    expect(projection).toContain('function: serviceMembership.function')
    expect(projection).toContain('approved: Boolean(serviceMembership.approvedAt)')
  })
})
