import 'server-only'

import { db } from '@/lib/db'
import {
  BUSINESS_TEAM_MANAGEMENT_ACCESS,
  GOVERNED_WEDDING_ACCESS,
  resolveWeddingPermissions,
  type MembershipRole,
} from '@/lib/wedding-access'
import type {
  BusinessLinkEvidence,
  BusinessMembershipEvidence,
  GateAssignmentEvidence,
  IdentityEvidence,
  PlatformRegistryEvidence,
  ProductionAuthorityEvidence,
  ProfileEvidence,
  ProviderProfileEvidence,
  VendorEngagementEvidence,
  WeddingMembershipEvidence,
  WewedProductionAuthorityV1,
} from './contract'
import { buildProductionAuthority } from './grants'

/**
 * Resolves WewedProductionAuthorityV1 for an access user. READ-ONLY.
 *
 * Unlike /api/auth/me this never accepts pending memberships, never changes currentWeddingId,
 * never sets a cookie and never selects a wedding. It reads relationships and reports them.
 *
 * It is not an authentication system. The caller must already have verified the account through
 * existing Wewed authority (the Supabase user bound to the AppSession, as /api/auth/me does) and
 * pass BOTH ids. `authUserId` is required: when it is missing or blank the result is
 * `unverified_auth_identity` with no grants. Native transport is master plan Phase 5.
 */
export async function resolveProductionAuthority(
  accessUserId: string,
  options: { authUserId: string | null },
): Promise<WewedProductionAuthorityV1> {
  return buildProductionAuthority(await loadProductionAuthorityEvidence(accessUserId, options))
}

const KNOWN_MEMBERSHIP_ROLES = new Set<MembershipRole>(['owner', 'planner', 'coordinator', 'viewer'])

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
  if (typeof value === 'string') {
    try {
      return stringArray(JSON.parse(value))
    } catch {
      return []
    }
  }
  return []
}

