# Wewed Communications Automatic Dispatch Plan

## Goal

Make external communication delivery automatic after a canonical Wewed message is created, while keeping Wewed as the conversation record and preserving the existing fail-closed endpoint verification, preference, retry, provider-status and privacy controls.

The user-visible contract is:

`Wewed message -> external delivery QUEUED -> automatic worker -> provider -> SENT/DELIVERED`

No user or operator should need to call the protected manual dispatcher during normal operation.

## Current production finding

The communications foundation already creates correct external delivery rows and the worker safely claims them with `FOR UPDATE ... SKIP LOCKED`, moves them through `PROCESSING`, applies bounded retries and records provider message IDs/status callbacks. The missing operational link is a scheduler that invokes that worker automatically.

The existing protected `POST /api/internal/communications/deliveries` route remains an explicit operator override and qualification tool. It is not the normal runtime scheduler.

## Hosting constraint discovered during implementation

The first implementation attempted a one-minute Vercel Cron. Vercel rejected the preview because the current Wewed account is on Hobby, where cron jobs are limited to daily schedules. Upgrading hosting is not required for this feature.

Wewed already uses Supabase Postgres as its canonical production data layer. Supabase supports `pg_cron` plus `pg_net`, including one-minute jobs and authenticated HTTP requests. The automatic dispatcher therefore runs from Supabase while Vercel continues to host the application route.

This preserves the intended architecture without adding another paid service:

`Supabase pg_cron -> pg_net -> wewed.pro scheduler route -> existing queue worker -> provider`

## Implementation

1. Add a dedicated server-only scheduler route at `/api/cron/communications-deliveries`.
2. Add a private `CommunicationSchedulerCredential` table in `wewed_communications` that stores only a SHA-256 digest, never the bearer secret itself.
3. Provision a random 32-byte scheduler bearer credential inside Supabase Postgres and store the plaintext only in Supabase Vault.
4. Enable Supabase `pg_cron` and `pg_net` in the production scheduler migration.
5. Schedule an authenticated `POST` to the Wewed scheduler route every minute. The job reads the bearer credential from Vault at execution time.
6. Verify the bearer token at the Wewed route by hashing it in Node and matching the private database digest.
7. Reuse `processQueuedCommunicationDeliveries()` directly; do not duplicate queue or provider logic.
8. Keep the worker batch bounded so one invocation cannot monopolize function execution.
9. Keep the existing manual dispatch key and manual route unchanged.
10. Keep the existing Vercel daily reminders cron unchanged and Hobby-compatible.
11. Extend Communications CI so the credential boundary, scheduler route, portable database migration and Supabase scheduler contract are regression-covered.

## Migration authority

The private credential table is a portable PostgreSQL migration and remains in the normal Prisma migration set so clean-Postgres CI can validate it.

Supabase-only scheduling is kept in `scripts/communications-supabase-scheduler.sql` because stock PostgreSQL CI images do not contain Supabase's `pg_net` and `pg_cron` extensions. Production application of that scheduler script remains under the established Supabase production migration authority.

## Security and privacy invariants

- The scheduler secret is generated inside Postgres and never committed, printed, returned to the browser or copied into Vercel environment variables.
- The plaintext secret is stored only in Supabase Vault; Wewed stores only its SHA-256 digest in the private communications schema.
- Missing or invalid scheduler authorization must not process deliveries.
- Scheduler authorization failure is fail-closed even if the database credential backend is unavailable.
- The route must not log message bodies, addresses, provider tokens or scheduler secrets.
- Only deliveries already eligible under the existing verified-endpoint and enabled-preference checks can be claimed.
- Staff-only content remains blocked by the existing claim/send policy.
- WhatsApp test mode remains E.164 allowlisted and parameter-free; automatic scheduling does not weaken its fail-closed behavior.
- Duplicate/concurrent scheduler invocations are tolerated by the existing database locking and delivery-state transitions.
- The manual `WEWED_COMMUNICATIONS_DISPATCH_KEY` remains separate from the automatic scheduler credential.

## Qualification plan

Before merge:

- All Prisma migrations apply to clean PostgreSQL.
- Build and existing Communications CI pass.
- Scheduler route rejects missing/wrong authorization.
- Scheduler route accepts a database-provisioned digest match and returns the worker result.
- The Supabase scheduler script is statically checked for the expected one-minute job, Vault usage, authenticated request and production route.
- Existing communications, rate-limit, channel and WhatsApp webhook tests remain green.
- Vercel preview succeeds because no sub-daily Vercel Cron is added.

Production qualification:

1. Deploy the exact merged application head.
2. Apply the portable scheduler-credential migration through the production database authority.
3. Apply the Supabase scheduler script, which enables `pg_net`/`pg_cron`, provisions the Vault secret/digest pair and registers the one-minute job.
4. Verify the job exists and produces successful run records without exposing the secret.
5. Leave the already-verified WhatsApp test endpoint and controlled `hello_world` test mode active for the qualification window.
6. Do not manually call the dispatcher.
7. Observe the existing queued WhatsApp test delivery progress automatically from `QUEUED` to `SENT` and `DELIVERED`.
8. Send one fresh Wewed message and confirm it also dispatches automatically within the scheduler interval.
9. Confirm later scheduler runs with no work are no-ops and no duplicate WhatsApp delivery occurs.
10. After qualification, disable WhatsApp test mode and restore the intended production channel preference state until the production notification template is approved.

## Rollback

If automatic dispatch causes any unexpected behavior:

1. Unschedule `wewed-communications-automatic-dispatch` in Supabase Cron.
2. Leave delivery records intact; queued work remains canonical and recoverable.
3. Keep channel preferences or test mode disabled to stop new external fanout if needed.
4. The protected manual dispatcher remains available for controlled recovery after diagnosis.
5. The private credential can remain in place or be rotated by replacing the Vault value and corresponding hash before re-enabling the job.

## Release gate

Do not consider this task complete merely because the scheduler route deploys or the cron job registers. Completion requires a real Wewed-originated production message to reach the verified WhatsApp test recipient automatically, with no manual dispatcher call, and for Meta delivery callbacks to reconcile back into Wewed.
