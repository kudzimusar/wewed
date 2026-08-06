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
  ACCOUNT_LIFECYCLE_STATUSES,
  CUSTOMER_PARTNER_ACCOUNT_TYPES,
  WEWED_ADMIN_ROLE_LABELS,
  WEWED_ADMIN_ROLES,
  accountScopeAllows,
  canTransitionAccount,
  isAccountLifecycleStatus,
  isPlatformAccountType,
  isWewedAdminRole,
  permissionForAccountTransition,
  rolePermissionMatrix,
  type PlatformAccountType,
} from '@/lib/wewed-admin-policy'

export const dynamic = 'force-dynamic'

type GovernanceAction =
  | 'transition_account'
  | 'update_platform_admin_role'
  | 'transition_platform_admin'
  | 'replace_platform_admin_scopes'

type AccountRow = {
  id: string
  name: string
  slug: string
  type: string
  status: string
  ownerUserId: string | null
  ownerEmail: string | null
  ownerName: string | null
  onboardingStatus: string
  subscriptionPlan: string
  subscriptionStatus: string
  memberCount: number
  activeMemberCount: number
  weddingCount: number
  linkedEntityCount: number
  lastActivityAt: Date
  createdAt: Date
  updatedAt: Date
}

type PlatformAdministratorRow = {
  userId: string
  legacyMembershipId: string | null
  email: string
  name: string | null
  userActive: boolean
  lastLoginAt: Date | null
  role: string
  membershipStatus: string
  statusReason: string | null
  invitationStatus: string | null
  invitedAt: Date | null
  activatedAt: Date | null
  suspendedAt: Date | null
  revokedAt: Date | null
  version: number
  updatedAt: Date
}

type ScopeRow = {
  administratorUserId: string
  scopeType: string
  scopeValue: string
}

class GovernanceRequestError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409,
  ) {
    super(message)
    this.name = 'GovernanceRequestError'
  }
}

function text(value: unknown, max = 1000): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function uniqueStrings(value: unknown, maxItems = 100): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(value.map((item) => text(item, 300)).filter(Boolean)),
  ).slice(0, maxItems)
}

function errorResponse(error: unknown) {
  if (error instanceof WewedAdminAccessError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status },
    )
  }
  if (error instanceof GovernanceRequestError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status },
    )
  }

  console.error('[api/admin/governance] Error:', error)
  return NextResponse.json(
    { success: false, error: 'Unable to complete the governance request.' },
    { status: 500 },
  )
}

function riskFlags(account: AccountRow): string[] {
  const flags: string[] = []
  if (account.type !== 'wewed_internal' && !account.ownerUserId) {
    flags.push('missing_owner')
  }
  if (account.type !== 'wewed_internal' && account.activeMemberCount === 0) {
    flags.push('no_active_members')
  }
  if (account.onboardingStatus !== 'complete') {
    flags.push('incomplete_onboarding')
  }
  if (
    ['rejected', 'suspended', 'blocked', 'cancelled', 'archived'].includes(
      account.status,
    )
  ) {
    flags.push('restricted_access')
  }
  if (
    ['past_due', 'unpaid', 'incomplete_expired'].includes(
      account.subscriptionStatus,
    )
  ) {
    flags.push('billing_attention')
  }
  if (
    account.lastActivityAt.getTime() <
    Date.now() - 60 * 24 * 60 * 60 * 1000
  ) {
    flags.push('inactive_60_days')
  }
  return flags
}

function effectiveAdminStatus(admin: PlatformAdministratorRow): string {
  if (admin.membershipStatus === 'invited') return 'invited'
  if (admin.membershipStatus === 'revoked') return 'revoked'
  if (admin.membershipStatus === 'suspended') return 'suspended'
  return admin.userActive ? 'active' : 'suspended'
}

