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
        { recipientUserId: 'vendor-2', weddingId: null },
        'vendor-1',
        new Set(),
      ),
    ).toBe(false)
  })

  it('allows a global notification only for its recipient', () => {
    expect(
      isNotificationVisibleToPrincipal(
        { recipientUserId: 'admin-1', weddingId: null },
        'admin-1',
        new Set(),
      ),
    ).toBe(true)
  })

  it('requires active accessible wedding context for wedding-scoped notifications', () => {
    const row = { recipientUserId: 'planner-1', weddingId: 'wedding-1' }

    expect(isNotificationVisibleToPrincipal(row, 'planner-1', new Set())).toBe(false)
    expect(
      isNotificationVisibleToPrincipal(row, 'planner-1', new Set(['wedding-1'])),
    ).toBe(true)
  })
})
