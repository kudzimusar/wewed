import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { INVITATION_CARD_STYLES } from './digital-invitation-card'

const source = (path: string) => readFileSync(path, 'utf8')

describe('premium digital invitation experience', () => {
  test('Card 1 is a premium physical-stationery tri-fold with the approved closed and revealed composition', () => {
    const shell = source(
      'src/components/wedding/invitation-experience/premium-invitation-experience.tsx',
    )
    const experience = source(
      'src/components/wedding/invitation-experience/ivory-floral-gold-trifold.tsx',
    )
    expect(shell).toContain('IvoryFloralGoldTriFold')
    expect(experience).toContain('data-testid="invitation-trifold"')
    expect(experience).toContain('data-card-object="physical-stationery"')
    expect(experience).toContain('data-testid="invitation-panel-left"')
    expect(experience).toContain('data-testid="invitation-panel-centre"')
    expect(experience).toContain('data-testid="invitation-panel-right"')
    expect(experience).toContain('data-testid="invitation-closed-cover"')
    expect(experience).toContain('data-testid="ivory-paper-grain"')
    expect(experience).toContain('A special invitation awaits')
    expect(experience).toContain('Tap to open')
    expect(experience).toContain('Together with our families')
    expect(experience).toContain('as we celebrate our marriage.')
    expect(experience).toContain('data-testid="invitation-rsvp-deadline"')
    expect(experience).toContain('RSVP by {formatDate(data.rsvpDeadline)}')
    expect(experience).not.toContain('Together with their families')
    expect(experience).not.toContain('celebrate their wedding')
    expect(experience).not.toContain('Our journey')
    expect(experience).not.toContain('A brighter tomorrow')
  })

  test('motion behaves like a hinged physical card, is focus-safe, and honours reduced motion without video', () => {
    const shell = source(
      'src/components/wedding/invitation-experience/premium-invitation-experience.tsx',
    )
    const experience = source(
      'src/components/wedding/invitation-experience/ivory-floral-gold-trifold.tsx',
    )
    expect(shell).toContain("type MotionState = 'closed' | 'opening' | 'open'")
    expect(shell).toContain("window.matchMedia('(prefers-reduced-motion: reduce)')")
    expect(shell).toContain('continueButtonRef')
    expect(shell).toContain('continueButtonRef.current?.focus()')
    expect(experience).toContain('data-testid="invitation-open-button"')
    expect(experience).toContain('[perspective:1800px]')
    expect(experience).toContain('[transform-origin:100%_50%]')
    expect(experience).toContain('[transform-origin:0%_50%]')
    expect(experience).toContain("translateX(-30%) rotateY(-52deg)")
    expect(experience).toContain("translateX(30%) rotateY(52deg)")
    expect(experience).toContain('shadow-[0_30px_65px_rgba(27,18,10,.38),0_5px_16px_rgba(27,18,10,.22)]')
    expect(experience).not.toContain('<video')
    expect(experience).not.toContain('autoplay')
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
