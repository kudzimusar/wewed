import { describe, expect, test } from 'bun:test'
import { communicationThreadIsNearBottom, communicationThreadNeedsReconciliation } from '@/lib/communications-client-state'

describe('communication thread reconciliation', () => {
  test('detects when the conversation preview has a newer visible message than the thread', () => {
    expect(communicationThreadNeedsReconciliation('2026-08-10T23:50:54.999Z', [
      { createdAt: '2026-08-10T23:17:24.640Z' },
      { createdAt: '2026-08-10T23:47:44.792Z' },
    ])).toBe(true)
  })

  test('accepts a thread that contains the preview latest message', () => {
    expect(communicationThreadNeedsReconciliation('2026-08-10T23:50:54.999Z', [
      { createdAt: '2026-08-10T23:17:24.640Z' },
      { createdAt: '2026-08-10T23:50:54.999Z' },
    ])).toBe(false)
  })

  test('requires reconciliation when a visible preview message exists but the thread is empty', () => {
    expect(communicationThreadNeedsReconciliation('2026-08-10T23:50:54.999Z', [])).toBe(true)
  })

  test('does not reconcile an empty conversation', () => {
    expect(communicationThreadNeedsReconciliation(null, [])).toBe(false)
  })
})

describe('communication thread latest-message following', () => {
  test('follows the latest message when the reader is already near the end', () => {
    expect(communicationThreadIsNearBottom({ scrollHeight: 1200, scrollTop: 650, clientHeight: 500 })).toBe(true)
  })

  test('does not pull a reader away from older history', () => {
    expect(communicationThreadIsNearBottom({ scrollHeight: 1200, scrollTop: 300, clientHeight: 500 })).toBe(false)
  })

  test('treats an exact threshold as close enough to follow', () => {
    expect(communicationThreadIsNearBottom({ scrollHeight: 1200, scrollTop: 604, clientHeight: 500 }, 96)).toBe(true)
  })

  test('rejects invalid scroll measurements', () => {
    expect(communicationThreadIsNearBottom({ scrollHeight: Number.NaN, scrollTop: 0, clientHeight: 500 })).toBe(false)
  })

  test('messages page keeps mobile inbox and thread exclusive while anchoring latest content after rendering', async () => {
    const page = await Bun.file('src/app/messages/page.tsx').text()
    const workspace = await Bun.file('src/components/communications/messages-workspace.tsx').text()
    expect(page).toContain('MessagesWorkspace')
    const implementation = `${page}\n${workspace}`
    for (const fragment of [
      'data-communications-inbox="true"',
      'data-communications-thread="true"',
      'data-communications-thread-scroll="true"',
      "mobileThreadOpen ? 'hidden lg:flex' : 'flex'",
      "mobileThreadOpen ? 'flex' : 'hidden lg:flex'",
      'min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain',
      'threadScrollRef',
      'threadEndRef',
      'communicationThreadIsNearBottom',
      'container.scrollTop = container.scrollHeight',
      'if (threadLoading || !selectedId || !latestMessageId || !followLatestRef.current) return',
      '[latestMessageId, mobileThreadOpen, selectedId, threadLoading]',
    ]) expect(implementation).toContain(fragment)
  })
})
