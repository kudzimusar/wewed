import type { NotificationRecord } from './contracts'

export type NotificationPrincipalRole = 'admin' | 'planner' | 'couple' | 'vendor'

export const VENDOR_ALLOWED_CATEGORIES = new Set([
  'vendor',
  'engagement',
  'message',
  'communication',
  'system',
])

export function vendorSourceAccessKey(sourceType: string, sourceId: string, weddingId: string) {
  return `${sourceType}:${sourceId}:${weddingId}`
}

export function isNotificationVisibleToPrincipal(
  notification: Pick<NotificationRecord, 'recipientUserId' | 'weddingId' | 'category' | 'sourceType'>,
  principalUserId: string,
  accessibleWeddingIds: ReadonlySet<string>,
  role: NotificationPrincipalRole,
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