async function readScopedAccounts(
  context: WewedAdminContext,
): Promise<AccountRow[]> {
  const scope = buildBusinessAccountScopeSql(context, 'ba', 1)
  return db.$queryRawUnsafe<AccountRow[]>(
    `SELECT
       ba.id,
       ba.name,
       ba.slug,
       ba.type,
       ba.status,
       ba."ownerUserId",
       owner.email AS "ownerEmail",
       owner.name AS "ownerName",
       ba."onboardingStatus",
       ba."subscriptionPlan",
       ba."subscriptionStatus",
       (SELECT COUNT(*)::int
        FROM wewed_admin."BusinessAccountMember" member
        WHERE member."businessAccountId" = ba.id) AS "memberCount",
       (SELECT COUNT(*)::int
        FROM wewed_admin."BusinessAccountMember" member
        WHERE member."businessAccountId" = ba.id
          AND member.status = 'active') AS "activeMemberCount",
       (SELECT COUNT(*)::int
        FROM wewed_admin."BusinessAccountLink" link
        WHERE link."businessAccountId" = ba.id
          AND link."entityType" = 'wedding') AS "weddingCount",
       (SELECT COUNT(*)::int
        FROM wewed_admin."BusinessAccountLink" link
        WHERE link."businessAccountId" = ba.id) AS "linkedEntityCount",
       COALESCE(
         (SELECT MAX(member_user."lastLoginAt")
          FROM wewed_admin."BusinessAccountMember" member
          JOIN public."User" member_user
            ON member_user.id = member."userId"
          WHERE member."businessAccountId" = ba.id),
         owner."lastLoginAt",
         ba."updatedAt"
       ) AS "lastActivityAt",
       ba."createdAt",
       ba."updatedAt"
     FROM wewed_admin."BusinessAccount" ba
     LEFT JOIN public."User" owner ON owner.id = ba."ownerUserId"
     WHERE ${scope.clause}
     ORDER BY CASE ba.type
       WHEN 'wewed_internal' THEN 0
       WHEN 'planning_company' THEN 1
       WHEN 'couple' THEN 2
       WHEN 'venue' THEN 3
       WHEN 'vendor' THEN 4
       ELSE 5
     END, ba.name`,
    ...scope.values,
  )
}

async function readPlatformAdministrators(
  context: WewedAdminContext,
): Promise<
  Array<
    PlatformAdministratorRow & {
      scopes: ScopeRow[]
      effectiveStatus: string
    }
  >
