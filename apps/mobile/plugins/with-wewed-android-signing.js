const { withAppBuildGradle } = require('expo/config-plugins')

const MARKER = '// WEWED_UPLOAD_SIGNING_CONFIG_V1'

module.exports = function withWewedAndroidSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') {
      throw new Error('[wewed] Android upload signing plugin requires Groovy app/build.gradle.')
    }

    let source = mod.modResults.contents
    if (source.includes(MARKER)) return mod

    const androidMarker = '\nandroid {'
    if (!source.includes(androidMarker)) {
      throw new Error('[wewed] Could not locate android block for upload signing configuration.')
    }

    const prelude = `
${MARKER}
def wewedUploadStoreFile = System.getenv('WEWED_UPLOAD_STORE_FILE')
def wewedUploadStorePassword = System.getenv('WEWED_UPLOAD_STORE_PASSWORD')
def wewedUploadKeyAlias = System.getenv('WEWED_UPLOAD_KEY_ALIAS')
def wewedUploadKeyPassword = System.getenv('WEWED_UPLOAD_KEY_PASSWORD')
def wewedHasUploadSigning = wewedUploadStoreFile && wewedUploadStorePassword && wewedUploadKeyAlias && wewedUploadKeyPassword
def wewedRequireReleaseSigning = System.getenv('WEWED_REQUIRE_RELEASE_SIGNING') == '1'

if (wewedRequireReleaseSigning && !wewedHasUploadSigning) {
    throw new GradleException('[wewed] Production Android signing was required but upload-key credentials are incomplete.')
}
`
    source = source.replace(androidMarker, `${prelude}${androidMarker}`)

    const signingMarker = '    signingConfigs {\n'
    if (!source.includes(signingMarker)) {
      throw new Error('[wewed] Could not locate signingConfigs block for upload signing configuration.')
    }

    source = source.replace(
      signingMarker,
      `${signingMarker}        wewedRelease {\n            if (wewedHasUploadSigning) {\n                storeFile file(wewedUploadStoreFile)\n                storePassword wewedUploadStorePassword\n                keyAlias wewedUploadKeyAlias\n                keyPassword wewedUploadKeyPassword\n            }\n        }\n`,
    )

    let signingOccurrences = 0
    source = source.replace(/signingConfig signingConfigs\.debug/g, (match) => {
      signingOccurrences += 1
      if (signingOccurrences === 2) {
        return 'signingConfig wewedHasUploadSigning ? signingConfigs.wewedRelease : signingConfigs.debug'
      }
      return match
    })

    if (signingOccurrences < 2) {
      throw new Error('[wewed] Could not locate the Expo release signing assignment. Refusing an ambiguous signing patch.')
    }

    mod.modResults.contents = source
    return mod
  })
}
