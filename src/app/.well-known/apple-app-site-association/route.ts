import { NextResponse } from 'next/server'
import {
  buildAppleAppSiteAssociation,
  normalizeAppleApplicationIdentifierPrefix,
} from '@/lib/apple-app-site-association'

export const dynamic = 'force-dynamic'

export function GET() {
  const prefix = normalizeAppleApplicationIdentifierPrefix(
    process.env.WEWED_APPLE_APPLICATION_IDENTIFIER_PREFIX,
  )

  // Fail closed until the Apple developer identity is deliberately configured.
  // Never publish a guessed Team/Application Identifier Prefix because iOS
  // caches this trust contract through Apple's associated-domains CDN.
  if (!prefix) {
    return new NextResponse(null, {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  return NextResponse.json(buildAppleAppSiteAssociation(prefix), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
