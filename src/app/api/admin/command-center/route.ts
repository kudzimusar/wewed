import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  buildBusinessAccountScopeSql,
  createBusinessId,
  requireWewedAdmin,
  WewedAdminAccessError,
  writeBusinessAudit,
  type WewedAdminContext,
} from '@/lib/wewed-admin'

export const dynamic = 'force-dynamic'

type AccountRow = {
  id: string
  name: string
  slug: string
  type: string
  status: string
  onboardingStatus: string
  subscriptionStatus: string
  ownerEmail: string | null
  ownerName: string | null
  subtypeKey: string | null
  subtypeName: string | null
  segment: string | null
  classificationSource: string | null
  memberCount: number
  weddingCount: number
  departmentCount: number
  billingOfferCode: string | null
  billingOfferName: string | null
  billingProfileStatus: string | null
  providerCategories: string[]
  lastActivityAt: Date
}

type WorkItemRow = {
  id: string
  businessAccountId: string | null
  accountName: string | null
  resourceType: string
  resourceId: string
  category: string
  priority: string
  status: string
  title: string
  summary: string
  assignedToUserId: string | null
  assignedToEmail: string | null
  departmentKey: string | null
  source: string
  dueAt: Date | null
  createdAt: Date
}

type SupportRow = {
  id: string
  businessAccountId: string | null
  accountName: string | null
  title: string
  priority: string
  status: string
  createdAt: Date
}

type ClaimRow = {
  id: string
  businessAccountId: string
  accountName: string
  claimantName: string
  status: string
  createdAt: Date
}

type VerificationRow = {
  id: string
  businessAccountId: string
  accountName: string
  identityStatus: string
  businessStatus: string
  insuranceStatus: string
  permitStatus: string
  updatedAt: Date
}

type InternalStaffRow = {
  userId: string
  email: string
  name: string | null
  membershipRole: string
  membershipStatus: string
  departmentKey: string | null
  departmentName: string | null
  jobTitle: string | null
  employmentType: string | null
  employmentStatus: string | null
  managerUserId: string | null
  managerName: string | null
  platformRole: string | null
  platformStatus: string | null
  lastLoginAt: Date | null
}

type SavedViewRow = {
  id: string
  name: string
  screen: string
  filters: unknown
  sort: unknown
  columns: unknown
  isDefault: boolean
  updatedAt: Date
}

class CommandCenterRequestError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409,
  ) {
    super(message)
    this.name = 'CommandCenterRequestError'
  }
}

function text(value: unknown, max = 500): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function optionalText(value: unknown, max = 500): string | null {
  const normalized = text(value, max)
  return normalized || null
}

function stringArray(value: unknown, max = 20): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(value.map((item) => text(item, 100)).filter(Boolean)),
  ).slice(0, max)
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function canManageOperations(context: WewedAdminContext): boolean {
  return (
    context.permissions.includes('*') ||
    context.permissions.includes('admin.departments.manage') ||
    context.permissions.includes('admin.support.manage') ||
    context.permissions.includes('admin.billing.manage')
  )
}

function canReadBilling(context: WewedAdminContext): boolean {
  return (
    context.permissions.includes('*') ||
    context.permissions.includes('admin.billing.read') ||
    context.permissions.includes('admin.billing.manage')
  )
}

function isSuperAdmin(context: WewedAdminContext): boolean {
  return context.adminRole === 'wewed_super_admin'
}

function errorResponse(error: unknown) {
  if (error instanceof WewedAdminAccessError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status },
    )
  }
  if (error instanceof CommandCenterRequestError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status },
    )
  }
  console.error('[api/admin/command-center] Error:', error)
  return NextResponse.json(
    { success: false, error: 'Unable to load the Admin command centre.' },
    { status: 500 },
  )
}

async function scopedAccount(
  context: WewedAdminContext,
  accountId: string,
): Promise<{ id: string; type: string; name: string }> {
  const scope = buildBusinessAccountScopeSql(context, 'ba', 2)
  const rows = await db.$queryRawUnsafe<Array<{ id: string; type: string; name: string }>>(
    `SELECT ba.id, ba.type, ba.name
     FROM wewed_admin."BusinessAccount" ba
     WHERE ba.id=$1 AND ${scope.clause}
     LIMIT 1`,
    accountId,
    ...scope.values,
  )
  if (!rows[0]) {
    throw new CommandCenterRequestError(
      'The account is outside this administrator scope.',
      404,
    )
  }
  return rows[0]
}

