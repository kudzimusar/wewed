import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import { db } from '@/lib/db'
import { enforceCommunicationRateLimit } from '@/lib/communications-rate-limit'
import { isTransactionalEmailConfigured, sendTransactionalEmail } from '@/lib/email/resend'
import { renderWewedTransactionalEmail } from '@/lib/email/wewed-template'

const VERIFICATION_TTL_MS = 30 * 60 * 1000
const CANONICAL_WEWED_ORIGIN = 'https://wewed.pro'
const ALLOWED_RETURN_TO = new Set(['/settings/notifications', '/messages/settings'])

type VerificationReturnTo = '/settings/notifications' | '/messages/settings'

interface VerificationPayload {
  version: 1
  endpointId: string
  userId: string
  email: string
  expiresAt: number
  returnTo?: VerificationReturnTo
}

function normalizeReturnTo(value: unknown): VerificationReturnTo {
  return typeof value === 'string' && ALLOWED_RETURN_TO.has(value)
    ? value as VerificationReturnTo
    : '/settings/notifications'
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
    if (payload.returnTo !== undefined && !ALLOWED_RETURN_TO.has(payload.returnTo)) return null
    return payload as VerificationPayload
  } catch {
    return null
  }
}

function applicationBaseUrl(request: NextRequest): string {
  const origin = request.nextUrl.origin
  const hostname = request.nextUrl.hostname.toLowerCase()

  // Local browser qualification must remain self-contained. Production email,
  // however, must never leak a Vercel preview/alias or another host.
  if (process.env.WEWED_E2E_MODE === '1') return origin
  if (hostname === 'wewed.pro' || hostname === 'www.wewed.pro') return CANONICAL_WEWED_ORIGIN
  if (process.env.NODE_ENV === 'production') return CANONICAL_WEWED_ORIGIN

  const url = new URL(origin)
  if (url.protocol === 'https:' || url.protocol === 'http:') return url.origin
  throw new Error('A valid Wewed origin is required for email verification.')
}

function settingsRedirect(request: NextRequest, returnTo: VerificationReturnTo, status: 'success' | 'invalid') {
  const url = new URL(returnTo, applicationBaseUrl(request))
  url.searchParams.set('emailVerification', status)
  return NextResponse.redirect(url, 303)
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
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const returnTo = normalizeReturnTo(body.returnTo)
    await enforceCommunicationRateLimit({ userId, scope: 'channel_mutation' })
    const endpointId = randomUUID()
    const endpoint = await db.$transaction(async (tx) => {
      // Account email is canonical for email delivery. Retire stale pending
      // addresses immediately; a verified old address is retired only after
      // the current account mailbox has itself been verified.
      await tx.$executeRawUnsafe(
        `
          UPDATE wewed_communications."CommunicationEndpoint"
          SET status = 'DISABLED', "updatedAt" = CURRENT_TIMESTAMP
          WHERE "userId" = $1
            AND channel = 'EMAIL'
            AND status = 'PENDING'
            AND LOWER("normalizedAddress") <> $2
        `,
        userId,
        normalizedEmail,
      )

      const rows = await tx.$queryRawUnsafe<Array<{ id: string; status: 'PENDING' | 'VERIFIED' }>>(
        `
          INSERT INTO wewed_communications."CommunicationEndpoint"
            (id, "userId", channel, address, "normalizedAddress", status, metadata, "createdAt", "updatedAt")
          VALUES ($1, $2, 'EMAIL', $3, $4, 'PENDING', '{"source":"account_email_verification"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT ("userId", channel, "normalizedAddress") DO UPDATE SET
            address = EXCLUDED.address,
            status = CASE
              WHEN wewed_communications."CommunicationEndpoint".status = 'VERIFIED' THEN 'VERIFIED'
              ELSE 'PENDING'
            END,
            metadata = EXCLUDED.metadata,
            "updatedAt" = CURRENT_TIMESTAMP
          RETURNING id, status
        `,
        endpointId,
        userId,
        session.email.trim(),
        normalizedEmail,
      )
      if (!rows[0]) throw new Error('Unable to prepare the email endpoint.')
      return rows[0]
    })

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

    if (endpoint.status === 'VERIFIED') {
      return NextResponse.json({
        success: true,
        data: {
          sent: false,
          alreadyVerified: true,
          address: normalizedEmail,
          message: 'Your Wewed account email is already verified.',
        },
      })
    }

    const token = createVerificationToken({
      version: 1,
      endpointId: endpoint.id,
      userId,
      email: normalizedEmail,
      expiresAt: Date.now() + VERIFICATION_TTL_MS,
      returnTo,
    })
    if (!token) throw new Error('Email verification signing is unavailable.')

    const link = `${applicationBaseUrl(request)}/api/notifications/email-verification?token=${encodeURIComponent(token)}`
    const result = await sendTransactionalEmail({
      idempotencyKey: `notification-email-verification:${endpoint.id}:${Math.floor(Date.now() / VERIFICATION_TTL_MS)}`,
      category: 'notification_email_verification',
      to: normalizedEmail,
      subject: 'Verify your email for Wewed notifications',
      text: [
        'Wewed',
        '',
        'Verify your Wewed email',
        '',
        `Confirm ${normalizedEmail} for external Wewed message and notification delivery.`,
        '',
        `Verify account email: ${link}`,
        '',
        'This link expires in 30 minutes.',
        'Open it from your external email inbox (for example Gmail). It will not appear in Wewed Messages.',
        '',
        'Wewed — https://wewed.pro',
      ].join('\n'),
      html: renderWewedTransactionalEmail({
        eyebrow: 'Account verification',
        title: 'Verify your Wewed email',
        paragraphs: [
          `Confirm ${normalizedEmail} for external Wewed message and notification delivery.`,
          'This verification is for your external mailbox. It will not appear as a conversation inside Wewed Messages.',
        ],
        ctaLabel: 'Verify account email',
        ctaHref: link,
        note: 'This secure verification link expires in 30 minutes. The verification destination should remain on wewed.pro.',
      }),
      metadata: { endpointId: endpoint.id, userId, returnTo },
    })
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.reason === 'not_configured' ? 'Wewed email delivery is not configured.' : 'Wewed could not send the verification email.' },
        { status: 503 },
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        sent: true,
        alreadyVerified: false,
        address: normalizedEmail,
        message: `Verification email sent to ${normalizedEmail}. Check that external inbox and spam. It will not appear in Wewed Messages.`,
      },
    })
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
  if (!payload) return settingsRedirect(request, '/settings/notifications', 'invalid')

  const returnTo = normalizeReturnTo(payload.returnTo)
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
  if (!rows[0]) return settingsRedirect(request, returnTo, 'invalid')

  await db.$transaction(async (tx) => {
    // Once the canonical account email is verified, every other Email endpoint
    // is retired so delivery cannot fan out to stale or duplicate mailboxes.
    await tx.$executeRawUnsafe(
      `
        UPDATE wewed_communications."CommunicationEndpoint"
        SET status = 'DISABLED', "verifiedAt" = NULL, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "userId" = $1
          AND channel = 'EMAIL'
          AND id <> $2
          AND status IN ('PENDING', 'VERIFIED')
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

  return settingsRedirect(request, returnTo, 'success')
}
