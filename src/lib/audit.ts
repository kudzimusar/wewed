import { db } from '@/lib/db'

/**
 * Audit logging helper.
 * Records important operational events for compliance and debugging.
 */
export interface AuditLogEntry {
  action: string
  resourceType: string
  resourceId?: string
  beforeValue?: unknown
  afterValue?: unknown
  ipAddress?: string
  userAgent?: string
  weddingId?: string
  actorId?: string
}

export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    await db.auditEvent.create({
      data: {
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        beforeValue: entry.beforeValue ? JSON.stringify(entry.beforeValue) : null,
        afterValue: entry.afterValue ? JSON.stringify(entry.afterValue) : null,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        weddingId: entry.weddingId,
        actorId: entry.actorId,
      },
    })
  } catch (err) {
    // Audit logging should never break the main operation
    console.error('[AUDIT] Failed to log event:', entry.action, err)
  }
}

/**
 * Get audit events for a wedding (admin only).
 */
export async function getAuditEvents(weddingId: string, limit = 50) {
  return db.auditEvent.findMany({
    where: { weddingId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}
