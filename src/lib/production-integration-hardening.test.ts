import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const source = (path: string) => readFileSync(join(root, path), 'utf8')

describe('production integration hardening contracts', () => {
  test('pins password recovery to the canonical public origin', () => {
    const recovery = source('src/app/forgot-password/page.tsx')

    expect(recovery).toContain("import { publicUrl } from '@/lib/public-origin'")
    expect(recovery).toContain("redirectTo: publicUrl('/reset-password')")
    expect(recovery).not.toContain('window.location.origin')
  })

  test('keeps registration confirmation on the canonical public origin', () => {
    const registration = source('src/app/api/auth/register/route.ts')

    expect(registration).toContain("publicUrl('/register?confirmed=1')")
    expect(registration).not.toContain('request.nextUrl.origin')
  })

  test('keeps Stripe-hosted return paths on the canonical public origin', () => {
    const billing = source('src/app/api/billing/account/route.ts')

    expect(billing).toContain('const origin = publicOrigin()')
    expect(billing).not.toContain('request.nextUrl.origin')
  })

  test('keeps Stripe webhook lifecycle signed, environment-scoped and idempotent', () => {
    const webhook = source('src/app/api/stripe/webhook/route.ts')
    const billing = source('src/lib/stripe-billing.ts')

    for (const event of [
      'checkout.session.completed',
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.paid',
      'invoice.payment_succeeded',
      'invoice.payment_failed',
      'charge.refunded',
    ]) {
      expect(webhook).toContain(`'${event}'`)
    }

    expect(webhook).toContain('verifyStripeWebhookSignature')
    expect(webhook).toContain('Stripe event environment mismatch.')
    expect(webhook).toContain('eventAlreadyProcessed')
    expect(webhook).toContain('stripe.webhook_processed')
    expect(webhook).toContain('sandboxLedgerWriteSkipped')
    expect(billing).toContain("return process.env.VERCEL_ENV !== 'production'")
    expect(billing).toContain("optional('STRIPE_TEST_WEBHOOK_SECRET')")
    expect(billing).toContain("optional('STRIPE_WEBHOOK_SECRET')")
  })

  test('requires an authenticated Supabase session to accept administrator invitations', () => {
    const invitation = source('src/app/api/admin/invitations/accept/route.ts')

    expect(invitation).toContain('const token = bearerToken(request)')
    expect(invitation).toContain('await service.auth.getUser(token)')
    expect(invitation).toContain("error: 'A valid invitation session is required.'")
    expect(invitation).not.toContain('request.nextUrl.origin')
  })

  test('fails Telegram webhooks closed and emits only canonical Wewed links', () => {
    const telegram = source('src/app/api/telegram/route.ts')

    expect(telegram).toContain("const SITE_URL = publicOrigin()")
    expect(telegram).toContain('TELEGRAM_WEBHOOK_SECRET')
    expect(telegram).toContain("request.headers.get('x-telegram-bot-api-secret-token')")
    expect(telegram).toContain("error: 'invalid_telegram_webhook_secret'")
    expect(telegram).toContain("error: 'telegram_webhook_not_configured'")
    expect(telegram).not.toContain("process.env.NEXT_PUBLIC_SITE_URL || 'https://wewed.pro'")
  })

  test('keeps production public origin pinned independently of Vercel hosts', () => {
    const origin = source('src/lib/public-origin.ts')

    expect(origin).toContain("const PRODUCTION_ORIGIN = 'https://wewed.pro'")
    expect(origin).not.toContain('VERCEL_URL')
    expect(origin).not.toContain('NEXT_PUBLIC_VERCEL_URL')
  })

  test('does not reintroduce legacy public-domain callbacks in guarded surfaces', () => {
    const guarded = [
      source('src/app/forgot-password/page.tsx'),
      source('src/app/api/auth/register/route.ts'),
      source('src/app/api/billing/account/route.ts'),
      source('src/app/api/admin/invitations/accept/route.ts'),
      source('src/app/api/telegram/route.ts'),
      source('src/lib/public-origin.ts'),
    ].join('\n')

    expect(guarded).not.toContain('wewed.app')
    expect(guarded).not.toContain('.vercel.app')
  })
})