async function readAccounts(context: WewedAdminContext): Promise<AccountRow[]> {
  const scope = buildBusinessAccountScopeSql(context, 'ba', 1)
  return db.$queryRawUnsafe<AccountRow[]>(
    `SELECT
       ba.id,
       ba.name,
       ba.slug,
       ba.type,
       ba.status,
       ba."onboardingStatus",
       ba."subscriptionStatus",
       owner.email AS "ownerEmail",
       owner.name AS "ownerName",
       classification."subtypeKey",
       subtype.name AS "subtypeName",
       classification.segment,
       classification.source AS "classificationSource",
       (SELECT COUNT(*)::int FROM wewed_admin."BusinessAccountMember" member
        WHERE member."businessAccountId"=ba.id) AS "memberCount",
       (SELECT COUNT(*)::int FROM wewed_admin."BusinessAccountLink" link
        WHERE link."businessAccountId"=ba.id AND link."entityType"='wedding') AS "weddingCount",
       (SELECT COUNT(*)::int FROM wewed_admin."BusinessAccountDepartment" department
        WHERE department."businessAccountId"=ba.id AND department.status='enabled') AS "departmentCount",
       billing."offerCode" AS "billingOfferCode",
       offer.name AS "billingOfferName",
       billing.status AS "billingProfileStatus",
       COALESCE(
         (SELECT jsonb_agg(category ORDER BY category)
          FROM (
            SELECT DISTINCT offering.category
            FROM wewed_admin."ProviderServiceOffering" offering
            WHERE offering."businessAccountId"=ba.id
              AND trim(COALESCE(offering.category,'')) <> ''
          ) provider_categories),
         '[]'::jsonb
       ) AS "providerCategories",
       COALESCE(
         (SELECT MAX(member_user."lastLoginAt")
          FROM wewed_admin."BusinessAccountMember" member
          JOIN public."User" member_user ON member_user.id=member."userId"
          WHERE member."businessAccountId"=ba.id),
         owner."lastLoginAt",
         ba."updatedAt"
       ) AS "lastActivityAt"
     FROM wewed_admin."BusinessAccount" ba
     LEFT JOIN public."User" owner ON owner.id=ba."ownerUserId"
     LEFT JOIN wewed_admin."BusinessAccountClassification" classification
       ON classification."businessAccountId"=ba.id
     LEFT JOIN wewed_admin."AccountSubtypeDefinition" subtype
       ON subtype."subtypeKey"=classification."subtypeKey"
      AND subtype."accountType"=classification."accountType"
     LEFT JOIN wewed_admin."BusinessAccountBillingProfile" billing
       ON billing."businessAccountId"=ba.id
     LEFT JOIN wewed_admin."BillingOffer" offer
       ON offer."offerCode"=billing."offerCode"
      AND offer."accountType"=billing."accountType"
     WHERE ${scope.clause}
     ORDER BY CASE ba.type
       WHEN 'wewed_internal' THEN 0
       WHEN 'planning_company' THEN 1
       WHEN 'couple' THEN 2
       WHEN 'venue' THEN 3
       WHEN 'vendor' THEN 4
       ELSE 5 END,
       ba.name`,
    ...scope.values,
  )
}

async function readPersistedWorkItems(
  context: WewedAdminContext,
): Promise<WorkItemRow[]> {
  const scope = buildBusinessAccountScopeSql(context, 'ba', 2)
  return db.$queryRawUnsafe<WorkItemRow[]>(
    `SELECT
       item.id,
       item."businessAccountId",
       ba.name AS "accountName",
       item."resourceType",
       item."resourceId",
       item.category,
       item.priority,
       item.status,
       item.title,
       item.summary,
       item."assignedToUserId",
       assignee.email AS "assignedToEmail",
       item."departmentKey",
       item.source,
       item."dueAt",
       item."createdAt"
     FROM wewed_admin."AdminWorkItem" item
     LEFT JOIN wewed_admin."BusinessAccount" ba ON ba.id=item."businessAccountId"
     LEFT JOIN public."User" assignee ON assignee.id=item."assignedToUserId"
     WHERE item.status IN ('open','in_progress','blocked')
       AND (item."assignedToUserId" IS NULL OR item."assignedToUserId"=$1)
       AND (item."businessAccountId" IS NULL OR (${scope.clause}))
     ORDER BY CASE item.priority
       WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
       item."dueAt" NULLS LAST,
       item."createdAt" ASC
     LIMIT 80`,
    context.session.userId,
    ...scope.values,
  )
}

