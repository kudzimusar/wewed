import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin-gate'
import { generateAiText, type AiMessage } from '@/lib/ai'

/* ============================================================
   POST /api/ai/chat
   ------------------------------------------------------------
   The wewed AI chat endpoint — powers both surfaces:

   • context: 'guest'  → public floating chat bubble (everyone)
   • context: 'couple' → planner-integrated assistant (authorized users)

   Body: {
     messages: Array<{ role: 'user' | 'assistant' | 'system', content: string }>,
     context: 'guest' | 'couple'
   }

   Response: { reply: string, usage?, provider?, model? }

   Rate-limited (10 req/min per IP) with graceful fallback if every
   eligible AI provider fails.
   ============================================================ */

type ChatRole = 'system' | 'user' | 'assistant'

interface IncomingMessage {
  role: ChatRole
  content: string
}

interface ChatRequestBody {
  messages?: unknown
  context?: unknown
}

const GUEST_SYSTEM_PROMPT = `You are wewed AI, a warm, elegant assistant for guests of Charity & Kudzie's wedding on December 23, 2026 at Imba Manor, Harare, Zimbabwe. Help guests with questions about: timing (ceremony 14:00, reception 16:30), dress code (formal/black tie, traditional Zimbabwean welcome), venue (Imba Manor, Borrowdale, Harare), dietary options (beef, chicken, vegetarian, vegan, traditional Zimbabwean), transport (shuttle from Meikles Hotel 12:30), cultural etiquette (Shona wedding traditions), and the songbook. Be concise, warm, and helpful. If you don't know something, direct them to the FAQ or RSVP section. Keep responses under 150 words.`

const COUPLE_SYSTEM_PROMPT = `You are wewed AI, a wedding planning assistant for Charity & Kudzie. Help with: budget advice (Zimbabwean wedding costs), checklist reminders, vendor questions, speech/vow suggestions, timeline optimization, and cultural considerations for Zimbabwean weddings (roora, magumo). Be practical, encouraging, and culturally aware. Reference their wedding date (Dec 23, 2026) and venue (Imba Manor). Keep responses under 200 words.`

const MAX_REQUESTS = 10
const WINDOW_MS = 60 * 1000
const buckets = new Map<string, { count: number; firstAt: number }>()

function pruneBuckets(now: number): void {
  for (const [key, entry] of buckets.entries()) {
    if (now - entry.firstAt > WINDOW_MS) buckets.delete(key)
  }
}

function rateLimit(clientKey: string): { ok: boolean; retryAfterMs?: number } {
  const now = Date.now()
  pruneBuckets(now)
  const entry = buckets.get(clientKey)
  if (!entry) {
    buckets.set(clientKey, { count: 1, firstAt: now })
    return { ok: true }
  }
  if (now - entry.firstAt > WINDOW_MS) {
    buckets.set(clientKey, { count: 1, firstAt: now })
    return { ok: true }
  }
  entry.count += 1
  if (entry.count > MAX_REQUESTS) {
    return { ok: false, retryAfterMs: WINDOW_MS - (now - entry.firstAt) }
  }
  return { ok: true }
}

function getClientKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}

const GUEST_FALLBACK =
  "I'm so sorry — I'm having a brief moment of trouble right now. For immediate help, please scroll to the FAQ section or RSVP area on this page. I'll be back in a moment to answer your question properly. 💛"

const COUPLE_FALLBACK =
  "I'm having a brief hiccup right now. Please try again in a few seconds — your planning conversation is important to me. In the meantime, you can review your checklist or budget tab. 💛"

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function sanitizeMessages(raw: unknown): IncomingMessage[] {
  if (!Array.isArray(raw)) return []
  const output: IncomingMessage[] = []

  for (const message of raw) {
    if (!message || typeof message !== 'object') continue
    const role = (message as { role?: unknown }).role
    const content = (message as { content?: unknown }).content

    if (
      (role === 'user' || role === 'assistant' || role === 'system') &&
      isString(content) &&
      content.trim().length > 0
    ) {
      output.push({ role, content: content.slice(0, 4000) })
    }
  }

  return output
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const clientKey = getClientKey(request)
  const limit = rateLimit(clientKey)

  if (!limit.ok) {
    return NextResponse.json(
      {
        success: false,
        reply:
          "You're asking questions faster than I can answer! Please wait a moment and try again. 💛",
        error: 'Rate limited',
        retryAfterMs: limit.retryAfterMs,
      },
      {
        status: 429,
        headers: limit.retryAfterMs
          ? { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) }
          : undefined,
      }
    )
  }

  let body: ChatRequestBody
  try {
    body = (await request.json()) as ChatRequestBody
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const context: 'guest' | 'couple' =
    body.context === 'couple' ? 'couple' : 'guest'

  if (context === 'couple' && !isAdmin(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const messages = sanitizeMessages(body.messages)
  if (messages.length === 0) {
    return NextResponse.json(
      { success: false, error: 'No messages provided' },
      { status: 400 }
    )
  }

  const systemPrompt =
    context === 'couple' ? COUPLE_SYSTEM_PROMPT : GUEST_SYSTEM_PROMPT
  const recent = messages.slice(-10)
  const aiMessages: AiMessage[] = [
    { role: 'system', content: systemPrompt },
    ...recent,
  ]

  try {
    // Treat both chat surfaces as private. Guests can type personal data even
    // though their normal questions are public wedding information.
    const result = await generateAiText({
      messages: aiMessages,
      profile: 'private',
      maxOutputTokens: 512,
    })

    return NextResponse.json({
      success: true,
      reply: result.text,
      provider: result.provider,
      model: result.model,
      usage: result.usage
        ? {
            prompt_tokens: result.usage.promptTokens ?? 0,
            completion_tokens: result.usage.completionTokens ?? 0,
            total_tokens: result.usage.totalTokens,
          }
        : undefined,
    })
  } catch {
    console.error('[AI CHAT] Every eligible provider failed')
    return NextResponse.json({
      success: true,
      reply: context === 'couple' ? COUPLE_FALLBACK : GUEST_FALLBACK,
      error: 'AI provider unavailable',
      fallback: true,
    })
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    success: true,
    service: 'wewed AI chat',
    contexts: ['guest', 'couple'],
    rateLimit: `${MAX_REQUESTS} requests per minute per IP`,
  })
}
