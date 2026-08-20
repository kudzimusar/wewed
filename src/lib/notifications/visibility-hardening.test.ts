import { describe, expect, it } from 'bun:test'
import {
  WEDDING_SCOPED_SOURCE_TYPES,
  isNotificationVisibleToPrincipal,
  isVendorNotificationSourceAuthorized,
} from './visibility'

describe('notification wedding-scope hardening', () => {
  it('classifies canonical wedding-owned sources as wedding scoped', () => {
    for (const sourceType of [
      'planner_task',
      'budget_item',
      'service_engagement',
      'contract_review_grant',
      'wedding',
      'programme_item',
      'guest',
      'contribution',
    ]) {
      expect(WEDDING_SCOPED_SOURCE_TYPES.has(sourceType)).toBe(true)
    }
  })

  it('fails closed for a wedding-owned source when weddingId is missing for every role', () => {
    for (const role of ['admin', 'planner', 'couple', 'vendor'] as const) {
      expect(
        isNotificationVisibleToPrincipal(
          {
            recipientUserId: 'user-1',
            weddingId: null,
            category: role === 'admin' ? 'admin' : 'task',
            sourceType: 'planner_task',
          },
          'user-1',
          new Set(['wedding-1']),
          role,
        ),
      ).toBe(false)
    }
  })

  it('fails closed when Vendor engagement or review-grant attention has no wedding scope', () => {
    const access = new Set([
      'service_engagement:engagement-1:wedding-1',
      'contract_review_grant:grant-1:wedding-1',
    ])

    expect(
      isVendorNotificationSourceAuthorized(
        {
          weddingId: null,
          category: 'engagement',
          sourceType: 'service_engagement',
          sourceId: 'engagement-1',
        },
        access,
      ),
    ).toBe(false)
    expect(
      isVendorNotificationSourceAuthorized(
        {
          weddingId: null,
          category: 'contract',
          sourceType: 'contract_review_grant',
          sourceId: 'grant-1',
        },
        access,
      ),
    ).toBe(false)
  })

  it('preserves legitimate recipient-scoped global system attention', () => {
    for (const role of ['admin', 'planner', 'couple', 'vendor'] as const) {
      expect(
        isNotificationVisibleToPrincipal(
          {
            recipientUserId: 'user-1',
            weddingId: null,
            category: 'system',
            sourceType: 'account_notice',
          },
          'user-1',
          new Set(),
          role,
        ),
      ).toBe(true)
    }
  })
})
