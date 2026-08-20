import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import type { AppSession, DashboardRole } from '@/lib/app-session'
import { listAccessibleWeddings } from '@/lib/wedding-access'
import {
  createNotificationInputSchema,
  effectiveNotificationStateForRead,
  notificationListFilterSchema,
  snoozeNotificationInputSchema,
  type CreateNotificationInput,
  type NotificationListFilter,
  type NotificationRecord,
  type ReminderRecord,
  type SnoozeNotificationInput,
} from '@/lib/notifications/contracts'

export class NotificationAccessError extends Error {
  constructor(message = 'Notification access denied.') {
    super(message)
    this.name = 'NotificationAccessError'
  }
}

export class NotificationNotFoundError extends Error {
  constructor(message = 'Notification not found.') {
    super(message)
    this.name = 'NotificationNotFoundError'
  }
}

function effectivePrincipal(session: AppSession): { userId: string; role: DashboardRole } | null {
  const userId = session.effectiveUserId ?? session.userId ?? null
  if (!userId) return null
  const role = session.effectiveRole ?? session.role
  return { userId, role }
}

const VENDOR_ALLOWED_CATEGORIES = new Set([
  'vendor',
  'engagement',
  'message',
  'communication',
  'system',
])

function vendorSourceAccessKey(sourceType: string, sourceId: string, weddingId: string) {
  return `${sourceType}:${sourceId}:${weddingId}`
}

export function isNotificationVisibleToPrincipal(
  notification: Pick<NotificationRecord, 'recipientUserId' | 'weddingId' | 'category' | 'sourceType'>,
  principalUserId: string,
  accessibleWeddingIds: ReadonlySet<string>,
  role: DashboardRole,
): boolean {
  if (notification.recipientUserId !== principalUserId) return false
  if (role === 'vendor') {
    if (notification.category === 'contract') {
      if (notification.sourceType !== 'contract_review_grant') return false
    } else if (!VENDOR_ALLOWED_CATEGORIES.has(notification.category)) {
      return false
    }
  }
  if (!notification.weddingId) return true
  return accessibleWeddingIds.has(notification.weddingId)
}

export function isVendorNotificationSourceAuthorized(
  notification: Pick<NotificationRecord, 'weddingId' | 'category' | 'sourceType' | 'sourceId'>,
  sourceAccessKeys: ReadonlySet<string>,
): boolean {
  if (!notification.weddingId) return true

  if (notification.category === 'engagement' || notification.sourceType === 'service_engagement') {
    if (notification.sourceType !== 'service_engagement' || !notification.sourceId) return false
    return sourceAccessKeys.has(
      vendorSourceAccessKey('service_engagement', notification.sourceId, notification.weddingId),
    )
  }

  if (notification.category === 'contract' || notification.sourceType === 'contract_review_grant') {
    if (notification.sourceType !== 'contract_review_grant' || !notification.sourceId) return false
    return sourceAccessKeys.has(
      vendorSourceAccessKey('contract_review_grant', notification.sourceId, notification.weddingId),
    )
  }

  return true
}

async function vendorSourceAccessKeys(userId: string): Promise<Set<string>> {
  const rows = await db.$queryRawUnsafe<
    Array<{ sourceType: string; sourceId: string; weddingId: string }>
  >(
    `
      SELECT 'service_engagement' AS "sourceType",
             ep."serviceEngagementId" AS "sourceId",
             ep."weddingId" AS "weddingId"
      FROM public."EngagementParty" ep
      WHERE ep."userId" = $1
        AND ep.status = 'active'
        AND ep."partyRole" = 'SERVICE_PROVIDER'
        AND ep."partyKind" = 'VENDOR'

      UNION ALL

      SELECT 'contract_review_grant' AS "sourceType",
             crg.id AS "sourceId",
             c."weddingId" AS "weddingId"
      FROM public."ContractReviewGrant" crg
      JOIN public."Contract" c ON c.id = crg."contractId"
      JOIN public."ContractVersion" cv
        ON cv.id = crg."contractVersionId" AND cv."contractId" = crg."contractId"
      JOIN public."EngagementParty" ep ON ep.id = crg."engagementPartyId"
      WHERE ep."userId" = $1
        AND ep.status = 'active'
        AND ep."partyRole" = 'SERVICE_PROVIDER'
        AND ep."partyKind" = 'VENDOR'
        AND crg.status = 'ACTIVE'
        AND crg."revokedAt" IS NULL
        AND crg."expiresAt" > CURRENT_TIMESTAMP
        AND cv.status IN ('ISSUED', 'AWAITING_ACCEPTANCE', 'PARTIALLY_ACCEPTED')
    `,
    userId,
  )

  return new Set(rows.map((row) => vendorSourceAccessKey(row.sourceType, row.sourceId, row.weddingId)))
}

