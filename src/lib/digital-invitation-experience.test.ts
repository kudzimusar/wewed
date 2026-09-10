import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { INVITATION_CARD_STYLES } from './digital-invitation-card'

const source = (path: string) => readFileSync(path, 'utf8')

describe('premium digital invitation experience', () => {
  test('Card 1 is implemented as a real interactive tri-fold with correct marriage wording and RSVP deadline support', () => {
    const experience = source(
      'src/components/wedding/invitation-experience/premium-invitation-experience.tsx',
    )
    expect(experience).toContain('data-testid="invitation-trifold"')
    expect(experience).toContain('data-testid="invitation-panel-left"')
    expect(experience).toContain('data-testid="invitation-panel-centre"')
    expect(experience).toContain('data-testid="invitation-panel-right"')
    expect(experience).toContain('Together with our families')
    expect(experience).toContain('as we celebrate our marriage.')
    expect(experience).toContain('data-testid="invitation-rsvp-deadline"')
    expect(experience).toContain('RSVP by {formatDate(data.rsvpDeadline)}')
    expect(experience).not.toContain('Together with their families')
    expect(experience).not.toContain('celebrate their wedding')
  })

  test('motion is interactive, focus-safe, and honours reduced-motion users without video', () => {
    const experience = source(
      'src/components/wedding/invitation-experience/premium-invitation-experience.tsx',
    )
    expect(experience).toContain("type MotionState = 'closed' | 'opening' | 'open'")
    expect(experience).toContain("window.matchMedia('(prefers-reduced-motion: reduce)')")
    expect(experience).toContain('data-testid="invitation-open-button"')
    expect(experience).toContain('continueButtonRef')
    expect(experience).toContain('continueButtonRef.current?.focus()')
    expect(experience).toContain("motionState !== 'open'")
    expect(experience).toContain('[perspective:1800px]')
    expect(experience).toContain('rotateY(168deg)')
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