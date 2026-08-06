import 'server-only'

import { randomUUID } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { readAppSession, type AppSession } from '@/lib/app-session'
import { db } from '@/lib/db'
import {
  CUSTOMER_PARTNER_ACCOUNT_TYPES,
  hasWewedAdminPermission,
  isPlatformAccountType,
  resolveWewedAdminPermissions,
  type PlatformAdminScope,
  type PlatformAccountType,
  type WewedAdminPermission,
} from '@/lib/wewed-admin-policy'

export class WewedAdminAccessError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403,
  ) {
    super(message)
    this.name = 'WewedAdminAccessError'
  }
}

export interface WewedAdminContext {
  session: AppSession
  membershipId: string
  businessAccountId: string
  adminRole: string
  permissions: string[]
  accountScope: PlatformAdminScope
  registrySource: 'platform_registry' | 'legacy_membership'
}

interface PlatformAdminRow {
  membershipId: string | null
  businessAccountId: string
  adminRole: string
  permissions: unknown
  status: string
}

interface ScopeRow {
  scopeType: string
  scopeValue: string
}

interface LegacyAdminMembershipRow {
  membershipId: string
  businessAccountId: string
  adminRole: string
  permissions: unknown
}

type PlatformRegistryLookup =
  | {
      state: 'active'
      membership: PlatformAdminRow
      scope: PlatformAdminScope
    }
  | {
      state: 'inactive'
      status: string
    }
  | {
      state: 'missing'
    }

export function assertWewedAdminPermission(
  context: WewedAdminContext,
  permission: WewedAdminPermission,
): void {
  if (!hasWewedAdminPermission(context.permissions, permission)) {
    throw new WewedAdminAccessError(
      `This administrator role does not have ${permission} permission.`,
      403,
    )
  }
}

function defaultScopeForRole(role: string): PlatformAdminScope {
  if (role === 'wewed_super_admin') {
    return { global: true, accountTypes: [], businessAccountIds: [] }
  }
  return {
    global: false,
    accountTypes: [...CUSTOMER_PARTNER_ACCOUNT_TYPES],
    businessAccountIds: [],
  }
}

function normalizeScope(rows: ScopeRow[], role: string): PlatformAdminScope {
  if (rows.length === 0) return defaultScopeForRole(role)

  const global =
    role === 'wewed_super_admin' &&
    rows.some(
      (row) => row.scopeType === 'global' && row.scopeValue === '*',
    )
  const accountTypes = Array.from(
    new Set(
      rows
        .filter((row) => row.scopeType === 'account_type')
        .map((row) => row.scopeValue)
        .filter(isPlatformAccountType),
    ),
  ) as PlatformAccountType[]
  const businessAccountIds = Array.from(
    new Set(
      rows
        .filter((row) => row.scopeType === 'business_account')
        .map((row) => row.scopeValue)
        .filter(Boolean),
    ),
  )

  return { global, accountTypes, businessAccountIds }
}

function isMissingPlatformRegistryError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes('PlatformAdministrator') ||
    message.includes('PlatformAdministratorScope') ||
    message.includes('does not exist')
  )
}

async function readPlatformRegistry(
  userId: string,
): Promise<PlatformRegistryLookup> {
  try {
    const rows = await db.$queryRawUnsafe<PlatformAdminRow[]>(
      `SELECT
         pa."legacyMembershipId" AS "membershipId",
         COALESCE(bam."businessAccountId", 'wewed-platform') AS "businessAccountId",
         pa.role AS "adminRole",
         COALESCE(bam.permissions, '[]'::jsonb) AS permissions,
         pa.status
       FROM wewed_admin."PlatformAdministrator" pa
       LEFT JOIN wewed_admin."BusinessAccountMember" bam
         ON bam.id = pa."legacyMembershipId"
       WHERE pa."userId" = $1
       LIMIT 1`,
      userId,
    )
    const membership = rows[0]

    if (!membership) return { state: 'missing' }
    if (membership.status !== 'active') {
      return { state: 'inactive', status: membership.status }
    }

    const scopeRows = await db.$queryRawUnsafe<ScopeRow[]>(
      `SELECT "scopeType", "scopeValue"
       FROM wewed_admin."PlatformAdministratorScope"
       WHERE "administratorUserId" = $1
       ORDER BY "scopeType", "scopeValue"`,
      userId,
    )

    return {
      state: 'active',
      membership,
      scope: normalizeScope(scopeRows, membership.adminRole),
    }
  } catch (error) {
    if (isMissingPlatformRegistryError(error)) {
      return { state: 'missing' }
    }
    throw error
  }
}