async function accessibleWeddingIdsForSession(session: AppSession): Promise<Set<string>> {
  const principal = effectivePrincipal(session)
  if (!principal) return new Set()

  const weddings = await listAccessibleWeddings(principal.userId, principal.role)
  const ids = new Set(
    weddings
      .filter((wedding) => wedding.membershipStatus === 'active')
      .map((wedding) => wedding.id),
  )

  if (principal.role === 'vendor') {
    const partyRows = await db.$queryRawUnsafe<Array<{ weddingId: string }>>(
      `
        SELECT DISTINCT "weddingId"
        FROM public."EngagementParty"
        WHERE "userId" = $1
          AND status = 'active'
          AND "partyRole" = 'SERVICE_PROVIDER'
          AND "partyKind" = 'VENDOR'
      `,
      principal.userId,
    )
    for (const row of partyRows) ids.add(row.weddingId)
  }

  return ids
}

async function assertWeddingRecipientAccess(
  recipientUserId: string,
  weddingId: string | null | undefined,
  sourceType: string,
  sourceId: string | null | undefined,
  category: string,
): Promise<void> {
  if (!weddingId) return

  const rows = await db.$queryRawUnsafe<Array<{ allowed: number }>>(
    `
      SELECT 1 AS allowed
      FROM public."WeddingMembership" m
      WHERE m."userId" = $1
        AND m."weddingId" = $2
        AND m.status = 'active'
      LIMIT 1
    `,
    recipientUserId,
    weddingId,
  )

  if (rows[0]) return

  if (
    sourceType === 'service_engagement' &&
    sourceId &&
    VENDOR_ALLOWED_CATEGORIES.has(category)
  ) {
    const partyRows = await db.$queryRawUnsafe<Array<{ allowed: number }>>(
      `
        SELECT 1 AS allowed
        FROM public."EngagementParty" ep
        WHERE ep."userId" = $1
          AND ep."weddingId" = $2
          AND ep."serviceEngagementId" = $3
          AND ep.status = 'active'
          AND ep."partyRole" = 'SERVICE_PROVIDER'
          AND ep."partyKind" = 'VENDOR'
        LIMIT 1
      `,
      recipientUserId,
      weddingId,
      sourceId,
    )
    if (partyRows[0]) return
  }

  if (
    sourceType === 'contract_review_grant' &&
    sourceId &&
    category === 'contract'
  ) {
    const grantRows = await db.$queryRawUnsafe<Array<{ allowed: number }>>(
      `
        SELECT 1 AS allowed
        FROM public."ContractReviewGrant" crg
        JOIN public."Contract" c ON c.id = crg."contractId"
        JOIN public."ContractVersion" cv
          ON cv.id = crg."contractVersionId" AND cv."contractId" = crg."contractId"
        JOIN public."EngagementParty" ep ON ep.id = crg."engagementPartyId"
        WHERE crg.id = $3
          AND c."weddingId" = $2
          AND ep."weddingId" = $2
          AND ep."userId" = $1
          AND ep.status = 'active'
          AND ep."partyRole" = 'SERVICE_PROVIDER'
          AND ep."partyKind" = 'VENDOR'
          AND crg.status = 'ACTIVE'
          AND crg."revokedAt" IS NULL
          AND crg."expiresAt" > CURRENT_TIMESTAMP
          AND cv.status IN ('ISSUED', 'AWAITING_ACCEPTANCE', 'PARTIALLY_ACCEPTED')
        LIMIT 1
      `,
      recipientUserId,
      weddingId,
      sourceId,
    )
    if (grantRows[0]) return
  }

  throw new NotificationAccessError(
    'The recipient does not have active access to the notification source.',
  )
}

