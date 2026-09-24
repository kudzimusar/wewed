import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export const ANDROID_PACKAGE_NAME = 'pro.wewed.app'

/**
 * Production Play App Signing Certificate SHA-256 Fingerprint.
 * Active on devices installed via Google Play.
 */
export const PLAY_SIGNING_SHA256 =
  '32:16:B9:AE:56:44:F9:B5:B4:F8:C3:04:6A:6B:D6:BF:86:3E:A3:51:B3:2A:F3:AE:4B:32:27:99:B9:FE:DA:7B'

/**
 * Local Release Upload Key Certificate SHA-256 Fingerprint.
 * Active for upload bundle verification and sideloaded release candidate testing.
 */
export const UPLOAD_KEY_SHA256 =
  'C3:D8:56:D7:82:F6:42:C6:88:4D:98:25:52:F5:67:65:3E:35:D5:DA:1E:AB:B1:12:EF:6F:C0:59:8E:88:65:8C'

export const ASSET_LINKS_STATEMENTS = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: ANDROID_PACKAGE_NAME,
      sha256_cert_fingerprints: [PLAY_SIGNING_SHA256, UPLOAD_KEY_SHA256],
    },
  },
] as const

export function GET() {
  return NextResponse.json(ASSET_LINKS_STATEMENTS, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