export async function loadProductionAuthorityEvidence(
  accessUserId: string,
  options: { authUserId: string | null },
): Promise<ProductionAuthorityEvidence> {
  const authUserId = options.authUserId?.trim() || null

  const [identityRows, profileRows, businessRows, weddingRows, registry, gateAssignments] = await Promise.all([
    db.$queryRawUnsafe<Array<Omit<IdentityEvidence, 'accessUserId' | 'authUserId' | 'userRole'> & { id: string; role: string }>>(
      `SELECT id, email, name, role, "coupleId", "isActive" FROM public."User" WHERE id = $1`,
      accessUserId,
    ),
    authUserId
      ? db.$queryRawUnsafe<Array<{ displayName: string | null; role: string | null; isBanned: boolean }>>(
          `SELECT "displayName", role, "isBanned" FROM public."UserProfile" WHERE id = $1`,
          authUserId,
        )
      : Promise.resolve([]),
    db.$queryRawUnsafe<Array<Omit<BusinessMembershipEvidence, 'permissions'> & { permissions: unknown }>>(
      `SELECT bam.id AS "membershipId", bam."businessAccountId", ba.name AS "businessName",
              ba.type AS "businessType", ba.status AS "businessStatus", ba."onboardingStatus",
              ba."subscriptionStatus", ba."ownerUserId", bam.role, bam.status, bam.permissions
         FROM public."BusinessAccountMember" bam
         JOIN public."BusinessAccount" ba ON ba.id = bam."businessAccountId"
        WHERE bam."userId" = $1
        ORDER BY ba."createdAt" ASC, bam.id ASC`,
      accessUserId,
    ),
    db.$queryRawUnsafe<Array<{
      membershipId: string; weddingId: string; slug: string; title: string; date: Date; coupleId: string
      role: string; status: string; permissions: string | null; governedAccess: boolean; businessCanManageMembers: boolean
    }>>(
      `SELECT m.id AS "membershipId", w.id AS "weddingId", w.slug, w.title, w.date, w."coupleId",
              m.role, m.status, m.permissions,
              (TRUE ${GOVERNED_WEDDING_ACCESS}) AS "governedAccess",
              ${BUSINESS_TEAM_MANAGEMENT_ACCESS} AS "businessCanManageMembers"
         FROM public."WeddingMembership" m
         JOIN public."Wedding" w ON w.id = m."weddingId"
        WHERE m."userId" = $1
        ORDER BY w.date ASC, w."createdAt" ASC, m.id ASC`,
      accessUserId,
    ),
    loadPlatformRegistry(accessUserId),
    loadGateAssignments(accessUserId),
  ])

  const activeBusinessIds = businessRows.filter((row) => row.status === 'active').map((row) => row.businessAccountId)

  const [linkRows, profileEvidenceRows, vendorRows] = activeBusinessIds.length
    ? await Promise.all([
        db.$queryRawUnsafe<BusinessLinkEvidence[]>(
          `SELECT id AS "linkId", "businessAccountId", "entityType", "entityId", relationship
             FROM public."BusinessAccountLink"
            WHERE "businessAccountId" = ANY($1::text[])
            ORDER BY "businessAccountId", "entityType", "entityId"`,
          activeBusinessIds,
        ),
        db.$queryRawUnsafe<ProviderProfileEvidence[]>(
          `SELECT "businessAccountId", "listingStatus", visibility, "isClaimable"
             FROM public."ProviderProfile"
            WHERE "businessAccountId" = ANY($1::text[])
            ORDER BY "businessAccountId"`,
          activeBusinessIds,
        ),
        db.$queryRawUnsafe<Array<Omit<VendorEngagementEvidence, 'serviceEngagements'> & { serviceEngagements: unknown }>>(
          `SELECT bal.id AS "linkId", bal."businessAccountId", bal.relationship AS "linkRelationship",
                  v.id AS "vendorId", v.name AS "vendorName", v."weddingId",
                  COALESCE(
                    json_agg(json_build_object(
                      'serviceEngagementId', se.id,
                      'lifecycleStatus', se."lifecycleStatus",
                      'origin', se.origin,
                      'recordMode', se."recordMode"
                    ) ORDER BY se.id) FILTER (WHERE se.id IS NOT NULL),
                    '[]'::json
                  ) AS "serviceEngagements"
             FROM public."BusinessAccountLink" bal
             JOIN public."Vendor" v ON v.id = bal."entityId"
             LEFT JOIN public."ServiceEngagement" se
               ON se."vendorId" = v.id AND se."weddingId" = v."weddingId"
            WHERE bal."entityType" = 'vendor'
              AND bal."businessAccountId" = ANY($1::text[])
            GROUP BY bal.id, bal."businessAccountId", bal.relationship, v.id, v.name, v."weddingId"
            ORDER BY bal."businessAccountId", v."weddingId", v.id`,
          activeBusinessIds,
        ),
      ])
    : [[], [], []]

  const identityRow = identityRows[0]
  const identity: IdentityEvidence | null = identityRow
    ? {
        accessUserId: identityRow.id,
        authUserId,
        email: identityRow.email,
        name: identityRow.name,
        userRole: identityRow.role,
        coupleId: identityRow.coupleId,
        isActive: identityRow.isActive,
      }
    : null
  const profileRow = profileRows[0]
  const profile: ProfileEvidence | null = profileRow
    ? { displayName: profileRow.displayName, profileRole: profileRow.role, isBanned: profileRow.isBanned }
    : null

  const weddingMemberships: WeddingMembershipEvidence[] = weddingRows.map((row) => ({
    membershipId: row.membershipId,
    weddingId: row.weddingId,
    slug: row.slug,
    title: row.title,
    date: new Date(row.date).toISOString(),
    coupleId: row.coupleId,
    role: row.role,
    status: row.status,
    governedAccess: Boolean(row.governedAccess),
    // Resolved exactly as the PWA resolves it; an unrecognised role resolves to nothing.
    permissions: KNOWN_MEMBERSHIP_ROLES.has(row.role as MembershipRole)
      ? resolveWeddingPermissions(row.permissions, row.role as MembershipRole, Boolean(row.businessCanManageMembers))
      : [],
  }))

  return {
    identity,
    profile,
    businessMemberships: businessRows.map((row) => ({ ...row, permissions: stringArray(row.permissions) })),
    businessLinks: linkRows,
    providerProfiles: profileEvidenceRows,
    weddingMemberships,
    vendorEngagements: vendorRows.map((row) => ({
      ...row,
      serviceEngagements: Array.isArray(row.serviceEngagements)
        ? (row.serviceEngagements as VendorEngagementEvidence['serviceEngagements'])
        : [],
    })),
    platformRegistry: registry,
    gateAssignments,
  }
}

