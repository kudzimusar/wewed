import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export function GET() {
  const fingerprint = process.env.WEWED_UAT_ANDROID_SHA256 ?? ''
  if (process.env.VERCEL_ENV !== 'preview' || process.env.WEWED_PREVIEW_WRITABLE_WEDDING_ID !== 'wewed-pr202-uat-20260912' || !/^([A-F0-9]{2}:){31}[A-F0-9]{2}$/.test(fingerprint)) {
    return new NextResponse(null, { status: 404 })
  }
  return NextResponse.json([{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: 'pro.wewed.app', sha256_cert_fingerprints: [fingerprint] } }], { headers: { 'Cache-Control': 'no-store' } })
}
