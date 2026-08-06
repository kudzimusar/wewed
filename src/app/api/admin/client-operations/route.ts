import type { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  assertWewedAdminPermission,
  buildBusinessAccountScopeSql,
  createBusinessId,
  requireWewedAdmin,
  WewedAdminAccessError,
  type WewedAdminContext,
} from '@/lib/wewed-admin'
import {
  accountScopeAllows,
  isPlatformAccountType,
} from '@/lib/wewed-admin-policy'

export const dynamic = 'force-dynamic'

type ClientOperationsRequestErrorStatus = 400 | 404 | 409

class ClientOperationsRequestError extends Error {
  constructor(
    message: string,
    readonly status: ClientOperationsRequestErrorStatus,
  ) {
    super(message)
    this.name = 'ClientOperationsRequestError'
  }
}

type AccountRow = {
  id: string
  name: string
  slug: string
  type: string
  status: string
  onboardingStatus: string
  subscriptionPlan: string
  subscriptionStatus: string
  billingOfferCode: string | null
  billingOfferName: string | null
  billingModel: string | null
  billingInterval: string | null
  billingProfileStatus: string | null
  billingProfileSource: string | null
  currentPeriodEndsAt: Date | null
}

type DepartmentDefinitionRow = {
  departmentKey: string
  accountType: string
  name: string
  description: string
  systemKey: string
  dataPoints: unknown
  resourceTools: unknown
  defaultEnabled: boolean
  sortOrder: number
}

type DepartmentAssignmentRow = {
  businessAccountId: string
  departmentKey: string
  status: string
  version: number
  updatedAt: Date
}

type BillingOfferRow = {
  offerCode: string
  accountType: string
  name: string
  description: string
  billingModel: string
  legacyPlan: string
  currency: string
  monthlyCents: number | null
  annualCents: number | null
  departmentKeys: unknown
  entitlements: unknown
  selfService: boolean
  status: string
  version: number
}

const REQUIRED_DEPARTMENT_BY_ACCOUNT_TYPE: Record<string, string> = {
  couple: 'couple_billing_support',
  planning_company: 'planner_commercial_operations',
  vendor: 'vendor_verification_billing',
  venue: 'venue_verification_billing',
  client: 'client_contract_billing',
}

function text(value: unknown, max = 1000): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function uniqueStrings(value: unknown, maxItems = 100): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(value.map((item) => text(item, 240)).filter(Boolean)),
  ).slice(0, maxItems)
}

function errorResponse(error: unknown) {
  if (error instanceof WewedAdminAccessError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status },
    )
  }
  if (error instanceof ClientOperationsRequestError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status },
    )
  }

  console.error('[api/admin/client-operations] Error:', error)
  return NextResponse.json(
    { success: false, error: 'Unable to complete the client operations request.' },
    { status: 500 },
  )
}

async function readScopedAccounts(
  context: WewedAdminContext,
): Promise<AccountRow[]> {
  const scope = buildBusinessAccountScopeSql(context, 'ba', 1)
  return db.$queryRawUnsafe<AccountRow[]>(
    `SELECT ba.id, ba.name, ba.slug, ba.type, ba.status,
       ba."onboardingStatus", ba."subscriptionPlan", ba."subscriptionStatus",
       billing."offerCode" AS "billingOfferCode",
       offer.name AS "billingOfferName",
       offer."billingModel",
       billing.interval AS "billingInterval",
       billing.status AS "billingProfileStatus",
       billing.source AS "billingProfileSource",
       COALESCE(billing."currentPeriodEndsAt", ba."currentPeriodEndsAt")
         AS "currentPeriodEndsAt"
     FROM wewed_admin."BusinessAccount" ba
     LEFT JOIN wewed_admin."BusinessAccountBillingProfile" billing
       ON billing."businessAccountId" = ba.id
     LEFT JOIN wewed_admin."BillingOffer" offer
       ON offer."offerCode" = billing."offerCode"
      AND offer."accountType" = billing."accountType"
     WHERE ${scope.clause}
       AND ba.type <> 'wewed_internal'
     ORDER BY CASE ba.type
       WHEN 'couple' THEN 1
       WHEN 'planning_company' THEN 2
       WHEN 'venue' THEN 3
       WHEN 'vendor' THEN 4
       ELSE 5
     END, ba.name`,
    ...scope.values,
  )
}

