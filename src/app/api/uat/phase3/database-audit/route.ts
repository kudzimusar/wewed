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

interface DatabaseIdentityRow {
  databaseName: string
  currentUser: string
  sessionUser: string
  serverVersion: string
}

interface RoleRow {
  roleName: string
  canLogin: boolean
  superuser: boolean
  bypassRls: boolean
  inherit: boolean
}

interface RequiredObjectRow {
  objectName: string
  regclass: string | null
}

interface SchemaPrivilegeRow {
  schemaName: string
  hasUsage: boolean
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
 * Temporary Phase-3 identity/catalog preflight.
 *
 * Safety properties:
 * - exact Preview branch only; production returns 404;
 * - DATABASE_URL is parsed in memory and never returned with password/query string;
 * - no SQL is attempted unless the Supabase project ref matches Wewed;
 * - every database statement runs after SET TRANSACTION READ ONLY;
 * - the transaction is deliberately rolled back;
 * - queries are hardcoded SELECT/catalog reads only.
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

  let audit: {
    database: DatabaseIdentityRow | null
    applicationRole: RoleRow | null
    schemaPrivileges: SchemaPrivilegeRow[]
    requiredObjects: RequiredObjectRow[]
  } | null = null

  try {
    await db.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')

        const identityRows = await tx.$queryRawUnsafe<DatabaseIdentityRow[]>(
          'SELECT current_database() AS "databaseName", current_user AS "currentUser", session_user AS "sessionUser", current_setting(\'server_version\') AS "serverVersion"',
        )

        const roleRows = await tx.$queryRawUnsafe<RoleRow[]>(
          'SELECT rolname AS "roleName", rolcanlogin AS "canLogin", rolsuper AS superuser, rolbypassrls AS "bypassRls", rolinherit AS inherit FROM pg_roles WHERE rolname = current_user',
        )

        const schemaPrivileges = await tx.$queryRawUnsafe<SchemaPrivilegeRow[]>(
          "SELECT schema_name AS \"schemaName\", has_schema_privilege(current_user, schema_name, 'USAGE') AS \"hasUsage\" FROM (VALUES ('public'), ('wewed_admin'), ('wewed_booking'), ('private')) AS wanted(schema_name) ORDER BY schema_name",
        )

        const requiredObjects = await tx.$queryRawUnsafe<RequiredObjectRow[]>(
          "SELECT object_name AS \"objectName\", to_regclass(object_name)::text AS regclass FROM (VALUES ('public.\"User\"'), ('public.\"UserProfile\"'), ('public.\"Couple\"'), ('public.\"Wedding\"'), ('public.\"WeddingMembership\"'), ('public.\"BusinessAccount\"'), ('public.\"BusinessAccountMember\"'), ('public.\"BusinessAccountLink\"'), ('public.\"ProviderProfile\"'), ('public.\"Vendor\"'), ('public.\"ServiceEngagement\"'), ('wewed_admin.\"PlatformAdministrator\"'), ('wewed_admin.\"PlatformAdministratorScope\"')) AS wanted(object_name) ORDER BY object_name",
        )

        audit = {
          database: identityRows[0] ?? null,
          applicationRole: roleRows[0] ?? null,
          schemaPrivileges,
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
          code: 'READ_ONLY_DATABASE_PREFLIGHT_FAILED',
          fingerprint,
          databaseQueryExecuted: true,
        },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({
    success: true,
    code: 'WEWED_PRODUCTION_DATABASE_IDENTIFIED',
    phase: 3,
    expectedProjectRef: EXPECTED_WEWED_SUPABASE_REF,
    fingerprint,
    databaseQueryExecuted: true,
    transactionMode: 'READ ONLY + ROLLBACK',
    audit,
    temporaryEndpoint: true,
    removalRequiredAfterPhase3: true,
  })
}
