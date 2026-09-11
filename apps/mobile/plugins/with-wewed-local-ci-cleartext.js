const { withAndroidManifest } = require('expo/config-plugins')

module.exports = function withWewedLocalCiCleartext(config) {
  if (process.env.WEWED_E2E_MODE !== '1') return config

  return withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0]
    if (!application?.$) {
      throw new Error('[wewed] Could not locate Android application manifest for local CI networking.')
    }

    application.$['android:usesCleartextTraffic'] = 'true'
    return mod
  })
}