> {
  const canManageAll = context.adminRole === 'wewed_super_admin'
  const administrators =
    await db.$queryRawUnsafe<PlatformAdministratorRow[]>(
      `SELECT
         pa."userId",
         pa."legacyMembershipId",
         u.email,
         u.name,
         u."isActive" AS "userActive",
         u."lastLoginAt",
         pa.role,
         pa.status AS "membershipStatus",
         pa."statusReason",
         profile."invitationStatus",
         pa."invitedAt",
         pa."activatedAt",
         pa."suspendedAt",
         pa."revokedAt",
         pa.version,
         pa."updatedAt"
       FROM wewed_admin."PlatformAdministrator" pa
       JOIN public."User" u ON u.id = pa."userId"
       LEFT JOIN wewed_admin."AdministratorProfile" profile
         ON profile."userId" = pa."userId"
       WHERE $1::boolean OR pa."userId" = $2
       ORDER BY CASE pa.role
         WHEN 'wewed_super_admin' THEN 0
         WHEN 'wewed_operations_admin' THEN 1
         WHEN 'wewed_billing_admin' THEN 2
         WHEN 'wewed_support_admin' THEN 3
         ELSE 4
       END, u.email`,
      canManageAll,
      context.session.userId,
    )

  const userIds = administrators.map((admin) => admin.userId)
  const scopes = userIds.length
    ? await db.$queryRawUnsafe<ScopeRow[]>(
        `SELECT "administratorUserId", "scopeType", "scopeValue"
         FROM wewed_admin."PlatformAdministratorScope"
         WHERE "administratorUserId" = ANY($1::text[])
         ORDER BY "administratorUserId", "scopeType", "scopeValue"`,
        userIds,
      )
    : []

  return administrators.map((admin) => ({
    ...admin,
    scopes: scopes.filter(
      (scope) => scope.administratorUserId === admin.userId,
    ),
    effectiveStatus: effectiveAdminStatus(admin),
  }))
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireWewedAdmin(
      request,
      'admin.accounts.read',
    )
    const [accountRows, administrators] = await Promise.all([
      readScopedAccounts(context),
      readPlatformAdministrators(context),
    ])
    const accounts = accountRows.map((account) => ({
      ...account,
      lastActivityAt: account.lastActivityAt.toISOString(),
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
      riskFlags: riskFlags(account),
    }))
    const accountTypeCounts = Object.fromEntries(
      [...CUSTOMER_PARTNER_ACCOUNT_TYPES, 'wewed_internal'].map((type) => [
        type,
        accounts.filter((account) => account.type === type).length,
      ]),
    )
    const roleLabel = isWewedAdminRole(context.adminRole)
      ? WEWED_ADMIN_ROLE_LABELS[context.adminRole]
      : context.adminRole

    return NextResponse.json({
      success: true,
      admin: {
        userId: context.session.userId,
        email: context.session.email,
        role: context.adminRole,
        roleLabel,
        permissions: context.permissions,
        accountScope: context.accountScope,
        registrySource: context.registrySource,
        isSuperAdmin: context.adminRole === 'wewed_super_admin',
      },
      accountTypeCounts,
      accounts,
      administrators: administrators.map((admin) => ({
        ...admin,
        lastLoginAt: admin.lastLoginAt?.toISOString() || null,
        invitedAt: admin.invitedAt?.toISOString() || null,
        activatedAt: admin.activatedAt?.toISOString() || null,
        suspendedAt: admin.suspendedAt?.toISOString() || null,
        revokedAt: admin.revokedAt?.toISOString() || null,
        updatedAt: admin.updatedAt.toISOString(),
      })),
      roles: WEWED_ADMIN_ROLES,
      roleLabels: WEWED_ADMIN_ROLE_LABELS,
      permissionMatrix: rolePermissionMatrix(),
      accountLifecycleStatuses: ACCOUNT_LIFECYCLE_STATUSES,
    })
  } catch (error) {
    return errorResponse(error)
  }
}

async function requireScopedAccount(
  context: WewedAdminContext,
  accountId: string,
): Promise<{ id: string; type: string; status: string; name: string }> {
  const scope = buildBusinessAccountScopeSql(context, 'ba', 2)
  const rows = await db.$queryRawUnsafe<
    Array<{ id: string; type: string; status: string; name: string }>
  >(
    `SELECT ba.id, ba.type, ba.status, ba.name
     FROM wewed_admin."BusinessAccount" ba
     WHERE ba.id = $1 AND ${scope.clause}
     LIMIT 1`,
    accountId,
    ...scope.values,
  )
  const account = rows[0]
  if (!account || !accountScopeAllows(context.accountScope, account)) {
    throw new GovernanceRequestError(
      'The account is outside this administrator scope.',
      404,
    )
  }
  return account
}

async function activeSuperAdminCount(): Promise<number> {
  const rows = await db.$queryRawUnsafe<Array<{ count: number }>>(
    `SELECT COUNT(*)::int AS count
     FROM wewed_admin."PlatformAdministrator" pa
     JOIN public."User" u ON u.id = pa."userId"
     WHERE pa.role = 'wewed_super_admin'
       AND pa.status = 'active'
       AND u."isActive" = true`,
  )
  return rows[0]?.count || 0
}

async function platformAdministrator(
  userId: string,
): Promise<PlatformAdministratorRow> {
  const rows = await db.$queryRawUnsafe<PlatformAdministratorRow[]>(
    `SELECT
       pa."userId",
       pa."legacyMembershipId",
       u.email,
       u.name,
       u."isActive" AS "userActive",
       u."lastLoginAt",
       pa.role,
       pa.status AS "membershipStatus",
       pa."statusReason",
       profile."invitationStatus",
       pa."invitedAt",
       pa."activatedAt",
       pa."suspendedAt",
       pa."revokedAt",
       pa.version,
       pa."updatedAt"
     FROM wewed_admin."PlatformAdministrator" pa
     JOIN public."User" u ON u.id = pa."userId"
     LEFT JOIN wewed_admin."AdministratorProfile" profile
       ON profile."userId" = pa."userId"
     WHERE pa."userId" = $1
     LIMIT 1`,
    userId,
  )
  if (!rows[0]) {
    throw new GovernanceRequestError('Administrator not found.', 404)
  }
  return rows[0]
}