function normalizeNotificationRow(row: NotificationRecord): NotificationRecord {
  return {
    ...row,
    metadata: row.metadata ?? null,
  }
}

export async function createNotification(input: CreateNotificationInput): Promise<NotificationRecord> {
  const parsed = createNotificationInputSchema.parse(input)
  await assertWeddingRecipientAccess(
    parsed.recipientUserId,
    parsed.weddingId,
    parsed.sourceType,
    parsed.sourceId,
    parsed.category,
  )

  const id = randomUUID()
  const inserted = await db.$queryRawUnsafe<NotificationRecord[]>(
    `
      INSERT INTO public."Notification" (
        id, "recipientUserId", "weddingId", "actorUserId", "sourceType", "sourceId",
        "eventType", category, severity, title, body, metadata, "deepLink", "actionType",
        "requiresAction", state, "scheduledFor", "expiresAt", "dedupeKey", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, CAST($12 AS jsonb), $13, $14,
        $15, $16, $17, $18, $19, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT DO NOTHING
      RETURNING *
    `,
    id,
    parsed.recipientUserId,
    parsed.weddingId ?? null,
    parsed.actorUserId ?? null,
    parsed.sourceType,
    parsed.sourceId ?? null,
    parsed.eventType,
    parsed.category,
    parsed.severity,
    parsed.title,
    parsed.body,
    parsed.metadata ? JSON.stringify(parsed.metadata) : null,
    parsed.deepLink ?? null,
    parsed.actionType ?? null,
    parsed.requiresAction,
    parsed.state,
    parsed.scheduledFor ?? null,
    parsed.expiresAt ?? null,
    parsed.dedupeKey ?? null,
  )

  if (inserted[0]) return normalizeNotificationRow(inserted[0])

  if (parsed.dedupeKey) {
    const existing = await db.$queryRawUnsafe<NotificationRecord[]>(
      `
        SELECT *
        FROM public."Notification"
        WHERE "recipientUserId" = $1 AND "dedupeKey" = $2
        LIMIT 1
      `,
      parsed.recipientUserId,
      parsed.dedupeKey,
    )
    if (existing[0]) return normalizeNotificationRow(existing[0])
  }

  throw new Error('Unable to create notification.')
}

export async function listNotificationsForSession(
  session: AppSession,
  input: NotificationListFilter = {},
): Promise<NotificationRecord[]> {
  const principal = effectivePrincipal(session)
  if (!principal) throw new NotificationAccessError('Authenticated user id is required.')

  const filters = notificationListFilterSchema.parse(input)
  const params: unknown[] = [principal.userId]
  const clauses = ['"recipientUserId" = $1']

  if (filters.state) {
    params.push(filters.state)
    clauses.push(`state = $${params.length}`)
  }
  if (filters.category) {
    params.push(filters.category)
    clauses.push(`category = $${params.length}`)
  }
  if (filters.weddingId) {
    params.push(filters.weddingId)
    clauses.push(`"weddingId" = $${params.length}`)
  }
  if (filters.unreadOnly) {
    clauses.push('"readAt" IS NULL')
    clauses.push(`state NOT IN ('resolved', 'cancelled', 'expired')`)
  }

  params.push(filters.limit)
  const rows = await db.$queryRawUnsafe<NotificationRecord[]>(
    `
      SELECT *
      FROM public."Notification"
      WHERE ${clauses.join(' AND ')}
      ORDER BY
        CASE severity
          WHEN 'urgent' THEN 0
          WHEN 'action_required' THEN 1
          WHEN 'important' THEN 2
          WHEN 'normal' THEN 3
          ELSE 4
        END,
        COALESCE("scheduledFor", "createdAt") ASC,
        "createdAt" DESC
      LIMIT $${params.length}
    `,
    ...params,
  )

  const accessibleWeddingIds = await accessibleWeddingIdsForSession(session)
  const visible = rows
    .map(normalizeNotificationRow)
    .filter((notification) =>
      isNotificationVisibleToPrincipal(
        notification,
        principal.userId,
        accessibleWeddingIds,
        principal.role,
      ),
    )

  if (principal.role !== 'vendor') return visible

  const sourceAccessKeys = await vendorSourceAccessKeys(principal.userId)
  return visible.filter((notification) =>
    isVendorNotificationSourceAuthorized(notification, sourceAccessKeys),
  )
}

