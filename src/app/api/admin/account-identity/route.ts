import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  requireWewedAdmin,
  WewedAdminAccessError,
} from '@/lib/wewed-admin'

export const dynamic = 'force-dynamic'

type AccountRow = {
  accountId: string
  accountName: string
  accountSlug: string
  accountStatus: string
  onboardingStatus: string
  ownerUserId: string | null
  ownerEmail: string | null
  ownerName: string | null
  weddingId: string | null
  weddingTitle: string | null
  weddingSlug: string | null
  weddingDate: Date | null
}

type MembershipRow = {
  id: string
  weddingId: string
  userId: string
  email: string
  name: string | null
  role: string
  status: string
  invitedByEmail: string | null
  acceptedAt: Date | null
  revokedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

type EngagementRow = {
  id: string
  weddingId: string
  plannerUserId: string | null
  plannerEmail: string | null
  plannerName: string | null
  membershipId: string | null
  status: string
  authorityBundle: string | null
  updatedAt: Date
}

type PlannerWorkspaceMembership = {
  id: string
  userId: string
}

function adminError(error: unknown) {
  if (error instanceof WewedAdminAccessError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status },
    )
  }

  console.error('[api/admin/account-identity] Error:', error)
  return NextResponse.json(
    { success: false, error: 'Unable to load account identity diagnostics.' },
    { status: 500 },
  )
}

function iso(value: Date | null) {
  return value?.toISOString() ?? null
}

function plannerAlignment(
  engagement: EngagementRow | undefined,
  activePlannerMemberships: PlannerWorkspaceMembership[],
) {
  if (!engagement) {
    return activePlannerMemberships.length > 0
      ? 'workspace_membership_without_engagement'
      : 'none'
  }

  // Requested, accepted-but-not-active, and paused engagements are valid
  // without active workspace access. Only an active engagement requires a
  // matching active planner membership.
  if (engagement.status !== 'active') return 'aligned'

  const engagementMatchesMembership = activePlannerMemberships.some(
    (membership) =>
      membership.id === engagement.membershipId ||
      membership.userId === engagement.plannerUserId,
  )

  return engagementMatchesMembership
    ? 'aligned'
    : 'engagement_without_matching_workspace_membership'
}

export async function GET(request: NextRequest) {
  try {
    await requireWewedAdmin(request, 'admin.accounts.read')

    const [accountRows, membershipRows] = await Promise.all([
      db.$queryRawUnsafe<AccountRow[]>(`
        SELECT
          ba.id AS "accountId",
          ba.name AS "accountName",
          ba.slug AS "accountSlug",
          ba.status AS "accountStatus",
          ba."onboardingStatus",
          ba."ownerUserId",
          owner.email AS "ownerEmail",
          owner.name AS "ownerName",
          w.id AS "weddingId",
          w.title AS "weddingTitle",
          w.slug AS "weddingSlug",
          w.date AS "weddingDate"
        FROM public."BusinessAccount" ba
        LEFT JOIN public."User" owner ON owner.id = ba."ownerUserId"
        LEFT JOIN public."BusinessAccountLink" bal
          ON bal."businessAccountId" = ba.id
         AND bal."entityType" = 'wedding'
         AND bal.relationship = 'owns'
        LEFT JOIN public."Wedding" w ON w.id = bal."entityId"
        WHERE ba.type = 'couple'
        ORDER BY ba.name, w.date NULLS LAST
      `),
      db.$queryRawUnsafe<MembershipRow[]>(`
        SELECT
          wm.id,
          wm."weddingId",
          wm."userId",
          member.email,
          member.name,
          wm.role,
          wm.status,
          inviter.email AS "invitedByEmail",
          wm."acceptedAt",
          wm."revokedAt",
          wm."createdAt",
          wm."updatedAt"
        FROM public."WeddingMembership" wm
        JOIN public."User" member ON member.id = wm."userId"
        LEFT JOIN public."User" inviter ON inviter.id = wm."invitedById"
        ORDER BY wm."weddingId", wm.role, member.email
      `),
    ])

    let engagementRows: EngagementRow[] = []
    try {
      engagementRows = await db.$queryRawUnsafe<EngagementRow[]>(`
        SELECT
          pe.id,
          pe."weddingId",
          pe."plannerUserId",
          planner.email AS "plannerEmail",
          planner.name AS "plannerName",
          pe."membershipId",
          pe.status,
          pe."authorityBundle",
          pe."updatedAt"
        FROM public."PlannerEngagement" pe
        LEFT JOIN public."User" planner ON planner.id = pe."plannerUserId"
        WHERE pe.status IN ('requested', 'planner_accepted', 'active', 'paused')
        ORDER BY pe."weddingId", pe."updatedAt" DESC
      `)
    } catch (error) {
      console.warn('[api/admin/account-identity] Planner engagement diagnostics unavailable:', error)
    }

    const accounts = new Map<
      string,
      {
        id: string
        name: string
        slug: string
        status: string
        onboardingStatus: string
        owner: {
          userId: string | null
          email: string | null
          name: string | null
        }
        weddings: Array<Record<string, unknown>>
      }
    >()

    for (const row of accountRows) {
      if (!accounts.has(row.accountId)) {
        accounts.set(row.accountId, {
          id: row.accountId,
          name: row.accountName,
          slug: row.accountSlug,
          status: row.accountStatus,
          onboardingStatus: row.onboardingStatus,
          owner: {
            userId: row.ownerUserId,
            email: row.ownerEmail,
            name: row.ownerName,
          },
          weddings: [],
        })
      }

      if (!row.weddingId) continue

      const memberships = membershipRows
        .filter((membership) => membership.weddingId === row.weddingId)
        .map((membership) => ({
          id: membership.id,
          userId: membership.userId,
          email: membership.email,
          name: membership.name,
          role: membership.role,
          status: membership.status,
          invitedByEmail: membership.invitedByEmail,
          acceptedAt: iso(membership.acceptedAt),
          revokedAt: iso(membership.revokedAt),
          createdAt: membership.createdAt.toISOString(),
          updatedAt: membership.updatedAt.toISOString(),
        }))

      const activePlannerMemberships = memberships.filter(
        (membership) =>
          membership.role === 'planner' && membership.status === 'active',
      )
      const engagement = engagementRows.find(
        (candidate) => candidate.weddingId === row.weddingId,
      )
      const alignment = plannerAlignment(
        engagement,
        activePlannerMemberships,
      )

      accounts.get(row.accountId)?.weddings.push({
        id: row.weddingId,
        title: row.weddingTitle,
        slug: row.weddingSlug,
        date: iso(row.weddingDate),
        memberships,
        pendingInvitations: memberships.filter(
          (membership) => membership.status === 'invited',
        ),
        activeOwners: memberships.filter(
          (membership) =>
            membership.role === 'owner' && membership.status === 'active',
        ),
        plannerRelationship: {
          alignment,
          activeWorkspaceMemberships: activePlannerMemberships,
          engagement: engagement
            ? {
                id: engagement.id,
                plannerUserId: engagement.plannerUserId,
                plannerEmail: engagement.plannerEmail,
                plannerName: engagement.plannerName,
                membershipId: engagement.membershipId,
                status: engagement.status,
                authorityBundle: engagement.authorityBundle,
                updatedAt: engagement.updatedAt.toISOString(),
              }
            : null,
        },
      })
    }

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      accounts: Array.from(accounts.values()),
    })
  } catch (error) {
    return adminError(error)
  }
}
