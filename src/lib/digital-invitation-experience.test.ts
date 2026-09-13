import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { INVITATION_CARD_STYLES } from './digital-invitation-card'

const source = (path: string) => readFileSync(path, 'utf8')

describe('premium digital invitation experience', () => {
  test('Card 1 is a premium physical-stationery invitation with the approved closed, opened and details composition', () => {
    const shell = source(
      'src/components/wedding/invitation-experience/premium-invitation-experience.tsx',
    )
    const experience = source(
      'src/components/wedding/invitation-experience/ivory-floral-gold-trifold.tsx',
    )
    expect(shell).toContain('IvoryFloralGoldTriFold')
    expect(experience).toContain('data-testid="invitation-trifold"')
    expect(experience).toContain('data-card-object="physical-stationery"')
    expect(experience).toContain('data-testid="invitation-panel-centre"')
    expect(experience).toContain('data-testid="invitation-closed-cover"')
    expect(experience).toContain('data-testid="invitation-interactive-details"')
    expect(experience).toContain('data-artwork-engine="approved-pixels"')
    expect(experience).not.toMatch(/PaperGrain|FloralSpray|SculptedVeil/)
    expect(experience).toContain('A special invitation awaits')
    expect(experience).toContain('Tap to open')
    expect(experience).toContain('Opening your invitation…')
    expect(experience).toContain('as we celebrate our marriage.')
    expect(experience).toContain('data-testid="invitation-rsvp-deadline"')
    expect(experience).toContain('RSVP by {formatDate(data.rsvpDeadline)}')
    expect(experience).not.toContain('Together with their families')
    expect(experience).not.toContain('celebrate their wedding')
    expect(experience).not.toContain('Our journey')
    expect(experience).not.toContain('A brighter tomorrow')
  })

  test('opening behaves like one continuous hinged physical object and settles to a fold-free full invitation', () => {
    const shell = source(
      'src/components/wedding/invitation-experience/premium-invitation-experience.tsx',
    )
    const experience = source(
      'src/components/wedding/invitation-experience/ivory-floral-gold-trifold.tsx',
    )
    expect(shell).toContain("type MotionState = 'closed' | 'opening' | 'open'")
    expect(shell).toContain("window.matchMedia('(prefers-reduced-motion: reduce)')")
    expect(experience).toContain("type IvoryInvitationView = 'closed' | 'opening' | 'open' | 'details'")
    expect(experience).toContain('data-testid="invitation-open-button"')
    const css = source('src/components/wedding/invitation-experience/ivory-floral-gold.css').replace(/\s+/g, '')
    expect(css).toContain('perspective:1900px')
    expect(css).toContain('rotateY(-82deg)')
    expect(css).toContain('rotateY(82deg)')
    expect(css).toContain('aspect-ratio:9/19.5')
    expect(experience).not.toContain('<video')
    expect(experience).not.toContain('autoplay')
  })

  test('the interactive invitation surface connects guest actions instead of becoming a decorative dead end', () => {
    const experience = source(
      'src/components/wedding/invitation-experience/ivory-floral-gold-trifold.tsx',
    )
    const contributions = source(
      'src/components/wedding/invitation-contribution-navigator.tsx',
    )
    const layout = source('src/app/layout.tsx')
    expect(experience).toContain('data-testid="invitation-details-button"')
    expect(experience).toContain("hit('rsvp'")
    expect(experience).toContain("hit('calendar'")
    expect(experience).toContain("hit('venue'")
    expect(experience).toContain("hit('registry'")
    expect(experience).toContain("hit('note'")
    expect(experience).toContain("window.dispatchEvent(new CustomEvent('wewed:open-premium-rsvp'))")
    expect(experience).toContain("window.dispatchEvent(new CustomEvent('wewed:open-contributions'))")
    expect(experience).toContain("type: 'text/calendar;charset=utf-8'")
    expect(experience).toContain('https://www.google.com/maps/search/?api=1&query=')
    expect(experience).not.toContain('ivory-unconfigured')
    expect(experience).not.toContain('registryAvailable')
    expect(contributions).toContain('?site=1#registry')
    expect(contributions).toContain('wewed:skip-invitation-once:')
    expect(contributions).toContain('#registry')
    expect(layout).toContain('<InvitationContributionNavigator />')
    expect(experience).toContain('Back to Wewed Couple Site')
    expect(experience).toContain('window.location.assign(window.location.pathname)')
    expect(experience).not.toContain("document.getElementById('wedding-details')")
  })

  test('the preview-only UAT route uses the approved Charity and Kudzie facts without inventing a ceremony time', () => {
    const page = source('src/app/uat/invitation/ivory-floral-gold/page.tsx')
    const preview = source('src/app/uat/invitation/ivory-floral-gold/preview.tsx')
    expect(page).toContain("process.env.VERCEL_ENV === 'production'")
    expect(preview).toContain('Charity & Kudzie')
    expect(preview).toContain('2026-12-23T00:00:00.000Z')
    expect(preview).toContain('Imba Manor')
    expect(preview).toContain('1 Worplestone Way')
    expect(preview).toContain('Glen Lorne, Harare')
    expect(preview).toContain('Zimbabwe')
    expect(preview).not.toMatch(/4:00|6:00|18:00|16:00/)
  })

  test('the physical-card reveal does not leak Ivory styling into other themes', () => {
    const shell = source(
      'src/components/wedding/invitation-experience/premium-invitation-experience.tsx',
    )
    const experience = source(
      'src/components/wedding/invitation-experience/ivory-floral-gold-trifold.tsx',
    )
    expect(experience).not.toContain('<div className="sr-only">')
    expect(shell).toContain("style={isIvoryBenchmark ? undefined : { background: palette.primary, color: palette.paper }}")
  })

  test('the engine supports multiple reusable motion families rather than one hard-coded card', () => {
    const motions = new Set(INVITATION_CARD_STYLES.map((style) => style.motion))
    expect(motions.has('tri-fold')).toBe(true)
    expect(motions.has('envelope-letter')).toBe(true)
    expect(motions.has('gate-fold')).toBe(true)
    expect(motions.has('book-open')).toBe(true)
    expect(motions.has('single-card-lift')).toBe(true)
    expect(motions.has('floral-reveal')).toBe(true)
    expect(motions.has('sleeve-pull')).toBe(true)
  })

  test('Planner renders a compact library and only one interactive preview surface', () => {
    const manager = source('src/components/wedding/invitation-manager.tsx')
    const studio = source(
      'src/components/wedding/invitation-experience/premium-invitation-studio.tsx',
    )
    expect(manager).toContain('PremiumInvitationStudio')
    expect(manager).not.toContain("guestName: 'Your invited guest'")
    expect(studio).toContain('INVITATION_CARD_STYLES.map')
    expect(studio).toContain('data-testid="invitation-preview-frame"')
    expect(studio).toContain('Preview guest')
    expect(studio).toContain('Reduced motion')
    expect(studio).toContain('Mobile')
    expect(studio).toContain('Desktop')
  })

  test('personal invitations show the premium experience only after scoped guest access and carry their palette into details', () => {
    const page = source('src/app/w/[slug]/page.tsx')
    const home = source('src/components/wedding/wedding-home.tsx')
    const themeApplier = source('src/components/wedding/theme-applier.tsx')
    expect(page).toContain("query.invitation === '1' && resolution.accessKind === 'invited_guest'")
    expect(home).toContain("accessKind === 'invited_guest'")
    expect(home).toContain('personalizeFromGuestSession')
    expect(home).toContain('PremiumInvitationRsvpDialog')
    expect(home).toContain('data-personal-invitation')
    expect(home).toContain('<ThemeApplier invitationCardStyle={showPersonalInvitation ? invitationCardStyle : null} />')
    expect(themeApplier).toContain('getInvitationCardStyleDefinition')
    expect(themeApplier).toContain('invitationPalette?.primary')
    expect(themeApplier).toContain('invitationPalette?.paper')
  })

  test('guest personalisation is loaded from the secure guest session and never from URL identity fields', () => {
    const experience = source(
      'src/components/wedding/invitation-experience/premium-invitation-experience.tsx',
    )
    expect(experience).toContain('/guest-session')
    expect(experience).toContain('guestName: payload.guest!.name')
    expect(experience).not.toContain('searchParams.get(\'guest\')')
    expect(experience).not.toContain('searchParams.get(\'email\')')
  })

  test('pending invitation validation follows the premium registry instead of a legacy three-style allowlist', () => {
    const pending = source('src/lib/pending-invitation.ts')
    expect(pending).toContain('INVITATION_CARD_STYLES')
    expect(pending).toContain('INVITATION_CARD_STYLE_IDS.has(payload.card)')
    expect(pending).not.toContain("payload.card !== 'botanical'")
    expect(pending).not.toContain("payload.card !== 'editorial'")
    expect(pending).not.toContain("payload.card !== 'midnight'")
  })

  test('personal RSVP remains guest-session scoped and physical invitation identity stays separate', () => {
    const premiumRsvp = source(
      'src/components/wedding/invitation-experience/premium-invitation-rsvp-dialog.tsx',
    )
    const physical = source('src/app/i/[code]/route.ts')
    expect(premiumRsvp).toContain('/guest-session')
    expect(premiumRsvp).toContain("method: 'PUT'")
    expect(premiumRsvp).not.toContain('rsvpToken')
    expect(physical).toContain('setWeddingSharedInvitationCookie')
    expect(physical).not.toContain('setWeddingGuestSessionCookie')
    expect(physical).not.toContain('wewed:open-premium-rsvp')
  })
})

describe('approved Ivory artwork provenance', () => {
  test('all four approved binaries and canonical dimensions are locked', async () => {
    const { createHash } = await import('node:crypto')
    const manifest = JSON.parse(source('public/invitation-art/ivory/manifest.json'))
    expect(manifest.canvas).toEqual([1080, 2340])
    for (const state of ['closed','opening','open','details']) {
      const bytes=readFileSync(`public/invitation-art/ivory/reference/${state}.png`)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(manifest.sources[state].sha256)
      const sharp=(await import('sharp')).default
      const meta=await sharp(`public/invitation-art/ivory/${state}-master.webp`).metadata()
      expect([meta.width,meta.height]).toEqual([1080,2340])
    }
  })
})