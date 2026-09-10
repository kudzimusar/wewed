import { NextResponse } from 'next/server'
import { buildAndroidAssetLinks } from '@/lib/android-app-links'

export const dynamic = 'force-dynamic'

export async function GET() {
  const payload = buildAndroidAssetLinks()
  const configured = payload.length > 0

  return NextResponse.json(payload, {
    status: 200,
    headers: {
      'Cache-Control': configured
        ? 'public, max-age=300, s-maxage=300, stale-while-revalidate=60'
        : 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