async function readLegacyMembership(
  userId: string,
): Promise<LegacyAdminMembershipRow | null> {
  const memberships = await db.$queryRawUnsafe<LegacyAdminMembershipRow[]>(
    `SELECT
       bam.id AS "membershipId",
       ba.id AS "businessAccountId",
       bam.role AS "adminRole",
       bam.permissions
     FROM public."BusinessAccountMember" bam
     JOIN public."BusinessAccount" ba ON ba.id = bam."businessAccountId"
     WHERE bam."userId" = $1
       AND bam.status = 'active'
       AND ba.type = 'wewed_internal'
       AND ba.status = 'active'
     ORDER BY CASE bam.role
       WHEN 'wewed_super_admin' THEN 0
       WHEN 'wewed_operations_admin' THEN 1
       WHEN 'wewed_billing_admin' THEN 2
       WHEN 'wewed_support_admin' THEN 3
       WHEN 'wewed_analyst' THEN 4
       ELSE 5
     END
     LIMIT 1`,
    userId,
  )

  return memberships[0] ?? null
}

export async function requireWewedAdmin(
  request: NextRequest,
  permission: WewedAdminPermission = 'admin.overview.read',
): Promise<WewedAdminContext> {
  const session = readAppSession(request)
  if (!session) throw new WewedAdminAccessError('Sign in is required.', 401)
  if (session.role !== 'admin') {
    throw new WewedAdminAccessError(
      'This area is restricted to Wewed company administrators.',
      403,
    )
  }

  const activeAdmin = await db.user.findFirst({
    where: { id: session.userId, role: 'admin', isActive: true },
    select: { id: true },
  })
  if (!activeAdmin) {
    throw new WewedAdminAccessError(
      'This Wewed administrator identity is inactive.',
      403,
    )
  }

  const registry = await readPlatformRegistry(session.userId)
  if (registry.state === 'inactive') {
    throw new WewedAdminAccessError(
      `This Wewed platform membership is ${registry.status}.`,
      403,
    )
  }

  const legacy =
    registry.state === 'missing'
      ? await readLegacyMembership(session.userId)
      : null
  const membership =
    registry.state === 'active' ? registry.membership : legacy

  if (!membership) {
    throw new WewedAdminAccessError(
      'An active, named Wewed platform role is required.',
      403,
    )
  }

  const context: WewedAdminContext = {
    session,
    membershipId:
      membership.membershipId || `platform-admin-${session.userId}`,
    businessAccountId: membership.businessAccountId,
    adminRole: membership.adminRole,
    permissions: resolveWewedAdminPermissions(
      membership.adminRole,
      membership.permissions,
    ),
    accountScope:
      registry.state === 'active'
        ? registry.scope
        : defaultScopeForRole(membership.adminRole),
    registrySource:
      registry.state === 'active'
        ? 'platform_registry'
        : 'legacy_membership',
  }

  assertWewedAdminPermission(context, permission)
  return context
}

export function buildBusinessAccountScopeSql(
  context: WewedAdminContext,
  alias = 'ba',
  firstParameter = 1,
): { clause: string; values: unknown[] } {
  if (context.accountScope.global) return { clause: 'TRUE', values: [] }

  const clauses: string[] = []
  const values: unknown[] = []

  if (context.accountScope.accountTypes.length > 0) {
    values.push(context.accountScope.accountTypes)
    clauses.push(
      `${alias}.type = ANY($${firstParameter + values.length - 1}::text[])`,
    )
  }
  if (context.accountScope.businessAccountIds.length > 0) {
    values.push(context.accountScope.businessAccountIds)
    clauses.push(
      `${alias}.id = ANY($${firstParameter + values.length - 1}::text[])`,
    )
  }
  if (clauses.length === 0) return { clause: 'FALSE', values: [] }

  return {
    clause: `${alias}.type <> 'wewed_internal' AND (${clauses.join(' OR ')})`,
    values,
  }
}

export function createBusinessId(prefix: string): string {
  return `${prefix}-${randomUUID()}`
}

export async function writeBusinessAudit(input: {
  actorUserId: string
  businessAccountId?: string | null
  action: string
  resourceType: string
  resourceId?: string | null
  details?: Record<string, unknown>
}): Promise<void> {
  await db.$executeRawUnsafe(
    `INSERT INTO public."BusinessAuditLog"
      ("id", "actorUserId", "businessAccountId", "action", "resourceType", "resourceId", "details")
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    createBusinessId('audit'),
    input.actorUserId,
    input.businessAccountId ?? null,
    input.action,
    input.resourceType,
    input.resourceId ?? null,
    JSON.stringify(input.details ?? {}),
  )
}
