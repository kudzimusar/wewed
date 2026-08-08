# Wewed integration operations

This runbook is the operator reference for external systems that can affect user-visible production flows.

## Canonical boundary

All production user-facing returns must resolve through `https://wewed.pro`.

Do not use a Vercel Preview URL, legacy Wewed hostname, request-derived origin, or provider-hosted arbitrary return URL as a production callback target.

## Operator health endpoint

Authenticated Wewed administrators can query:

`GET /api/admin/integrations/health`

The endpoint never returns provider secrets. It reports configuration/readiness and recent Wewed-side evidence for:

- Resend transactional delivery records;
- Stripe mode, credential/webhook readiness and recent processed events;
- optional Telegram readiness;
- Supabase Auth configuration presence and the canonical recovery path.

The public `/api/health` endpoint remains the platform-level database/Supabase/environment readiness check.

## Email: Resend

Production callback:

`https://wewed.pro/api/webhooks/resend`

Operational evidence:

- `wewed_admin.EmailDelivery`
- `wewed_admin.EmailWebhookEvent`

If delivery fails:

1. Check `/api/admin/integrations/health` for failed/bounced/complained counts.
2. Check the Resend event/request log for the provider message ID.
3. Confirm the webhook signing secret in Vercel Production matches the active Resend endpoint.
4. Replay/retry from Resend where supported; Wewed webhook IDs and provider IDs are persisted idempotently.
5. Do not resend blindly when Wewed already records a delivered event.

Ownership:

- `support@wewed.pro`: customer operations
- `billing@wewed.pro`: billing/finance operations
- `privacy@wewed.pro`: privacy operations
- `legal@wewed.pro`: legal operations
- `security@wewed.pro`: security/incident operations

## Stripe

Production callback:

`https://wewed.pro/api/stripe/webhook`

Production uses live Stripe credentials only. Vercel Preview/local environments use Stripe test credentials and must never be pointed at the production webhook secret.

Test webhook UAT uses a stable Preview branch target. Its Stripe endpoint is test-mode only and subscribes to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `charge.refunded`

Wewed validates the raw-body Stripe signature, rejects test/live mismatches and locks each event ID before processing. Successfully processed events are recorded in `wewed_admin.BusinessAuditLog` as `StripeEvent` resources. Replays are therefore safe and become no-ops after the first successful processing.

When a Stripe delivery fails:

1. Check Vercel runtime logs for `/api/stripe/webhook`.
2. Confirm the endpoint is sending to the correct environment.
3. Confirm `STRIPE_TEST_WEBHOOK_SECRET` exists in Preview or `STRIPE_WEBHOOK_SECRET` exists in Production, as applicable.
4. Replay the failed event from Stripe after configuration is corrected.
5. Verify a `stripe.webhook_processed` audit record appears with the expected environment and event type.

Never copy a test webhook signing secret into the Production variable, or a live signing secret into Preview.

## Authentication and recovery

Registration confirmation and password recovery are pinned to Wewed's canonical public-origin helper in production.

Recovery callback:

`https://wewed.pro/reset-password`

The reset page removes recovery tokens from the visible URL, establishes the Supabase recovery session, enforces Wewed's password floor, updates the password, then performs a global sign-out.

Supabase Dashboard must keep its production Site URL and redirect allow-list aligned with `wewed.pro`. A provider-side redirect configuration is an external control-plane setting and is not inferred from application code.

If recovery fails:

1. Verify the newest recovery link was used.
2. Confirm the link returns to `wewed.pro/reset-password`.
3. Check Supabase Auth logs/settings and the configured redirect allow-list.
4. Request a new link rather than reusing an expired or consumed token.

## Administrator invitations

Administrator invitation acceptance requires a valid Supabase bearer session and validates the authenticated email against the internal Wewed administrator membership before activation. The acceptance API does not trust a callback hostname supplied by the browser.

## Telegram

Telegram is optional and currently fail-closed unless both of these server-only variables exist:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`

If enabled, register `https://wewed.pro/api/telegram` with Telegram and use the same webhook secret as Telegram's `secret_token`. Wewed rejects POSTs without a matching `X-Telegram-Bot-Api-Secret-Token` header.

Do not activate the Telegram bot by setting only the bot token.

## Vercel runtime triage

For provider callback incidents, filter runtime logs by the canonical route and environment:

- `/api/webhooks/resend`
- `/api/stripe/webhook`
- `/api/telegram`

A provider-side successful delivery without a Wewed audit record is not considered a completed integration event.

## Recovery principle

Correct configuration first, then replay. Do not bypass signature checks, environment separation, idempotency locks, or canonical-origin rules merely to make a failed provider event appear successful.
