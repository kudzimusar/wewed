import 'server-only'

import { db } from '@/lib/db'
import { isDashboardRole, type DashboardRole } from '@/lib/app-session'
import { listAccessibleWeddings } from '@/lib/wedding-access'
import type { NotificationRecord } from '@/lib/notifications/contracts'
import {
  isNotificationVisibleToPrincipal,
  isVendorNotificationSourceAuthorized,
  vendorSourceAccessKey,
} from '@/lib/notifications/visibility'

export interface DeliveryAuthorizationCandidate {
  id: string
  recipientUserId: string
  recipientRole: string
  weddingId: string | null
  category: NotificationRecord['category']
  sourceType: string
  sourceId: string | null
}

async function vendorAuthorizationContext(userId: string): Promise<{
  weddingIds: Set<string>
  sourceAccessKeys: Set<string>
}> {
  const weddingRows = await db.$queryRawUnsafe<Array<{ weddingId: string }>>(
    `
      SELECT DISTINCT "weddingId"
      FROM public."EngagementParty"
      WHERE "userId" = $1
        AND status = 'active'
        AND "partyRole" = 'SERVICE_PROVIDER'
        AND "partyKind" = 'VENDOR'
    `,
    userId,
  )

  const sourceRows = await db.$queryRawUnsafe<
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

  return {
    weddingIds: new Set(weddingRows.map((row) => row.weddingId)),
    sourceAccessKeys: new Set(
      sourceRows.map((row) => vendorSourceAccessKey(row.sourceType, row.sourceId, row.weddingId)),
    ),
  }
}

async function activeWeddingIds(userId: string, role: DashboardRole): Promise<Set<string>> {
  if (role === 'admin') return new Set()
  if (role === 'vendor') return (await vendorAuthorizationContext(userId)).weddingIds

  const weddings = await listAccessibleWeddings(userId, role)
  return new Set(
    weddings
      .filter((wedding) => wedding.membershipStatus === 'active')
      .map((wedding) => wedding.id),
  )
}

/**
 * Re-checks the same recipient/source boundary at external-delivery time.
 * This intentionally does not trust authorization that may have been true when
 * the Notification row was created: memberships, Vendor parties and review grants
 * can be revoked before an email, WhatsApp or push attempt is dispatched.
 */
export async function isNotificationExternallyDeliverableToRecipient(
  candidate: DeliveryAuthorizationCandidate,
): Promise<boolean> {
  if (!isDashboardRole(candidate.recipientRole)) return false

  const role = candidate.recipientRole
  let weddingIds: Set<string>
  let vendorSourceKeys: Set<string> | null = null

  if (role === 'vendor') {
    const context = await vendorAuthorizationContext(candidate.recipientUserId)
    weddingIds = context.weddingIds
    vendorSourceKeys = context.sourceAccessKeys
  } else {
    weddingIds = await activeWeddingIds(candidate.recipientUserId, role)
  }

  if (
    !isNotificationVisibleToPrincipal(
      candidate,
      candidate.recipientUserId,
      weddingIds,
      role,
    )
  ) {
    return false
  }

  if (role !== 'vendor') return true
  return isVendorNotificationSourceAuthorized(candidate, vendorSourceKeys ?? new Set())
}
