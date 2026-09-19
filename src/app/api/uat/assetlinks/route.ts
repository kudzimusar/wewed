import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const PR202_WEDDING_ID = 'wewed-pr202-uat-20260912'
const ANDROID_PACKAGE = 'pro.wewed.app'

// These are the signing fingerprints already published by the production
// Wewed assetlinks contract for pro.wewed.app. Google Play app signing uses
// the same signing identity across release tracks for one package, so the UAT
// host must trust the established Play identity as well as the companion key
// already accepted by production.
const ESTABLISHED_ANDROID_SHA256 = [
  '32:16:B9:AE:56:44:F9:B5:B4:F8:C3:04:6A:6B:D6:BF:86:3E:A3:51:B3:2A:F3:AE:4B:32:27:99:B9:FE:DA:7B',
  'C3:D8:56:D7:82:F6:42:C6:88:4D:98:25:52:F5:67:65:3E:35:D5:DA:1E:AB:B1:12:EF:6F:C0:59:8E:88:65:8C',
] as const

const SHA256_PATTERN = /^([A-F0-9]{2}:){31}[A-F0-9]{2}$/

// Local UAT wrapper builds install as their own package so they can never replace the
// Play-installed app. They are trusted only with explicitly configured local keys,
// never with the Play signing identity.
const LOCAL_UAT_ANDROID_PACKAGE = 'pro.wewed.app.uatdev'

function localUatFingerprints(): string[] {
  const configured = (process.env.WEWED_UAT_ANDROID_SHA256 ?? '')
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter((value) => SHA256_PATTERN.test(value))

  return [...new Set(configured)]
}

function configuredFingerprints(): string[] {
  return [...new Set([...ESTABLISHED_ANDROID_SHA256, ...localUatFingerprints()])]
}

export function GET() {
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.WEWED_PREVIEW_WRITABLE_WEDDING_ID !== PR202_WEDDING_ID
  ) {
    return new NextResponse(null, { status: 404 })
  }

  const statements = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: ANDROID_PACKAGE,
        sha256_cert_fingerprints: configuredFingerprints(),
      },
    },
  ]
  const localKeys = localUatFingerprints()
  if (localKeys.length > 0) {
    statements.push({
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: LOCAL_UAT_ANDROID_PACKAGE,
        sha256_cert_fingerprints: localKeys,
      },
    })
  }

  return NextResponse.json(statements, { headers: { 'Cache-Control': 'no-store' } })
}
