import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import {
  IVORY_INVITATION_COMPACT_LINE,
  ivoryInvitationContent,
} from './invitation-content-contract'

const androidIvory = readFileSync(
  'apps/android/app/src/main/java/pro/wewed/app/ui/invitation/ivory/IvoryFloralGoldNative.kt',
  'utf8',
)
const androidLive = readFileSync(
  'apps/android/app/src/main/java/pro/wewed/app/ui/invitation/LiveGuestInvitationScreen.kt',
  'utf8',
)
const iosIvory = readFileSync(
  'apps/ios/Wewed/Views/Invitation/Ivory/IvoryFloralGoldNative.swift',
  'utf8',
)
const iosLive = readFileSync(
  'apps/ios/Wewed/Views/Invitation/LiveGuestInvitationView.swift',
  'utf8',
)

describe('invitation content semantic convergence', () => {
  test('long couple notes are preserved exactly while artwork receives fixed compact copy', () => {
    const note =
      '  A long, authored note with travel details, gratitude, family context, and punctuation.  '
    const content = ivoryInvitationContent(note)

    expect(content.compactLine).toBe('We’d be honoured to celebrate with you.')
    expect(content.coupleNote).toBe(note.trim())
    expect(content.coupleNote).not.toBe(content.compactLine)
  })

  test('blank authored notes remain absent instead of becoming stock Couple copy', () => {
    expect(ivoryInvitationContent('   ').coupleNote).toBeNull()
    expect(ivoryInvitationContent(null).coupleNote).toBeNull()
  })

  test('web, Android and iOS use the same compact line and separate Couple-note field', () => {
    expect(IVORY_INVITATION_COMPACT_LINE).toBe('We’d be honoured to celebrate with you.')

    for (const source of [androidIvory, iosIvory]) {
      expect(source).toContain('compactLine')
      expect(source).toContain('coupleNote')
      expect(source).toContain('We’d be honoured to celebrate with you.')
    }

    expect(androidLive).toContain('coupleNote = invitationCardMessage')
    expect(iosLive).toContain('coupleNote: (invitationCardMessage')
  })

  test('native compact artwork no longer renders a generic message field', () => {
    expect(androidIvory).not.toContain('data.message.uppercase()')
    expect(iosIvory).not.toContain('data.message.uppercased()')
    expect(androidIvory).toContain('data.compactLine.uppercase()')
    expect(iosIvory).toContain('data.compactLine.uppercased()')
  })
})
