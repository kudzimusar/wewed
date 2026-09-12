import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  formatPhysicalInvitationCode,
  normalizePhysicalInvitationCode,
  physicalInvitationCodeFromDestinationId,
  physicalInvitationDestinationId,
} from './physical-invitation-code'

const root = process.cwd()

function source(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

describe('bulk physical invitation access', () => {
  test('normalizes one shared printable code without ambiguous separators', () => {
    expect(normalizePhysicalInvitationCode('k7m4p-9xdt2')).toBe('K7M4P9XDT2')
    expect(formatPhysicalInvitationCode('k7m4p9xdt2')).toBe('K7M4P-9XDT2')
    expect(physicalInvitationDestinationId('K7M4P-9XDT2')).toBe(
      'print_K7M4P9XDT2',
    )
    expect(
      physicalInvitationCodeFromDestinationId('print_K7M4P9XDT2'),
    ).toBe('K7M4P9XDT2')
  })

  test('QR route grants anonymous shared access, preserves card style, and records opens', () => {
    const route = source('src/app/i/[code]/route.ts')
    expect(route).toContain("type: 'physical_invitation'")
    expect(route).toContain('scanCount: { increment: 1 }')
    expect(route).toContain('setWeddingSharedInvitationCookie')
    expect(route).toContain("destinationUrl.searchParams.set('source', 'printed-invitation')")
    expect(route).toContain("destinationUrl.searchParams.set('card', selectedCard)")
    expect(route).toContain("? 'ivory-floral-gold'")
    expect(route).not.toContain('setWeddingGuestSessionCookie')
  })

  test('invalid physical invitations clear all invitation identity families', () => {
    const route = source('src/app/i/[code]/route.ts')
    expect(route).toContain('function clearAllInvitationContext(response: NextResponse)')
    expect(route).toContain('clearWeddingSharedInvitationCookie(response)')
    expect(route).toContain('clearAllInvitationContext(response)')
  })

  test('physical invitation style stays server-authoritative through QR, destination, and secure claim', () => {
    const route = source('src/app/i/[code]/route.ts')
    const page = source('src/app/w/[slug]/page.tsx')
    const claim = source(
      'src/app/api/weddings/[slug]/physical-invitation/claim/route.ts',
    )

    expect(route).not.toContain("request.nextUrl.searchParams.get('card')")
    expect(route).toContain(
      'normalizeInvitationCardStyle(destination.wedding.invitationCardStyle)',
    )

    expect(page).toContain('const physicalInvitationStyle = isDedicatedPreviewWedding')
    expect(page).toContain(
      'normalizeInvitationCardStyle(wedding.invitationCardStyle)',
    )
    expect(page).not.toContain(
      'normalizeInvitationCardStyle(query.card || wedding.invitationCardStyle)',
    )

    expect(claim).not.toContain('body?.card')
    expect(claim).toContain(
      'normalizeInvitationCardStyle(wedding.invitationCardStyle)',
    )
    expect(claim).toContain('card: selectedCard')
  })

  test('failed private and deferred transitions clear shared physical context', () => {
    const privateRoute = source('src/app/invite/[slug]/route.ts')
    const continueRoute = source('src/app/invite/[slug]/continue/route.ts')
    const resumeRoute = source('src/app/invite/resume/route.ts')

    expect(privateRoute).toContain('clearWeddingSharedInvitationCookie(response)')
    expect(continueRoute).toContain('clearWeddingSharedInvitationCookie(response)')
    expect(resumeRoute).toContain('clearWeddingSharedInvitationCookie(response)')
    expect(resumeRoute).toContain('function recoveryRedirect(): NextResponse')
  })

  test('shared-card access stays read-only instead of impersonating a guest', () => {
    const access = source('src/lib/wedding-public-access.ts')
    expect(access).toContain('sharedInvitationAllowed')
    expect(access).toContain("type: 'physical_invitation'")
    expect(access).toContain(
      "Bulk-printed cards grant anonymous, read-only wedding-site access",
    )
    expect(access).toContain("accessKind: 'public'")
  })

  test('planner distinguishes bulk QR from personal RSVP QR and exports vector SVG', () => {
    const component = source(
      'src/components/wedding/physical-invitation-qr.tsx',
    )
    const api = source(
      'src/app/api/planner/guests/invitations/physical/route.ts',
    )
    expect(component).toContain('One clean QR for every printed invitation')
    expect(component).toContain("errorCorrectionLevel: 'H'")
    expect(component).toContain('margin: 4')
    expect(component).toContain("type: 'svg'")
    expect(api).toContain('db.guest.count')
    expect(api).toContain('scanCount')
    expect(api).toContain("type: 'physical_invitation'")
  })

  test('manual code entry accepts the shared code while preserving guest-token fallback', () => {
    const gateway = source('src/components/wedding/guest-access-gateway.tsx')
    const exchange = source(
      'src/app/api/weddings/[slug]/invitation-access/exchange/route.ts',
    )
    expect(gateway).toContain('/invitation-access/exchange?code=')
    expect(exchange).toContain('physicalInvitationDestinationId')
    expect(exchange).toContain('/guest-session/exchange?')
  })
})
