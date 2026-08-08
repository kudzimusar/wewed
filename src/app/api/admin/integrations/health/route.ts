import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { stripeBillingConfiguration } from '@/lib/stripe-billing'
import {
  requireWewedAdmin,
  WewedAdminAccessError,
} from '@/lib/wewed-admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type EmailSummaryRow = {
  total: number
  sent: number
  delivered: number
  delayed: number
  bounced: number
  complained: number
  failed: number
  notConfigured: number
  latestEventAt: Date | null
}

type StripeSummaryRow = {
  total: number
  latestEventAt: Date | null
  latestEventType: string | null
}

function configured(name: string): boolean {
  return Boolean(process.env[name]?.trim())
}

function errorResponse(error: unknown) {
  if (error instanceof WewedAdminAccessError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status },
    )
  }

  console.error('[api/admin/integrations/health] Error:', error)
  return NextResponse.json(
    { success: false, error: 'Unable to read integration health.' },
    { status: 500 },
  )
}

export async function GET(request: NextRequest) {
  try {
    await requireWewedAdmin(request, 'admin.overview.read')

    const [emailRows, stripeRows] = await Promise.all([
      db.$queryRawUnsafe<EmailSummaryRow[]>(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
          COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered,
          COUNT(*) FILTER (WHERE status = 'delayed')::int AS delayed,
          COUNT(*) FILTER (WHERE status = 'bounced')::int AS bounced,
          COUNT(*) FILTER (WHERE status = 'complained')::int AS complained,
          COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
          COUNT(*) FILTER (WHERE status = 'not_configured')::int AS "notConfigured",
          MAX(COALESCE("lastEventAt", "updatedAt", "createdAt")) AS "latestEventAt"
        FROM wewed_admin."EmailDelivery"
        WHERE "createdAt" >= NOW() - INTERVAL '24 hours'
      `),
      db.$queryRawUnsafe<StripeSummaryRow[]>(`
        SELECT
          COUNT(*)::int AS total,
          MAX("createdAt") AS "latestEventAt",
          (
            SELECT details->>'type'
            FROM wewed_admin."BusinessAuditLog"
            WHERE "resourceType" = 'StripeEvent'
              AND action = 'stripe.webhook_processed'
            ORDER BY "createdAt" DESC
            LIMIT 1
          ) AS "latestEventType"
        FROM wewed_admin."BusinessAuditLog"
        WHERE "resourceType" = 'StripeEvent'
          AND action = 'stripe.webhook_processed'
          AND "createdAt" >= NOW() - INTERVAL '24 hours'
      `),
    ])

    const email = emailRows[0] ?? {
      total: 0,
      sent: 0,
      delivered: 0,
      delayed: 0,
      bounced: 0,
      complained: 0,
      failed: 0,
      notConfigured: 0,
      latestEventAt: null,
    }
    const stripe = stripeRows[0] ?? {
      total: 0,
      latestEventAt: null,
      latestEventType: null,
    }
    const stripeConfiguration = stripeBillingConfiguration()

    const resendReady =
      configured('RESEND_API_KEY') &&
      configured('RESEND_WEBHOOK_SECRET') &&
      configured('WEWED_EMAIL_FROM') &&
      configured('WEWED_EMAIL_REPLY_TO')
    const telegramReady =
      configured('TELEGRAM_BOT_TOKEN') && configured('TELEGRAM_WEBHOOK_SECRET')

    return NextResponse.json(
      {
        success: true,
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
        integrations: {
          resend: {
            configured: resendReady,
            last24h: email,
            healthy:
              resendReady &&
              email.failed === 0 &&
              email.bounced === 0 &&
              email.complained === 0,
          },
          stripe: {
            mode: stripeConfiguration.mode,
            configured: stripeConfiguration.enabled,
            webhookConfigured: stripeConfiguration.webhookConfigured,
            last24hProcessedEvents: stripe.total,
            latestEventAt: stripe.latestEventAt,
            latestEventType: stripe.latestEventType,
            healthy:
              stripeConfiguration.enabled && stripeConfiguration.webhookConfigured,
          },
          telegram: {
            configured: telegramReady,
            optional: true,
            healthy: telegramReady || !configured('TELEGRAM_BOT_TOKEN'),
          },
          auth: {
            supabaseConfigured:
              configured('NEXT_PUBLIC_SUPABASE_URL') &&
              configured('NEXT_PUBLIC_SUPABASE_ANON_KEY') &&
              configured('SUPABASE_SERVICE_ROLE_KEY'),
            recoveryCallback: '/reset-password',
            productionOriginPinned: process.env.NODE_ENV === 'production',
          },
        },
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      },
    )
  } catch (error) {
    return errorResponse(error)
  }
}
