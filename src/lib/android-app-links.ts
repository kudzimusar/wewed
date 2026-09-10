export const WEWED_ANDROID_PACKAGE_NAME = 'pro.wewed.app'
export const ANDROID_APP_LINK_RELATION = 'delegate_permission/common.handle_all_urls'

const SHA256_FINGERPRINT = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/

export function parseAndroidAppLinkFingerprints(raw: string | null | undefined): string[] {
  if (!raw) return []

  return [...new Set(
    raw
      .split(/[\n,]/)
      .map((value) => value.trim().toUpperCase())
      .filter((value) => SHA256_FINGERPRINT.test(value)),
  )]
}

export function buildAndroidAssetLinks(
  rawFingerprints: string | null | undefined = process.env.WEWED_ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS,
) {
  const fingerprints = parseAndroidAppLinkFingerprints(rawFingerprints)
  if (fingerprints.length === 0) return []

  return [
    {
      relation: [ANDROID_APP_LINK_RELATION],
      target: {
        namespace: 'android_app',
        package_name: WEWED_ANDROID_PACKAGE_NAME,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ]
}
