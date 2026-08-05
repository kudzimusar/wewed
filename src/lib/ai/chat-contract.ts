export type SanitizedAiChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

interface RequestHeadersLike {
  get(name: string): string | null
}

export interface AiChatRequestLike {
  headers: RequestHeadersLike
}

export function sanitizeAiChatMessages(raw: unknown): SanitizedAiChatMessage[] {
  if (!Array.isArray(raw)) return []
  const output: SanitizedAiChatMessage[] = []

  for (const message of raw) {
    if (!message || typeof message !== 'object') continue
    const role = (message as { role?: unknown }).role
    const content = (message as { content?: unknown }).content

    if (
      (role === 'user' || role === 'assistant') &&
      typeof content === 'string' &&
      content.trim().length > 0
    ) {
      output.push({ role, content: content.slice(0, 4_000) })
    }
  }

  return output
}

export function resolveGuestWeddingSlug(
  request: AiChatRequestLike,
  requestedSlug: unknown,
): string {
  if (typeof requestedSlug === 'string' && requestedSlug.trim()) {
    return requestedSlug.trim().slice(0, 160)
  }

  const referer = request.headers.get('referer')
  if (referer) {
    try {
      const pathname = new URL(referer).pathname
      const match = pathname.match(/^\/w\/([^/?#]+)/)
      if (match?.[1]) return decodeURIComponent(match[1]).slice(0, 160)
    } catch {
      // Ignore malformed referrers and use the compatibility fallback below.
    }
  }

  return 'charity-and-kudzie'
}
