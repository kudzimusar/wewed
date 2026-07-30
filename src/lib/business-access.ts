import 'server-only'

import { db } from '@/lib/db'

export const WEWED_PLATFORM_SESSION_ID = 'wewed-platform'

export async function isWewedPlatformAdministrator(userId: string): Promise<boolean> {
  const rows = await db.$queryRawUnsafe<Array<{ allowed: boolean }>>(
    `SELECT EXISTS (
       SELECT 1
       FROM public."BusinessAccountMember" bam
       JOIN public."BusinessAccount" ba ON ba.id = bam."businessAccountId"
       WHERE bam."userId" = $1
         AND bam.status = 'active'
         AND ba.type = 'wewed_internal'
         AND ba.status = 'active'
         AND bam.role IN (
           'wewed_super_admin',
           'wewed_operations_admin',
           'wewed_billing_admin',
           'wewed_support_admin',
           'wewed_analyst'
         )
     ) AS allowed`,
    userId,
  )

  return Boolean(rows[0]?.allowed)
}

function parsePermissions(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string')
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string')
        : []
    } catch {
      return []
    }
  }

  return []
}

export function businessMemberCanManageBilling(role: string, permissions: unknown): boolean {
  const explicit = parsePermissions(permissions)
  return (
    ['business_owner', 'couple_owner', 'billing_manager'].includes(role) ||
    explicit.includes('*') ||
    explicit.includes('billing.manage')
  )
}
