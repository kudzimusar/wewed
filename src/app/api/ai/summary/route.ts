import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin-gate'
import { generateAiText } from '@/lib/ai'

/* ============================================================
   POST /api/ai/summary
   ------------------------------------------------------------
   Generates a natural-language summary of the couple's RSVPs.
   Authorized dashboard users only.
   ============================================================ */

interface RsvpRow {
  name?: unknown
  attending?: unknown
  meal?: unknown
  plusOne?: unknown
  message?: unknown
}

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
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isBoolOrNull(value: unknown): value is boolean | null | undefined {
  return typeof value === 'boolean' || value === null || value === undefined
}

function sanitizeRsvps(raw: unknown): SanitizedRsvp[] {
  if (!Array.isArray(raw)) return []
  const output: SanitizedRsvp[] = []

  for (const value of raw) {
    if (!value || typeof value !== 'object') continue
    const row = value as RsvpRow
    if (!isString(row.name)) continue
    if (!isBoolOrNull(row.attending)) continue

    output.push({
      name: row.name.slice(0, 120),
      attending: row.attending ?? null,
      meal: isString(row.meal) ? row.meal.slice(0, 60) : null,
      plusOne: typeof row.plusOne === 'boolean' ? row.plusOne : false,
      message: isString(row.message) ? row.message.slice(0, 600) : null,
    })
  }

  return output
}

function computeStats(rsvps: SanitizedRsvp[]) {
  let confirmed = 0
  let declined = 0
  let pending = 0
  let plusOnes = 0
  const meals = new Map<string, number>()
  const messages: string[] = []

  for (const rsvp of rsvps) {
    if (rsvp.attending === true) {
      confirmed += 1
      if (rsvp.plusOne) plusOnes += 1
      if (rsvp.meal) {
        const key = rsvp.meal.trim().toLowerCase()
        meals.set(key, (meals.get(key) ?? 0) + 1)
      }
    } else if (rsvp.attending === false) {
      declined += 1
    } else {
      pending += 1
    }

    if (rsvp.message && rsvp.message.trim().length > 0) {
      messages.push(`${rsvp.name}: "${rsvp.message.trim()}"`)
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAdmin(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', summary: '' },
      { status: 401 }
    )
  }

  const clientKey = getClientKey(request)
  const limit = rateLimit(clientKey)
  if (!limit.ok) {
    return NextResponse.json(
      {
        success: false,
        summary: '',
        error: 'Too many requests. Please wait a moment and try again.',
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

  let body: SummaryRequestBody
  try {
    body = (await request.json()) as SummaryRequestBody
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body', summary: '' },
      { status: 400 }
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

  try {
    const result = await generateAiText({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      profile: 'private',
      maxOutputTokens: 384,
    })

    return NextResponse.json({
      success: true,
      summary: result.text,
      stats,
      provider: result.provider,
      model: result.model,
      usage: result.usage,
    })
  } catch {
    console.error('[AI SUMMARY] Every eligible provider failed')
  }

  const fallbackSummary =
    `You have ${stats.confirmed} confirmed guests, ${stats.declined} declines` +
    `${stats.pending > 0 ? `, and ${stats.pending} still pending` : ''}. ` +
    `${stats.plusOnes > 0 ? `${stats.plusOnes} plus-ones are joining. ` : ''}` +
    `Meal selections: ${mealsLine}. ` +
    `${stats.messageCount > 0 ? `You've received ${stats.messageCount} warm messages — including notes from ${stats.topMessages.slice(0, 3).map((message) => message.split(':')[0]).join(', ')}. ` : ''}` +
    `You're well on your way. 💛`

  return NextResponse.json({
    success: true,
    summary: fallbackSummary,
    stats,
    fallback: true,
  })
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    success: true,
    service: 'wewed AI RSVP summary',
    adminRequired: true,
  })
}
