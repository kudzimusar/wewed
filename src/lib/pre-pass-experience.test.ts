import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const passRoute = readFileSync('src/app/api/wedding-day/pass/route.ts', 'utf8')
const weddingDay = readFileSync('src/lib/wedding-day.ts', 'utf8')
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

describe('locked Wedding Pre-Pass', () => {
  test('server refusal carries safe identity and wedding context, never credential material', () => {
    expect(passRoute).toContain('prePass: context')
    expect(passRoute).toContain('guestName: context.guestName')
    expect(passRoute).toContain('weddingDate: context.weddingDate')
    expect(passRoute).toContain('venue: context.venue')
    expect(passRoute).toContain('availability: error.availability')
    expect(weddingDay).toContain('w."venueCity"')
    expect(weddingDay).toContain('w."venueCountry"')

    const prePassBlock = passRoute.slice(
      passRoute.indexOf('prePass: context'),
      passRoute.indexOf(': null,', passRoute.indexOf('prePass: context')) + 7,
    )
    expect(prePassBlock).not.toContain('token:')
    expect(prePassBlock).not.toContain('passSerial')
    expect(prePassBlock).not.toContain('publicKey')
  })

  test('web locked card shows identity, RSVP, unlock, wedding and journey with no QR', () => {
    expect(web).toContain('data-testid="wedding-pass-locked"')
    expect(web).toContain('data-testid="pre-pass-guest-name"')
    expect(web).toContain('data-testid="pre-pass-unlock"')
    expect(web).toContain('Your journey')
    expect(web).toContain('signed WW2 credential required')

    const lockedStart = web.indexOf('data-testid="wedding-pass-locked"')
    const activeStart = web.indexOf('{!loading && pass &&', lockedStart)
    const lockedBlock = web.slice(lockedStart, activeStart)
    expect(lockedBlock).not.toContain('<img')
    expect(lockedBlock).not.toContain('qrcode')
    expect(lockedBlock).not.toContain('invitationUrl')
    expect(lockedBlock).not.toContain('qrDataUrl')
  })

  test('web rechecks locked Pass on resume and time transition', () => {
    expect(web).toContain("window.addEventListener('focus', refresh)")
    expect(web).toContain("document.addEventListener('visibilitychange', refresh)")
    expect(web).toContain('window.setInterval(() => { void loadPass() }, 60_000)')
    expect(web).toContain('prePassUnlockLabel(availability)')
  })

  test('Android locked Pass has no QR and refreshes on resume/time transition', () => {
    expect(android).toContain('private fun LockedGuestWeddingPass(')
    expect(android).toContain('.testTag("wedding-pass-locked")')
    expect(android).toContain('"SECURE ADMISSION QR"')
    expect(android).toContain('Lifecycle.Event.ON_RESUME')
    expect(android).toContain('delay(60_000)')
    expect(android).toContain('signed WW2 credential required')

    const start = android.indexOf('private fun LockedGuestWeddingPass(')
    const end = android.indexOf('/**', start)
    const block = android.slice(start, end > start ? end : android.length)
    expect(block).not.toContain('WeddingQrCode(')
    expect(block).not.toContain('qrPayload')
    expect(block).not.toContain('invitation')
  })

  test('iOS locked Pass has no QR and refreshes on scene resume/time transition', () => {
    expect(ios).toContain('@Environment(\\.scenePhase) private var scenePhase')
    expect(ios).toContain('.accessibilityIdentifier("wedding-pass-locked")')
    expect(ios).toContain('Text("SECURE ADMISSION QR")')
    expect(ios).toContain('if next == .active, pass == nil')
    expect(ios).toContain('Task.sleep(for: .seconds(60))')
    expect(ios).toContain('signed WW2 credential required')

    const start = ios.indexOf('private func lockedPass(')
    const end = ios.indexOf('private func loadPass()', start)
    const block = ios.slice(start, end)
    expect(block).not.toContain('WeddingQRCodeView')
    expect(block).not.toContain('qrPayload')
    expect(block).not.toContain('invitationUrl')
  })

  test('only an issued active Pass renders the WW2 QR across clients', () => {
    expect(web).toContain("data-pass-authority="ww2"")
    expect(web).toContain("data-testid="wedding-pass-ww2-qr"")
    expect(web).toContain("data.token.startsWith('WW2.')")
    expect(android).toContain('WeddingReferencePassScreen(')
    expect(ios).toContain('WeddingReferencePassView(pass: pass')
  })
})