async function readSupport(context: WewedAdminContext): Promise<SupportRow[]> {
  if (
    !context.permissions.includes('*') &&
    !context.permissions.includes('admin.support.read') &&
    !context.permissions.includes('admin.support.manage')
  ) return []
  const scope = buildBusinessAccountScopeSql(context, 'ba', 1)
  return db.$queryRawUnsafe<SupportRow[]>(
    `SELECT support.id,
            support."businessAccountId",
            ba.name AS "accountName",
            support.title,
            support.priority,
            support.status,
            support."createdAt"
     FROM wewed_admin."SupportCase" support
     LEFT JOIN wewed_admin."BusinessAccount" ba ON ba.id=support."businessAccountId"
     WHERE support.status NOT IN ('resolved','closed')
       AND (support."businessAccountId" IS NULL OR (${scope.clause}))
     ORDER BY CASE support.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
              support."createdAt"
     LIMIT 50`,
    ...scope.values,
  )
}

async function readClaims(context: WewedAdminContext): Promise<ClaimRow[]> {
  const scope = buildBusinessAccountScopeSql(context, 'ba', 1)
  return db.$queryRawUnsafe<ClaimRow[]>(
    `SELECT claim.id,
            claim."businessAccountId",
            ba.name AS "accountName",
            claim."claimantName",
            claim.status,
            claim."createdAt"
     FROM wewed_admin."ProviderClaimRequest" claim
     JOIN wewed_admin."BusinessAccount" ba ON ba.id=claim."businessAccountId"
     WHERE claim.status IN ('pending','under_review')
       AND ${scope.clause}
     ORDER BY claim."createdAt"
     LIMIT 50`,
    ...scope.values,
  )
}

async function readVerification(
  context: WewedAdminContext,
): Promise<VerificationRow[]> {
  const scope = buildBusinessAccountScopeSql(context, 'ba', 1)
  return db.$queryRawUnsafe<VerificationRow[]>(
    `SELECT verification.id,
            verification."businessAccountId",
            ba.name AS "accountName",
            verification."identityStatus",
            verification."businessStatus",
            verification."insuranceStatus",
            verification."permitStatus",
            verification."updatedAt"
     FROM wewed_admin."ProviderVerification" verification
     JOIN wewed_admin."BusinessAccount" ba ON ba.id=verification."businessAccountId"
     WHERE ${scope.clause}
       AND (
         COALESCE(verification."identityStatus", 'pending') NOT IN ('verified','approved') OR
         COALESCE(verification."businessStatus", 'pending') NOT IN ('verified','approved') OR
         COALESCE(verification."insuranceStatus", 'pending') NOT IN ('verified','approved','not_required') OR
         COALESCE(verification."permitStatus", 'pending') NOT IN ('verified','approved','not_required')
       )
     ORDER BY verification."updatedAt"
     LIMIT 50`,
    ...scope.values,
  )
}

