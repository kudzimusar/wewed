import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const route = readFileSync('src/app/api/wedding-day/pass/route.ts', 'utf8')
const authority = readFileSync('src/lib/wedding-day.ts', 'utf8')
const web = readFileSync(
  'src/components/wedding/invitation-experience/wedding-guest-pass-dialog.tsx',
  'utf8',
)
const android = readFileSync(
  'apps/android/app/src/main/java/pro/wewed/app/ui/invitation/LiveGuestShell.kt',
  'utf8',
)
const ios = readFileSync(
  'apps/ios/Wewed/Views/Invitation/LiveGuestShellView.swift',
  'utf8',
)

describe('locked Pre-Pass experience', () => {
  test('unavailable Pass responses expose safe identity context but no credential', () => {
    expect(authority).toContain('interface WeddingPassGuestContext')
    expect(authority).toContain('venueCity')
    expect(authority).toContain('new WeddingPassUnavailableError(error.availability, context)')
    expect(route).toContain('context: error.context')
    const unavailable = route.slice(
      route.indexOf('if (error instanceof WeddingPassUnavailableError'),
      route.indexOf('if (isPreviewWriteBlockedError'),
    )
    expect(unavailable).toContain('guestName: error.context.guestName')
    expect(unavailable).toContain('weddingDate: error.context.weddingDate')
    expect(unavailable).not.toContain('token:')
    expect(unavailable).not.toContain('publicKeyDerBase64')
  })

  test('web locked card shows identity, RSVP, availability, date and venue', () => {
    expect(web).toContain('data-testid="wedding-pass-locked-card"')
    expect(web).toContain('wedding-pass-locked-guest-name')
    expect(web).toContain('Invitation verified')
    expect(web).toContain('RSVP confirmed')
    expect(web).toContain('Secure admission QR')
    expect(web).toContain('lockedContext.weddingDate')
    expect(web).toContain('lockedContext.venue')
  })

  test('web only renders the WW2 QR inside the active Pass branch', () => {
    const lockedStart = web.indexOf('data-testid="wedding-pass-locked-card"')
    const activeStart = web.indexOf('data-testid="wedding-pass-ww2-qr"')
    expect(lockedStart).toBeGreaterThan(0)
    expect(activeStart).toBeGreaterThan(lockedStart)
    const lockedBlock = web.slice(lockedStart, activeStart)
    expect(lockedBlock).not.toContain('qrcode.toDataURL')
    expect(lockedBlock).not.toContain('<img')
  })

  test('web rechecks the server on resume and at opensAt', () => {
    expect(web).toContain("window.addEventListener('focus', refreshOnResume)")
    expect(web).toContain("document.addEventListener('visibilitychange', refreshOnResume)")
    expect(web).toContain('availability?.opensAt')
    expect(web).toContain('window.setTimeout(() => void loadPass(), delay)')
  })

  test('Android locked Pass has no QR renderer and refreshes on resume/time transition', () => {
    const start = android.indexOf('private fun LockedGuestPassCard')
    expect(start).toBeGreaterThan(0)
    const block = android.slice(start)
    expect(block).toContain('testTag("wedding-pass-locked-card")')
    expect(block).toContain('Invitation verified')
    expect(block).toContain('Secure admission QR is not issued yet')
    expect(block).not.toContain('WeddingQrCode(')
    expect(android).toContain('Lifecycle.Event.ON_RESUME')
    expect(android).toContain('Instant.parse(raw).toEpochMilli()')
  })

  test('iOS locked Pass has no QR renderer and refreshes on foreground/time transition', () => {
    const start = ios.indexOf('private func lockedPassCard')
    const end = ios.indexOf('private struct LiveGuestDayDataView')
    const block = ios.slice(start, end)
    expect(block).toContain('accessibilityIdentifier("wedding-pass-locked-card")')
    expect(block).toContain('Invitation verified')
    expect(block).toContain('Secure admission QR is not issued yet')
    expect(block).not.toContain('WeddingQRCodeView')
    expect(ios).toContain('@Environment(\\.scenePhase)')
    expect(ios).toContain('if phase == .active { refreshNonce += 1 }')
    expect(ios).toContain('availability?.opensAtDate')
  })
})
