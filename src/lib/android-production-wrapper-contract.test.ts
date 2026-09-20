import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const source = (path: string) => readFileSync(path, 'utf8')
const PLAY_SIGNING_SHA256 = '32:16:B9:AE:56:44:F9:B5:B4:F8:C3:04:6A:6B:D6:BF:86:3E:A3:51:B3:2A:F3:AE:4B:32:27:99:B9:FE:DA:7B'
const UPLOAD_SHA256 = 'C3:D8:56:D7:82:F6:42:C6:88:4D:98:25:52:F5:67:65:3E:35:D5:DA:1E:AB:B1:12:EF:6F:C0:59:8E:88:65:8C'

describe('production Android invitation wrapper contract', () => {
  test('keeps the production App Link association bound to the Play package and certificate', () => {
    const assetLinks = JSON.parse(source('public/.well-known/assetlinks.json')) as Array<{
      target?: { package_name?: string; sha256_cert_fingerprints?: string[] }
    }>
    const production = assetLinks.find((statement) => statement.target?.package_name === 'pro.wewed.app')

    expect(production?.target?.sha256_cert_fingerprints).toContain(PLAY_SIGNING_SHA256)
    expect(production?.target?.sha256_cert_fingerprints).toContain(UPLOAD_SHA256)
  })

  test('compiles a production wrapper for wewed.pro and keeps UAT host isolation explicit', () => {
    const gradle = source('android/app/build.gradle')
    const manifest = source('android/app/src/main/AndroidManifest.xml')

    expect(manifest).toContain('android:host="@string/hostName"')
    expect(gradle).toContain("hostName: 'wewed.pro'")
    expect(gradle).toContain('buildConfigField "boolean", "UAT", "false"')
    expect(gradle).toContain(`buildConfigField "String", "INVITATION_RESUME_ORIGIN", '"https://wewed.pro"'`)
    expect(gradle).toContain("onVariants(selector().withBuildType('release'))")
    expect(gradle).toContain('WEWED_ANDROID_PRODUCTION_VERSION_CODE')
    expect(gradle).toContain('WEWED_ANDROID_PRODUCTION_VERSION_NAME')
    expect(gradle).toContain('uatPlay {')
    expect(gradle).toContain('resValue "string", "hostName", "uat.wewed.pro"')
    expect(gradle).toContain(`buildConfigField "String", "INVITATION_RESUME_ORIGIN", '"https://uat.wewed.pro"'`)
  })

  test('requires a signed release bundle and forbids Play publication from the production candidate workflow', () => {
    const workflow = source('.github/workflows/android-invitation-production-play-aab.yml')

    expect(workflow).toContain(':app:bundleRelease')
    expect(workflow).toContain('android:host="wewed.pro"')
    expect(workflow).toContain('boolean UAT = false;')
    expect(workflow).toContain('INVITATION_RESUME_ORIGIN = "https://wewed.pro";')
    expect(workflow).toContain('EXPECTED_UPLOAD_CERT_SHA256')
    expect(workflow).toContain('WEWED_ANDROID_UPLOAD_KEYSTORE_BASE64')
    expect(workflow).not.toContain('upload-google-play')
    expect(workflow).not.toContain('GOOGLE_PLAY_SERVICE_ACCOUNT')
  })

  test('does not falsely label a disabled production handoff as a UAT build', () => {
    for (const path of [
      'src/components/wedding/invitation-app-handoff.tsx',
      'src/components/wedding/physical-invitation-entry.tsx',
    ]) {
      const component = source(path)
      expect(component).toContain('Secure Android invitation handoff is not available yet.')
      expect(component).not.toContain('handoff is being prepared for this UAT build')
    }
  })
})
