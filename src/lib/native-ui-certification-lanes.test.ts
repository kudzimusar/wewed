import { describe, expect, test } from 'bun:test'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * QRO04-UI01 (D-084/D-085): Shadow is a qualification harness, never final-native UI evidence, and
 * the top-level android/ Bubblewrap/TWA wrapper is not the Compose native app. The production-native
 * certification list may only contain FINAL NATIVE GUEST SURFACE tests from apps/.
 */
const root = join(import.meta.dir, '..', '..')
const read = (path: string) => readFileSync(join(root, path), 'utf8')
const manifest = JSON.parse(read('mobile/contracts/final-native-ui-certification.json'))
const script = read('scripts/native-mobile/final-native-ui-certification.sh')

function walk(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const path = join(dir, name)
    return statSync(join(root, path)).isDirectory() ? walk(path) : [path]
  })
}

const SHADOW_LAUNCH = /wewed_native_env\s*[:=]\s*["']?(shadow|sanitized_shadow|private_real_shadow)\b/

describe('final-native UI certification lanes', () => {
  test('no automation that launches a Shadow environment is part of the production-native certification', () => {
    const shadowFlows = walk('.maestro').filter((path) => SHADOW_LAUNCH.test(read(path)))
    expect(shadowFlows.length).toBeGreaterThan(0)
    const certified = JSON.stringify(manifest.finalNativeGuestSurfaceTests) + script
    for (const flow of shadowFlows) {
      expect(certified).not.toContain(flow.split('/').pop()!)
    }
    expect(certified).not.toContain('.maestro')
    expect(certified).not.toMatch(SHADOW_LAUNCH)
    expect(script).not.toContain('maestro')
  })

  test('certification targets only the final native apps, never the top-level android/ TWA wrapper', () => {
    expect(manifest.finalNativeApplication.ios).toBe('apps/ios/Wewed')
    expect(manifest.finalNativeApplication.android).toBe('apps/android/app')
    expect(manifest.legacyTwaWrapper.path).toBe('android/')
    // Every Android invocation goes through apps/android; no bare top-level android/ path is used.
    expect(script).toContain('"$root/apps/android"')
    expect(script).not.toMatch(/"\$root\/android"|\$root\/android\/|(^|[\s"'(])\.?\/?android\/gradlew/m)
  })

  test('pending Guest tests follow the RSVP-first contract instead of the removed Continue control', () => {
    const ios = read('apps/ios/GuestProfileUITests/GuestProfileUITests.swift')
    const android = read('apps/android/app/src/androidTest/java/pro/wewed/app/invitation/GuestProfileUiTests.kt')
    expect(ios).not.toContain('tap("invitation-continue")')
    expect(android).not.toContain('tap("invitation-continue")')
    expect(ios).toContain('invitation-rsvp-prompt')
    expect(android).toContain('invitation-rsvp-prompt')
  })

  test('the GuestProfile suites are classified as FINAL NATIVE GUEST SURFACE tests', () => {
    expect(manifest.finalNativeGuestSurfaceTests.classification).toBe('FINAL NATIVE GUEST SURFACE')
    expect(read('apps/ios/GuestProfileUITests/GuestProfileUITests.swift')).toContain('FINAL NATIVE GUEST SURFACE')
    expect(read('apps/android/app/src/androidTest/java/pro/wewed/app/invitation/GuestProfileUiTests.kt')).toContain('FINAL NATIVE GUEST SURFACE')
    for (const id of manifest.finalNativeGuestSurfaceTests.ios.tests) expect(id.startsWith('GuestProfileUITests/GuestProfileUITests/')).toBe(true)
    for (const cls of manifest.finalNativeGuestSurfaceTests.android.classes) expect(cls.startsWith('pro.wewed.app.invitation.Guest')).toBe(true)
    // The synthetic loopback server the suites depend on is tracked with them.
    expect(read('scripts/native-mobile/guest-profile-ui-server.py')).toContain("ThreadingHTTPServer(('127.0.0.1', 8768)")
  })
})
