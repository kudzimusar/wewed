import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import { db } from '@/lib/db'
import { enforceCommunicationRateLimit } from '@/lib/communications-rate-limit'
import { isTransactionalEmailConfigured, sendTransactionalEmail } from '@/lib/email/resend'

const VERIFICATION_TTL_MS = 30 * 60 * 1000

interface VerificationPayload {
  version: 1
  endpointId: string
  userId: string
  email: string
  expiresAt: number
}

function signingSecret(): string | null {
  return process.env.WEWED_SESSION_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null
}

function signature(value: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(`wewed-notification-email-verification:${value}`)
    .digest('base64url')
}

function createVerificationToken(payload: VerificationPayload): string | null {
  const secret = signingSecret()
  if (!secret) return null
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${encoded}.${signature(encoded, secret)}`
}

function verifyVerificationToken(token: string): VerificationPayload | null {
  try {
    const secret = signingSecret()
    if (!secret) return null
    const [encoded, actualSignature, extra] = token.split('.')
    if (!encoded || !actualSignature || extra) return null
    const expectedSignature = signature(encoded, secret)
    const actual = Buffer.from(actualSignature, 'base64url')
    const expected = Buffer.from(expectedSignature, 'base64url')
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Partial<VerificationPayload>
    if (
      payload.version !== 1 ||
      typeof payload.endpointId !== 'string' ||
      typeof payload.userId !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.expiresAt !== 'number' ||
      payload.expiresAt <= Date.now()
    ) return null
    return payload as VerificationPayload
  } catch {
    return null
  }
}

function applicationBaseUrl(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (configured) {
    try {
      const url = new URL(configured)
      if (url.protocol === 'https:' || (process.env.WEWED_E2E_MODE === '1' && url.protocol === 'http:')) {
        return url.origin
      }
    } catch {
      // Fall through to the request origin in local/e2e environments.
    }
  }
  return request.nextUrl.origin
}

export async function POST(request: NextRequest) {
  const session = readAppSession(request)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 })
  }
  if (!isTransactionalEmailConfigured()) {
    return NextResponse.json(
      { success: false, error: 'Wewed email delivery is not configured with a valid sender yet.' },
      { status: 503 },
    )
  }

  const userId = session.userId
  const normalizedEmail = session.email.trim().toLowerCase()
  if (!normalizedEmail) {
    return NextResponse.json({ success: false, error: 'Your Wewed account has no email address.' }, { status: 400 })
  }

  try {
    await enforceCommunicationRateLimit({ userId, scope: 'channel_mutation' })
    const endpointId = randomUUID()
    const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `
        INSERT INTO wewed_communications."CommunicationEndpoint"
          (id, "userId", channel, address, "normalizedAddress", status, metadata, "createdAt", "updatedAt")
        VALUES ($1, $2, 'EMAIL', $3, $4, 'PENDING', '{"source":"account_email_verification"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("userId", channel, "normalizedAddress") DO UPDATE SET
          address = EXCLUDED.address,
          "updatedAt" = CURRENT_TIMESTAMP
        RETURNING id
      `,
      endpointId,
      userId,
      session.email.trim(),
      normalizedEmail,
    )
    const endpoint = rows[0]
    if (!endpoint) throw new Error('Unable to prepare the email endpoint.')

    await db.$executeRawUnsafe(
      `
        INSERT INTO wewed_communications."CommunicationPreference"
          (id, "userId", channel, enabled, "createdAt", "updatedAt")
        VALUES ($1, $2, 'EMAIL', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("userId", channel) DO NOTHING
      `,
      randomUUID(),
      userId,
    )

    const token = createVerificationToken({
      version: 1,
      endpointId: endpoint.id,
      userId,
      email: normalizedEmail,
      expiresAt: Date.now() + VERIFICATION_TTL_MS,
    })
    if (!token) throw new Error('Email verification signing is unavailable.')

    const link = `${applicationBaseUrl(request)}/api/notifications/email-verification?token=${encodeURIComponent(token)}`
    const result = await sendTransactionalEmail({
      idempotencyKey: `notification-email-verification:${endpoint.id}:${Math.floor(Date.now() / VERIFICATION_TTL_MS)}`,
      category: 'notification_email_verification',
      to: normalizedEmail,
      subject: 'Verify your email for Wewed notifications',
      text: `Verify this email address for Wewed notifications:\n\n${link}\n\nThis link expires in 30 minutes.`,
      html: `<p>Verify this email address for Wewed notifications.</p><p><a href="${link}">Verify email</a></p><p>This link expires in 30 minutes.</p>`,
      metadata: { endpointId: endpoint.id, userId },
    })
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.reason === 'not_configured' ? 'Wewed email delivery is not configured.' : 'Wewed could not send the verification email.' },
        { status: 503 },
      )
    }

    return NextResponse.json({ success: true, data: { sent: true } })
  } catch (error) {
    const status = typeof error === 'object' && error && 'status' in error && typeof error.status === 'number'
      ? error.status
      : 500
    const message = error instanceof Error ? error.message : 'Unable to send the verification email.'
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')?.trim() || ''
  const payload = verifyVerificationToken(token)
  const settingsUrl = new URL('/settings/notifications', request.url)
  if (!payload) {
    settingsUrl.searchParams.set('emailVerification', 'invalid')
    return NextResponse.redirect(settingsUrl, 303)
  }

  const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `
      SELECT id
      FROM wewed_communications."CommunicationEndpoint"
      WHERE id = $1
        AND "userId" = $2
        AND channel = 'EMAIL'
        AND LOWER("normalizedAddress") = $3
        AND status IN ('PENDING', 'VERIFIED')
      LIMIT 1
    `,
    payload.endpointId,
    payload.userId,
    payload.email,
  )
  if (!rows[0]) {
    settingsUrl.searchParams.set('emailVerification', 'invalid')
    return NextResponse.redirect(settingsUrl, 303)
  }

  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `
        UPDATE wewed_communications."CommunicationEndpoint"
        SET status = 'DISABLED', "verifiedAt" = NULL, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "userId" = $1 AND channel = 'EMAIL' AND id <> $2 AND status = 'VERIFIED'
      `,
      payload.userId,
      payload.endpointId,
    )
    await tx.$executeRawUnsafe(
      `
        UPDATE wewed_communications."CommunicationEndpoint"
        SET status = 'VERIFIED', "verifiedAt" = COALESCE("verifiedAt", CURRENT_TIMESTAMP), "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = $1 AND "userId" = $2
      `,
      payload.endpointId,
      payload.userId,
    )
  })

  settingsUrl.searchParams.set('emailVerification', 'success')
  return NextResponse.redirect(settingsUrl, 303)
}
