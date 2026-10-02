import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const source = (path: string) => readFileSync(path, 'utf8')

describe('personal invitation mobile entry', () => {
  test('Android keeps Google Play primary even when secure deferred continuity is disabled', () => {
    const handoff = source('src/components/wedding/invitation-app-handoff.tsx')

    expect(handoff).toContain('data-testid="android-google-play-install-fallback"')
    expect(handoff).toContain('href={PLAY_STORE_URL}')
    expect(handoff).toContain('You do not need a new link from the Planner.')
    expect(handoff).not.toContain('window.location.replace(continueInBrowser)')
  })

  test('Android standalone/PWA entry cannot swallow the native adoption gate', () => {
    const handoff = source('src/components/wedding/invitation-app-handoff.tsx')

    expect(handoff).toContain("window.matchMedia('(display-mode: standalone)').matches && !androidClient")
    expect(handoff).toContain("const androidClient = /Android/i.test(navigator.userAgent)")
  })

  test('production enables secure Android install continuity by default with an emergency kill switch', () => {
    const page = source('src/app/invite/[slug]/open/page.tsx')

    expect(page).toContain("process.env.VERCEL_ENV === 'production'")
    expect(page).toContain("process.env.ANDROID_DEFERRED_INVITATION_HANDOFF !== '0'")
    expect(page).toContain('productionDeferredInstallEnabled')
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

  test('Play install handoffs use a wedding-realistic production lifetime while remaining one-time', () => {
    const handoff = source('src/lib/invitation-install-handoff.ts')

    expect(handoff).toContain('const DEFAULT_HANDOFF_TTL_SECONDS = 30 * 24 * 60 * 60')
    expect(handoff).toContain('const MAX_HANDOFF_TTL_SECONDS = 90 * 24 * 60 * 60')
    expect(handoff).toContain("process.env.VERCEL_ENV === 'production'")
    expect(handoff).toContain('? DEFAULT_HANDOFF_TTL_SECONDS')
    expect(handoff).toContain('if (handoff.usedAt)')
    expect(handoff).toContain("reason: 'used'")
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

  test('answered invited guests have a Guest Session wedding-day transport independent of admission QR eligibility', () => {
    const route = source('src/app/api/wedding-day/guest/route.ts')

    expect(route).toContain('readWeddingDayGuestContext(request)')
    expect(route).toContain('FROM public."ProgrammeItem"')
    expect(route).toContain("attendeeKey: 'primary'")
    expect(route).toContain('loadPublishedAnnouncements(context.weddingId')
    expect(route).not.toContain('ATTENDANCE_REQUIRED')
    expect(route).not.toContain('ATTENDANCE_DECLINED')
  })


  test('QRO06: the shared printed invitation also continues in the browser on Android', () => {
    const entry = source('src/components/wedding/physical-invitation-entry.tsx')

    // No deferred transport: straight to the verified browser claim, never a locked dead end.
    expect(entry).toContain("if (!deferredInstallEnabled) {\n        setMode('web')")
    expect(entry).not.toContain('Your private invitation remains locked')
    // With the transport: Open/Get Wewed stays primary, browser continuation stays available.
    expect(entry).toContain('data-testid="physical-android-continue-in-browser"')
    expect(entry).toContain("onClick={() => setMode('web')}")
    expect(entry).toContain('Continue in browser instead')
  })
})
