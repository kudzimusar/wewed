# Wewed Billing Cancellation Contract

## Customer-facing state

A paid Stripe subscription that remains active but has a scheduled cancellation must be presented as:

- Plan: the public Wewed plan name, such as `Canon`
- Subscription: `Active — cancellation scheduled`
- Billing cadence: `Month` or `Year`
- End-date label: `Access until`

The interface must also warn that the subscription will not renew and that the customer can resume it from the Stripe Customer Portal before the access end date.

## Stripe state detection

Wewed treats a cancellation as scheduled when either Stripe signal is present:

- `cancel_at_period_end` is `true`; or
- `cancel_at` contains an explicit future cancellation timestamp.

The access end date uses `cancel_at` when available and otherwise falls back to the current billing-period end.

## Synchronization

Both signed webhook processing and authenticated Stripe reconciliation must persist the same scheduled-cancellation state. Webhook events remain idempotent and environment-scoped.

## Environment isolation

Stripe Sandbox cancellation state is stored only in `stripeTest...` account metadata. It must not modify live subscription columns or create live `PaymentRecord` entries.
