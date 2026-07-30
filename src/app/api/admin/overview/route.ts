import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  assertWewedAdminPermission,
  createBusinessId,
  requireWewedAdmin,
  WewedAdminAccessError,
  writeBusinessAudit,
} from '@/lib/wewed-admin'
import {
  canTransitionAccount,
  hasWewedAdminPermission,
  isAccountLifecycleStatus,
  isRestrictiveAccountStatus,
  isWewedAdminRole,
  normalizeAccountLifecycleStatus,
  permissionForAccountTransition,
} from '@/lib/wewed-admin-policy'

export const dynamic = 'force-dynamic'

type AdminAction =
  | 'create_account'
  | 'update_account'
  | 'transition_account'
  | 'update_admin_role'
  | 'create_support_case'
  | 'update_support_case'
  | 'create_incident'
  | 'update_incident'
  | 'record_payment'

function text(value: unknown, max = 500): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function nullableText(value: unknown, max = 2000): string | null {
  const normalized = text(value, max)
  return normalized || null
}

function slugify(value: string): string {
  const normalized = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)

  return normalized || 'business-account'
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function adminError(error: unknown) {
  if (error instanceof WewedAdminAccessError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status },
    )
  }

  console.error('[api/admin/overview] Error:', error)
  return NextResponse.json(
    { success: false, error: 'Unable to complete the admin request.' },
    { status: 500 },
  )
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireWewedAdmin(request, 'admin.overview.read')
    const canReadBilling = hasWewedAdminPermission(context.permissions, 'admin.billing.read')
    const canReadSupport = hasWewedAdminPermission(context.permissions, 'admin.support.read')
    const canReadIncidents = hasWewedAdminPermission(context.permissions, 'admin.incidents.read')
    const canReadAudit = hasWewedAdminPermission(context.permissions, 'admin.audit.read')
    const canReadMembers = hasWewedAdminPermission(context.permissions, 'admin.members.read')

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

    return NextResponse.json({
      success: true,
      admin: {
        email: context.session.email,
        role: context.adminRole,
        permissions: context.permissions,
        membershipId: context.membershipId,
      },
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
    })
  } catch (error) {
    return adminError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireWewedAdmin(request, 'admin.overview.read')
    const body = (await request.json()) as Record<string, unknown>
    const action = text(body.action, 50) as AdminAction

    if (action === 'create_account') {
      assertWewedAdminPermission(context, 'admin.accounts.create')
      const name = text(body.name, 120)
      const type = text(body.type, 40) || 'client'
      const plan = text(body.subscriptionPlan, 40) || 'free'

      if (!name) {
        return NextResponse.json(
          { success: false, error: 'Business account name is required.' },
          { status: 400 },
        )
      }

      const id = createBusinessId('business')
      const slug = `${slugify(name)}-${id.slice(-8)}`

      await db.$executeRawUnsafe(
        `INSERT INTO public."BusinessAccount"
          ("id", "name", "slug", "type", "status", "onboardingStatus", "subscriptionPlan", "subscriptionStatus", "notes", "metadata")
         VALUES ($1, $2, $3, $4, 'pending_review', 'not_started', $5, $6, $7, $8::jsonb)`,
        id,
        name,
        slug,
        type,
        plan,
        plan === 'free' ? 'free' : 'trialing',
        nullableText(body.notes),
        JSON.stringify({ createdByAdminUserId: context.session.userId }),
      )

      await writeBusinessAudit({
        actorUserId: context.session.userId,
        businessAccountId: id,
        action: 'business_account.created_for_review',
        resourceType: 'BusinessAccount',
        resourceId: id,
        details: { name, type, plan, status: 'pending_review' },
      })

      return NextResponse.json({ success: true, id })
    }

    if (action === 'update_account') {
      const id = text(body.id, 120)
      if (!id) {
        return NextResponse.json(
          { success: false, error: 'Business account ID is required.' },
          { status: 400 },
        )
      }

      const hasOperationalFields = ['onboardingStatus', 'notes'].some((key) =>
        Object.prototype.hasOwnProperty.call(body, key),
      )
      const hasBillingFields = ['subscriptionPlan', 'subscriptionStatus'].some((key) =>
        Object.prototype.hasOwnProperty.call(body, key),
      )

      if (!hasOperationalFields && !hasBillingFields) {
        return NextResponse.json(
          { success: false, error: 'No supported account fields were supplied.' },
          { status: 400 },
        )
      }

      if (hasOperationalFields) assertWewedAdminPermission(context, 'admin.accounts.approve')
      if (hasBillingFields) assertWewedAdminPermission(context, 'admin.billing.manage')

      await db.$executeRawUnsafe(
        `UPDATE public."BusinessAccount"
         SET
           "onboardingStatus" = COALESCE($2, "onboardingStatus"),
           "subscriptionPlan" = COALESCE($3, "subscriptionPlan"),
           "subscriptionStatus" = COALESCE($4, "subscriptionStatus"),
           notes = CASE WHEN $5::boolean THEN $6 ELSE notes END,
           "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $1 AND type <> 'wewed_internal'`,
        id,
        nullableText(body.onboardingStatus, 40),
        nullableText(body.subscriptionPlan, 40),
        nullableText(body.subscriptionStatus, 40),
        Object.prototype.hasOwnProperty.call(body, 'notes'),
        nullableText(body.notes),
      )

      await writeBusinessAudit({
        actorUserId: context.session.userId,
        businessAccountId: id,
        action: 'business_account.details_updated',
        resourceType: 'BusinessAccount',
        resourceId: id,
        details: {
          onboardingStatus: body.onboardingStatus,
          subscriptionPlan: body.subscriptionPlan,
          subscriptionStatus: body.subscriptionStatus,
          notesChanged: Object.prototype.hasOwnProperty.call(body, 'notes'),
        },
      })

      return NextResponse.json({ success: true })
    }

    if (action === 'transition_account') {
      const id = text(body.id, 120)
      const nextStatus = text(body.status, 40)
      const reason = text(body.reason, 500)
      const note = nullableText(body.note, 2000)

      if (!id || !isAccountLifecycleStatus(nextStatus) || !reason) {
        return NextResponse.json(
          { success: false, error: 'Account ID, valid next status and reason are required.' },
          { status: 400 },
        )
      }

      const rows = await db.$queryRawUnsafe<
        Array<{
          id: string
          name: string
          type: string
          status: string
          metadata: Record<string, unknown>
        }>
      >(
        `SELECT id, name, type, status, metadata FROM public."BusinessAccount" WHERE id = $1 LIMIT 1`,
        id,
      )
      const account = rows[0]

      if (!account) {
        return NextResponse.json({ success: false, error: 'Business account was not found.' }, { status: 404 })
      }
      if (account.type === 'wewed_internal') {
        return NextResponse.json({ success: false, error: 'The Wewed parent account cannot use the client lifecycle.' }, { status: 409 })
      }

      const currentStatus = normalizeAccountLifecycleStatus(account.status)
      if (!canTransitionAccount(currentStatus, nextStatus)) {
        return NextResponse.json(
          { success: false, error: `Transition from ${currentStatus} to ${nextStatus} is not allowed.` },
          { status: 409 },
        )
      }

      assertWewedAdminPermission(
        context,
        permissionForAccountTransition(currentStatus, nextStatus),
      )

      const metadata = objectValue(account.metadata)
      const nextMetadata = {
        ...metadata,
        lifecycle: {
          previousStatus: currentStatus,
          status: nextStatus,
          reason,
          note,
          changedAt: new Date().toISOString(),
          changedByUserId: context.session.userId,
        },
      }

      await db.$transaction([
        db.$executeRawUnsafe(
          `UPDATE public."BusinessAccount"
           SET status = $2,
             metadata = $3::jsonb,
             "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $1`,
          id,
          nextStatus,
          JSON.stringify(nextMetadata),
        ),
        db.$executeRawUnsafe(
          `INSERT INTO public."BusinessAuditLog"
            ("id", "actorUserId", "businessAccountId", "action", "resourceType", "resourceId", "details")
           VALUES ($1, $2, $3, 'business_account.lifecycle_transitioned', 'BusinessAccount', $3, $4::jsonb)`,
          createBusinessId('audit'),
          context.session.userId,
          id,
          JSON.stringify({ accountName: account.name, previousStatus: currentStatus, status: nextStatus, reason, note }),
        ),
      ])

      return NextResponse.json({ success: true })
    }

    if (action === 'update_admin_role') {
      assertWewedAdminPermission(context, 'admin.members.manage')
      const membershipId = text(body.membershipId, 120)
      const role = text(body.role, 80)
      const status = text(body.status, 40) || 'active'

      if (!membershipId || !isWewedAdminRole(role) || !['active', 'suspended', 'revoked'].includes(status)) {
        return NextResponse.json(
          { success: false, error: 'A valid administrator membership, role and status are required.' },
          { status: 400 },
        )
      }
      if (role === 'wewed_super_admin' && context.adminRole !== 'wewed_super_admin') {
        throw new WewedAdminAccessError('Only a Super Admin may assign the Super Admin role.', 403)
      }

      const targets = await db.$queryRawUnsafe<
        Array<{ membershipId: string; userId: string; email: string; role: string; status: string }>
      >(
        `SELECT bam.id AS "membershipId", bam."userId", u.email, bam.role, bam.status
         FROM public."BusinessAccountMember" bam
         JOIN public."BusinessAccount" ba ON ba.id = bam."businessAccountId"
         JOIN public."User" u ON u.id = bam."userId"
         WHERE bam.id = $1 AND ba.type = 'wewed_internal'
         LIMIT 1`,
        membershipId,
      )
      const target = targets[0]
      if (!target) {
        return NextResponse.json({ success: false, error: 'Administrator membership was not found.' }, { status: 404 })
      }

      if (
        target.role === 'wewed_super_admin' &&
        (role !== 'wewed_super_admin' || status !== 'active')
      ) {
        const counts = await db.$queryRawUnsafe<Array<{ count: number }>>(`
          SELECT COUNT(*)::int AS count
          FROM public."BusinessAccountMember" bam
          JOIN public."BusinessAccount" ba ON ba.id = bam."businessAccountId"
          WHERE ba.type = 'wewed_internal'
            AND bam.role = 'wewed_super_admin'
            AND bam.status = 'active'
        `)
        if ((counts[0]?.count ?? 0) <= 1) {
          return NextResponse.json(
            { success: false, error: 'At least one active Wewed Super Admin must remain.' },
            { status: 409 },
          )
        }
      }

      await db.$transaction([
        db.$executeRawUnsafe(
          `UPDATE public."BusinessAccountMember"
           SET role = $2, status = $3, permissions = '[]'::jsonb, "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $1`,
          membershipId,
          role,
          status,
        ),
        db.$executeRawUnsafe(
          `INSERT INTO public."BusinessAuditLog"
            ("id", "actorUserId", "businessAccountId", "action", "resourceType", "resourceId", "details")
           VALUES ($1, $2, $3, 'admin_membership.updated', 'BusinessAccountMember', $4, $5::jsonb)`,
          createBusinessId('audit'),
          context.session.userId,
          context.businessAccountId,
          membershipId,
          JSON.stringify({ targetEmail: target.email, previousRole: target.role, role, previousStatus: target.status, status }),
        ),
      ])

      return NextResponse.json({ success: true })
    }

    if (action === 'create_support_case') {
      assertWewedAdminPermission(context, 'admin.support.manage')
      const title = text(body.title, 160)
      if (!title) {
        return NextResponse.json(
          { success: false, error: 'Support case title is required.' },
          { status: 400 },
        )
      }

      const id = createBusinessId('support')
      const businessAccountId = nullableText(body.businessAccountId, 120)

      await db.$executeRawUnsafe(
        `INSERT INTO public."SupportCase"
          ("id", "businessAccountId", "title", "description", "category", "priority", "status", "requesterEmail", "assignedToUserId")
         VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, $8)`,
        id,
        businessAccountId,
        title,
        nullableText(body.description, 4000),
        text(body.category, 40) || 'general',
        text(body.priority, 40) || 'normal',
        nullableText(body.requesterEmail, 180),
        context.session.userId,
      )

      await writeBusinessAudit({
        actorUserId: context.session.userId,
        businessAccountId,
        action: 'support_case.created',
        resourceType: 'SupportCase',
        resourceId: id,
        details: { title },
      })

      return NextResponse.json({ success: true, id })
    }

    if (action === 'update_support_case') {
      assertWewedAdminPermission(context, 'admin.support.manage')
      const id = text(body.id, 120)
      const status = text(body.status, 40)
      if (!id || !['open', 'in_progress', 'waiting', 'resolved', 'closed'].includes(status)) {
        return NextResponse.json(
          { success: false, error: 'Support case ID and valid status are required.' },
          { status: 400 },
        )
      }

      await db.$executeRawUnsafe(
        `UPDATE public."SupportCase"
         SET status = $2,
           "resolvedAt" = CASE WHEN $2 IN ('resolved', 'closed') THEN CURRENT_TIMESTAMP ELSE NULL END,
           "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $1`,
        id,
        status,
      )

      await writeBusinessAudit({
        actorUserId: context.session.userId,
        action: 'support_case.status_changed',
        resourceType: 'SupportCase',
        resourceId: id,
        details: { status },
      })

      return NextResponse.json({ success: true })
    }

    if (action === 'create_incident') {
      assertWewedAdminPermission(context, 'admin.incidents.manage')
      const title = text(body.title, 160)
      if (!title) {
        return NextResponse.json(
          { success: false, error: 'Incident title is required.' },
          { status: 400 },
        )
      }

      const id = createBusinessId('incident')
      await db.$executeRawUnsafe(
        `INSERT INTO public."PlatformIncident"
          ("id", "title", "summary", "status", "severity", "createdByUserId")
         VALUES ($1, $2, $3, 'investigating', $4, $5)`,
        id,
        title,
        nullableText(body.summary, 4000),
        text(body.severity, 40) || 'minor',
        context.session.userId,
      )

      await writeBusinessAudit({
        actorUserId: context.session.userId,
        action: 'platform_incident.created',
        resourceType: 'PlatformIncident',
        resourceId: id,
        details: { title },
      })

      return NextResponse.json({ success: true, id })
    }

    if (action === 'update_incident') {
      assertWewedAdminPermission(context, 'admin.incidents.manage')
      const id = text(body.id, 120)
      const status = text(body.status, 40)
      if (!id || !['investigating', 'identified', 'monitoring', 'resolved'].includes(status)) {
        return NextResponse.json(
          { success: false, error: 'Incident ID and valid status are required.' },
          { status: 400 },
        )
      }

      await db.$executeRawUnsafe(
        `UPDATE public."PlatformIncident"
         SET status = $2,
           "resolvedAt" = CASE WHEN $2 = 'resolved' THEN CURRENT_TIMESTAMP ELSE NULL END,
           "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $1`,
        id,
        status,
      )

      await writeBusinessAudit({
        actorUserId: context.session.userId,
        action: 'platform_incident.status_changed',
        resourceType: 'PlatformIncident',
        resourceId: id,
        details: { status },
      })

      return NextResponse.json({ success: true })
    }

    if (action === 'record_payment') {
      assertWewedAdminPermission(context, 'admin.billing.manage')
      const businessAccountId = text(body.businessAccountId, 120)
      const amount = Number(body.amount)
      const amountCents = Number.isFinite(amount) ? Math.round(amount * 100) : -1

      if (!businessAccountId || amountCents < 0) {
        return NextResponse.json(
          { success: false, error: 'A valid business account and amount are required.' },
          { status: 400 },
        )
      }

      const id = createBusinessId('payment')
      const status = text(body.status, 40) || 'paid'
      if (!['paid', 'pending', 'due', 'failed', 'refunded'].includes(status)) {
        return NextResponse.json({ success: false, error: 'Payment status is invalid.' }, { status: 400 })
      }

      await db.$executeRawUnsafe(
        `INSERT INTO public."PaymentRecord"
          ("id", "businessAccountId", "provider", "providerReference", "type", "amountCents", "currency", "status", "paidAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CASE WHEN $8 = 'paid' THEN CURRENT_TIMESTAMP ELSE NULL END)`,
        id,
        businessAccountId,
        text(body.provider, 40) || 'manual',
        nullableText(body.providerReference, 120),
        text(body.type, 40) || 'subscription',
        amountCents,
        text(body.currency, 8).toUpperCase() || 'USD',
        status,
      )

      await writeBusinessAudit({
        actorUserId: context.session.userId,
        businessAccountId,
        action: 'payment_record.created',
        resourceType: 'PaymentRecord',
        resourceId: id,
        details: { amountCents, status },
      })

      return NextResponse.json({ success: true, id })
    }

    return NextResponse.json(
      { success: false, error: 'Unknown admin action.' },
      { status: 400 },
    )
  } catch (error) {
    return adminError(error)
  }
}
