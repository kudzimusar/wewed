import { NextRequest, NextResponse } from 'next/server'
import { generateAiText } from '@/lib/ai'
import { consumeAiRateLimit } from '@/lib/ai/rate-limit'

const EXPECTED = 'WEWED_ZAI_OK'
const MAX_REQUESTS = 3
const WINDOW_MS = 5 * 60 * 1_000

function getClientKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}

function previewSmokeEnabled(): boolean {
  return (
    process.env.VERCEL_ENV === 'preview' ||
    process.env.AI_LIVE_SMOKE_ENABLED === 'true'
  )
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!previewSmokeEnabled()) {
    return NextResponse.json(
      { success: false, error: 'Not found' },
      { status: 404 },
    )
  }

  let limit
  try {
    limit = await consumeAiRateLimit({
      scope: 'ai-live-smoke',
      identity: getClientKey(request),
      maxRequests: MAX_REQUESTS,
      windowMs: WINDOW_MS,
    })
  } catch (error) {
    console.error('[AI LIVE SMOKE] Rate limiter failed:', error)
    return NextResponse.json(
      { success: false, error: 'Smoke-test controls are unavailable.' },
      { status: 503 },
    )
  }

  if (!limit.ok) {
    return NextResponse.json(
      {
        success: false,
        error: 'Live smoke-test rate limit reached.',
        retryAfterMs: limit.retryAfterMs,
      },
      {
        status: 429,
        headers: limit.retryAfterMs
          ? { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1_000)) }
          : undefined,
      },
    )
  }

  const startedAt = Date.now()
  try {
    const result = await generateAiText({
      provider: 'zai',
      profile: 'anonymized',
      allowFallback: false,
      maxOutputTokens: 24,
      messages: [
        {
          role: 'system',
          content:
            'You are a deterministic health check. Return only the exact token requested by the user, with no punctuation or explanation.',
        },
        {
          role: 'user',
          content: `Return exactly ${EXPECTED}`,
        },
      ],
    })

    const exact = result.text.trim() === EXPECTED
    return NextResponse.json(
      {
        success: exact,
        exact,
        output: exact ? EXPECTED : 'unexpected-output',
        provider: result.provider,
        model: result.model,
        latencyMs: Date.now() - startedAt,
        usage: result.usage,
      },
      {
        status: exact ? 200 : 502,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      },
    )
  } catch (error) {
    console.error('[AI LIVE SMOKE] Provider request failed:', error)
    return NextResponse.json(
      {
        success: false,
        exact: false,
        error: 'Live Z.AI smoke test failed.',
        latencyMs: Date.now() - startedAt,
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      },
    )
  }
}
