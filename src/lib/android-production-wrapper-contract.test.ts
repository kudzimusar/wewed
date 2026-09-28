import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'

const source = (path: string) => readFileSync(path, 'utf8')
const PLAY_SIGNING_SHA256 = '32:16:B9:AE:56:44:F9:B5:B4:F8:C3:04:6A:6B:D6:BF:86:3E:A3:51:B3:2A:F3:AE:4B:32:27:99:B9:FE:DA:7B'
const UPLOAD_SHA256 = 'C3:D8:56:D7:82:F6:42:C6:88:4D:98:25:52:F5:67:65:3E:35:D5:DA:1E:AB:B1:12:EF:6F:C0:59:8E:88:65:8C'

/**
 * QRO07-SHIP01 — Google Play production authority.
 *
 * apps/android (Kotlin) is the only tree that may produce a signed pro.wewed.app candidate. The
 * legacy TWA (android/) and Expo (apps/mobile) sources remain for history, but their signing
 * workflows are retired. Under Play App Signing, users install APKs signed by the Play
 * app-signing key, so only that certificate may claim wewed.pro App Links — never the upload key.
 */
describe('Google Play production authority (apps/android only)', () => {
  test('App Links trust only the Play app-signing certificate for pro.wewed.app', () => {
    const assetLinks = JSON.parse(source('public/.well-known/assetlinks.json')) as Array<{
      target?: { package_name?: string; sha256_cert_fingerprints?: string[] }
    }>
    expect(assetLinks.map((statement) => statement.target?.package_name)).toEqual(['pro.wewed.app'])
    expect(assetLinks[0].target?.sha256_cert_fingerprints).toEqual([PLAY_SIGNING_SHA256])
    expect(JSON.stringify(assetLinks)).not.toContain(UPLOAD_SHA256)
  })

  test('the Kotlin app is the production package with the current Play API levels', () => {
    const gradle = source('apps/android/app/build.gradle.kts')
    expect(gradle).toContain('applicationId = "pro.wewed.app"')
    expect(gradle).toContain('compileSdk = 36')
    expect(gradle).toContain('targetSdk = 36')
    expect(gradle).toContain('minSdk = 24')
    expect(gradle).toContain('WEWED_PLAY_VERSION_CODE')
    // Debug and UAT stay isolated from the production package.
    expect(gradle).toContain('applicationIdSuffix = ".dev"')
    expect(gradle).toContain('applicationIdSuffix = ".uatdev"')
    const manifest = source('apps/android/app/src/main/AndroidManifest.xml')
    expect(manifest).toContain('android:autoVerify="true"')
    expect(manifest).toContain('android:host="wewed.pro" android:pathPrefix="/invite/"')
    expect(manifest).toContain('android:host="wewed.pro" android:pathPrefix="/w/"')
  })

  test('one signed production workflow builds apps/android, pins the upload signer and never publishes', () => {
    const workflow = source('.github/workflows/android-native-production-play-aab.yml')
    expect(workflow).toContain('working-directory: apps/android')
    expect(workflow).toContain(':app:bundleRelease')
    expect(workflow).toContain("EXPECTED_UPLOAD_CERT_SHA256='C3D856D782F642C6884D982552F567653E35D5DA1EABB112EF6FC0598E88658C'")
    expect(workflow).toContain('android:targetSdkVersion="36"')
    expect(workflow).toContain('package="pro.wewed.app"')
    expect(workflow).toContain("if: github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/heads/release/') || startsWith(github.ref, 'refs/tags/android-play-candidate-')")
    // A candidate tag must point at a commit already on main or a release/ branch.
    expect(workflow).toContain("grep -Eq 'origin/(main|release/)'")
    expect(workflow).toContain('ref: ${{ github.sha }}')
    expect(workflow).not.toContain('pull_request:')
    expect(workflow).not.toContain('upload-google-play')
    expect(workflow).not.toContain('GOOGLE_PLAY_SERVICE_ACCOUNT')
  })

  test('no other workflow can sign a pro.wewed.app candidate with the upload key', () => {
    const signers = readdirSync('.github/workflows')
      .filter((file) => /\.ya?ml$/.test(file))
      .filter((file) => /WEWED_(ANDROID_)?UPLOAD_KEYSTORE_BASE64/.test(source(`.github/workflows/${file}`)))
    expect(signers).toEqual(['android-native-production-play-aab.yml'])
    for (const retired of ['android-invitation-production-play-aab.yml', 'native-gate-g-release.yml']) {
      const workflow = source(`.github/workflows/${retired}`)
      expect(workflow).toContain('Retired by QRO07-SHIP01')
      expect(workflow).toContain('exit 1')
      expect(workflow).not.toContain('bundleRelease')
    }
    for (const [file, job] of [
      ['android-invitation-uat-play-aab.yml', 'signed-candidate'],
      ['native-release-aab-ci.yml', 'signed-upload-aab'],
    ]) {
      const workflow = source(`.github/workflows/${file}`)
      const retiredJob = workflow.slice(workflow.indexOf(`  ${job}:`))
      expect(retiredJob).toContain('Retired by QRO07-SHIP01')
    }
  })

  test('does not falsely label a disabled production handoff as a UAT build', () => {
    for (const path of [
      'src/components/wedding/invitation-app-handoff.tsx',
      'src/components/wedding/physical-invitation-entry.tsx',
    ]) {
      const component = source(path)
      // QRO06/AT01: a disabled handoff never strands Android — both gates continue in the browser.
      expect(component).not.toContain('Your private invitation remains locked')
      expect(component).toContain('if (!deferredInstallEnabled)')
      expect(component).not.toContain('handoff is being prepared for this UAT build')
    }
  })
})
