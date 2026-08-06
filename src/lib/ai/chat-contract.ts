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

const WEDDING_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

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
      output.push({ role, content: content.trim().slice(0, 4_000) })
    }
  }

  return output.slice(-60)
}

function validWeddingSlug(value: string): string | null {
  const normalized = value.trim().toLowerCase().slice(0, 160)
  return WEDDING_SLUG_PATTERN.test(normalized) ? normalized : null
}

export function resolveGuestWeddingSlug(
  request: AiChatRequestLike,
  requestedSlug: unknown,
): string | null {
  if (typeof requestedSlug === 'string') {
    const explicit = validWeddingSlug(requestedSlug)
    if (explicit) return explicit
  }

  const referer = request.headers.get('referer')
  if (!referer) return null

  try {
    const pathname = new URL(referer).pathname
    const match = pathname.match(/^\/w\/([^/?#]+)/)
    if (!match?.[1]) return null
    return validWeddingSlug(decodeURIComponent(match[1]))
  } catch {
    return null
  }
}
