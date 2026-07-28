import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

/* ============================================================
   POST /api/ai/speech
   ------------------------------------------------------------
   Generates a personalized wedding speech for the couple
   (Charity & Kudzie). Couple-only — admin-gated.

   Body: {
     type:   'groom' | 'bride' | 'best_man' | 'maid_of_honor'
           | 'father_bride' | 'mother_groom',
     tone:   'heartfelt' | 'funny' | 'traditional',
     length: 'short' | 'medium' | 'long'
   }

   Response: { speech: string }

   Rate-limited (5 req/min per IP) — speech generation is heavier.
   ============================================================ */

// ─── Types ──────────────────────────────────────────────────────
type SpeechType =
  | 'groom'
  | 'bride'
  | 'best_man'
  | 'maid_of_honor'
  | 'father_bride'
  | 'mother_groom'
type SpeechTone = 'heartfelt' | 'funny' | 'traditional'
type SpeechLength = 'short' | 'medium' | 'long'

interface SpeechRequestBody {
  type?: unknown
  tone?: unknown
  length?: unknown
}

// ─── Enumerations (validated) ───────────────────────────────────
const SPEECH_TYPES: readonly SpeechType[] = [
  'groom',
  'bride',
  'best_man',
  'maid_of_honor',
  'father_bride',
  'mother_groom',
]
const SPEECH_TONES: readonly SpeechTone[] = ['heartfelt', 'funny', 'traditional']
const SPEECH_LENGTHS: readonly SpeechLength[] = ['short', 'medium', 'long']

const LENGTH_MINUTES: Record<SpeechLength, number> = {
  short: 2,
  medium: 4,
  long: 6,
}

// Human-readable labels for the speaker
const SPEAKER_LABEL: Record<SpeechType, string> = {
  groom: "the groom's (Kudzie's)",
  bride: "the bride's (Charity's)",
  best_man: "the best man's",
  maid_of_honor: "the maid of honor's",
  father_bride: "the father of the bride's",
  mother_groom: "the mother of the groom's",
}

// ─── Admin gate (same pattern as planner routes) ────────────────
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

// ─── POST handler ───────────────────────────────────────────────
export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1) Admin gate — couple-only tool
  if (!isAdmin(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
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
        speech: '',
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
  let body: SpeechRequestBody
  try {
    body = (await request.json()) as SpeechRequestBody
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body', speech: '' },
      { status: 400 },
    )
  }

  const type = SPEECH_TYPES.includes(body.type as SpeechType)
    ? (body.type as SpeechType)
    : null
  const tone = SPEECH_TONES.includes(body.tone as SpeechTone)
    ? (body.tone as SpeechTone)
    : 'heartfelt'
  const length = SPEECH_LENGTHS.includes(body.length as SpeechLength)
    ? (body.length as SpeechLength)
    : 'medium'

  if (!type) {
    return NextResponse.json(
      {
        success: false,
        speech: '',
        error: `Invalid speech type. Must be one of: ${SPEECH_TYPES.join(', ')}`,
      },
      { status: 400 },
    )
  }

  // 4) Build the prompt
  const systemPrompt =
    'You are an expert wedding speech writer. You craft speeches that feel personal, warm, and culturally resonant — never generic. You write in clear prose with natural pauses, ready to be spoken aloud.'

  const userPrompt = `Write a ${tone} ${SPEAKER_LABEL[type]} speech for Charity & Kudzie's wedding on December 23, 2026 at Imba Manor, Harare, Zimbabwe.

Requirements:
- Length: ${length} (approximately ${LENGTH_MINUTES[length]} minutes spoken aloud, ~${LENGTH_MINUTES[length] * 140} words).
- Tone: ${tone}. ${tone === 'funny' ? 'Include 2-3 tasteful, warm moments of humor — never at the couple\'s expense.' : tone === 'traditional' ? 'Honor Zimbabwean wedding traditions and family. Reference roora/magumo where natural.' : 'Lead with sincere emotion and gratitude.'}
- Personal touches: reference Charity (the bride) and Kudzie (the groom, soon-to-be Mr Musarurwa) by name. Mention their family — the bridal party and guests are gathered in Harare.
- Where natural, weave in Zimbabwean cultural elements (Shona/Ndebele wedding warmth, family, community, the joy of union).
- Open with a warm address to the room. Close with a heartfelt toast to the couple.
- Write only the speech text (no preamble, no explanations). Use paragraph breaks for natural speaking pauses.
- Do NOT include stage directions in brackets.`

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

    const speech = response?.choices?.[0]?.message?.content
    if (typeof speech !== 'string' || speech.trim().length === 0) {
      return NextResponse.json({
        success: false,
        speech: '',
        error: 'The AI returned an empty speech. Please try again.',
      })
    }

    return NextResponse.json({
      success: true,
      speech: speech.trim(),
      meta: {
        type,
        tone,
        length,
        targetMinutes: LENGTH_MINUTES[length],
        wordCount: speech.trim().split(/\s+/).length,
      },
    })
  } catch (err) {
    console.error('[AI SPEECH] SDK failure:', err)
    return NextResponse.json({
      success: false,
      speech: '',
      error:
        "I couldn't finish drafting that speech just now. Please try again in a moment — these things deserve the right words.",
    })
  }
}

// ─── GET (quick health probe) ───────────────────────────────────
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    success: true,
    service: 'wewed AI speech generator',
    types: SPEECH_TYPES,
    tones: SPEECH_TONES,
    lengths: SPEECH_LENGTHS,
    adminRequired: true,
  })
}
