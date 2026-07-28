import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

/* ============================================================
   POST /api/ai/summary
   ------------------------------------------------------------
   Generates a natural-language summary of the couple's RSVPs.
   Couple-only — admin-gated.

   Body: {
     rsvps: Array<{
       name: string,
       attending: boolean | null,
       meal: string | null,
       plusOne?: boolean,
       message?: string | null
     }>
   }

   Response: { summary: string }

   Rate-limited (5 req/min per IP).
   ============================================================ */

// ─── Types ──────────────────────────────────────────────────────
interface RsvpRow {
  name?: unknown
  attending?: unknown
  meal?: unknown
  plusOne?: unknown
  message?: unknown
}

// A sanitized RSVP row — guaranteed field types after validation.
interface SanitizedRsvp {
  name: string
  attending: boolean | null
  meal: string | null
  plusOne: boolean
  message: string | null
}

interface SummaryRequestBody {
  rsvps?: unknown
}

// ─── Admin gate ─────────────────────────────────────────────────
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

// ─── Rate limiter (5 req/min per IP) ────────────────────────────
const MAX_REQUESTS = 5
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

// ─── Helpers ────────────────────────────────────────────────────
function isString(v: unknown): v is string {
  return typeof v === 'string'
}

function isBoolOrNull(v: unknown): v is boolean | null {
  return typeof v === 'boolean' || v === null || v === undefined
}

function sanitizeRsvps(raw: unknown): SanitizedRsvp[] {
  if (!Array.isArray(raw)) return []
  const out: SanitizedRsvp[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const row = r as RsvpRow
    if (!isString(row.name)) continue
    if (!isBoolOrNull(row.attending)) continue
    out.push({
      name: row.name.slice(0, 120),
      attending: row.attending ?? null,
      meal: isString(row.meal) ? row.meal.slice(0, 60) : null,
      plusOne: typeof row.plusOne === 'boolean' ? row.plusOne : false,
      message: isString(row.message) ? row.message.slice(0, 600) : null,
    })
  }
  return out
}

// Compute local stats so we can both (a) hand the AI a structured
// summary AND (b) have a graceful fallback if the AI call fails.
function computeStats(rsvps: SanitizedRsvp[]) {
  let confirmed = 0
  let declined = 0
  let pending = 0
  let plusOnes = 0
  const meals = new Map<string, number>()
  const messages: string[] = []

  for (const r of rsvps) {
    if (r.attending === true) {
      confirmed += 1
      if (r.plusOne) plusOnes += 1
      if (r.meal) {
        const key = r.meal.trim().toLowerCase()
        meals.set(key, (meals.get(key) ?? 0) + 1)
      }
    } else if (r.attending === false) {
      declined += 1
    } else {
      pending += 1
    }
    if (r.message && r.message.trim().length > 0) {
      messages.push(`${r.name}: "${r.message.trim()}"`)
    }
  }

  return {
    total: rsvps.length,
    confirmed,
    declined,
    pending,
    plusOnes,
    meals: Array.from(meals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([meal, count]) => `${count} ${meal}`),
    messageCount: messages.length,
    topMessages: messages.slice(0, 6),
  }
}

// ─── POST handler ───────────────────────────────────────────────
export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1) Admin gate
  if (!isAdmin(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', summary: '' },
      { status: 401 },
    )
  }

  // 2) Rate-limit
  const clientKey = getClientKey(request)
  const rl = rateLimit(clientKey)
  if (!rl.ok) {
    return NextResponse.json(
      {
        success: false,
        summary: '',
        error: 'Too many requests. Please wait a moment and try again.',
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

  // 3) Parse + validate body
  let body: SummaryRequestBody
  try {
    body = (await request.json()) as SummaryRequestBody
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body', summary: '' },
      { status: 400 },
    )
  }

  const rsvps = sanitizeRsvps(body.rsvps)
  if (rsvps.length === 0) {
    return NextResponse.json({
      success: true,
      summary:
        "You don't have any RSVPs logged yet. Once guests start responding, I'll summarize their meal choices, dietary notes, and messages for you here.",
    })
  }

  const stats = computeStats(rsvps)

  // 4) Build a compact structured payload for GLM
  const mealsLine =
    stats.meals.length > 0
      ? stats.meals.join(', ')
      : 'no meal selections yet'
  const messagesLine =
    stats.topMessages.length > 0
      ? stats.topMessages.join(' | ')
      : 'no messages yet'

  const systemPrompt =
    "You are wewed AI, the couple's planning assistant. Summarize their RSVPs in a warm, natural, two-or-three sentence paragraph — the way a thoughtful friend would brief them. Mention confirmed/declined/pending counts, the meal breakdown, plus-ones, and a flavor of the messages. Reference Zimbabwean warmth where natural. Keep it under 90 words."

  const userPrompt = `Here is the RSVP data for Charity & Kudzie's wedding (Dec 23, 2026, Imba Manor, Harare):

Total invitations: ${stats.total}
Confirmed attending: ${stats.confirmed}
Declined: ${stats.declined}
Pending (no response yet): ${stats.pending}
Plus-ones coming: ${stats.plusOnes}
Meal selections: ${mealsLine}
Recent messages (${stats.messageCount} total): ${messagesLine}

Please write a warm, natural-language summary for the couple. Reference the numbers naturally (e.g. "42 confirmed, 8 declines"), highlight the meal breakdown, and include a sentence about the messages they've received. Sign off with a gentle, encouraging note.`

  // 5) Call GLM
  try {
    const zai = await ZAI.create()
    const response = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    })

    const summary = response?.choices?.[0]?.message?.content
    if (typeof summary === 'string' && summary.trim().length > 0) {
      return NextResponse.json({
        success: true,
        summary: summary.trim(),
        stats,
      })
    }
    // Empty reply → fall through to graceful local summary
  } catch (err) {
    console.error('[AI SUMMARY] SDK failure:', err)
    // Fall through to graceful local summary
  }

  // 6) Graceful local fallback (no AI) — still useful, still warm
  const fallbackSummary =
    `You have ${stats.confirmed} confirmed guests, ${stats.declined} declines` +
    `${stats.pending > 0 ? `, and ${stats.pending} still pending` : ''}. ` +
    `${stats.plusOnes > 0 ? `${stats.plusOnes} plus-ones are joining. ` : ''}` +
    `Meal selections: ${mealsLine}. ` +
    `${stats.messageCount > 0 ? `You've received ${stats.messageCount} warm messages — including notes from ${stats.topMessages.slice(0, 3).map((m) => m.split(':')[0]).join(', ')}. ` : ''}` +
    `You're well on your way. 💛`

  return NextResponse.json({
    success: true,
    summary: fallbackSummary,
    stats,
    fallback: true,
  })
}

// ─── GET (quick health probe) ───────────────────────────────────
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    success: true,
    service: 'wewed AI RSVP summary',
    adminRequired: true,
  })
}