/** Reads gate assignments and linked gates for an access user. */
async function loadGateAssignments(userId: string): Promise<GateAssignmentEvidence[]> {
  try {
    const rows = await db.$queryRawUnsafe<Array<{
      assignmentId: string
      weddingId: string
      weddingTitle: string
      gateId: string
      gateName: string
      gateStatus: string
      userId: string
      operatorRole: string
      capabilities: unknown
      activeFrom: Date
      expiresAt: Date | null
      revokedAt: Date | null
      revokedByUserId: string | null
      createdByUserId: string | null
    }>>(
      `SELECT a.id AS "assignmentId", a."weddingId", w.title AS "weddingTitle",
              a."gateId", g.name AS "gateName", g.status AS "gateStatus",
              a."userId", a."operatorRole", a.capabilities,
              a."activeFrom", a."expiresAt", a."revokedAt",
              a."revokedByUserId", a."createdByUserId"
         FROM public."WeddingGateAssignment" a
         JOIN public."WeddingGate" g ON g.id = a."gateId" AND g."weddingId" = a."weddingId"
         JOIN public."Wedding" w ON w.id = a."weddingId"
        WHERE a."userId" = $1
        ORDER BY w.date ASC, g.name ASC, a."createdAt" ASC`,
      userId,
    )
    return rows.map((row) => ({
      assignmentId: row.assignmentId,
      weddingId: row.weddingId,
      weddingTitle: row.weddingTitle,
      gateId: row.gateId,
      gateName: row.gateName,
      gateStatus: row.gateStatus,
      userId: row.userId,
      operatorRole: row.operatorRole,
      capabilities: stringArray(row.capabilities),
      activeFrom: new Date(row.activeFrom).toISOString(),
      expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
      revokedAt: row.revokedAt ? new Date(row.revokedAt).toISOString() : null,
      revokedByUserId: row.revokedByUserId,
      createdByUserId: row.createdByUserId,
    }))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('WeddingGateAssignment') || message.includes('does not exist')) {
      return []
    }
    throw error
  }
}

/** Reads the platform registry the way `readPlatformRegistry` (wewed-admin.ts) does. */
async function loadPlatformRegistry(userId: string): Promise<PlatformRegistryEvidence> {
  try {
    const rows = await db.$queryRawUnsafe<Array<{ role: string; status: string }>>(
      `SELECT role, status FROM wewed_admin."PlatformAdministrator" WHERE "userId" = $1 LIMIT 1`,
      userId,
    )
    const row = rows[0]
    if (!row) return { state: 'missing', role: null, status: null, scopes: [] }
    const scopes = await db.$queryRawUnsafe<Array<{ scopeType: string; scopeValue: string }>>(
      `SELECT "scopeType", "scopeValue" FROM wewed_admin."PlatformAdministratorScope"
        WHERE "administratorUserId" = $1 ORDER BY "scopeType", "scopeValue"`,
      userId,
    )
    return { state: row.status === 'active' ? 'active' : 'inactive', role: row.role, status: row.status, scopes }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('PlatformAdministrator') || message.includes('does not exist')) {
      return { state: 'missing', role: null, status: null, scopes: [] }
    }
    throw error
  }
}
