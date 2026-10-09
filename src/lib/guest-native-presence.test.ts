import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { nativeGuestClientFromHeaders } from './guest-native-presence'

describe('Guest native activation telemetry', () => {
  test('only explicit native clients with an approved platform are classified', () => {
    expect(nativeGuestClientFromHeaders(new Headers())).toBeNull()

    expect(nativeGuestClientFromHeaders(new Headers({
      'x-wewed-client': 'web',
      'x-wewed-native-platform': 'android',
    }))).toBeNull()

    expect(nativeGuestClientFromHeaders(new Headers({
      'x-wewed-client': 'native',
      'x-wewed-native-platform': 'windows',
    }))).toBeNull()

    expect(nativeGuestClientFromHeaders(new Headers({
      'user-agent': 'Wewed-Android/1.4.0',
      'x-wewed-client': 'native',
      'x-wewed-native-platform': 'android',
      'x-wewed-native-runtime': 'android-httpurlconnection',
      'x-wewed-app-version': '1.4.0',
      'x-wewed-build-version': '104',
    }))).toEqual({
      platform: 'android',
      appVersion: '1.4.0',
      buildVersion: '104',
    })
  })

  test('browser/PWA fetch metadata cannot forge native activation', () => {
    const forged = new Headers({
      'user-agent': 'Mozilla/5.0',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'cors',
      'sec-fetch-dest': 'empty',
      'x-wewed-client': 'native',
      'x-wewed-native-platform': 'android',
      'x-wewed-native-runtime': 'android-httpurlconnection',
    })
    expect(nativeGuestClientFromHeaders(forged)).toBeNull()

    const wrongRuntime = new Headers({
      'user-agent': 'Wewed-Android/1.4.0',
      'x-wewed-client': 'native',
      'x-wewed-native-platform': 'android',
      'x-wewed-native-runtime': 'ios-urlsession',
    })
    expect(nativeGuestClientFromHeaders(wrongRuntime)).toBeNull()

    const browserUserAgent = new Headers({
      'user-agent': 'Mozilla/5.0 (Linux; Android 16)',
      'x-wewed-client': 'native',
      'x-wewed-native-platform': 'android',
      'x-wewed-native-runtime': 'android-httpurlconnection',
    })
    expect(nativeGuestClientFromHeaders(browserUserAgent)).toBeNull()
  })

  test('metadata is bounded and contains no device advertising identifier', () => {
    const long = 'x'.repeat(200)
    const parsed = nativeGuestClientFromHeaders(new Headers({
      'user-agent': 'Wewed-iOS/2.0.0',
      'x-wewed-client': 'native',
      'x-wewed-native-platform': 'ios',
      'x-wewed-native-runtime': 'ios-urlsession',
      'x-wewed-app-version': long,
      'x-wewed-build-version': long,
    }))
    expect(parsed?.appVersion?.length).toBe(64)
    expect(parsed?.buildVersion?.length).toBe(64)

    const source = readFileSync('src/lib/guest-native-presence.ts', 'utf8')
    expect(source).not.toContain('advertisingId')
    expect(source).not.toContain('IDFA')
    expect(source).not.toContain('GAID')
    expect(source).toContain('appInstanceHash: null')
  })

  test('presence is recorded only after Guest identity resolution', () => {
    const route = readFileSync('src/app/api/weddings/[slug]/guest-session/route.ts', 'utf8')
    const getStart = route.indexOf('export async function GET')
    const getRecord = route.indexOf('await recordGuestNativePresence({', getStart)
    const guestGuard = route.indexOf('if (!guest)', getStart)
    expect(getRecord).toBeGreaterThan(guestGuard)

    const postStart = route.indexOf('export async function POST')
    const invalidGuard = route.indexOf("if (!rsvp || rsvp.guest.wedding.slug !== slug", postStart)
    const postRecord = route.indexOf('await recordGuestNativePresence({', postStart)
    expect(postRecord).toBeGreaterThan(invalidGuard)

    expect(route.slice(postStart, postRecord)).toContain('recordGuestInvitationOpened')
    expect(route.slice(postRecord, postRecord + 350)).toContain('invitationOpened: true')
  })

  test('schema binds activation to one canonical Guest per wedding and platform', () => {
    const schema = readFileSync('prisma/schema.prisma', 'utf8')
    const migration = readFileSync(
      'prisma/migrations/20260930103000_guest_native_presence/migration.sql',
      'utf8',
    )

    expect(schema).toContain('model GuestNativePresence')
    expect(schema).toContain('@@unique([weddingId, guestId, platform])')
    expect(schema).toContain('guest Guest @relation(fields: [guestId, weddingId], references: [id, weddingId], onDelete: Cascade)')
    expect(migration).toContain('GuestNativePresence_platform_check')
    expect(migration).toContain("CHECK (\"platform\" IN ('android', 'ios'))")
  })

  test('Android and iOS Guest-session transports send platform and build metadata', () => {
    const android = readFileSync(
      'apps/android/app/src/main/java/pro/wewed/app/invitation/GuestSessionClient.kt',
      'utf8',
    )
    const ios = readFileSync(
      'apps/ios/Wewed/Invitation/GuestSessionClient.swift',
      'utf8',
    )

    expect(android).toContain('"User-Agent", "Wewed-Android/${BuildConfig.VERSION_NAME}"')
    expect(android).toContain('"x-wewed-native-platform", "android"')
    expect(android).toContain('"x-wewed-native-runtime", "android-httpurlconnection"')
    expect(android).toContain('"x-wewed-app-version", BuildConfig.VERSION_NAME')
    expect(android).toContain('"x-wewed-build-version", BuildConfig.VERSION_CODE.toString()')

    expect(ios).toContain('"Wewed-iOS/\\(appVersion)", forHTTPHeaderField: "User-Agent"')
    expect(ios).toContain('"ios", forHTTPHeaderField: "x-wewed-native-platform"')
    expect(ios).toContain('"ios-urlsession", forHTTPHeaderField: "x-wewed-native-runtime"')
    expect(ios).toContain('CFBundleShortVersionString')
    expect(ios).toContain('CFBundleVersion')
  })

  test('Planner projection exposes activation without inventing it from invitation delivery', () => {
    const projection = readFileSync('src/lib/planner-invitation-projection.ts', 'utf8')
    expect(projection).toContain('db.guestNativePresence.findMany')
    expect(projection).toContain('nativeActivated: nativeClients.length > 0')
    expect(projection).toContain('nativeActivationRate')
    expect(projection).not.toContain("delivery.status === 'sent' ? true")
  })
})
