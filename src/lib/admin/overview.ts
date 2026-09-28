import 'server-only'

import { db } from '@/lib/db'
import { isRestrictiveAccountStatus, normalizeAccountLifecycleStatus } from '@/lib/wewed-admin-policy'

/**
 * Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 closure §4.
 *
 * Extracted, unchanged, from `/api/admin/overview`'s GET handler (the queries and derived
 * `analytics`/`accounts` shaping are copied verbatim) so the PWA route and the native
 * `/api/native/admin/overview` route call the exact same mature business logic instead of native
 * growing a second implementation of "what counts as an at-risk account" or how analytics are
 * derived. Per-section reads (`canReadBilling`/etc.) are still gated by the caller, matching the
 * PWA's own permission-scoped section visibility — a support-only administrator gets `supportCases`
 * but not `payments`, on both transports identically.
 */
export interface AdminOverviewPermissions {
  canReadBilling: boolean
  canReadSupport: boolean
  canReadIncidents: boolean
  canReadAudit: boolean
  canReadMembers: boolean
}

export async function loadAdminOverview(permissions: AdminOverviewPermissions) {
  const { canReadBilling, canReadSupport, canReadIncidents, canReadAudit, canReadMembers } = permissions

  const [
    summaryRows,
    accountRows,
    memberRows,
    linkRows,
    supportRows,
    incidentRows,
    paymentRows,
    auditRows,
    adminUserRows,
  ] = await Promise.all([
    db.$queryRawUnsafe<
      Array<{
        businessAccounts: number
        activeAccounts: number
        pendingReviewAccounts: number
        restrictedAccounts: number
        couples: number
        weddings: number
        upcomingWeddings: number
        completedWeddings: number
        weddingsWithoutActiveOwner: number
        planners: number
        venues: number
        vendors: number
        activeSubscriptions: number
        openSupportCases: number
        urgentSupportCases: number
        openIncidents: number
        paidRevenueCents: number
        pendingRevenueCents: number
        accountsWithoutOwner: number
        accountsWithoutMembers: number
        incompleteOnboarding: number
      }>
    >(`
      SELECT
        (SELECT COUNT(*)::int FROM public."BusinessAccount" WHERE type <> 'wewed_internal') AS "businessAccounts",
        (SELECT COUNT(*)::int FROM public."BusinessAccount" WHERE type <> 'wewed_internal' AND status = 'active') AS "activeAccounts",
        (SELECT COUNT(*)::int FROM public."BusinessAccount" WHERE type <> 'wewed_internal' AND status = 'pending_review') AS "pendingReviewAccounts",
        (SELECT COUNT(*)::int FROM public."BusinessAccount" WHERE type <> 'wewed_internal' AND status IN ('rejected', 'suspended', 'blocked', 'cancelled', 'archived')) AS "restrictedAccounts",
        (SELECT COUNT(*)::int FROM public."Couple") AS couples,
        (SELECT COUNT(*)::int FROM public."Wedding") AS weddings,
        (SELECT COUNT(*)::int FROM public."Wedding" WHERE date >= CURRENT_TIMESTAMP) AS "upcomingWeddings",
        (SELECT COUNT(*)::int FROM public."Wedding" WHERE date < CURRENT_TIMESTAMP) AS "completedWeddings",
        (SELECT COUNT(*)::int FROM public."Wedding" w WHERE NOT EXISTS (
          SELECT 1 FROM public."WeddingMembership" wm
          WHERE wm."weddingId" = w.id AND wm.status = 'active' AND wm.role = 'owner'
        )) AS "weddingsWithoutActiveOwner",
        (SELECT COUNT(*)::int FROM public."User" WHERE role = 'planner' AND "isActive" = true) AS planners,
        (SELECT COUNT(*)::int FROM public."BusinessAccount" WHERE type = 'venue') AS venues,
        (SELECT COUNT(*)::int FROM public."BusinessAccount" WHERE type = 'vendor') AS vendors,
        (SELECT COUNT(*)::int FROM public."BusinessAccount" WHERE "subscriptionStatus" IN ('active', 'trialing')) AS "activeSubscriptions",
        (SELECT COUNT(*)::int FROM public."SupportCase" WHERE status NOT IN ('resolved', 'closed')) AS "openSupportCases",
        (SELECT COUNT(*)::int FROM public."SupportCase" WHERE status NOT IN ('resolved', 'closed') AND priority IN ('urgent', 'high')) AS "urgentSupportCases",
        (SELECT COUNT(*)::int FROM public."PlatformIncident" WHERE status <> 'resolved') AS "openIncidents",
        (SELECT COALESCE(SUM("amountCents"), 0)::double precision FROM public."PaymentRecord" WHERE status = 'paid') AS "paidRevenueCents",
        (SELECT COALESCE(SUM("amountCents"), 0)::double precision FROM public."PaymentRecord" WHERE status IN ('pending', 'due')) AS "pendingRevenueCents",
        (SELECT COUNT(*)::int FROM public."BusinessAccount" WHERE type <> 'wewed_internal' AND "ownerUserId" IS NULL) AS "accountsWithoutOwner",
        (SELECT COUNT(*)::int FROM public."BusinessAccount" ba WHERE ba.type <> 'wewed_internal' AND NOT EXISTS (
          SELECT 1 FROM public."BusinessAccountMember" bam
          WHERE bam."businessAccountId" = ba.id AND bam.status = 'active'
        )) AS "accountsWithoutMembers",
        (SELECT COUNT(*)::int FROM public."BusinessAccount" WHERE type <> 'wewed_internal' AND "onboardingStatus" <> 'complete') AS "incompleteOnboarding"
    `),
    db.$queryRawUnsafe<
      Array<{
        id: string
        name: string
        slug: string
        type: string
        status: string
        ownerUserId: string | null
        ownerEmail: string | null
        ownerName: string | null
        ownerLastLoginAt: Date | null
        onboardingStatus: string
        subscriptionPlan: string
        subscriptionStatus: string
        trialEndsAt: Date | null
        currentPeriodEndsAt: Date | null
        notes: string | null
        metadata: Record<string, unknown>
        memberCount: number
        activeMemberCount: number
        weddingCount: number
        linkedEntityCount: number
        lastActivityAt: Date
        createdAt: Date
        updatedAt: Date
      }>
    >(`
      SELECT
        ba.id,
        ba.name,
        ba.slug,
        ba.type,
        ba.status,
        ba."ownerUserId",
        owner.email AS "ownerEmail",
        owner.name AS "ownerName",
        owner."lastLoginAt" AS "ownerLastLoginAt",
        ba."onboardingStatus",
        ba."subscriptionPlan",
        ba."subscriptionStatus",
        ba."trialEndsAt",
        ba."currentPeriodEndsAt",
        ba.notes,
        ba.metadata,
        (SELECT COUNT(*)::int FROM public."BusinessAccountMember" bam WHERE bam."businessAccountId" = ba.id) AS "memberCount",
        (SELECT COUNT(*)::int FROM public."BusinessAccountMember" bam WHERE bam."businessAccountId" = ba.id AND bam.status = 'active') AS "activeMemberCount",
        (SELECT COUNT(*)::int FROM public."BusinessAccountLink" bal WHERE bal."businessAccountId" = ba.id AND bal."entityType" = 'wedding') AS "weddingCount",
        (SELECT COUNT(*)::int FROM public."BusinessAccountLink" bal WHERE bal."businessAccountId" = ba.id) AS "linkedEntityCount",
        COALESCE(
          (SELECT MAX(u."lastLoginAt") FROM public."BusinessAccountMember" bam JOIN public."User" u ON u.id = bam."userId" WHERE bam."businessAccountId" = ba.id),
          owner."lastLoginAt",
          ba."updatedAt"
        ) AS "lastActivityAt",
        ba."createdAt",
        ba."updatedAt"
      FROM public."BusinessAccount" ba
      LEFT JOIN public."User" owner ON owner.id = ba."ownerUserId"
      ORDER BY CASE ba.type
        WHEN 'wewed_internal' THEN 0
        WHEN 'planning_company' THEN 1
        WHEN 'couple' THEN 2
        WHEN 'venue' THEN 3
        WHEN 'vendor' THEN 4
        ELSE 5
      END, ba.name
    `),
    db.$queryRawUnsafe<
      Array<{
        id: string
        businessAccountId: string
        userId: string
        role: string
        status: string
        permissions: unknown
        email: string
        name: string | null
        userActive: boolean
        lastLoginAt: Date | null
        createdAt: Date
        updatedAt: Date
      }>
    >(`
      SELECT bam.id, bam."businessAccountId", bam."userId", bam.role, bam.status,
        bam.permissions, u.email, u.name, u."isActive" AS "userActive", u."lastLoginAt",
        bam."createdAt", bam."updatedAt"
      FROM public."BusinessAccountMember" bam
      JOIN public."User" u ON u.id = bam."userId"
      ORDER BY bam."businessAccountId", u.email
    `),
    db.$queryRawUnsafe<
      Array<{
        id: string
        businessAccountId: string
        entityType: string
        entityId: string
        relationship: string
        displayName: string
        createdAt: Date
      }>
    >(`
      SELECT bal.id, bal."businessAccountId", bal."entityType", bal."entityId", bal.relationship,
        COALESCE(
          CASE WHEN bal."entityType" = 'wedding' THEN (SELECT w.title FROM public."Wedding" w WHERE w.id = bal."entityId") END,
          CASE WHEN bal."entityType" = 'couple' THEN (SELECT c."partner1" || ' & ' || c."partner2" FROM public."Couple" c WHERE c.id = bal."entityId") END,
          CASE WHEN bal."entityType" = 'vendor' THEN (SELECT v.name FROM public."Vendor" v WHERE v.id = bal."entityId") END,
          bal."entityId"
        ) AS "displayName",
        bal."createdAt"
      FROM public."BusinessAccountLink" bal
      ORDER BY bal."businessAccountId", bal."entityType", "displayName"
    `),
    canReadSupport
      ? db.$queryRawUnsafe<
          Array<{
            id: string
            businessAccountId: string | null
            businessAccountName: string | null
            title: string
            description: string | null
            category: string
            priority: string
            status: string
            requesterEmail: string | null
            createdAt: Date
            updatedAt: Date
          }>
        >(`
          SELECT sc.id, sc."businessAccountId", ba.name AS "businessAccountName", sc.title,
            sc.description, sc.category, sc.priority, sc.status, sc."requesterEmail",
            sc."createdAt", sc."updatedAt"
          FROM public."SupportCase" sc
          LEFT JOIN public."BusinessAccount" ba ON ba.id = sc."businessAccountId"
          ORDER BY CASE sc.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
            CASE sc.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
            sc."createdAt" DESC
          LIMIT 100
        `)
      : Promise.resolve([]),
    canReadIncidents
      ? db.$queryRawUnsafe<
          Array<{
            id: string
            title: string
            summary: string | null
            status: string
            severity: string
            startedAt: Date
            resolvedAt: Date | null
            createdAt: Date
            updatedAt: Date
          }>
        >(`
          SELECT id, title, summary, status, severity, "startedAt", "resolvedAt", "createdAt", "updatedAt"
          FROM public."PlatformIncident"
          ORDER BY CASE status WHEN 'investigating' THEN 0 WHEN 'monitoring' THEN 1 ELSE 2 END,
            "startedAt" DESC
          LIMIT 100
        `)
      : Promise.resolve([]),
    canReadBilling
      ? db.$queryRawUnsafe<
          Array<{
            id: string
            businessAccountId: string
            businessAccountName: string
            provider: string
            providerReference: string | null
            type: string
            amountCents: number
            currency: string
            status: string
            dueAt: Date | null
            paidAt: Date | null
            createdAt: Date
          }>
        >(`
          SELECT pr.id, pr."businessAccountId", ba.name AS "businessAccountName", pr.provider,
            pr."providerReference", pr.type, pr."amountCents", pr.currency, pr.status,
            pr."dueAt", pr."paidAt", pr."createdAt"
          FROM public."PaymentRecord" pr
          JOIN public."BusinessAccount" ba ON ba.id = pr."businessAccountId"
          ORDER BY pr."createdAt" DESC
          LIMIT 100
        `)
      : Promise.resolve([]),
    canReadAudit
      ? db.$queryRawUnsafe<
          Array<{
            id: string
            businessAccountId: string | null
            action: string
            resourceType: string
            resourceId: string | null
            businessAccountName: string | null
            actorEmail: string | null
            details: Record<string, unknown>
            createdAt: Date
          }>
        >(`
          SELECT bal.id, bal."businessAccountId", bal.action, bal."resourceType", bal."resourceId",
            ba.name AS "businessAccountName", actor.email AS "actorEmail", bal.details, bal."createdAt"
          FROM public."BusinessAuditLog" bal
          LEFT JOIN public."BusinessAccount" ba ON ba.id = bal."businessAccountId"
          LEFT JOIN public."User" actor ON actor.id = bal."actorUserId"
          ORDER BY bal."createdAt" DESC
          LIMIT 200
        `)
      : Promise.resolve([]),
    canReadMembers
      ? db.$queryRawUnsafe<
          Array<{
            membershipId: string
            userId: string
            email: string
            name: string | null
            userActive: boolean
            lastLoginAt: Date | null
            role: string
            status: string
            permissions: unknown
            createdAt: Date
            updatedAt: Date
          }>
        >(`
          SELECT bam.id AS "membershipId", bam."userId", u.email, u.name,
            u."isActive" AS "userActive", u."lastLoginAt", bam.role, bam.status,
            bam.permissions, bam."createdAt", bam."updatedAt"
          FROM public."BusinessAccountMember" bam
          JOIN public."BusinessAccount" ba ON ba.id = bam."businessAccountId"
          JOIN public."User" u ON u.id = bam."userId"
          WHERE ba.type = 'wewed_internal'
          ORDER BY CASE bam.role
            WHEN 'wewed_super_admin' THEN 0
            WHEN 'wewed_operations_admin' THEN 1
            WHEN 'wewed_billing_admin' THEN 2
            WHEN 'wewed_support_admin' THEN 3
            WHEN 'wewed_analyst' THEN 4
            ELSE 5
          END, u.email
        `)
      : Promise.resolve([]),
  ])

  const now = Date.now()
  const staleCutoff = now - 60 * 24 * 60 * 60 * 1000
  const accounts = accountRows.map((account) => {
    const riskFlags: string[] = []
    if (account.type !== 'wewed_internal' && !account.ownerUserId) riskFlags.push('missing_owner')
    if (account.type !== 'wewed_internal' && account.activeMemberCount === 0) riskFlags.push('no_active_members')
    if (account.type !== 'wewed_internal' && account.onboardingStatus !== 'complete') riskFlags.push('incomplete_onboarding')
    if (isRestrictiveAccountStatus(normalizeAccountLifecycleStatus(account.status))) riskFlags.push('restricted_access')
    if (['past_due', 'failed'].includes(account.subscriptionStatus)) riskFlags.push('billing_attention')
    if (new Date(account.lastActivityAt).getTime() < staleCutoff) riskFlags.push('inactive_60_days')

    return { ...account, riskFlags }
  })

  const externalAccounts = accounts.filter((account) => account.type !== 'wewed_internal')
  const completedOnboarding = externalAccounts.filter((account) => account.onboardingStatus === 'complete').length
  const pendingAccounts = externalAccounts.filter((account) => account.status === 'pending_review')
  const averageApprovalAgeDays = pendingAccounts.length
    ? pendingAccounts.reduce((total, account) => total + (now - new Date(account.createdAt).getTime()) / 86_400_000, 0) / pendingAccounts.length
    : 0

  const countBy = <T,>(rows: T[], value: (row: T) => string) =>
    rows.reduce<Record<string, number>>((totals, row) => {
      const key = value(row) || 'unknown'
      totals[key] = (totals[key] || 0) + 1
      return totals
    }, {})

  const summary = summaryRows[0]
  const analytics = {
    reportingWindow: 'Current platform state',
    accountStatusCounts: countBy(externalAccounts, (account) => account.status),
    accountTypeCounts: countBy(externalAccounts, (account) => account.type),
    subscriptionCounts: countBy(externalAccounts, (account) => account.subscriptionStatus),
    onboardingCompletionRate: externalAccounts.length
      ? Math.round((completedOnboarding / externalAccounts.length) * 1000) / 10
      : 0,
    averageApprovalAgeDays: Math.round(averageApprovalAgeDays * 10) / 10,
    staleAccountCount: externalAccounts.filter((account) => account.riskFlags.includes('inactive_60_days')).length,
    averageWeddingsPerPlanningBusiness: (() => {
      const planningAccounts = externalAccounts.filter((account) => account.type === 'planning_company')
      return planningAccounts.length
        ? Math.round((planningAccounts.reduce((total, account) => total + account.weddingCount, 0) / planningAccounts.length) * 10) / 10
        : 0
    })(),
    couplesPerActivePlanner: summary.planners
      ? Math.round((summary.couples / summary.planners) * 10) / 10
      : null,
    riskSignals: [
      { key: 'pending_approvals', label: 'Pending approvals', count: summary.pendingReviewAccounts, severity: 'warning' },
      { key: 'missing_owners', label: 'Accounts without owners', count: summary.accountsWithoutOwner, severity: 'warning' },
      { key: 'missing_members', label: 'Accounts without active members', count: summary.accountsWithoutMembers, severity: 'warning' },
      { key: 'wedding_ownership', label: 'Weddings without an active owner membership', count: summary.weddingsWithoutActiveOwner, severity: 'critical' },
      { key: 'billing_attention', label: 'Pending or overdue payment exposure', count: paymentRows.filter((payment) => ['pending', 'due', 'failed'].includes(payment.status)).length, severity: 'warning' },
      { key: 'urgent_support', label: 'High-priority support cases', count: summary.urgentSupportCases, severity: 'critical' },
      { key: 'open_incidents', label: 'Open platform incidents', count: summary.openIncidents, severity: 'critical' },
    ],
  }

  return {
    summary,
    analytics,
    accounts,
    accountMembers: memberRows,
    accountLinks: linkRows,
    adminUsers: adminUserRows,
    supportCases: supportRows,
    incidents: incidentRows,
    payments: paymentRows,
    auditLog: auditRows,
  }
}

export type AdminOverview = Awaited<ReturnType<typeof loadAdminOverview>>
