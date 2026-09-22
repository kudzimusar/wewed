import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  EXPECTED_WEWED_SUPABASE_REF,
  fingerprintDatabaseUrl,
} from '@/lib/phase3-database-fingerprint'

const PHASE3_BRANCH = 'backend/production-database-audit-phase3-20260922'
const AUDIT_TOKEN = 'phase3-20260922'

class Phase3Rollback extends Error {
  constructor() {
    super('phase3-read-only-rollback')
    this.name = 'Phase3Rollback'
  }
}

type DatabaseIdentity = {
  databaseName: string
  currentUser: string
  sessionUser: string
  serverVersion: string
}

type RoleIdentity = {
  roleName: string
  canLogin: boolean
  superuser: boolean
  bypassRls: boolean
  inherit: boolean
}

type RequiredObject = {
  objectName: string
  regclass: string | null
}

type Phase3IdentityAudit = {
  database: DatabaseIdentity | null
  role: RoleIdentity | null
  requiredObjects: RequiredObject[]
}

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
 * It exists only on the exact Phase-3 Vercel Preview branch. DATABASE_URL is parsed in memory and
 * never logged or returned. SQL is impossible unless the URL itself fingerprints to the repository
 * expected Wewed Supabase ref. The SQL is hard-coded SELECT-only, inside a READ ONLY transaction,
 * and the callback deliberately throws a sentinel so Prisma rolls it back.
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

  if (!fingerprint.matchesExpectedProject) {
    return NextResponse.json(
      {
        success: false,
        code: 'DATABASE_PROJECT_MISMATCH',
        expectedProjectRef: EXPECTED_WEWED_SUPABASE_REF,
        fingerprint,
        databaseQueryExecuted: false,
      },
      { status: 409 },
    )
  }

  let audit: Phase3IdentityAudit | null = null

  try {
    await db.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')

        const databaseRows = await tx.$queryRawUnsafe<DatabaseIdentity[]>(`
          SELECT
            current_database() AS "databaseName",
            current_user AS "currentUser",
            session_user AS "sessionUser",
            current_setting('server_version') AS "serverVersion"
        `)

        const roleRows = await tx.$queryRawUnsafe<RoleIdentity[]>(`
          SELECT
            rolname AS "roleName",
            rolcanlogin AS "canLogin",
            rolsuper AS superuser,
            rolbypassrls AS "bypassRls",
            rolinherit AS inherit
          FROM pg_roles
          WHERE rolname = current_user
        `)

        const requiredObjects = await tx.$queryRawUnsafe<RequiredObject[]>(`
          SELECT object_name AS "objectName", to_regclass(object_name)::text AS regclass
          FROM (VALUES
            ('public."User"'),
            ('public."UserProfile"'),
            ('public."Couple"'),
            ('public."Wedding"'),
            ('public."WeddingMembership"'),
            ('public."BusinessAccount"'),
            ('public."BusinessAccountMember"'),
            ('public."BusinessAccountLink"'),
            ('public."ProviderProfile"'),
            ('public."Vendor"'),
            ('public."ServiceEngagement"'),
            ('wewed_admin."PlatformAdministrator"'),
            ('wewed_admin."PlatformAdministratorScope"')
          ) AS wanted(object_name)
          ORDER BY object_name
        `)

        audit = {
          database: databaseRows[0] ?? null,
          role: roleRows[0] ?? null,
          requiredObjects,
        }

        throw new Phase3Rollback()
      },
      { timeout: 15_000 },
    )
  } catch (error) {
    if (!(error instanceof Phase3Rollback)) {
      return NextResponse.json(
        {
          success: false,
          code: 'READ_ONLY_IDENTITY_AUDIT_FAILED',
          fingerprint,
          databaseQueryExecuted: true,
        },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({
    success: true,
    code: 'WEWED_DATABASE_IDENTITY_CONFIRMED',
    expectedProjectRef: EXPECTED_WEWED_SUPABASE_REF,
    fingerprint,
    databaseQueryExecuted: true,
    transactionMode: 'READ ONLY + ROLLBACK',
    audit,
    temporaryEndpoint: true,
    removalRequiredAfterPhase3: true,
  })
}
