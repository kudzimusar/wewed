import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import {
  buildDigitalInvitationMessage,
  buildDigitalInvitationUrl,
  INVITATION_CARD_STYLES,
  normalizeInvitationCardStyle,
} from './digital-invitation-card'

const source = (path: string) => readFileSync(path, 'utf8')

describe('digital invitation card delivery', () => {
  test('supports three stable card styles and rejects arbitrary style input', () => {
    expect(INVITATION_CARD_STYLES.map((style) => style.id)).toEqual([
      'botanical',
      'editorial',
      'midnight',
    ])
    expect(normalizeInvitationCardStyle('editorial')).toBe('editorial')
    expect(normalizeInvitationCardStyle('unknown')).toBe('botanical')
    expect(normalizeInvitationCardStyle(null)).toBe('botanical')
  })

  test('builds a guest-specific card link and a non-forwarding share message', () => {
    const url = buildDigitalInvitationUrl({
      siteUrl: 'https://wewed.example/',
      weddingSlug: 'aurora-and-blake',
      token: 'guest token',
      style: 'midnight',
    })
    expect(url).toBe(
      'https://wewed.example/w/aurora-and-blake?rsvp=guest+token&card=midnight',
    )
    const message = buildDigitalInvitationMessage({
      guestName: 'Taylor',
      weddingTitle: 'Aurora & Blake',
      invitationUrl: url,
    })
    expect(message).toContain('private digital wedding card')
    expect(message).toContain(url)
    expect(message).toContain('Please do not forward it.')
  })

  test('stores the default design and RSVP deadline in a tracked migration', () => {
    const schema = source('prisma/schema.prisma')
    const migration = source(
      'prisma/migrations/20260804014000_digital_invitation_cards/migration.sql',
    )
    expect(schema).toContain('invitationCardStyle   String    @default("botanical")')
    expect(schema).toContain('invitationCardMessage String?')
    expect(schema).toContain('rsvpDeadline          DateTime?')
    expect(migration).toContain('Wedding_invitationCardStyle_check')
    for (const style of INVITATION_CARD_STYLES) {
      expect(migration).toContain(`'${style.id}'`)
    }
  })

  test('the invitation API produces card URLs, CSV delivery data and audited design updates', () => {
    const route = source('src/app/api/planner/guests/invitations/route.ts')
    expect(route).toContain('buildDigitalInvitationUrl')
    expect(route).toContain('buildDigitalInvitationMessage')
    expect(route).toContain('Card Style,Digital Invitation URL,Share Message')
    expect(route).toContain("action: 'wedding.invitation_card_updated'")
    expect(route).toContain('export async function PUT')
    expect(route).toContain('RSVP deadline cannot be after the wedding date.')
  })

  test('invitation credentials are never returned as a raw JSON field or stored by caches', () => {
    const route = source('src/app/api/planner/guests/invitations/route.ts')
    expect(route).toContain('function privateNoStore')
    expect(route).toContain("'Cache-Control', 'private, no-store, max-age=0'")
    expect(route).toContain("response.headers.set('Vary', 'Cookie')")
    expect(route).toContain('const missingTokens = guests.filter')
    expect(route).toContain('if (access.error) return privateNoStore(access.error)')
    expect(route).not.toContain('token: guest.rsvp?.token ?? null')
  })

  test('the shared dashboard API proxy prevents authenticated responses from shared caching', () => {
    const proxy = source('src/proxy.ts')
    expect(proxy).toContain('function privateNoStore')
    expect(proxy).toContain("'Cache-Control', 'private, no-store, max-age=0'")
    expect(proxy).toContain("response.headers.set('Vary', 'Cookie')")
    expect(proxy).toContain('return privateNoStore(NextResponse.next())')
    expect(proxy).toContain('return privateNoStore(')
  })

  test('RSVP reminder delivery embeds the same secure digital card URL and email CTA', () => {
    const delivery = source('src/lib/reminder-delivery.ts')
    expect(delivery).toContain('buildDigitalInvitationUrl')
    expect(delivery).toContain('digitalInvitationEmailHtml')
    expect(delivery).toContain('Open card &amp; RSVP')
    expect(delivery).toContain('weddingSlug: wedding.slug')
    expect(delivery).not.toContain('`${siteUrl}/?rsvp=')
  })

  test('QR exchange preserves the selected card but strips the RSVP credential', () => {
    const page = source('src/app/w/[slug]/page.tsx')
    const exchange = source(
      'src/app/api/weddings/[slug]/guest-session/exchange/route.ts',
    )
    const dialog = source(
      'src/components/wedding/invitation-rsvp-dialog.tsx',
    )
    expect(page).toContain("exchangeQuery.set('card', normalizeInvitationCardStyle(query.card))")
    expect(exchange).toContain("invitation: '1'")
    expect(exchange).toContain('card: requestedStyle')
    expect(exchange).toContain('relativeRedirect')
    expect(dialog).toContain("view === 'card'")
    expect(dialog).toContain('DigitalInvitationCard')
    expect(dialog).toContain('RSVP now')
    expect(dialog).toContain("url.searchParams.delete('card')")
  })

  test('couple and planner invitation surfaces preview, share, export and rotate cards', () => {
    const manager = source('src/components/wedding/invitation-manager.tsx')
    expect(manager).toContain('INVITATION_CARD_STYLES.map')
    expect(manager).toContain('Save card design')
    expect(manager).toContain('Copy message')
    expect(manager).toContain('Share card')
    expect(manager).toContain('Invitation CSV')
    expect(manager).toContain('Rotate')
    expect(manager).toContain('navigator.share')
  })

  test('generic QR and share surfaces never expose a flagship or private guest credential', () => {
    const gateway = source('src/components/wedding/qr-gateway.tsx')
    const shareSection = source('src/components/wedding/share-section.tsx')
    const telegram = source('src/app/api/telegram/route.ts')
    const access = source('src/lib/wedding-public-access.ts')

    for (const implementation of [gateway, shareSection, telegram]) {
      expect(implementation).not.toContain('Charity & Kudzie')
      expect(implementation).not.toContain('Imba Manor')
      expect(implementation).not.toContain('23.12.26')
    }
    expect(gateway).toContain('private-wedding-qr-guard')
    expect(shareSection).toContain('private-share-guard')
    expect(telegram).toContain('Wedding invitations are guest-specific')
    expect(access).toContain("'wedding_member'")
    expect(access).toContain('session.activeWeddingId !== wedding.id')
  })
})