async function writeAudit(
  tx: Prisma.TransactionClient,
  input: {
    actorUserId: string
    businessAccountId?: string | null
    action: string
    resourceType: string
    resourceId?: string | null
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
    input.businessAccountId ?? null,
    input.action,
    input.resourceType,
    input.resourceId ?? null,
    JSON.stringify(input.details),
  )
}

async function transitionAccount(
  context: WewedAdminContext,
  body: Record<string, unknown>,
) {
  const accountId = text(body.accountId, 200)
  const nextStatus = text(body.status, 50)
  const reason = text(body.reason, 2000)
  const note = text(body.note, 4000)

  if (!accountId || !isAccountLifecycleStatus(nextStatus) || !reason) {
    throw new GovernanceRequestError(
      'Account, valid status, and reason are required.',
      400,
    )
  }

  const account = await requireScopedAccount(context, accountId)
  if (account.type === 'wewed_internal') {
    throw new GovernanceRequestError(
      'Wewed internal lifecycle is governed through platform controls.',
      409,
    )
  }
  if (
    !isAccountLifecycleStatus(account.status) ||
    !canTransitionAccount(account.status, nextStatus)
  ) {
    throw new GovernanceRequestError(
      `The account cannot move from ${account.status} to ${nextStatus}.`,
      409,
    )
  }

  assertWewedAdminPermission(
    context,
    permissionForAccountTransition(account.status, nextStatus),
  )

  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `UPDATE wewed_admin."BusinessAccount"
       SET status = $2,
           notes = CASE WHEN $3 = '' THEN notes ELSE $3 END,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $1`,
      account.id,
      nextStatus,
      note,
    )
    await writeAudit(tx, {
      actorUserId: context.session.userId,
      businessAccountId: account.id,
      action: 'account.lifecycle_changed',
      resourceType: 'BusinessAccount',
      resourceId: account.id,
      details: {
        accountName: account.name,
        previousStatus: account.status,
        nextStatus,
        reason,
        note: note || null,
      },
    })
  })
}

async function updatePlatformAdminRole(
  context: WewedAdminContext,
  body: Record<string, unknown>,
) {
  assertWewedAdminPermission(context, 'admin.platform_admins.manage')
  const userId = text(body.userId, 200)
  const role = text(body.role, 80)
  const reason = text(body.reason, 2000)

  if (!userId || !isWewedAdminRole(role) || !reason) {
    throw new GovernanceRequestError(
      'Administrator, valid role, and reason are required.',
      400,
    )
  }

  const target = await platformAdministrator(userId)
  if (
    target.userId === context.session.userId &&
    target.role === 'wewed_super_admin' &&
    role !== target.role
  ) {
    throw new GovernanceRequestError(
      'A Super Admin cannot demote their own active account.',
      409,
    )
  }
  if (
    target.role === 'wewed_super_admin' &&
    role !== 'wewed_super_admin' &&
    target.membershipStatus === 'active' &&
    (await activeSuperAdminCount()) <= 1
  ) {
    throw new GovernanceRequestError(
      'The last active Super Admin cannot be demoted.',
      409,
    )
  }
  if (target.role === role) return

  await db.$transaction(async (tx) => {
    if (target.legacyMembershipId) {
      await tx.$executeRawUnsafe(
        `UPDATE wewed_admin."BusinessAccountMember"
         SET role = $2, "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $1`,
        target.legacyMembershipId,
        role,
      )
    } else {
      await tx.$executeRawUnsafe(
        `UPDATE wewed_admin."PlatformAdministrator"
         SET role = $2,
             version = version + 1,
             "updatedAt" = CURRENT_TIMESTAMP
         WHERE "userId" = $1`,
        target.userId,
        role,
      )
      await tx.$queryRawUnsafe(
        `SELECT wewed_admin.ensure_platform_admin_default_scopes($1, $2)`,
        target.userId,
        role,
      )
    }

    await tx.$executeRawUnsafe(
      `UPDATE wewed_admin."PlatformAdministrator"
       SET "statusReason" = $2,
           "updatedByUserId" = $3,
           version = version + 1,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE "userId" = $1`,
      target.userId,
      reason,
      context.session.userId,
    )
    await writeAudit(tx, {
      actorUserId: context.session.userId,
      businessAccountId: context.businessAccountId,
      action: 'platform_administrator.role_changed',
      resourceType: 'PlatformAdministrator',
      resourceId: target.userId,
      details: {
        email: target.email,
        previousRole: target.role,
        nextRole: role,
        reason,
      },
    })
  })
}

