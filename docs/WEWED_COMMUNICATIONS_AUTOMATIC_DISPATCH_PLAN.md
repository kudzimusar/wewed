# Wewed Communications Automatic Dispatch Plan

## Goal

Make external communication delivery automatic after a canonical Wewed message is created, while keeping Wewed as the conversation record and preserving the existing fail-closed endpoint verification, preference, retry, provider-status and privacy controls.

The user-visible contract is:

`Wewed message -> external delivery QUEUED -> automatic worker -> provider -> SENT/DELIVERED`

No user or operator should need to call the protected manual dispatcher during normal operation.

## Current production finding

The communications foundation already creates correct external delivery rows and the worker safely claims them with `FOR UPDATE ... SKIP LOCKED`, moves them through `PROCESSING`, applies bounded retries and records provider message IDs/status callbacks. The missing operational link is a scheduler that invokes that worker automatically.

The existing protected `POST /api/internal/communications/deliveries` route remains an explicit operator override and qualification tool. It is not the normal runtime scheduler.

## Implementation

1. Add a dedicated production cron route at `/api/cron/communications-deliveries`.
2. Require `Authorization: Bearer <CRON_SECRET>` and fail closed when the secret is missing or incorrect.
3. Reuse `processQueuedCommunicationDeliveries()` directly; do not duplicate queue or provider logic.
4. Schedule the route every minute through Vercel production cron configuration.
5. Keep the worker batch bounded so one invocation cannot monopolize function execution.
6. Keep the existing manual dispatch key and manual route unchanged.
7. Add `CRON_SECRET` to the environment contract without committing a real value.
8. Extend Communications CI so the cron HTTP boundary and production schedule are regression-covered.

## Security and privacy invariants

- Cron authorization is server-only and independent of browser sessions.
- Missing or invalid `CRON_SECRET` must not process deliveries.
- The route must not log message bodies, addresses, provider tokens or secrets.
- Only deliveries already eligible under the existing verified-endpoint and enabled-preference checks can be claimed.
- Staff-only content remains blocked by the existing claim/send policy.
- WhatsApp test mode remains E.164 allowlisted and parameter-free; automatic scheduling does not weaken its fail-closed behavior.
- Duplicate/concurrent cron invocations are tolerated by the existing database locking and delivery-state transitions.

## Qualification plan

Before merge:

- Build and existing Communications CI pass.
- Cron route rejects missing/wrong authorization.
- Cron route accepts the configured secret and returns the worker result.
- The configured production cron path and one-minute schedule are asserted in CI.
- Existing communications, rate-limit, channel and WhatsApp webhook tests remain green.

Production qualification:

1. Configure `CRON_SECRET` as a sensitive Production environment variable.
2. Deploy the exact merged head and confirm the cron is registered.
3. Leave the already-verified WhatsApp test endpoint and controlled `hello_world` test mode active for the qualification window.
4. Do not manually call the dispatcher.
5. Observe the existing queued WhatsApp test delivery progress automatically from `QUEUED` to `SENT` and `DELIVERED`.
6. Send one fresh Wewed message and confirm it also dispatches automatically within the scheduler interval.
7. Confirm a second cron run with no work is a no-op and no duplicate WhatsApp delivery occurs.
8. After qualification, disable WhatsApp test mode and restore the intended production channel preference state until the production notification template is approved.

## Rollback

If automatic dispatch causes any unexpected behavior:

1. Remove/disable the cron schedule in production or roll back the deployment.
2. Leave delivery records intact; queued work remains canonical and recoverable.
3. Keep channel preferences or test mode disabled to stop new external fanout if needed.
4. The protected manual dispatcher remains available for controlled recovery after diagnosis.

## Release gate

Do not consider this task complete merely because the cron route deploys. Completion requires a real Wewed-originated production message to reach the verified WhatsApp test recipient automatically, with no manual dispatcher call, and for Meta delivery callbacks to reconcile back into Wewed.
