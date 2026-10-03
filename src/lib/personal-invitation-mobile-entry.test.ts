import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const source = (path: string) => readFileSync(path, 'utf8')

describe('personal invitation mobile entry', () => {
  test('Android keeps Google Play primary instead of silently falling through to the web app', () => {
    const handoff = source('src/components/wedding/invitation-app-handoff.tsx')

    expect(handoff).toContain('data-testid="android-google-play-install"')
    expect(handoff).toContain('href={installPath}')
    expect(handoff).toContain('You do not need a new invitation after installing.')
    expect(handoff).toContain('The personal invitation does not expire on a timer.')
    expect(handoff).not.toContain('window.location.replace(continueInBrowser)')
  })

  test('Android standalone/PWA entry cannot swallow the native adoption gate', () => {
    const handoff = source('src/components/wedding/invitation-app-handoff.tsx')

    expect(handoff).toContain("window.matchMedia('(display-mode: standalone)').matches && !androidClient")
    expect(handoff).toContain("const androidClient = /Android/i.test(navigator.userAgent)")
  })

  test('one shared production authority controls deferred Android continuity with an emergency kill switch', () => {
    const gate = source('src/lib/invitation-deferred-install.ts')
    const personal = source('src/app/invite/[slug]/open/page.tsx')
    const wedding = source('src/app/w/[slug]/page.tsx')
    const helper = source('src/lib/invitation-mobile-entry.ts')

    expect(gate).toContain("if (vercelEnv === 'production') return configuredFlag !== '0'")
    expect(gate).toContain("return configuredFlag === '1'")
    expect(personal).toContain('androidDeferredInvitationHandoffEnabled(wedding.id)')
    expect(wedding).toContain('androidDeferredInvitationHandoffEnabled(wedding.id)')
    expect(helper).toContain('androidDeferredInvitationHandoffEnabled(invitation.weddingId)')
  })

  test('non-installed Android guests do not mint a handoff until they press an install/open route', () => {
    const component = source('src/components/wedding/invitation-app-handoff.tsx')
    const helper = source('src/lib/invitation-mobile-entry.ts')
    const installRoute = source('src/app/invite/[slug]/install/route.ts')
    const appRoute = source('src/app/invite/[slug]/app/route.ts')

    expect(component).not.toContain('/api/invitations/install-handoff')
    expect(component).not.toContain('prepareSecureHandoff')
    expect(component).toContain('const installPath = `/invite/${encodedSlug}/install`')
    expect(component).toContain('const openAppPath = `/invite/${encodedSlug}/app`')
    expect(helper).toContain('createInvitationInstallHandoff({')
    expect(helper).toContain('Falling back to direct Google Play invitation install')
    expect(installRoute).toContain("'android-install-click'")
    expect(appRoute).toContain("'android-open-app-click'")
  })

  test('Android keeps browser continuation as a secondary option when native handoff is enabled', () => {
    const handoff = source('src/components/wedding/invitation-app-handoff.tsx')

    expect(handoff).toContain('data-testid="android-continue-in-browser"')
    expect(handoff).toContain('Continue in browser instead')
    expect(handoff).toContain('href={continueInBrowser}')
  })

  test('iOS uses only an authoritative configured distribution destination and keeps browser fallback', () => {
    const handoff = source('src/components/wedding/invitation-app-handoff.tsx')
    const distribution = source('src/lib/ios-app-distribution.ts')

    expect(handoff).toContain('data-testid="ios-install-wewed"')
    expect(handoff).toContain('href={iosDistributionUrl}')
    expect(handoff).toContain('App Store link not configured')
    expect(handoff).toContain('Continue in browser')
    expect(distribution).toContain("'apps.apple.com'")
    expect(distribution).toContain("'testflight.apple.com'")
    expect(distribution).toContain("url.protocol !== 'https:'")
  })

  test('iOS distribution is configurable only through authoritative Apple hosts', () => {
    const distribution = source('src/lib/ios-app-distribution.ts')
    const personal = source('src/components/wedding/invitation-app-handoff.tsx')
    const physical = source('src/components/wedding/physical-invitation-entry.tsx')

    expect(distribution).toContain("'apps.apple.com'")
    expect(distribution).toContain("'testflight.apple.com'")
    expect(distribution).toContain("url.protocol !== 'https:'")
    expect(personal).toContain('data-testid="ios-install-wewed"')
    expect(personal).toContain('You do not need a replacement invitation.')
    expect(physical).toContain('data-testid="physical-ios-install-wewed"')
  })

  test('Play install handoffs use a wedding-realistic production lifetime while remaining one-time', () => {
    const handoff = source('src/lib/invitation-install-handoff.ts')

    expect(handoff).toContain('const DEFAULT_HANDOFF_TTL_SECONDS = 30 * 24 * 60 * 60')
    expect(handoff).toContain('const MAX_HANDOFF_TTL_SECONDS = 90 * 24 * 60 * 60')
    expect(handoff).toContain("process.env.VERCEL_ENV === 'production'")
    expect(handoff).toContain('? DEFAULT_HANDOFF_TTL_SECONDS')
    expect(handoff).toContain('if (handoff.usedAt)')
    expect(handoff).toContain("failedResult('used'")
  })

  test('expired or reused install handoffs recover through the original invitation without Planner regeneration', () => {
    const resume = source('src/app/invite/resume/route.ts')
    const help = source('src/app/guest-access-help/page.tsx')

    expect(resume).toContain('invitation-resume-${encodeURIComponent(safeReason)}')
    expect(help).toContain('Your invitation is still valid')
    expect(help).toContain('You normally do not need the Planner to create another one.')
  })

  test('Android install clicks are recorded separately from authenticated app activation', () => {
    const helper = source('src/lib/invitation-mobile-entry.ts')
    const projection = source('src/lib/planner-invitation-projection.ts')
    const manager = source('src/components/wedding/invitation-manager.tsx')

    expect(helper).toContain("action: 'guest.native_install_clicked'")
    expect(helper).toContain("resourceType: 'guest_invitation'")
    expect(helper).toContain("source === 'android-install-click'")
    expect(projection).toContain('nativeInstallClicked')
    expect(projection).toContain('nativeInstallNotActivated')
    expect(projection).toContain('nativeInstallToActivationRate')
    expect(manager).toContain('Install clicked')
    expect(manager).toContain('Install clicked · not active')
    expect(manager).toContain('Install → active')
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


  test('QRO06: the shared printed invitation keeps Google Play primary on Android', () => {
    const entry = source('src/components/wedding/physical-invitation-entry.tsx')
    const page = source('src/app/w/[slug]/page.tsx')
    const handoff = source('src/lib/physical-invitation-install-handoff.ts')

    expect(entry).not.toContain("if (!deferredInstallEnabled) {\n        setMode('web')")
    expect(entry).toContain('data-testid="physical-android-google-play-install-fallback"')
    expect(entry).toContain('No Planner action is required.')
    expect(entry).toContain('data-testid="physical-android-continue-in-browser"')
    expect(entry).toContain("onClick={() => setMode('web')}")
    expect(page).toContain('androidDeferredInvitationHandoffEnabled(wedding.id)')
    expect(handoff).toContain('const HANDOFF_TTL_SECONDS = 30 * 24 * 60 * 60')
  })
})
