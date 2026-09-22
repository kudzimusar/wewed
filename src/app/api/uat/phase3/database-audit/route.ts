import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  EXPECTED_WEWED_SUPABASE_REF,
  fingerprintDatabaseUrl,
} from '@/lib/phase3-database-fingerprint'

const PHASE3_BRANCH = 'backend/production-database-audit-phase3-20260922'
const AUDIT_TOKEN = 'phase3-20260922'

class ReadOnlyAuditRollback extends Error {
  constructor() {
    super('phase3-read-only-rollback')
    this.name = 'ReadOnlyAuditRollback'
  }
}

interface IdentityRow {
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

interface RelationRow {
  schemaName: string
  relationName: string
  relationKind: string
  rlsEnabled: boolean
  rlsForced: boolean
  ownerName: string
}

interface PrivilegeRow {
  schemaName: string
  hasUsage: boolean
}

interface RequiredObjectRow {
  objectName: string
  regclass: string | null
}

interface AuditResult {
  database: IdentityRow
  applicationRole: RoleRow | null
  schemaPrivileges: PrivilegeRow[]
  requiredObjects: RequiredObjectRow[]
  authorityRelations: RelationRow[]
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
 * It exists only on the exact Phase-3 Vercel Preview branch. DATABASE_URL is parsed in memory,
 * never logged or returned, and no SQL runs unless its project ref matches the repository's
 * expected Wewed Supabase ref. The database work is wrapped in a read-only transaction that is
 * deliberately rolled back after collecting sanitized catalog evidence.
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

  let audit: AuditResult | null = null

  try {
    await db.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')

        const [identityRows, roleRows, schemaPrivileges, requiredObjects, authorityRelations] =
          await Promise.all([
            tx.$queryRawUnsafe<IdentityRow[]>(\`
              SELECT
                current_database() AS "databaseName",
                current_user AS "currentUser",
                session_user AS "sessionUser",
                current_setting('server_version') AS "serverVersion"
            \`),
            tx.$queryRawUnsafe<RoleRow[]>(\`
              SELECT
                rolname AS "roleName",
                rolcanlogin AS "canLogin",
                rolsuper AS superuser,
                rolbypassrls AS "bypassRls",
                rolinherit AS inherit
              FROM pg_roles
              WHERE rolname = current_user
            \`),
            tx.$queryRawUnsafe<PrivilegeRow[]>(\`
              SELECT schema_name AS "schemaName",
                     has_schema_privilege(current_user, schema_name, 'USAGE') AS "hasUsage"
              FROM (VALUES
                ('public'),
                ('wewed_admin'),
                ('wewed_booking'),
                ('private')
              ) AS wanted(schema_name)
              ORDER BY schema_name
            \`),
            tx.$queryRawUnsafe<RequiredObjectRow[]>(\`
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
            \`),
            tx.$queryRawUnsafe<RelationRow[]>(\`
              SELECT
                n.nspname AS "schemaName",
                c.relname AS "relationName",
                c.relkind::text AS "relationKind",
                c.relrowsecurity AS "rlsEnabled",
                c.relforcerowsecurity AS "rlsForced",
                pg_get_userbyid(c.relowner) AS "ownerName"
              FROM pg_class c
              JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname IN ('public', 'wewed_admin', 'wewed_booking', 'private')
                AND c.relname IN (
                  'BusinessAccount',
                  'BusinessAccountMember',
                  'BusinessAccountLink',
                  'ProviderProfile',
                  'PlatformAdministrator',
                  'PlatformAdministratorScope',
                  'User',
                  'UserProfile',
                  'Wedding',
                  'WeddingMembership',
                  'Vendor',
                  'ServiceEngagement'
                )
              ORDER BY n.nspname, c.relname
            \`),
          ])

        audit = {
          database: identityRows[0],
          applicationRole: roleRows[0] ?? null,
          schemaPrivileges,
          requiredObjects,
          authorityRelations,
        }

        throw new ReadOnlyAuditRollback()
      },
      {
        timeout: 15_000,
      },
    )
  } catch (error) {
    if (!(error instanceof ReadOnlyAuditRollback)) {
      return NextResponse.json(
        {
          success: false,
          code: 'READ_ONLY_AUDIT_FAILED',
          databaseQueryExecuted: true,
        },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({
    success: true,
    phase: 3,
    environment: 'preview',
    expectedProjectRef: EXPECTED_WEWED_SUPABASE_REF,
    fingerprint,
    databaseQueryExecuted: true,
    transactionMode: 'READ ONLY + ROLLBACK',
    audit,
    temporaryEndpoint: true,
    removalRequiredAfterPhase3: true,
  })
}