export async function unreadNotificationCountForSession(session: AppSession): Promise<number> {
  const notifications = await listNotificationsForSession(session, { unreadOnly: true, limit: 100 })
  return notifications.length
}

async function requireVisibleNotification(
  session: AppSession,
  notificationId: string,
): Promise<{ principalUserId: string; notification: NotificationRecord }> {
  const principal = effectivePrincipal(session)
  if (!principal) throw new NotificationAccessError('Authenticated user id is required.')

  const rows = await db.$queryRawUnsafe<NotificationRecord[]>(
    `
      SELECT *
      FROM public."Notification"
      WHERE id = $1 AND "recipientUserId" = $2
      LIMIT 1
    `,
    notificationId,
    principal.userId,
  )
  const notification = rows[0]
  if (!notification) throw new NotificationNotFoundError()

  const accessibleWeddingIds = await accessibleWeddingIdsForSession(session)
  if (
    !isNotificationVisibleToPrincipal(
      notification,
      principal.userId,
      accessibleWeddingIds,
      principal.role,
    )
  ) {
    throw new NotificationAccessError()
  }

  if (principal.role === 'vendor') {
    const sourceAccessKeys = await vendorSourceAccessKeys(principal.userId)
    if (!isVendorNotificationSourceAuthorized(notification, sourceAccessKeys)) {
      throw new NotificationAccessError()
    }
  }

  return { principalUserId: principal.userId, notification: normalizeNotificationRow(notification) }
}

export async function setNotificationReadState(
  session: AppSession,
  notificationId: string,
  read: boolean,
): Promise<NotificationRecord> {
  const { principalUserId, notification } = await requireVisibleNotification(session, notificationId)
  const nextState = effectiveNotificationStateForRead(notification.state, read)

  const rows = await db.$queryRawUnsafe<NotificationRecord[]>(
    `
      UPDATE public."Notification"
      SET state = $3,
          "readAt" = CASE WHEN $4::boolean THEN COALESCE("readAt", CURRENT_TIMESTAMP) ELSE NULL END,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $1 AND "recipientUserId" = $2
      RETURNING *
    `,
    notificationId,
    principalUserId,
    nextState,
    read,
  )

  if (!rows[0]) throw new NotificationNotFoundError()
  return normalizeNotificationRow(rows[0])
}

export async function acknowledgeNotification(
  session: AppSession,
  notificationId: string,
): Promise<NotificationRecord> {
  const { principalUserId } = await requireVisibleNotification(session, notificationId)
  const rows = await db.$queryRawUnsafe<NotificationRecord[]>(
    `
      UPDATE public."Notification"
      SET state = CASE
            WHEN state IN ('resolved', 'cancelled', 'expired') THEN state
            ELSE 'acknowledged'
          END,
          "readAt" = COALESCE("readAt", CURRENT_TIMESTAMP),
          "acknowledgedAt" = CASE
            WHEN state IN ('resolved', 'cancelled', 'expired') THEN "acknowledgedAt"
            ELSE COALESCE("acknowledgedAt", CURRENT_TIMESTAMP)
          END,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $1 AND "recipientUserId" = $2
      RETURNING *
    `,
    notificationId,
    principalUserId,
  )

  if (!rows[0]) throw new NotificationNotFoundError()
  return normalizeNotificationRow(rows[0])
}

