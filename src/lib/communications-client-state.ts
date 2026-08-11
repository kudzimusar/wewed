export interface CommunicationThreadCursor {
  createdAt: string
}

export interface CommunicationThreadScrollState {
  scrollHeight: number
  scrollTop: number
  clientHeight: number
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

/**
 * Keep following new messages while the reader is already at the end of the
 * thread. Once they deliberately scroll up to history, polling must not drag
 * them back down until they return close to the latest message themselves.
 */
export function communicationThreadIsNearBottom(
  state: CommunicationThreadScrollState,
  threshold = 96,
): boolean {
  if (![state.scrollHeight, state.scrollTop, state.clientHeight, threshold].every(Number.isFinite)) {
    return false
  }
  const remaining = state.scrollHeight - state.scrollTop - state.clientHeight
  return remaining <= Math.max(0, threshold)
}
