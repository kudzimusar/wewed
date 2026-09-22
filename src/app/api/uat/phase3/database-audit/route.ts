import { NextRequest, NextResponse } from 'next/server'
import {
  EXPECTED_WEWED_SUPABASE_REF,
  fingerprintDatabaseUrl,
} from '@/lib/phase3-database-fingerprint'

const PHASE3_BRANCH = 'backend/production-database-audit-phase3-20260922'
const AUDIT_TOKEN = 'phase3-20260922'

function previewOnly(request: NextRequest): boolean {
  return (
    process.env.VERCEL_ENV === 'preview' &&
    process.env.VERCEL_GIT_COMMIT_REF === PHASE3_BRANCH &&
    request.nextUrl.hostname.endsWith('.vercel.app') &&
    request.nextUrl.searchParams.get('audit') === AUDIT_TOKEN
  )
}

/**
 * Temporary Phase-3 identity bridge.
 *
 * This first gate deliberately does not connect to PostgreSQL. It fingerprints the exact
 * DATABASE_URL injected into this Vercel Preview in memory and returns only non-secret metadata.
 * The password, query string and full URL are never returned or logged.
 */
export async function GET(request: NextRequest) {
  if (!previewOnly(request)) {
    return NextResponse.json({ success: false }, { status: 404 })
  }

  const fingerprint = fingerprintDatabaseUrl(process.env.DATABASE_URL)

  if (!fingerprint.available || fingerprint.parseError) {
    return NextResponse.json(
      {
        success: false,
        code: 'DATABASE_URL_NOT_FINGERPRINTABLE',
        fingerprint,
        databaseQueryExecuted: false,
      },
      { status: 409 },
    )
  }

  return NextResponse.json(
    {
      success: fingerprint.matchesExpectedProject,
      code: fingerprint.matchesExpectedProject
        ? 'WEWED_DATABASE_FINGERPRINT_MATCH'
        : 'DATABASE_PROJECT_MISMATCH',
      expectedProjectRef: EXPECTED_WEWED_SUPABASE_REF,
      fingerprint,
      databaseQueryExecuted: false,
      temporaryEndpoint: true,
      removalRequiredAfterPhase3: true,
    },
    { status: fingerprint.matchesExpectedProject ? 200 : 409 },
  )
}
