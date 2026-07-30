import 'server-only'

import { randomUUID } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { readAppSession, type AppSession } from '@/lib/app-session'
import { db } from '@/lib/db'

export class WewedAdminAccessError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403,
  ) {
    super(message)
    this.name = 'WewedAdminAccessError'
  }
}

export async function requireWewedAdmin(
  request: NextRequest,
): Promise<AppSession> {
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

  return session
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