async function requireScopedAccount(
  context: WewedAdminContext,
  accountId: string,
): Promise<{ id: string; name: string; type: string }> {
  const scope = buildBusinessAccountScopeSql(context, 'ba', 2)
  const rows = await db.$queryRawUnsafe<
    Array<{ id: string; name: string; type: string }>
  >(
    `SELECT ba.id, ba.name, ba.type
     FROM wewed_admin."BusinessAccount" ba
     WHERE ba.id = $1
       AND ba.type <> 'wewed_internal'
       AND ${scope.clause}
     LIMIT 1`,
    accountId,
    ...scope.values,
  )
  const account = rows[0]
  if (!account || !accountScopeAllows(context.accountScope, account)) {
    throw new ClientOperationsRequestError(
      'The account is outside this administrator scope.',
      404,
    )
  }
  if (!isPlatformAccountType(account.type) || account.type === 'wewed_internal') {
    throw new ClientOperationsRequestError(
      'This account does not support client departments.',
      409,
    )
  }
  return account
}

async function writeAudit(
  tx: Prisma.TransactionClient,
  input: {
    actorUserId: string
    businessAccountId: string
    action: string
    resourceType: string
    resourceId: string
    details: Record<string, unknown>
  },
) {
  await tx.$executeRawUnsafe(
    `INSERT INTO wewed_admin."BusinessAuditLog"
      (id, "actorUserId", "businessAccountId", action,
       "resourceType", "resourceId", details)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    createBusinessId('audit'),
    input.actorUserId,
    input.businessAccountId,
    input.action,
    input.resourceType,
    input.resourceId,
    JSON.stringify(input.details),
  )
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireWewedAdmin(
      request,
      'admin.departments.read',
    )
    const accounts = await readScopedAccounts(context)
    const accountIds = accounts.map((account) => account.id)

    const [definitions, assignments, offers] = await Promise.all([
      db.$queryRawUnsafe<DepartmentDefinitionRow[]>(
        `SELECT "departmentKey", "accountType", name, description,
           "systemKey", "dataPoints", "resourceTools", "defaultEnabled",
           "sortOrder"
         FROM wewed_admin."ClientDepartmentDefinition"
         WHERE status = 'active'
         ORDER BY "accountType", "sortOrder", name`,
      ),
      accountIds.length
        ? db.$queryRawUnsafe<DepartmentAssignmentRow[]>(
            `SELECT "businessAccountId", "departmentKey", status, version,
               "updatedAt"
             FROM wewed_admin."BusinessAccountDepartment"
             WHERE "businessAccountId" = ANY($1::text[])
             ORDER BY "businessAccountId", "departmentKey"`,
            accountIds,
          )
        : Promise.resolve([]),
      db.$queryRawUnsafe<BillingOfferRow[]>(
        `SELECT "offerCode", "accountType", name, description,
           "billingModel", "legacyPlan", currency, "monthlyCents",
           "annualCents", "departmentKeys", entitlements, "selfService",
           status, version
         FROM wewed_admin."BillingOffer"
         WHERE status = 'active'
         ORDER BY "accountType", "monthlyCents" NULLS LAST, name`,
      ),
    ])

    return NextResponse.json({
      success: true,
      admin: {
        userId: context.session.userId,
        email: context.session.email,
        role: context.adminRole,
        permissions: context.permissions,
        accountScope: context.accountScope,
        canManageDepartments:
          context.permissions.includes('*') ||
          context.permissions.includes('admin.departments.manage'),
      },
      definitions,
      offers,
      accounts: accounts.map((account) => ({
        ...account,
        currentPeriodEndsAt:
          account.currentPeriodEndsAt?.toISOString() || null,
        departments: assignments
          .filter(
            (assignment) => assignment.businessAccountId === account.id,
          )
          .map((assignment) => ({
            ...assignment,
            updatedAt: assignment.updatedAt.toISOString(),
          })),
      })),
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireWewedAdmin(
      request,
      'admin.departments.read',
    )
    assertWewedAdminPermission(context, 'admin.departments.manage')

    const body = (await request.json()) as Record<string, unknown>
    const action = text(body.action, 100)
    if (action !== 'replace_account_departments') {
      throw new ClientOperationsRequestError(
        'Unsupported client operations action.',
        400,
      )
    }

    const accountId = text(body.accountId, 200)
    const departmentKeys = uniqueStrings(body.departmentKeys, 50)
    const reason = text(body.reason, 2000)
    if (!accountId || !departmentKeys.length || reason.length < 5) {
      throw new ClientOperationsRequestError(
        'Account, at least one department, and a meaningful reason are required.',
        400,
      )
    }

    const account = await requireScopedAccount(context, accountId)
    const requiredDepartment = REQUIRED_DEPARTMENT_BY_ACCOUNT_TYPE[account.type]
    if (requiredDepartment && !departmentKeys.includes(requiredDepartment)) {
      throw new ClientOperationsRequestError(
        'The category billing/support department must remain enabled to preserve the account data loop.',
        409,
      )
    }

    const validDefinitions = await db.$queryRawUnsafe<
      Array<{ departmentKey: string }>
    >(
      `SELECT "departmentKey"
       FROM wewed_admin."ClientDepartmentDefinition"
       WHERE "accountType" = $1
         AND status = 'active'
         AND "departmentKey" = ANY($2::text[])`,
      account.type,
      departmentKeys,
    )
    if (validDefinitions.length !== departmentKeys.length) {
      throw new ClientOperationsRequestError(
        'One or more departments do not belong to this account category.',
        400,
      )
    }

    await db.$transaction(async (tx) => {
      const previousRows = await tx.$queryRawUnsafe<
        Array<{ departmentKey: string }>
      >(
        `SELECT "departmentKey"
         FROM wewed_admin."BusinessAccountDepartment"
         WHERE "businessAccountId" = $1
           AND status = 'enabled'
         FOR UPDATE`,
        account.id,
      )
      const previousDepartmentKeys = previousRows.map(
        (row) => row.departmentKey,
      )

      await tx.$executeRawUnsafe(
        `UPDATE wewed_admin."BusinessAccountDepartment"
         SET status = 'disabled',
           version = version + 1,
           "updatedByUserId" = $2,
           "updatedAt" = CURRENT_TIMESTAMP
         WHERE "businessAccountId" = $1
           AND status <> 'disabled'`,
        account.id,
        context.session.userId,
      )

      for (const departmentKey of departmentKeys) {
        await tx.$executeRawUnsafe(
          `INSERT INTO wewed_admin."BusinessAccountDepartment" (
             id, "businessAccountId", "departmentKey", "accountType", status,
             "updatedByUserId"
           ) VALUES ($1, $2, $3, $4, 'enabled', $5)
           ON CONFLICT ("businessAccountId", "departmentKey") DO UPDATE SET
             "accountType" = EXCLUDED."accountType",
             status = 'enabled',
             version = wewed_admin."BusinessAccountDepartment".version + 1,
             "updatedByUserId" = EXCLUDED."updatedByUserId",
             "updatedAt" = CURRENT_TIMESTAMP`,
          createBusinessId('account-department'),
          account.id,
          departmentKey,
          account.type,
          context.session.userId,
        )
      }

      await writeAudit(tx, {
        actorUserId: context.session.userId,
        businessAccountId: account.id,
        action: 'account.departments_replaced',
        resourceType: 'BusinessAccountDepartment',
        resourceId: account.id,
        details: {
          accountName: account.name,
          accountType: account.type,
          previousDepartmentKeys,
          nextDepartmentKeys: departmentKeys,
          reason,
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error)
  }
}
