import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

/* ============================================================
   POST /api/ai/chat
   ------------------------------------------------------------
   The wewed AI chat endpoint — powers both surfaces:

   • context: 'guest'  → public floating chat bubble (everyone)
   • context: 'couple' → planner-integrated assistant (admin only)

   Body: {
     messages: Array<{ role: 'user' | 'assistant' | 'system', content: string }>,
     context: 'guest' | 'couple'
   }

   Response: { reply: string, usage?: { prompt_tokens, completion_tokens } }

   Rate-limited (10 req/min per IP) with graceful fallback if the
   SDK ever fails — guests always get a warm answer, never a 500.
   ============================================================ */

// ─── Types ──────────────────────────────────────────────────────
type ChatRole = 'system' | 'user' | 'assistant'

interface IncomingMessage {
  role: ChatRole
  content: string
}

interface ChatRequestBody {
  messages?: unknown
  context?: unknown
}

// ─── System prompts ─────────────────────────────────────────────
const GUEST_SYSTEM_PROMPT = `You are wewed AI, a warm, elegant assistant for guests of Charity & Kudzie's wedding on December 23, 2026 at Imba Manor, Harare, Zimbabwe. Help guests with questions about: timing (ceremony 14:00, reception 16:30), dress code (formal/black tie, traditional Zimbabwean welcome), venue (Imba Manor, Borrowdale, Harare), dietary options (beef, chicken, vegetarian, vegan, traditional Zimbabwean), transport (shuttle from Meikles Hotel 12:30), cultural etiquette (Shona wedding traditions), and the songbook. Be concise, warm, and helpful. If you don't know something, direct them to the FAQ or RSVP section. Keep responses under 150 words.`

const COUPLE_SYSTEM_PROMPT = `You are wewed AI, a wedding planning assistant for Charity & Kudzie. Help with: budget advice (Zimbabwean wedding costs), checklist reminders, vendor questions, speech/vow suggestions, timeline optimization, and cultural considerations for Zimbabwean weddings (roora, magumo). Be practical, encouraging, and culturally aware. Reference their wedding date (Dec 23, 2026) and venue (Imba Manor). Keep responses under 200 words.`

// ─── Admin gate (soft cookie check — same pattern as planner) ───
const ADMIN_COOKIE_KEY = 'wewed_admin_auth'
const NONCE_PATTERN = /^[a-f0-9]{16}$/

function isAdmin(request: NextRequest): boolean {
  try {
    const cookie = request.cookies.get(ADMIN_COOKIE_KEY)?.value
    if (cookie && NONCE_PATTERN.test(cookie)) return true
  } catch {
    /* ignore */
  }
  if (process.env.NODE_ENV !== 'production') {
    const url = new URL(request.url)
    if (url.searchParams.get('admin') === '1') return true
  }
  return false
}

// ─── In-memory rate limiter (10 req/min per IP) ─────────────────
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
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}

// ─── Graceful fallback replies ──────────────────────────────────
const GUEST_FALLBACK =
  "I'm so sorry — I'm having a brief moment of trouble right now. For immediate help, please scroll to the FAQ section or RSVP area on this page. I'll be back in a moment to answer your question properly. 💛"

const COUPLE_FALLBACK =
  "I'm having a brief hiccup right now. Please try again in a few seconds — your planning conversation is important to me. In the meantime, you can review your checklist or budget tab. 💛"

// ─── Helpers ────────────────────────────────────────────────────
function isString(v: unknown): v is string {
  return typeof v === 'string'
}

function sanitizeMessages(raw: unknown): IncomingMessage[] {
  if (!Array.isArray(raw)) return []
  const out: IncomingMessage[] = []
  for (const m of raw) {
    if (!m || typeof m !== 'object') continue
    const role = (m as { role?: unknown }).role
    const content = (m as { content?: unknown }).content
    if (
      (role === 'user' || role === 'assistant' || role === 'system') &&
      isString(content) &&
      content.trim().length > 0
    ) {
      out.push({ role, content: content.slice(0, 4000) })
    }
  }
  return out
}

// ─── POST handler ───────────────────────────────────────────────
export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1) Rate-limit
  const clientKey = getClientKey(request)
  const rl = rateLimit(clientKey)
  if (!rl.ok) {
    return NextResponse.json(
      {
        success: false,
        reply:
          "You're asking questions faster than I can answer! Please wait a moment and try again. 💛",
        error: 'Rate limited',
        retryAfterMs: rl.retryAfterMs,
      },
      {
        status: 429,
        headers: rl.retryAfterMs
          ? { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) }
          : undefined,
      },
    )
  }

  // 2) Parse + validate body
  let body: ChatRequestBody
  try {
    body = (await request.json()) as ChatRequestBody
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  const context: 'guest' | 'couple' =
    body.context === 'couple' ? 'couple' : 'guest'

  // Couple context requires admin auth
  if (context === 'couple' && !isAdmin(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }

  const messages = sanitizeMessages(body.messages)
  if (messages.length === 0) {
    return NextResponse.json(
      { success: false, error: 'No messages provided' },
      { status: 400 },
    )
  }

  // 3) Build the message array for GLM
  const systemPrompt =
    context === 'couple' ? COUPLE_SYSTEM_PROMPT : GUEST_SYSTEM_PROMPT

  // Keep only the last 10 turns (avoid token bloat) + always prepend system prompt
  const recent = messages.slice(-10)
  const sdkMessages: { role: ChatRole; content: string }[] = [
    { role: 'system', content: systemPrompt },
    ...recent,
  ]

  // 4) Call GLM via z-ai-web-dev-sdk (server-side only)
  try {
    const zai = await ZAI.create()
    const response = await zai.chat.completions.create({
      messages: sdkMessages,
      thinking: { type: 'disabled' },
    })

    const reply = response?.choices?.[0]?.message?.content
    if (!isString(reply) || reply.trim().length === 0) {
      return NextResponse.json({
        success: true,
        reply: context === 'couple' ? COUPLE_FALLBACK : GUEST_FALLBACK,
        usage: response?.usage
          ? {
              prompt_tokens: response.usage.prompt_tokens ?? 0,
              completion_tokens: response.usage.completion_tokens ?? 0,
            }
          : undefined,
      })
    }

    return NextResponse.json({
      success: true,
      reply: reply.trim(),
      usage: response?.usage
        ? {
            prompt_tokens: response.usage.prompt_tokens ?? 0,
            completion_tokens: response.usage.completion_tokens ?? 0,
          }
        : undefined,
    })
  } catch (err) {
    console.error('[AI CHAT] SDK failure:', err)
    return NextResponse.json({
      success: true,
      reply: context === 'couple' ? COUPLE_FALLBACK : GUEST_FALLBACK,
      error: 'AI provider unavailable',
    })
  }
}

// ─── GET (quick health probe) ───────────────────────────────────
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    success: true,
    service: 'wewed AI chat',
    contexts: ['guest', 'couple'],
    rateLimit: `${MAX_REQUESTS} requests per minute per IP`,
  })
}
