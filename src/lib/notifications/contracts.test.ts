import { describe, expect, it } from 'vitest'
import {
  canTransitionNotificationState,
  createNotificationInputSchema,
  effectiveNotificationStateForRead,
  isTerminalNotificationState,
} from './contracts'
import { isNotificationVisibleToPrincipal } from './service'

describe('notification contracts', () => {
  it('accepts a system-wide notification category and defaults', () => {
    const parsed = createNotificationInputSchema.parse({
      recipientUserId: 'user-1',
      sourceType: 'task',
      sourceId: 'task-1',
      eventType: 'task.due_soon',
      category: 'task',
      title: 'Task due tomorrow',
      body: 'Confirm the florist arrival time.',
    })

    expect(parsed.severity).toBe('normal')
    expect(parsed.state).toBe('active')
    expect(parsed.requiresAction).toBe(false)
  })

  it('rejects unknown categories rather than silently widening scope', () => {
    expect(() =>
      createNotificationInputSchema.parse({
        recipientUserId: 'user-1',
        sourceType: 'private_admin_record',
        eventType: 'private.leak',
        category: 'anything',
        title: 'Invalid',
        body: 'Invalid',
      }),
    ).toThrow()
  })

  it('keeps terminal lifecycle states terminal', () => {
    expect(isTerminalNotificationState('resolved')).toBe(true)
    expect(canTransitionNotificationState('resolved', 'active')).toBe(false)
    expect(canTransitionNotificationState('active', 'resolved')).toBe(true)
  })

  it('marking read does not reopen resolved attention', () => {
    expect(effectiveNotificationStateForRead('active', true)).toBe('read')
    expect(effectiveNotificationStateForRead('read', false)).toBe('active')
    expect(effectiveNotificationStateForRead('resolved', false)).toBe('resolved')
  })
})

describe('notification visibility', () => {
  it('is fail-closed when the record belongs to another recipient', () => {
    expect(
      isNotificationVisibleToPrincipal(
        {
          recipientUserId: 'vendor-2',
          weddingId: null,
          category: 'engagement',
          sourceType: 'service_engagement',
        },
        'vendor-1',
        new Set(),
        'vendor',
      ),
    ).toBe(false)
  })

  it('allows a global notification only for its recipient', () => {
    expect(
      isNotificationVisibleToPrincipal(
        {
          recipientUserId: 'admin-1',
          weddingId: null,
          category: 'admin',
          sourceType: 'admin_operation',
        },
        'admin-1',
        new Set(),
        'admin',
      ),
    ).toBe(true)
  })

  it('requires active accessible wedding context for wedding-scoped notifications', () => {
    const row = {
      recipientUserId: 'planner-1',
      weddingId: 'wedding-1',
      category: 'task' as const,
      sourceType: 'planner_task',
    }

    expect(isNotificationVisibleToPrincipal(row, 'planner-1', new Set(), 'planner')).toBe(false)
    expect(
      isNotificationVisibleToPrincipal(row, 'planner-1', new Set(['wedding-1']), 'planner'),
    ).toBe(true)
  })

  it('does not expose couple/planner budget categories to vendors even inside an accessible wedding', () => {
    expect(
      isNotificationVisibleToPrincipal(
        {
          recipientUserId: 'vendor-1',
          weddingId: 'wedding-1',
          category: 'budget',
          sourceType: 'budget_item',
        },
        'vendor-1',
        new Set(['wedding-1']),
        'vendor',
      ),
    ).toBe(false)
  })

  it('keeps vendor payment attention disabled until a vendor-payment source contract exists', () => {
    expect(
      isNotificationVisibleToPrincipal(
        {
          recipientUserId: 'vendor-1',
          weddingId: 'wedding-1',
          category: 'payment',
          sourceType: 'budget_item',
        },
        'vendor-1',
        new Set(['wedding-1']),
        'vendor',
      ),
    ).toBe(false)
  })

  it('allows a vendor engagement notification only when the wedding context is accessible', () => {
    expect(
      isNotificationVisibleToPrincipal(
        {
          recipientUserId: 'vendor-1',
          weddingId: 'wedding-1',
          category: 'engagement',
          sourceType: 'service_engagement',
        },
        'vendor-1',
        new Set(['wedding-1']),
        'vendor',
      ),
    ).toBe(true)
  })

  it('rejects generic vendor contract attention even inside an accessible wedding', () => {
    expect(
      isNotificationVisibleToPrincipal(
        {
          recipientUserId: 'vendor-1',
          weddingId: 'wedding-1',
          category: 'contract',
          sourceType: 'contract',
        },
        'vendor-1',
        new Set(['wedding-1']),
        'vendor',
      ),
    ).toBe(false)
  })

  it('allows only contract-review-grant contract attention for the mapped vendor wedding', () => {
    const row = {
      recipientUserId: 'vendor-1',
      weddingId: 'wedding-1',
      category: 'contract' as const,
      sourceType: 'contract_review_grant',
    }

    expect(isNotificationVisibleToPrincipal(row, 'vendor-1', new Set(), 'vendor')).toBe(false)
    expect(
      isNotificationVisibleToPrincipal(row, 'vendor-1', new Set(['wedding-1']), 'vendor'),
    ).toBe(true)
  })
})
