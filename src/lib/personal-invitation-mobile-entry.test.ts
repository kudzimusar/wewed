import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const source = (path: string) => readFileSync(path, 'utf8')

describe('personal invitation mobile entry', () => {
  test('a valid Android invitation falls through to the secure browser card when native handoff is disabled', () => {
    const handoff = source('src/components/wedding/invitation-app-handoff.tsx')

    expect(handoff).toContain('if (!deferredInstallEnabled) {')
    expect(handoff).toContain('window.location.replace(continueInBrowser)')
    expect(handoff).not.toContain(
      'Secure Android invitation handoff is not available yet. Your private invitation remains locked until the production Wewed release is available.',
    )
  })

  test('Android keeps browser continuation as a secondary option when native handoff is enabled', () => {
    const handoff = source('src/components/wedding/invitation-app-handoff.tsx')

    expect(handoff).toContain('data-testid="android-continue-in-browser"')
    expect(handoff).toContain('Continue in browser instead')
    expect(handoff).toContain('href={continueInBrowser}')
  })

  test('iOS fallback does not invent an App Store destination or claim the app is coming soon', () => {
    const handoff = source('src/components/wedding/invitation-app-handoff.tsx')

    expect(handoff).toContain('A direct App Store handoff is not configured for this invitation yet.')
    expect(handoff).toContain('Continue in browser')
    expect(handoff).not.toContain('Wewed for iPhone is coming soon')
    expect(handoff).not.toContain('APP_STORE_BADGE')
    expect(handoff).not.toContain('apps.apple.com/')
  })

  test('browser continuation revalidates the pending invitation and enters invitation mode without a raw RSVP credential', () => {
    const continuation = source('src/app/invite/[slug]/continue/route.ts')

    expect(continuation).toContain('resolvePersonalInvitation({')
    expect(continuation).toContain('token: pending.rsvpToken')
    expect(continuation).toContain("invitation: '1'")
    expect(continuation).toContain('setWeddingGuestSessionCookie')
    expect(continuation).toContain('clearPendingInvitationCookie')
    expect(continuation).not.toContain("searchParams.get('rsvp')")
  })

  test('the wedding record, not the shared URL card parameter, remains authoritative for Ivory Floral Gold', () => {
    const page = source('src/app/w/[slug]/page.tsx')
    const renderer = source(
      'src/components/wedding/invitation-experience/premium-invitation-experience.tsx',
    )
    const registry = source('src/lib/digital-invitation-card.ts')

    expect(page).toContain('normalizeInvitationCardStyle(wedding.invitationCardStyle)')
    expect(renderer).toContain('IvoryFloralGoldTriFold')
    expect(renderer).toContain("style === 'ivory-floral-gold'")
    expect(registry).toContain("id: 'ivory-floral-gold'")
    expect(registry).toContain("motion: 'tri-fold'")
  })

  test('web Guest Pass is backed by the same WW2 Wedding Day authority as native', () => {
    const dialog = source(
      'src/components/wedding/invitation-experience/wedding-guest-pass-dialog.tsx',
    )
    const route = source('src/app/api/wedding-day/pass/route.ts')

    expect(dialog).toContain("fetch('/api/wedding-day/pass'")
    expect(dialog).toContain('data-pass-authority="ww2"')
    expect(dialog).toContain('wedding-pass-ww2-qr')
    expect(dialog).toContain("data.token.startsWith('WW2.')")
    expect(dialog).not.toContain('/guest-session')

    expect(route).toContain('publicKeyDerBase64: passKey.publicKeyDerBase64')
    expect(route).toContain('token: credential.token')
  })
})
