import { describe, expect, test } from 'bun:test'
import { communicationThreadNeedsReconciliation } from '@/lib/communications-client-state'

describe('communication thread reconciliation', () => {
  test('detects when the conversation preview has a newer visible message than the thread', () => {
    expect(communicationThreadNeedsReconciliation(
      '2026-08-10T23:50:54.999Z',
      [
        { createdAt: '2026-08-10T23:17:24.640Z' },
        { createdAt: '2026-08-10T23:47:44.792Z' },
      ],
    )).toBe(true)
  })

  test('accepts a thread that contains the preview latest message', () => {
    expect(communicationThreadNeedsReconciliation(
      '2026-08-10T23:50:54.999Z',
      [
        { createdAt: '2026-08-10T23:17:24.640Z' },
        { createdAt: '2026-08-10T23:50:54.999Z' },
      ],
    )).toBe(false)
  })

  test('requires reconciliation when a visible preview message exists but the thread is empty', () => {
    expect(communicationThreadNeedsReconciliation(
      '2026-08-10T23:50:54.999Z',
      [],
    )).toBe(true)
  })

  test('does not reconcile an empty conversation', () => {
    expect(communicationThreadNeedsReconciliation(null, [])).toBe(false)
  })
})
