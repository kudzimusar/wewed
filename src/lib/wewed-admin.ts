import 'server-only'

import { randomUUID } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { readAppSession, type AppSession } from '@/lib/app-session'
import { db } from '@/lib/db'
import {
  hasWewedAdminPermission,
  resolveWewedAdminPermissions,
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
}

interface AdminMembershipRow {
  membershipId: string
  businessAccountId: string
  adminRole: string
  permissions: unknown
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

export async function requireWewedAdmin(
  request: NextRequest,
  permission: WewedAdminPermission = 'admin.overview.read',
): Promise<WewedAdminContext> {
  const session = readAppSession(request)

  if (!session) {
    throw new WewedAdminAccessError('Sign in is required.', 401)
  }

  if (session.role !== 'admin') {
    throw new WewedAdminAccessError(
      'This area is restricted to Wewed company administrators.',
      403,
    )
  }

  const activeAdmin = await db.user.findFirst({
    where: {
      id: session.userId,
      role: 'admin',
      isActive: true,
    },
    select: { id: true },
  })

  if (!activeAdmin) {
    throw new WewedAdminAccessError(
      'This Wewed administrator account is inactive.',
      403,
    )
  }

  const memberships = await db.$queryRawUnsafe<AdminMembershipRow[]>(
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
    session.userId,
  )

  const membership = memberships[0]
  if (!membership) {
    throw new WewedAdminAccessError(
      'An active Wewed platform role is required.',
      403,
    )
  }

  const context: WewedAdminContext = {
    session,
    membershipId: membership.membershipId,
    businessAccountId: membership.businessAccountId,
    adminRole: membership.adminRole,
    permissions: resolveWewedAdminPermissions(
      membership.adminRole,
      membership.permissions,
    ),
  }

  assertWewedAdminPermission(context, permission)
  return context
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