async function readInternalStaff(context: WewedAdminContext): Promise<InternalStaffRow[]> {
  if (!isSuperAdmin(context)) return []
  return db.$queryRawUnsafe<InternalStaffRow[]>(
    `SELECT
       member."userId",
       u.email,
       u.name,
       member.role AS "membershipRole",
       member.status AS "membershipStatus",
       staff."departmentKey",
       department.name AS "departmentName",
       staff."jobTitle",
       staff."employmentType",
       staff."employmentStatus",
       staff."managerUserId",
       manager.name AS "managerName",
       administrator.role AS "platformRole",
       administrator.status AS "platformStatus",
       u."lastLoginAt"
     FROM wewed_admin."BusinessAccountMember" member
     JOIN public."User" u ON u.id=member."userId"
     LEFT JOIN wewed_admin."InternalStaffProfile" staff ON staff."userId"=member."userId"
     LEFT JOIN wewed_admin."InternalDepartmentDefinition" department
       ON department."departmentKey"=staff."departmentKey"
     LEFT JOIN public."User" manager ON manager.id=staff."managerUserId"
     LEFT JOIN wewed_admin."PlatformAdministrator" administrator
       ON administrator."userId"=member."userId"
     WHERE member."businessAccountId"='wewed-platform'
     ORDER BY CASE member.status WHEN 'active' THEN 0 ELSE 1 END,
              COALESCE(department."sortOrder",999),
              COALESCE(u.name,u.email)`
  )
}

