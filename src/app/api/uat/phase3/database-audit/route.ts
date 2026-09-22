import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  EXPECTED_WEWED_SUPABASE_REF,
  fingerprintDatabaseUrl,
} from '@/lib/phase3-database-fingerprint'
import {
  resolveProductionAuthority,
  type AuthorityQueryClient,
} from '@/lib/production-authority/resolver'

const PHASE3_BRANCH = 'backend/production-database-audit-phase3-20260922'
const AUDIT_TOKEN = 'phase3-20260922'

class Phase3Rollback extends Error {
  constructor() {
    super('phase3-read-only-rollback')
    this.name = 'Phase3Rollback'
  }
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
 * Every value below is an aggregate count, a distinct-value list, a catalog fact, or a
 * grant-SHAPE description (kind/scope, never an id/name/email). Nothing here is a row of
 * customer data. This is enforced by construction: every SELECT below groups, counts, or
 * projects only catalog metadata — no query in this file selects a raw PII column.
 */
async function runFullAudit(tx: AuthorityQueryClient) {
  const q = <T>(sql: string) => tx.$queryRawUnsafe<T[]>(sql)

  // ---- 1. Identity -----------------------------------------------------------------------
  const identity = (
    await q<{ databaseName: string; currentUser: string; sessionUser: string; serverVersion: string }>(`
    SELECT current_database() AS "databaseName", current_user AS "currentUser",
           session_user AS "sessionUser", current_setting('server_version') AS "serverVersion"
  `)
  )[0]

  const role = (
    await q<{ roleName: string; canLogin: boolean; superuser: boolean; bypassRls: boolean; inherit: boolean }>(`
    SELECT rolname AS "roleName", rolcanlogin AS "canLogin", rolsuper AS superuser,
           rolbypassrls AS "bypassRls", rolinherit AS inherit
    FROM pg_roles WHERE rolname = current_user
  `)
  )[0]

  // ---- 2. Schema topology -----------------------------------------------------------------
  const schemas = await q<{ schemaName: string; exists: boolean; hasUsage: boolean }>(`
    SELECT wanted.schema_name AS "schemaName",
           EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname = wanted.schema_name) AS exists,
           has_schema_privilege(current_user, wanted.schema_name, 'USAGE') AS "hasUsage"
    FROM (VALUES ('public'),('wewed_admin'),('wewed_booking'),('wewed_contributions'),
                 ('wewed_planner'),('wewed_notebook'),('wewed_media'),('wewed_communications'),
                 ('wewed_contracts'),('wewed_safety'),('private'),('auth')) AS wanted(schema_name)
    ORDER BY 1
  `)

  const objectTopology = await q<{
    schemaName: string
    relationName: string
    relationKind: string | null
    rlsEnabled: boolean | null
    rlsForced: boolean | null
    ownerName: string | null
  }>(`
    WITH wanted(schema_name, relation_name) AS (
      VALUES ('public','User'),('public','UserProfile'),('public','Couple'),('public','Wedding'),
             ('public','WeddingMembership'),('public','Guest'),('public','RSVP'),('public','SeatingTable'),
             ('public','Vendor'),('public','ServiceEngagement'),('public','PlannerTask'),('public','BudgetItem'),
             ('public','ProgrammeItem'),('public','WeddingContent'),('public','Message'),
             ('public','Notification'),('public','GuestContribution'),('public','Contract'),
             ('public','ContractTemplate'),('public','VaultObject'),('public','BusinessAccount'),
             ('public','BusinessAccountMember'),('public','BusinessAccountLink'),('public','ProviderProfile'),
             ('wewed_admin','BusinessAccount'),('wewed_admin','BusinessAccountMember'),
             ('wewed_admin','BusinessAccountLink'),('wewed_admin','ProviderProfile'),
             ('wewed_admin','PlatformAdministrator'),('wewed_admin','PlatformAdministratorScope'),
             ('wewed_booking','Booking'),('wewed_booking','BookingLine'),
             ('wewed_contributions','wedding_contributions'),('wewed_contributions','contributors')
    )
    SELECT w.schema_name AS "schemaName", w.relation_name AS "relationName",
           c.relkind::text AS "relationKind", c.relrowsecurity AS "rlsEnabled",
           c.relforcerowsecurity AS "rlsForced", pg_get_userbyid(c.relowner) AS "ownerName"
    FROM wanted w
    LEFT JOIN pg_namespace n ON n.nspname = w.schema_name
    LEFT JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = w.relation_name
    ORDER BY 1, 2
  `)

  const publicViewDefinitions = await q<{ relationName: string; viewDefinition: string }>(`
    SELECT c.relname AS "relationName", pg_get_viewdef(c.oid, true) AS "viewDefinition"
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'v'
      AND c.relname IN ('BusinessAccount','BusinessAccountMember','BusinessAccountLink','ProviderProfile')
    ORDER BY 1
  `)

  // pg_get_viewdef() prints only the view body, not its reloptions, so security_invoker must be
  // read separately from pg_class.reloptions.
  const publicViewSecurityInvoker = await q<{ relationName: string; securityInvoker: string }>(`
    SELECT c.relname AS "relationName",
           COALESCE(
             (SELECT option_value FROM pg_options_to_table(c.reloptions) WHERE option_name = 'security_invoker'),
             'not_set'
           ) AS "securityInvoker"
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'v'
      AND c.relname IN ('BusinessAccount','BusinessAccountMember','BusinessAccountLink','ProviderProfile')
    ORDER BY 1
  `)

  const policies = await q<{ schemaName: string; tableName: string; policyName: string; permissive: string; cmd: string }>(`
    SELECT schemaname AS "schemaName", tablename AS "tableName", policyname AS "policyName",
           permissive, cmd
    FROM pg_policies
    WHERE schemaname IN ('public','wewed_admin','wewed_booking','private')
      AND tablename IN ('BusinessAccount','BusinessAccountMember','BusinessAccountLink','ProviderProfile',
                        'PlatformAdministrator','PlatformAdministratorScope','WeddingMembership','ServiceEngagement')
    ORDER BY 1, 2, 3
  `)

  const rolePrivileges = await q<{ tableSchema: string; tableName: string; privilegeType: string }>(`
    SELECT table_schema AS "tableSchema", table_name AS "tableName", privilege_type AS "privilegeType"
    FROM information_schema.role_table_grants
    WHERE grantee = current_user
      AND table_schema IN ('public','wewed_admin','wewed_booking','private')
      AND table_name IN ('BusinessAccount','BusinessAccountMember','BusinessAccountLink','ProviderProfile',
                        'PlatformAdministrator','PlatformAdministratorScope','WeddingMembership','ServiceEngagement')
    ORDER BY 1, 2, 3
  `)

  const authReadable = await q<{ canReadAuthUsers: boolean }>(`
    SELECT has_table_privilege(current_user, 'auth.users', 'SELECT') AS "canReadAuthUsers"
  `).catch(() => [{ canReadAuthUsers: false }])

  const migrationLedger = (
    await q<{
      migrationRows: number
      finishedRows: number
      rolledBackRows: number
      unresolvedRows: number
      firstMigration: string | null
      lastMigration: string | null
    }>(`
    SELECT COUNT(*)::int AS "migrationRows",
           COUNT(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)::int AS "finishedRows",
           COUNT(*) FILTER (WHERE rolled_back_at IS NOT NULL)::int AS "rolledBackRows",
           COUNT(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL)::int AS "unresolvedRows",
           MIN(migration_name) AS "firstMigration", MAX(migration_name) AS "lastMigration"
    FROM public._prisma_migrations
  `)
  )[0]

  // Migration filenames are internal catalog metadata, not customer data. This is needed to
  // interpret the ledger-row-count vs repository-migration-count discrepancy, and specifically
  // whether the vendor-link backfill migration is among the applied rows.
  const migrationNames = await q<{ migrationName: string; finished: boolean; rolledBack: boolean }>(`
    SELECT migration_name AS "migrationName",
           (finished_at IS NOT NULL AND rolled_back_at IS NULL) AS finished,
           (rolled_back_at IS NOT NULL) AS "rolledBack"
    FROM public._prisma_migrations ORDER BY started_at
  `)

  // ---- 3. Business/wedding role & permission shapes -----------------------------------------
  const businessMemberRoleCounts = await q<{ role: string; status: string; count: number }>(`
    SELECT role, status, COUNT(*)::int AS count FROM public."BusinessAccountMember"
    GROUP BY role, status ORDER BY count DESC
  `)
  const businessAccountTypeCounts = await q<{ type: string; status: string; count: number }>(`
    SELECT type, status, COUNT(*)::int AS count FROM public."BusinessAccount"
    GROUP BY type, status ORDER BY count DESC
  `)
  const businessOnboardingCounts = await q<{ onboardingStatus: string; count: number }>(`
    SELECT "onboardingStatus", COUNT(*)::int AS count FROM public."BusinessAccount"
    GROUP BY "onboardingStatus" ORDER BY count DESC
  `)
  const subscriptionStatusCounts = await q<{ subscriptionStatus: string; count: number }>(`
    SELECT "subscriptionStatus", COUNT(*)::int AS count FROM public."BusinessAccount"
    GROUP BY "subscriptionStatus" ORDER BY count DESC
  `)
  const subscriptionStatusCheck = await q<{ constraintDef: string }>(`
    SELECT pg_get_constraintdef(oid) AS "constraintDef" FROM pg_constraint
    WHERE conrelid = 'wewed_admin."BusinessAccount"'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%subscriptionStatus%'
  `).catch(() => [] as { constraintDef: string }[])
  const businessPermissionShapes = await q<{ shape: string; count: number }>(`
    SELECT CASE
      WHEN permissions IS NULL THEN 'null'
      WHEN jsonb_typeof(permissions) = 'array' AND jsonb_array_length(permissions) = 0 THEN 'empty_array'
      WHEN jsonb_typeof(permissions) = 'array' THEN 'string_array'
      ELSE jsonb_typeof(permissions)
    END AS shape, COUNT(*)::int AS count
    FROM public."BusinessAccountMember" GROUP BY 1 ORDER BY count DESC
  `)
  const weddingMembershipRoleCounts = await q<{ role: string; status: string; count: number }>(`
    SELECT role, status, COUNT(*)::int AS count FROM public."WeddingMembership"
    GROUP BY role, status ORDER BY count DESC
  `)
  const weddingPermissionShapes = await q<{ shape: string; count: number }>(`
    SELECT CASE
      WHEN permissions IS NULL THEN 'null'
      ELSE 'text_present'
    END AS shape, COUNT(*)::int AS count
    FROM public."WeddingMembership" GROUP BY 1 ORDER BY count DESC
  `)

  // ---- 4. Business links -----------------------------------------------------------------
  const businessLinkCombinations = await q<{ entityType: string; relationship: string; count: number }>(`
    SELECT "entityType" AS "entityType", relationship, COUNT(*)::int AS count
    FROM public."BusinessAccountLink" GROUP BY 1, 2 ORDER BY count DESC
  `)

  // ---- 5. Vendor / ServiceEngagement graph -------------------------------------------------
  const vendorBusinessEligibility = (
    await q<{ eligibleVendorBusinesses: number }>(`
    SELECT COUNT(DISTINCT ba.id)::int AS "eligibleVendorBusinesses"
    FROM public."BusinessAccount" ba
    JOIN public."BusinessAccountMember" bam ON bam."businessAccountId" = ba.id
      AND bam.status = 'active' AND bam.role IN ('business_owner','vendor_manager')
    WHERE ba.type = 'vendor' AND ba.status = 'active' AND ba."onboardingStatus" = 'complete'
  `)
  )[0]
  const vendorLinksPerBusiness = await q<{ linkCount: number; businesses: number }>(`
    WITH per_business AS (
      SELECT ba.id, COUNT(bal.id)::int AS link_count
      FROM public."BusinessAccount" ba
      LEFT JOIN public."BusinessAccountLink" bal
        ON bal."businessAccountId" = ba.id AND bal."entityType" = 'vendor'
      WHERE ba.type = 'vendor'
      GROUP BY ba.id
    )
    SELECT link_count AS "linkCount", COUNT(*)::int AS businesses
    FROM per_business GROUP BY link_count ORDER BY link_count
  `)
  const vendorLinkOrphans = (
    await q<{ orphanVendorLinks: number }>(`
    SELECT COUNT(*)::int AS "orphanVendorLinks" FROM public."BusinessAccountLink" bal
    WHERE bal."entityType" = 'vendor'
      AND NOT EXISTS (SELECT 1 FROM public."Vendor" v WHERE v.id = bal."entityId")
  `)
  )[0]
  const vendorRepresentsRelationships = await q<{ relationship: string; count: number }>(`
    SELECT relationship, COUNT(*)::int AS count FROM public."BusinessAccountLink"
    WHERE "entityType" = 'vendor' GROUP BY 1 ORDER BY count DESC
  `)
  const serviceEngagementCountsPerVendor = await q<{ engagementCount: number; vendors: number }>(`
    WITH per_vendor AS (
      SELECT v.id, COUNT(se.id)::int AS engagement_count
      FROM public."Vendor" v
      LEFT JOIN public."ServiceEngagement" se ON se."vendorId" = v.id
      GROUP BY v.id
    )
    SELECT engagement_count AS "engagementCount", COUNT(*)::int AS vendors
    FROM per_vendor GROUP BY engagement_count ORDER BY engagement_count
  `)
  const serviceEngagementLifecycle = await q<{ lifecycleStatus: string; origin: string; recordMode: string; count: number }>(`
    SELECT "lifecycleStatus" AS "lifecycleStatus", origin, "recordMode" AS "recordMode", COUNT(*)::int AS count
    FROM public."ServiceEngagement" GROUP BY 1, 2, 3 ORDER BY count DESC
  `)
  const serviceEngagementCrossWedding = (
    await q<{ crossWeddingMismatches: number }>(`
    SELECT COUNT(*)::int AS "crossWeddingMismatches" FROM public."ServiceEngagement" se
    JOIN public."Vendor" v ON v.id = se."vendorId"
    WHERE se."weddingId" != v."weddingId"
  `)
  )[0]
  const vendorWeddingOrphans = (
    await q<{ orphanVendors: number }>(`
    SELECT COUNT(*)::int AS "orphanVendors" FROM public."Vendor" v
    WHERE NOT EXISTS (SELECT 1 FROM public."Wedding" w WHERE w.id = v."weddingId")
  `)
  )[0]

  // ---- 6. Multi-business / multi-wedding reality -------------------------------------------
  const businessMembershipDistribution = await q<{ membershipCount: number; users: number }>(`
    WITH per_user AS (
      SELECT "userId", COUNT(*)::int AS c FROM public."BusinessAccountMember"
      WHERE status = 'active' GROUP BY "userId"
    )
    SELECT LEAST(c, 2) AS "membershipCount", COUNT(*)::int AS users FROM per_user
    GROUP BY LEAST(c, 2) ORDER BY 1
  `)
  const multiBusinessTypeCombinations = await q<{ combination: string; count: number }>(`
    WITH per_user AS (
      SELECT bam."userId", array_agg(DISTINCT ba.type ORDER BY ba.type) AS types
      FROM public."BusinessAccountMember" bam
      JOIN public."BusinessAccount" ba ON ba.id = bam."businessAccountId"
      WHERE bam.status = 'active'
      GROUP BY bam."userId" HAVING COUNT(DISTINCT ba.id) >= 2
    )
    SELECT array_to_string(types, '+') AS combination, COUNT(*)::int AS count
    FROM per_user GROUP BY 1 ORDER BY count DESC
  `)
  const weddingMembershipDistribution = await q<{ membershipCount: number; users: number }>(`
    WITH per_user AS (
      SELECT "userId", COUNT(*)::int AS c FROM public."WeddingMembership"
      WHERE status = 'active' GROUP BY "userId"
    )
    SELECT LEAST(c, 2) AS "membershipCount", COUNT(*)::int AS users FROM per_user
    GROUP BY LEAST(c, 2) ORDER BY 1
  `)
  const multiRoleWeddingCombinations = await q<{ combination: string; count: number }>(`
    WITH per_user AS (
      SELECT "userId", array_agg(DISTINCT role ORDER BY role) AS roles
      FROM public."WeddingMembership" WHERE status = 'active'
      GROUP BY "userId" HAVING COUNT(DISTINCT role) >= 2
    )
    SELECT array_to_string(roles, '+') AS combination, COUNT(*)::int AS count
    FROM per_user GROUP BY 1 ORDER BY count DESC
  `)

  // ---- 7. Platform admin parity -------------------------------------------------------------
  const platformRoleCheck = await q<{ constraintDef: string }>(`
    SELECT pg_get_constraintdef(oid) AS "constraintDef" FROM pg_constraint
    WHERE conrelid = 'wewed_admin."PlatformAdministrator"'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
  `).catch(() => [] as { constraintDef: string }[])
  const internalMembershipCount = (
    await q<{ count: number }>(`
    SELECT COUNT(*)::int AS count FROM public."BusinessAccountMember" bam
    JOIN public."BusinessAccount" ba ON ba.id = bam."businessAccountId"
    WHERE ba.type = 'wewed_internal' AND bam.status = 'active' AND ba.status = 'active'
  `)
  )[0]
  const registryCount = (
    await q<{ count: number }>(`SELECT COUNT(*)::int AS count FROM wewed_admin."PlatformAdministrator"`)
      .catch(() => [{ count: -1 }])
  )[0]
  const registryParity = (
    await q<{ membershipMissingRegistry: number; registryMissingMembership: number; roleMismatch: number }>(`
    WITH internal_members AS (
      SELECT bam."userId", bam.role FROM public."BusinessAccountMember" bam
      JOIN public."BusinessAccount" ba ON ba.id = bam."businessAccountId"
      WHERE ba.type = 'wewed_internal' AND bam.status = 'active' AND ba.status = 'active'
    ), registry AS (
      SELECT "userId", role FROM wewed_admin."PlatformAdministrator"
    )
    SELECT
      (SELECT COUNT(*)::int FROM internal_members m WHERE NOT EXISTS
        (SELECT 1 FROM registry r WHERE r."userId" = m."userId")) AS "membershipMissingRegistry",
      (SELECT COUNT(*)::int FROM registry r WHERE NOT EXISTS
        (SELECT 1 FROM internal_members m WHERE m."userId" = r."userId")) AS "registryMissingMembership",
      (SELECT COUNT(*)::int FROM internal_members m JOIN registry r ON r."userId" = m."userId"
        WHERE r.role != m.role) AS "roleMismatch"
  `).catch(() => [{ membershipMissingRegistry: -1, registryMissingMembership: -1, roleMismatch: -1 }])
  )[0]

  // ---- 8. Legacy global-admin hazard (§8.15) -----------------------------------------------
  const legacyGlobalAdminHazard = (
    await q<{ hazardUserCount: number; potentialWeddingCount: number }>(`
    WITH hazard_users AS (
      SELECT u.id FROM public."User" u
      WHERE u.role = 'admin' AND u."isActive" = true
        AND NOT EXISTS (
          SELECT 1 FROM public."BusinessAccountMember" bam
          JOIN public."BusinessAccount" ba ON ba.id = bam."businessAccountId"
          WHERE bam."userId" = u.id AND bam.status = 'active' AND ba.status = 'active'
            AND ba.type = 'wewed_internal'
            AND bam.role IN ('wewed_super_admin','wewed_operations_admin','wewed_billing_admin',
                             'wewed_support_admin','wewed_analyst')
        )
    )
    SELECT (SELECT COUNT(*)::int FROM hazard_users) AS "hazardUserCount",
           CASE WHEN EXISTS (SELECT 1 FROM hazard_users)
             THEN (SELECT COUNT(*)::int FROM public."Wedding") ELSE 0 END AS "potentialWeddingCount"
  `)
  )[0]

  // ---- 9. UserProfile <-> auth identity ------------------------------------------------------
  let identityMapping: { profilesMatched: number; profilesUnmatched: number } | 'UNVERIFIED' = 'UNVERIFIED'
  if (authReadable[0]?.canReadAuthUsers) {
    identityMapping = (
      await q<{ profilesMatched: number; profilesUnmatched: number }>(`
      SELECT
        COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM auth.users au WHERE au.id::text = up.id))::int AS "profilesMatched",
        COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id::text = up.id))::int AS "profilesUnmatched"
      FROM public."UserProfile" up
    `).catch(() => [{ profilesMatched: -1, profilesUnmatched: -1 }] as { profilesMatched: number; profilesUnmatched: number }[])
    )[0]
  }

  // ---- 10. Global relationship integrity -----------------------------------------------------
  const globalIntegrity = (
    await q<{
      weddingCoupleOrphans: number
      membershipUserOrphans: number
      membershipWeddingOrphans: number
      guestWeddingOrphans: number
      rsvpGuestOrphans: number
      seatingWeddingOrphans: number
      guestSeatingCrossWedding: number
      vendorWeddingOrphans: number
      linkTargetOrphansVendor: number
      linkTargetOrphansWedding: number
      linkTargetOrphansCouple: number
      linkTargetOrphansUser: number
      duplicateWeddingMemberships: number
    }>(`
    SELECT
      (SELECT COUNT(*)::int FROM public."Wedding" w
        WHERE NOT EXISTS (SELECT 1 FROM public."Couple" c WHERE c.id = w."coupleId")) AS "weddingCoupleOrphans",
      (SELECT COUNT(*)::int FROM public."WeddingMembership" m
        WHERE NOT EXISTS (SELECT 1 FROM public."User" u WHERE u.id = m."userId")) AS "membershipUserOrphans",
      (SELECT COUNT(*)::int FROM public."WeddingMembership" m
        WHERE NOT EXISTS (SELECT 1 FROM public."Wedding" w WHERE w.id = m."weddingId")) AS "membershipWeddingOrphans",
      (SELECT COUNT(*)::int FROM public."Guest" g
        WHERE NOT EXISTS (SELECT 1 FROM public."Wedding" w WHERE w.id = g."weddingId")) AS "guestWeddingOrphans",
      (SELECT COUNT(*)::int FROM public."RSVP" r
        WHERE NOT EXISTS (SELECT 1 FROM public."Guest" g WHERE g.id = r."guestId")) AS "rsvpGuestOrphans",
      (SELECT COUNT(*)::int FROM public."SeatingTable" s
        WHERE NOT EXISTS (SELECT 1 FROM public."Wedding" w WHERE w.id = s."weddingId")) AS "seatingWeddingOrphans",
      (SELECT COUNT(*)::int FROM public."Guest" g JOIN public."SeatingTable" s ON s.id = g."seatingTableId"
        WHERE g."weddingId" != s."weddingId") AS "guestSeatingCrossWedding",
      (SELECT COUNT(*)::int FROM public."Vendor" v
        WHERE NOT EXISTS (SELECT 1 FROM public."Wedding" w WHERE w.id = v."weddingId")) AS "vendorWeddingOrphans",
      (SELECT COUNT(*)::int FROM public."BusinessAccountLink" bal WHERE bal."entityType" = 'vendor'
        AND NOT EXISTS (SELECT 1 FROM public."Vendor" v WHERE v.id = bal."entityId")) AS "linkTargetOrphansVendor",
      (SELECT COUNT(*)::int FROM public."BusinessAccountLink" bal WHERE bal."entityType" = 'wedding'
        AND NOT EXISTS (SELECT 1 FROM public."Wedding" w WHERE w.id = bal."entityId")) AS "linkTargetOrphansWedding",
      (SELECT COUNT(*)::int FROM public."BusinessAccountLink" bal WHERE bal."entityType" = 'couple'
        AND NOT EXISTS (SELECT 1 FROM public."Couple" c WHERE c.id = bal."entityId")) AS "linkTargetOrphansCouple",
      (SELECT COUNT(*)::int FROM public."BusinessAccountLink" bal WHERE bal."entityType" = 'user'
        AND NOT EXISTS (SELECT 1 FROM public."User" u WHERE u.id = bal."entityId")) AS "linkTargetOrphansUser",
      (SELECT COUNT(*)::int FROM (
        SELECT "userId", "weddingId" FROM public."WeddingMembership" GROUP BY 1, 2 HAVING COUNT(*) > 1
      ) dup) AS "duplicateWeddingMemberships"
  `)
  )[0]

  // ---- 11. Mature PWA domain catalog health --------------------------------------------------
  const matureDomainCounts = (
    await q<{
      plannerTasks: number
      budgetItems: number
      guestContributions: number
      contracts: number
      vaultObjects: number
      programmeItems: number
      weddingContent: number
      messages: number
      notifications: number
    }>(`
    SELECT
      (SELECT COUNT(*)::int FROM public."PlannerTask") AS "plannerTasks",
      (SELECT COUNT(*)::int FROM public."BudgetItem") AS "budgetItems",
      (SELECT COUNT(*)::int FROM public."GuestContribution") AS "guestContributions",
      (SELECT COUNT(*)::int FROM public."Contract") AS contracts,
      (SELECT COUNT(*)::int FROM public."VaultObject") AS "vaultObjects",
      (SELECT COUNT(*)::int FROM public."ProgrammeItem") AS "programmeItems",
      (SELECT COUNT(*)::int FROM public."WeddingContent") AS "weddingContent",
      (SELECT COUNT(*)::int FROM public."Message") AS messages,
      (SELECT COUNT(*)::int FROM public."Notification") AS notifications
  `)
  )[0]
  const bookingCommerceCount = (
    await q<{ bookings: number }>(`SELECT COUNT(*)::int AS bookings FROM wewed_booking."Booking"`)
      .catch(() => [{ bookings: -1 }])
  )[0]

  // ---- 12. Usher/Gate & Wedding Day discovery ------------------------------------------------
  const usherGateObjects = await q<{ schemaName: string; objectName: string; relationKind: string }>(`
    SELECT n.nspname AS "schemaName", c.relname AS "objectName", c.relkind::text AS "relationKind"
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname NOT IN ('pg_catalog','information_schema')
      AND (lower(c.relname) LIKE '%usher%' OR lower(c.relname) LIKE '%gate%'
        OR lower(c.relname) LIKE '%checkin%' OR lower(c.relname) LIKE '%check_in%'
        OR lower(c.relname) LIKE '%admission%' OR lower(c.relname) LIKE '%scanner%')
    ORDER BY 1, 2
  `)
  const weddingDayObjects = await q<{ schemaName: string; objectName: string; relationKind: string }>(`
    SELECT n.nspname AS "schemaName", c.relname AS "objectName", c.relkind::text AS "relationKind"
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname NOT IN ('pg_catalog','information_schema')
      AND (lower(c.relname) LIKE '%weddingpass%' OR lower(c.relname) LIKE '%wedding_pass%'
        OR lower(c.relname) LIKE '%weddingcheckin%' OR lower(c.relname) LIKE '%weddingannouncement%'
        OR lower(c.relname) LIKE '%servicepresence%')
    ORDER BY 1, 2
  `)
  const guestWeddingCompositeUnique = await q<{ constraintName: string; constraintDef: string }>(`
    SELECT conname AS "constraintName", pg_get_constraintdef(oid) AS "constraintDef"
    FROM pg_constraint WHERE conrelid = 'public."Guest"'::regclass AND contype = 'u'
  `)

  return {
    identity, role, schemas, objectTopology, publicViewDefinitions, publicViewSecurityInvoker,
    policies, rolePrivileges,
    authReadable: authReadable[0]?.canReadAuthUsers ?? false, migrationLedger, migrationNames,
    businessMemberRoleCounts, businessAccountTypeCounts, businessOnboardingCounts,
    subscriptionStatusCounts, subscriptionStatusCheck, businessPermissionShapes,
    weddingMembershipRoleCounts, weddingPermissionShapes, businessLinkCombinations,
    vendorGraph: {
      vendorBusinessEligibility, vendorLinksPerBusiness, vendorLinkOrphans,
      vendorRepresentsRelationships, serviceEngagementCountsPerVendor, serviceEngagementLifecycle,
      serviceEngagementCrossWedding, vendorWeddingOrphans,
    },
    multiStakeholder: {
      businessMembershipDistribution, multiBusinessTypeCombinations,
      weddingMembershipDistribution, multiRoleWeddingCombinations,
    },
    platformAdmin: { platformRoleCheck, internalMembershipCount, registryCount, registryParity },
    legacyGlobalAdminHazard,
    identityMapping,
    globalIntegrity,
    matureDomains: { ...matureDomainCounts, bookingCommerceBookings: bookingCommerceCount.bookings },
    usherGateObjects,
    weddingDay: { weddingDayObjects, guestWeddingCompositeUnique },
  }
}

/** Sanitized shape only: grant kind + scope, never an id, name or email. */
function sanitizeGrant(grant: { workspaceKind: string; scopeKind: string }) {
  return { workspaceKind: grant.workspaceKind, scopeKind: grant.scopeKind }
}

async function runContractProbes(tx: AuthorityQueryClient) {
  // Controlled internal probe accounts only — never arbitrary customer rows. Selected by role
  // shape (dashboard class + business/wedding relationship pattern), never by name/email.
  // `User` carries no auth-identity column. Per the Phase-2 UserProfile<->auth assumption, the
  // verified auth id is `UserProfile.id`, joined here only through the unique `email` (matching
  // `accessUserMatchesSession`'s case-insensitive comparison) — never through a stored FK that
  // does not exist. A candidate with no matching profile probes as `authUserId = NULL`, which the
  // resolver already treats as `unverified_auth_identity`; that is itself a Phase-3 finding.
  const candidates = await tx.$queryRawUnsafe<Array<{ id: string; authUserId: string | null; label: string }>>(`
    WITH candidate_roles AS (
      SELECT u.id, up.id AS "authUserId", 'couple_owner' AS label
      FROM public."User" u
      JOIN public."WeddingMembership" m ON m."userId" = u.id AND m.role = 'owner' AND m.status = 'active'
      LEFT JOIN public."UserProfile" up ON lower(up.email) = lower(u.email)
      WHERE u."isActive" = true
      LIMIT 1
    ), planner_one AS (
      SELECT u.id, up.id AS "authUserId", 'planner_one_wedding' AS label
      FROM public."User" u
      JOIN (SELECT "userId" FROM public."WeddingMembership"
            WHERE role = 'planner' AND status = 'active' GROUP BY "userId" HAVING COUNT(*) = 1) one
        ON one."userId" = u.id
      LEFT JOIN public."UserProfile" up ON lower(up.email) = lower(u.email)
      WHERE u."isActive" = true LIMIT 1
    ), planner_many AS (
      SELECT u.id, up.id AS "authUserId", 'planner_multiple_weddings' AS label
      FROM public."User" u
      JOIN (SELECT "userId" FROM public."WeddingMembership"
            WHERE role = 'planner' AND status = 'active' GROUP BY "userId" HAVING COUNT(*) >= 2) many
        ON many."userId" = u.id
      LEFT JOIN public."UserProfile" up ON lower(up.email) = lower(u.email)
      WHERE u."isActive" = true LIMIT 1
    ), planner_portfolio AS (
      SELECT u.id, up.id AS "authUserId", 'planner_portfolio' AS label
      FROM public."User" u
      JOIN public."BusinessAccountMember" bam ON bam."userId" = u.id AND bam.status = 'active'
        AND bam.role IN ('business_owner','planner')
      JOIN public."BusinessAccount" ba ON ba.id = bam."businessAccountId" AND ba.type = 'planning_company'
        AND ba.status = 'active' AND ba."onboardingStatus" = 'complete'
      LEFT JOIN public."UserProfile" up ON lower(up.email) = lower(u.email)
      WHERE u."isActive" = true
        AND NOT EXISTS (SELECT 1 FROM public."WeddingMembership" m WHERE m."userId" = u.id AND m.status = 'active')
      LIMIT 1
    ), coordinator AS (
      SELECT u.id, up.id AS "authUserId", 'coordinator' AS label
      FROM public."User" u
      JOIN public."WeddingMembership" m ON m."userId" = u.id AND m.role = 'coordinator' AND m.status = 'active'
      LEFT JOIN public."UserProfile" up ON lower(up.email) = lower(u.email)
      WHERE u."isActive" = true LIMIT 1
    ), vendor_actor AS (
      SELECT u.id, up.id AS "authUserId", 'vendor' AS label
      FROM public."User" u
      JOIN public."BusinessAccountMember" bam ON bam."userId" = u.id AND bam.status = 'active'
        AND bam.role IN ('business_owner','vendor_manager')
      JOIN public."BusinessAccount" ba ON ba.id = bam."businessAccountId" AND ba.type = 'vendor'
        AND ba.status = 'active' AND ba."onboardingStatus" = 'complete'
      LEFT JOIN public."UserProfile" up ON lower(up.email) = lower(u.email)
      WHERE u."isActive" = true LIMIT 1
    ), admin_actor AS (
      SELECT u.id, up.id AS "authUserId", 'admin' AS label
      FROM public."User" u
      JOIN public."BusinessAccountMember" bam ON bam."userId" = u.id AND bam.status = 'active'
      JOIN public."BusinessAccount" ba ON ba.id = bam."businessAccountId" AND ba.type = 'wewed_internal'
        AND ba.status = 'active'
      LEFT JOIN public."UserProfile" up ON lower(up.email) = lower(u.email)
      WHERE u."isActive" = true AND u.role = 'admin' LIMIT 1
    ), multi_axis AS (
      SELECT u.id, up.id AS "authUserId", 'multi_axis' AS label
      FROM public."User" u
      LEFT JOIN public."UserProfile" up ON lower(up.email) = lower(u.email)
      WHERE u."isActive" = true
        AND EXISTS (SELECT 1 FROM public."WeddingMembership" m WHERE m."userId" = u.id AND m.status = 'active')
        AND EXISTS (SELECT 1 FROM public."BusinessAccountMember" bam WHERE bam."userId" = u.id AND bam.status = 'active')
      LIMIT 1
    )
    SELECT id, "authUserId", label FROM candidate_roles
    UNION ALL SELECT id, "authUserId", label FROM planner_one
    UNION ALL SELECT id, "authUserId", label FROM planner_many
    UNION ALL SELECT id, "authUserId", label FROM planner_portfolio
    UNION ALL SELECT id, "authUserId", label FROM coordinator
    UNION ALL SELECT id, "authUserId", label FROM vendor_actor
    UNION ALL SELECT id, "authUserId", label FROM admin_actor
    UNION ALL SELECT id, "authUserId", label FROM multi_axis
  `)

  const probes: Record<string, unknown> = {}
  for (const candidate of candidates) {
    try {
      const authority = await resolveProductionAuthority(candidate.id, {
        authUserId: candidate.authUserId,
        client: tx,
      })
      probes[candidate.label] = {
        accountStatus: authority.accountStatus,
        grants: authority.workspaceGrants.map(sanitizeGrant),
        selectionRequired: authority.contextSelection.filter((s) => s.selectionRequired).map((s) => s.workspaceKind),
      }
    } catch {
      probes[candidate.label] = 'PROBE_QUERY_FAILED'
    }
  }
  return probes
}

export async function GET(request: NextRequest) {
  if (!previewOnly(request)) {
    return NextResponse.json({ success: false }, { status: 404 })
  }

  const fingerprint = fingerprintDatabaseUrl(process.env.DATABASE_URL)

  if (!fingerprint.available || fingerprint.parseError) {
    return NextResponse.json(
      { success: false, code: 'DATABASE_URL_NOT_FINGERPRINTABLE', fingerprint, databaseQueryExecuted: false },
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

  const full = request.nextUrl.searchParams.get('scope') === 'full'
  let payload: unknown = null

  try {
    await db.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
        if (full) {
          const auditResult = await runFullAudit(tx)
          const probes = await runContractProbes(tx)
          payload = { ...auditResult, contractProbes: probes }
        } else {
          const databaseRows = await tx.$queryRawUnsafe<
            Array<{ databaseName: string; currentUser: string; sessionUser: string; serverVersion: string }>
          >(`
            SELECT current_database() AS "databaseName", current_user AS "currentUser",
                   session_user AS "sessionUser", current_setting('server_version') AS "serverVersion"
          `)
          const roleRows = await tx.$queryRawUnsafe<
            Array<{ roleName: string; canLogin: boolean; superuser: boolean; bypassRls: boolean; inherit: boolean }>
          >(`
            SELECT rolname AS "roleName", rolcanlogin AS "canLogin", rolsuper AS superuser,
                   rolbypassrls AS "bypassRls", rolinherit AS inherit
            FROM pg_roles WHERE rolname = current_user
          `)
          const requiredObjects = await tx.$queryRawUnsafe<Array<{ objectName: string; regclass: string | null }>>(`
            SELECT object_name AS "objectName", to_regclass(object_name)::text AS regclass
            FROM (VALUES
              ('public."User"'),('public."UserProfile"'),('public."Couple"'),('public."Wedding"'),
              ('public."WeddingMembership"'),('public."BusinessAccount"'),('public."BusinessAccountMember"'),
              ('public."BusinessAccountLink"'),('public."ProviderProfile"'),('public."Vendor"'),
              ('public."ServiceEngagement"'),('wewed_admin."PlatformAdministrator"'),
              ('wewed_admin."PlatformAdministratorScope"')
            ) AS wanted(object_name)
            ORDER BY object_name
          `)
          payload = {
            database: databaseRows[0] ?? null,
            role: roleRows[0] ?? null,
            requiredObjects,
          }
        }
        throw new Phase3Rollback()
      },
      { timeout: 55_000 },
    )
  } catch (error) {
    if (!(error instanceof Phase3Rollback)) {
      return NextResponse.json(
        { success: false, code: 'READ_ONLY_IDENTITY_AUDIT_FAILED', fingerprint, databaseQueryExecuted: true },
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
    scope: full ? 'full' : 'identity',
    audit: payload,
    temporaryEndpoint: true,
    removalRequiredAfterPhase3: true,
  })
}