async function transitionPlatformAdmin(
  context: WewedAdminContext,
  body: Record<string, unknown>,
) {
  assertWewedAdminPermission(context, 'admin.platform_admins.manage')
  const userId = text(body.userId, 200)
  const status = text(body.status, 40)
  const reason = text(body.reason, 2000)

  if (
    !userId ||
    !['active', 'suspended', 'revoked'].includes(status) ||
    !reason
  ) {
    throw new GovernanceRequestError(
      'Administrator, valid status, and reason are required.',
      400,
    )
  }

  const target = await platformAdministrator(userId)
  if (target.membershipStatus === status) return
  if (target.membershipStatus === 'invited' && status === 'active') {
    throw new GovernanceRequestError(
      'Invited administrators become active only by accepting their secure invitation.',
      409,
    )
  }
  if (status === 'active' && !target.userActive) {
    throw new GovernanceRequestError(
      'The application identity must be active before access can be reinstated.',
      409,
    )
  }
  if (target.userId === context.session.userId && status !== 'active') {
    throw new GovernanceRequestError(
      'An administrator cannot suspend or revoke their own account.',
      409,
    )
  }
  if (
    target.role === 'wewed_super_admin' &&
    target.membershipStatus === 'active' &&
    status !== 'active' &&
    (await activeSuperAdminCount()) <= 1
  ) {
    throw new GovernanceRequestError(
      'The last active Super Admin cannot be suspended or revoked.',
      409,
    )
  }

  await db.$transaction(async (tx) => {
    if (target.legacyMembershipId) {
      await tx.$executeRawUnsafe(
        `UPDATE wewed_admin."BusinessAccountMember"
         SET status = $2, "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $1`,
        target.legacyMembershipId,
        status,
      )
    } else {
      await tx.$executeRawUnsafe(
        `UPDATE wewed_admin."PlatformAdministrator"
         SET status = $2,
             version = version + 1,
             "updatedAt" = CURRENT_TIMESTAMP
         WHERE "userId" = $1`,
        target.userId,
        status,
      )
    }

    await tx.$executeRawUnsafe(
      `UPDATE wewed_admin."PlatformAdministrator"
       SET "statusReason" = $2,
           "updatedByUserId" = $3,
           "activatedAt" = CASE
             WHEN $4 = 'active'
               THEN COALESCE("activatedAt", CURRENT_TIMESTAMP)
             ELSE "activatedAt"
           END,
           "suspendedAt" = CASE
             WHEN $4 = 'suspended' THEN CURRENT_TIMESTAMP
             WHEN $4 = 'active' THEN NULL
             ELSE "suspendedAt"
           END,
           "revokedAt" = CASE
             WHEN $4 = 'revoked' THEN CURRENT_TIMESTAMP
             WHEN $4 = 'active' THEN NULL
             ELSE "revokedAt"
           END,
           version = version + 1,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE "userId" = $1`,
      target.userId,
      reason,
      context.session.userId,
      status,
    )
    await tx.$executeRawUnsafe(
      `UPDATE wewed_admin."AdministratorProfile"
       SET "invitationStatus" = $2,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE "userId" = $1`,
      target.userId,
      status,
    )
    await writeAudit(tx, {
      actorUserId: context.session.userId,
      businessAccountId: context.businessAccountId,
      action: 'platform_administrator.status_changed',
      resourceType: 'PlatformAdministrator',
      resourceId: target.userId,
      details: {
        email: target.email,
        role: target.role,
        previousStatus: target.membershipStatus,
        nextStatus: status,
        reason,
      },
    })
  })
}

