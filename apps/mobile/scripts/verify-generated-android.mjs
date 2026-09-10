import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const expectedVersionCode = String(process.env.WEWED_ANDROID_VERSION_CODE ?? '3')
const gradlePath = resolve(root, 'android/app/build.gradle')
const manifestPath = resolve(root, 'android/app/src/main/AndroidManifest.xml')
const gradle = readFileSync(gradlePath, 'utf8')
const manifest = readFileSync(manifestPath, 'utf8')

const checks = [
  {
    name: 'applicationId pro.wewed.app',
    ok: /applicationId\s*(?:=\s*)?["']pro\.wewed\.app["']/.test(gradle),
    source: gradle,
    hint: /applicationId|namespace/,
  },
  {
    name: `versionCode ${expectedVersionCode}`,
    ok: new RegExp(`versionCode\\s*(?:=\\s*)?${expectedVersionCode}\\b`).test(gradle),
    source: gradle,
    hint: /versionCode|versionName/,
  },
  {
    name: 'Wewed upload-signing config plugin marker',
    ok: gradle.includes('WEWED_UPLOAD_SIGNING_CONFIG_V1'),
    source: gradle,
    hint: /WEWED_|wewedRelease|signingConfig/,
  },
  {
    name: 'fail-closed release signing guard',
    ok: gradle.includes('WEWED_REQUIRE_RELEASE_SIGNING'),
    source: gradle,
    hint: /WEWED_|wewedRequireReleaseSigning/,
  },
  {
    name: 'autoVerify App Link intent filter',
    ok: /android:autoVerify=["']true["']/.test(manifest),
    source: manifest,
    hint: /autoVerify|intent-filter/,
  },
  {
    name: 'wewed.pro App Link host',
    ok: /android:host=["']wewed\.pro["']/.test(manifest),
    source: manifest,
    hint: /android:host|android:scheme/,
  },
  {
    name: 'HTTP App Link scheme',
    ok: /android:scheme=["']http["']/.test(manifest),
    source: manifest,
    hint: /android:host|android:scheme/,
  },
  {
    name: 'HTTPS App Link scheme',
    ok: /android:scheme=["']https["']/.test(manifest),
    source: manifest,
    hint: /android:host|android:scheme/,
  },
]

let failed = false
for (const check of checks) {
  if (check.ok) {
    console.log(`PASS: ${check.name}`)
    continue
  }
  failed = true
  console.error(`FAIL: ${check.name}`)
  const excerpts = check.source
    .split(/\r?\n/)
    .map((line, index) => ({ line, index: index + 1 }))
    .filter(({ line }) => check.hint.test(line))
    .slice(0, 30)
  for (const excerpt of excerpts) console.error(`${excerpt.index}: ${excerpt.line}`)
}

if (failed) process.exit(1)