async function plannerMismatchCount(context: WewedAdminContext): Promise<number> {
  const scope = buildBusinessAccountScopeSql(context, 'couple_account', 1)
  const rows = await db.$queryRawUnsafe<Array<{ count: number }>>(
    `SELECT COUNT(*)::int AS count
     FROM wewed_admin."PlannerEngagement" engagement
     JOIN wewed_admin."BusinessAccount" couple_account
       ON couple_account.id=engagement."coupleBusinessAccountId"
     WHERE engagement.status IN ('planner_accepted','active','paused')
       AND ${scope.clause}
       AND NOT EXISTS (
         SELECT 1
         FROM public."WeddingMembership" membership
         WHERE membership."weddingId"=engagement."weddingId"
           AND membership."userId"=engagement."plannerUserId"
           AND membership.status='active'
       )`,
    ...scope.values,
  )
  return rows[0]?.count || 0
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireWewedAdmin(request, 'admin.accounts.read')
    const [
      accounts,
      persistedWork,
      support,
      claims,
      verification,
      internalStaff,
      mismatchCount,
      subtypes,
      departments,
      savedViews,
    ] = await Promise.all([
      readAccounts(context),
      readPersistedWorkItems(context),
      readSupport(context),
      readClaims(context),
      readVerification(context),
      readInternalStaff(context),
      plannerMismatchCount(context),
      db.$queryRawUnsafe<Array<{ subtypeKey: string; accountType: string; name: string; description: string; sortOrder: number }>>(
        `SELECT "subtypeKey", "accountType", name, description, "sortOrder"
         FROM wewed_admin."AccountSubtypeDefinition"
         WHERE status='active'
         ORDER BY "accountType", "sortOrder", name`,
      ),
      db.$queryRawUnsafe<Array<{ departmentKey: string; name: string; description: string; sortOrder: number }>>(
        `SELECT "departmentKey", name, description, "sortOrder"
         FROM wewed_admin."InternalDepartmentDefinition"
         WHERE status='active'
         ORDER BY "sortOrder", name`,
      ),
      db.$queryRawUnsafe<SavedViewRow[]>(
        `SELECT id, name, screen, filters, sort, columns, "isDefault", "updatedAt"
         FROM wewed_admin."AdminSavedView"
         WHERE "administratorUserId"=$1
         ORDER BY screen, "isDefault" DESC, name`,
        context.session.userId,
      ),
    ])

    const offers = canReadBilling(context)
      ? await db.$queryRawUnsafe<Array<{
          offerCode: string
          accountType: string
          name: string
          billingModel: string
          currency: string
          monthlyCents: number | null
          annualCents: number | null
          selfService: boolean
          status: string
          departmentKeys: unknown
          entitlements: unknown
        }>>(
          `SELECT "offerCode", "accountType", name, "billingModel", currency,
                  "monthlyCents", "annualCents", "selfService", status,
                  "departmentKeys", entitlements
           FROM wewed_admin."BillingOffer"
           WHERE status='active'
           ORDER BY "accountType", "monthlyCents" NULLS LAST, name`,
        )
      : []

    const projectedWork = [
      ...accounts
        .filter((account) => account.status === 'pending_review')
        .map((account) => ({
          id: `projected-review-${account.id}`,
          businessAccountId: account.id,
          accountName: account.name,
          resourceType: 'business_account',
          resourceId: account.id,
          category: 'account_review',
          priority: 'high',
          status: 'open',
          title: `Review ${account.name}`,
          summary: `${account.type.replaceAll('_',' ')} account is awaiting a lifecycle decision.`,
          assignedToUserId: null,
          assignedToEmail: null,
          departmentKey: 'operations',
          source: 'account',
          dueAt: null,
          createdAt: account.lastActivityAt,
          projected: true,
        })),
      ...accounts
        .filter((account) => account.onboardingStatus !== 'complete')
        .map((account) => ({
          id: `projected-onboarding-${account.id}`,
          businessAccountId: account.id,
          accountName: account.name,
          resourceType: 'business_account',
          resourceId: account.id,
          category: 'onboarding',
          priority: 'normal',
          status: 'open',
          title: `Complete onboarding: ${account.name}`,
          summary: `Onboarding is ${account.onboardingStatus.replaceAll('_',' ')}.`,
          assignedToUserId: null,
          assignedToEmail: null,
          departmentKey: 'operations',
          source: 'onboarding',
          dueAt: null,
          createdAt: account.lastActivityAt,
          projected: true,
        })),
      ...accounts
        .filter((account) => ['past_due','unpaid','incomplete_expired'].includes(account.billingProfileStatus || account.subscriptionStatus))
        .map((account) => ({
          id: `projected-billing-${account.id}`,
          businessAccountId: account.id,
          accountName: account.name,
          resourceType: 'business_account',
          resourceId: account.id,
          category: 'billing_attention',
          priority: 'high',
          status: 'open',
          title: `Billing attention: ${account.name}`,
          summary: `Billing status is ${(account.billingProfileStatus || account.subscriptionStatus).replaceAll('_',' ')}.`,
          assignedToUserId: null,
          assignedToEmail: null,
          departmentKey: 'billing_finance',
          source: 'billing',
          dueAt: null,
          createdAt: account.lastActivityAt,
          projected: true,
        })),
      ...claims.map((claim) => ({
        id: `projected-claim-${claim.id}`,
        businessAccountId: claim.businessAccountId,
        accountName: claim.accountName,
        resourceType: 'provider_claim',
        resourceId: claim.id,
        category: 'provider_claim',
        priority: 'high',
        status: 'open',
        title: `Provider claim: ${claim.accountName}`,
        summary: `${claim.claimantName} submitted a ${claim.status.replaceAll('_',' ')} claim.`,
        assignedToUserId: null,
        assignedToEmail: null,
        departmentKey: 'marketplace',
        source: 'provider_claim',
        dueAt: null,
        createdAt: claim.createdAt,
        projected: true,
      })),
      ...verification.map((item) => ({
        id: `projected-verification-${item.id}`,
        businessAccountId: item.businessAccountId,
        accountName: item.accountName,
        resourceType: 'provider_verification',
        resourceId: item.id,
        category: 'provider_verification',
        priority: 'normal',
        status: 'open',
        title: `Verify ${item.accountName}`,
        summary: `Identity ${item.identityStatus}; business ${item.businessStatus}; insurance ${item.insuranceStatus}; permit ${item.permitStatus}.`,
        assignedToUserId: null,
        assignedToEmail: null,
        departmentKey: 'compliance',
        source: 'provider_verification',
        dueAt: null,
        createdAt: item.updatedAt,
        projected: true,
      })),
      ...support.map((item) => ({
        id: `projected-support-${item.id}`,
        businessAccountId: item.businessAccountId,
        accountName: item.accountName,
        resourceType: 'support_case',
        resourceId: item.id,
        category: 'support',
        priority: item.priority === 'critical' ? 'critical' : item.priority === 'high' ? 'high' : 'normal',
        status: 'open',
        title: item.title,
        summary: `${item.accountName || 'Platform'} support case · ${item.status.replaceAll('_',' ')}`,
        assignedToUserId: null,
        assignedToEmail: null,
        departmentKey: 'customer_support',
        source: 'support',
        dueAt: null,
        createdAt: item.createdAt,
        projected: true,
      })),
    ]

    const queue = [
      ...persistedWork.map((item) => ({
        ...item,
        dueAt: item.dueAt?.toISOString() || null,
        createdAt: item.createdAt.toISOString(),
        projected: false,
      })),
      ...projectedWork.map((item) => ({
        ...item,
        dueAt: null,
        createdAt: item.createdAt.toISOString(),
      })),
    ].sort((a, b) => {
      const priorityRank: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 }
      const priorityDelta = (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9)
      if (priorityDelta !== 0) return priorityDelta
      return a.createdAt.localeCompare(b.createdAt)
    }).slice(0, 100)

    const externalAccounts = accounts.filter((account) => account.type !== 'wewed_internal')
    const pendingReview = externalAccounts.filter((account) => account.status === 'pending_review').length
    const onboardingAttention = externalAccounts.filter((account) => account.onboardingStatus !== 'complete').length
    const billingAttention = externalAccounts.filter((account) =>
      ['past_due','unpaid','incomplete_expired'].includes(account.billingProfileStatus || account.subscriptionStatus),
    ).length
    const missingProvisioning = externalAccounts.filter((account) => !account.departmentCount || !account.billingOfferCode).length

    const accountTypeCounts = Object.fromEntries(
      ['couple','planning_company','venue','vendor','client','wewed_internal'].map((type) => [
        type,
        accounts.filter((account) => account.type === type).length,
      ]),
    )

    return NextResponse.json({
      success: true,
      admin: {
        userId: context.session.userId,
        email: context.session.email,
        role: context.adminRole,
        isSuperAdmin: isSuperAdmin(context),
        canManageOperations: canManageOperations(context),
        canReadBilling: canReadBilling(context),
        accountScope: context.accountScope,
      },
      metrics: {
        totalScopedAccounts: accounts.length,
        pendingReview,
        onboardingAttention,
        providerClaims: claims.length,
        providerVerification: verification.length,
        billingAttention,
        highPrioritySupport: support.filter((item) => ['critical','high'].includes(item.priority)).length,
        plannerRelationshipMismatches: mismatchCount,
        missingProvisioning,
      },
      accountTypeCounts,
      accounts: accounts.map((account) => ({
        ...account,
        lastActivityAt: account.lastActivityAt.toISOString(),
      })),
      queue,
      internalStaff: internalStaff.map((staff) => ({
        ...staff,
        lastLoginAt: staff.lastLoginAt?.toISOString() || null,
      })),
      subtypes,
      departments,
      offers,
      savedViews: savedViews.map((view) => ({
        ...view,
        updatedAt: view.updatedAt.toISOString(),
      })),
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireWewedAdmin(request, 'admin.accounts.read')
    const body = (await request.json()) as Record<string, unknown>
    const action = text(body.action, 80)

    if (action === 'set_account_classification') {
      if (!context.permissions.includes('*') && !context.permissions.includes('admin.departments.manage')) {
        throw new WewedAdminAccessError('This administrator cannot manage account classification.', 403)
      }
      const accountId = text(body.accountId, 200)
      const subtypeKey = optionalText(body.subtypeKey, 120)
      const segment = optionalText(body.segment, 120)
      const reason = text(body.reason, 1000)
      if (!accountId || reason.length < 5) {
        throw new CommandCenterRequestError('Account and a reason of at least 5 characters are required.', 400)
      }
      const account = await scopedAccount(context, accountId)
      if (subtypeKey) {
        const definitions = await db.$queryRawUnsafe<Array<{ subtypeKey: string }>>(
          `SELECT "subtypeKey" FROM wewed_admin."AccountSubtypeDefinition"
           WHERE "accountType"=$1 AND "subtypeKey"=$2 AND status='active' LIMIT 1`,
          account.type,
          subtypeKey,
        )
        if (!definitions[0]) {
          throw new CommandCenterRequestError('The selected subtype is not valid for this account type.', 400)
        }
      }

      const beforeRows = await db.$queryRawUnsafe<Array<{ subtypeKey: string | null; segment: string | null; source: string }>>(
        `SELECT "subtypeKey", segment, source
         FROM wewed_admin."BusinessAccountClassification"
         WHERE "businessAccountId"=$1 LIMIT 1`,
        accountId,
      )
      await db.$executeRawUnsafe(
        `INSERT INTO wewed_admin."BusinessAccountClassification"
          ("businessAccountId", "accountType", "subtypeKey", segment, source, "assignedByUserId")
         VALUES ($1,$2,$3,$4,'manual',$5)
         ON CONFLICT ("businessAccountId") DO UPDATE SET
           "accountType"=EXCLUDED."accountType",
           "subtypeKey"=EXCLUDED."subtypeKey",
           segment=EXCLUDED.segment,
           source='manual',
           "assignedByUserId"=EXCLUDED."assignedByUserId",
           version=wewed_admin."BusinessAccountClassification".version+1,
           "updatedAt"=CURRENT_TIMESTAMP`,
        accountId,
        account.type,
        subtypeKey,
        segment,
        context.session.userId,
      )
      await writeBusinessAudit({
        actorUserId: context.session.userId,
        businessAccountId: accountId,
        action: 'admin.account.classification.updated',
        resourceType: 'BusinessAccountClassification',
        resourceId: accountId,
        details: {
          reason,
          before: beforeRows[0] || null,
          after: { subtypeKey, segment, source: 'manual' },
        },
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'set_staff_profile') {
      if (!isSuperAdmin(context)) {
        throw new WewedAdminAccessError('Only Super Admin can manage workforce profiles.', 403)
      }
      const userId = text(body.userId, 200)
      const departmentKey = optionalText(body.departmentKey, 120)
      const jobTitle = optionalText(body.jobTitle, 200)
      const employmentType = text(body.employmentType, 40)
      const employmentStatus = text(body.employmentStatus, 40)
      const managerUserId = optionalText(body.managerUserId, 200)
      const reason = text(body.reason, 1000)
      if (!userId || reason.length < 5) {
        throw new CommandCenterRequestError('Staff user and a reason of at least 5 characters are required.', 400)
      }
      if (!['employee','contractor','advisor'].includes(employmentType)) {
        throw new CommandCenterRequestError('Invalid employment type.', 400)
      }
      if (!['active','leave','suspended','left'].includes(employmentStatus)) {
        throw new CommandCenterRequestError('Invalid employment status.', 400)
      }
      const members = await db.$queryRawUnsafe<Array<{ userId: string }>>(
        `SELECT "userId" FROM wewed_admin."BusinessAccountMember"
         WHERE "businessAccountId"='wewed-platform' AND "userId"=$1 LIMIT 1`,
        userId,
      )
      if (!members[0]) {
        throw new CommandCenterRequestError('The user is not a Wewed internal-account member.', 404)
      }
      if (departmentKey) {
        const departments = await db.$queryRawUnsafe<Array<{ departmentKey: string }>>(
          `SELECT "departmentKey" FROM wewed_admin."InternalDepartmentDefinition"
           WHERE "departmentKey"=$1 AND status='active' LIMIT 1`,
          departmentKey,
        )
        if (!departments[0]) throw new CommandCenterRequestError('Unknown internal department.', 400)
      }
      if (managerUserId === userId) throw new CommandCenterRequestError('A staff member cannot manage themselves.', 400)

      await db.$executeRawUnsafe(
        `INSERT INTO wewed_admin."InternalStaffProfile"
          ("userId","departmentKey","jobTitle","employmentType","employmentStatus","managerUserId")
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT ("userId") DO UPDATE SET
           "departmentKey"=EXCLUDED."departmentKey",
           "jobTitle"=EXCLUDED."jobTitle",
           "employmentType"=EXCLUDED."employmentType",
           "employmentStatus"=EXCLUDED."employmentStatus",
           "managerUserId"=EXCLUDED."managerUserId",
           "updatedAt"=CURRENT_TIMESTAMP`,
        userId,
        departmentKey,
        jobTitle,
        employmentType,
        employmentStatus,
        managerUserId,
      )
      await writeBusinessAudit({
        actorUserId: context.session.userId,
        businessAccountId: 'wewed-platform',
        action: 'admin.internal_staff.profile.updated',
        resourceType: 'InternalStaffProfile',
        resourceId: userId,
        details: { reason, departmentKey, jobTitle, employmentType, employmentStatus, managerUserId },
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'save_view') {
      const screen = text(body.screen, 40)
      const name = text(body.name, 100)
      const viewId = optionalText(body.id, 200) || createBusinessId('admin-view')
      if (!['accounts','queue','commercial','people'].includes(screen) || !name) {
        throw new CommandCenterRequestError('Saved view name and supported screen are required.', 400)
      }
      const filters = jsonObject(body.filters)
      const sort = jsonObject(body.sort)
      const columns = stringArray(body.columns, 30)
      const isDefault = body.isDefault === true
      await db.$transaction(async (tx) => {
        if (isDefault) {
          await tx.$executeRawUnsafe(
            `UPDATE wewed_admin."AdminSavedView" SET "isDefault"=false, "updatedAt"=CURRENT_TIMESTAMP
             WHERE "administratorUserId"=$1 AND screen=$2`,
            context.session.userId,
            screen,
          )
        }
        await tx.$executeRawUnsafe(
          `INSERT INTO wewed_admin."AdminSavedView"
            (id,"administratorUserId",name,screen,filters,sort,columns,"isDefault")
           VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8)
           ON CONFLICT (id) DO UPDATE SET
             name=EXCLUDED.name,
             screen=EXCLUDED.screen,
             filters=EXCLUDED.filters,
             sort=EXCLUDED.sort,
             columns=EXCLUDED.columns,
             "isDefault"=EXCLUDED."isDefault",
             "updatedAt"=CURRENT_TIMESTAMP
           WHERE wewed_admin."AdminSavedView"."administratorUserId"=$2`,
          viewId,
          context.session.userId,
          name,
          screen,
          JSON.stringify(filters),
          JSON.stringify(sort),
          JSON.stringify(columns),
          isDefault,
        )
      })
      return NextResponse.json({ success: true, id: viewId })
    }

    if (action === 'delete_view') {
      const id = text(body.id, 200)
      if (!id) throw new CommandCenterRequestError('Saved view id is required.', 400)
      await db.$executeRawUnsafe(
        `DELETE FROM wewed_admin."AdminSavedView"
         WHERE id=$1 AND "administratorUserId"=$2`,
        id,
        context.session.userId,
      )
      return NextResponse.json({ success: true })
    }

    if (action === 'update_work_item') {
      if (!canManageOperations(context)) {
        throw new WewedAdminAccessError('This administrator cannot manage work items.', 403)
      }
      const id = text(body.id, 200)
      const status = text(body.status, 40)
      const priority = text(body.priority, 40)
      const departmentKey = optionalText(body.departmentKey, 120)
      const assignedToUserId = optionalText(body.assignedToUserId, 200)
      if (!id || !['open','in_progress','blocked','resolved','dismissed'].includes(status)) {
        throw new CommandCenterRequestError('Valid work item and status are required.', 400)
      }
      if (!['low','normal','high','critical'].includes(priority)) {
        throw new CommandCenterRequestError('Invalid priority.', 400)
      }
      const items = await db.$queryRawUnsafe<Array<{ businessAccountId: string | null }>>(
        `SELECT "businessAccountId" FROM wewed_admin."AdminWorkItem" WHERE id=$1 LIMIT 1`,
        id,
      )
      if (!items[0]) throw new CommandCenterRequestError('Work item not found.', 404)
      if (items[0].businessAccountId) await scopedAccount(context, items[0].businessAccountId)
      await db.$executeRawUnsafe(
        `UPDATE wewed_admin."AdminWorkItem"
         SET status=$2,
             priority=$3,
             "departmentKey"=$4,
             "assignedToUserId"=$5,
             "resolvedAt"=CASE WHEN $2 IN ('resolved','dismissed') THEN CURRENT_TIMESTAMP ELSE NULL END,
             "updatedAt"=CURRENT_TIMESTAMP
         WHERE id=$1`,
        id,
        status,
        priority,
        departmentKey,
        assignedToUserId,
      )
      await writeBusinessAudit({
        actorUserId: context.session.userId,
        businessAccountId: items[0].businessAccountId,
        action: 'admin.work_item.updated',
        resourceType: 'AdminWorkItem',
        resourceId: id,
        details: { status, priority, departmentKey, assignedToUserId },
      })
      return NextResponse.json({ success: true })
    }

    throw new CommandCenterRequestError('Unsupported command-centre action.', 400)
  } catch (error) {
    return errorResponse(error)
  }
}