async function replacePlatformAdminScopes(
  context: WewedAdminContext,
  body: Record<string, unknown>,
) {
  assertWewedAdminPermission(context, 'admin.scopes.manage')
  const userId = text(body.userId, 200)
  const reason = text(body.reason, 2000)
  const accountTypes = uniqueStrings(body.accountTypes, 10).filter(
    (value): value is PlatformAccountType =>
      isPlatformAccountType(value) && value !== 'wewed_internal',
  )
  const businessAccountIds = uniqueStrings(
    body.businessAccountIds,
    100,
  )

  if (!userId || !reason) {
    throw new GovernanceRequestError(
      'Administrator and reason are required.',
      400,
    )
  }

  const target = await platformAdministrator(userId)
  if (target.role === 'wewed_super_admin') {
    throw new GovernanceRequestError(
      'Super Admin scope is always global and cannot be narrowed.',
      409,
    )
  }
  if (accountTypes.length === 0 && businessAccountIds.length === 0) {
    throw new GovernanceRequestError(
      'Assign at least one account category or explicit account.',
      400,
    )
  }
  if (businessAccountIds.length) {
    const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id
       FROM wewed_admin."BusinessAccount"
       WHERE id = ANY($1::text[])
         AND type <> 'wewed_internal'`,
      businessAccountIds,
    )
    if (rows.length !== businessAccountIds.length) {
      throw new GovernanceRequestError(
        'One or more explicit account scopes are invalid.',
        400,
      )
    }
  }

  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `DELETE FROM wewed_admin."PlatformAdministratorScope"
       WHERE "administratorUserId" = $1`,
      target.userId,
    )
    for (const accountType of accountTypes) {
      await tx.$executeRawUnsafe(
        `INSERT INTO wewed_admin."PlatformAdministratorScope"
          (id, "administratorUserId", "scopeType", "scopeValue",
           "createdByUserId")
         VALUES ($1, $2, 'account_type', $3, $4)`,
        createBusinessId('platform-scope'),
        target.userId,
        accountType,
        context.session.userId,
      )
    }
    for (const accountId of businessAccountIds) {
      await tx.$executeRawUnsafe(
        `INSERT INTO wewed_admin."PlatformAdministratorScope"
          (id, "administratorUserId", "scopeType", "scopeValue",
           "createdByUserId")
         VALUES ($1, $2, 'business_account', $3, $4)`,
        createBusinessId('platform-scope'),
        target.userId,
        accountId,
        context.session.userId,
      )
    }

    await tx.$executeRawUnsafe(
      `UPDATE wewed_admin."PlatformAdministrator"
       SET "statusReason" = $2,
           "updatedByUserId" = $3,
           version = version + 1,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE "userId" = $1`,
      target.userId,
      reason,
      context.session.userId,
    )
    await writeAudit(tx, {
      actorUserId: context.session.userId,
      businessAccountId: context.businessAccountId,
      action: 'platform_administrator.scopes_replaced',
      resourceType: 'PlatformAdministrator',
      resourceId: target.userId,
      details: {
        email: target.email,
        accountTypes,
        businessAccountIds,
        reason,
      },
    })
  })
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireWewedAdmin(
      request,
      'admin.accounts.read',
    )
    const body = (await request.json()) as Record<string, unknown>
    const action = text(body.action, 100) as GovernanceAction

    if (action === 'transition_account') {
      await transitionAccount(context, body)
    } else if (action === 'update_platform_admin_role') {
      await updatePlatformAdminRole(context, body)
    } else if (action === 'transition_platform_admin') {
      await transitionPlatformAdmin(context, body)
    } else if (action === 'replace_platform_admin_scopes') {
      await replacePlatformAdminScopes(context, body)
    } else {
      throw new GovernanceRequestError(
        'Unsupported governance action.',
        400,
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error)
  }
}