export async function resolveNotification(
  session: AppSession,
  notificationId: string,
): Promise<NotificationRecord> {
  const { principalUserId } = await requireVisibleNotification(session, notificationId)
  const rows = await db.$queryRawUnsafe<NotificationRecord[]>(
    `
      UPDATE public."Notification"
      SET state = CASE WHEN state IN ('cancelled', 'expired') THEN state ELSE 'resolved' END,
          "readAt" = COALESCE("readAt", CURRENT_TIMESTAMP),
          "resolvedAt" = CASE
            WHEN state IN ('cancelled', 'expired') THEN "resolvedAt"
            ELSE COALESCE("resolvedAt", CURRENT_TIMESTAMP)
          END,
          "snoozedUntil" = NULL,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $1 AND "recipientUserId" = $2
      RETURNING *
    `,
    notificationId,
    principalUserId,
  )

  if (!rows[0]) throw new NotificationNotFoundError()

  await db.$executeRawUnsafe(
    `
      UPDATE public."Reminder"
      SET state = 'cancelled', "cancelledAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "recipientUserId" = $1
        AND "sourceType" = 'notification'
        AND "sourceId" = $2
        AND state = 'scheduled'
    `,
    principalUserId,
    notificationId,
  )

  return normalizeNotificationRow(rows[0])
}

export async function snoozeNotification(
  session: AppSession,
  input: SnoozeNotificationInput,
): Promise<{ notification: NotificationRecord; reminder: ReminderRecord }> {
  const parsed = snoozeNotificationInputSchema.parse(input)
  if (parsed.triggerAt.getTime() <= Date.now()) {
    throw new Error('Snooze time must be in the future.')
  }

  const { principalUserId, notification } = await requireVisibleNotification(
    session,
    parsed.notificationId,
  )

  const reminderId = randomUUID()
  const dedupeKey = `snooze:${notification.id}:${parsed.triggerAt.toISOString()}`

  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const reminderRows = await tx.$queryRawUnsafe<ReminderRecord[]>(
      `
        INSERT INTO public."Reminder" (
          id, "ownerUserId", "recipientUserId", "weddingId", "sourceType", "sourceId",
          "triggerAt", timezone, state, "deliveryPolicy", "dedupeKey", "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $2, $3, 'notification', $4,
          $5, $6, 'scheduled', '{"surface":"in_app"}'::jsonb, $7,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT DO NOTHING
        RETURNING *
      `,
      reminderId,
      principalUserId,
      notification.weddingId,
      notification.id,
      parsed.triggerAt,
      parsed.timezone,
      dedupeKey,
    )

    let reminder = reminderRows[0]
    if (!reminder) {
      const existing = await tx.$queryRawUnsafe<ReminderRecord[]>(
        `
          SELECT * FROM public."Reminder"
          WHERE "recipientUserId" = $1 AND "dedupeKey" = $2
          LIMIT 1
        `,
        principalUserId,
        dedupeKey,
      )
      reminder = existing[0]
    }
    if (!reminder) throw new Error('Unable to create snooze reminder.')

    const notificationRows = await tx.$queryRawUnsafe<NotificationRecord[]>(
      `
        UPDATE public."Notification"
        SET state = 'scheduled',
            "snoozedUntil" = $3,
            "scheduledFor" = $3,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = $1 AND "recipientUserId" = $2
          AND state NOT IN ('resolved', 'cancelled', 'expired')
        RETURNING *
      `,
      notification.id,
      principalUserId,
      parsed.triggerAt,
    )

    if (!notificationRows[0]) {
      throw new Error('Resolved, cancelled or expired notifications cannot be snoozed.')
    }

    return {
      notification: normalizeNotificationRow(notificationRows[0]),
      reminder,
    }
  })
}