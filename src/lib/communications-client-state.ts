export interface CommunicationThreadCursor {
  createdAt: string
}

/**
 * The conversation list and the open thread are loaded independently.
 * If the list has already observed a newer visible message than the thread,
 * the thread must be refreshed again rather than leaving an incomplete trail.
 */
export function communicationThreadNeedsReconciliation(
  lastVisibleMessageAt: string | null,
  messages: readonly CommunicationThreadCursor[],
): boolean {
  if (!lastVisibleMessageAt) return false

  const expectedTimestamp = Date.parse(lastVisibleMessageAt)
  if (!Number.isFinite(expectedTimestamp)) return false

  const latestMessage = messages[messages.length - 1]
  if (!latestMessage) return true

  const actualTimestamp = Date.parse(latestMessage.createdAt)
  if (!Number.isFinite(actualTimestamp)) return true

  return actualTimestamp < expectedTimestamp
}
