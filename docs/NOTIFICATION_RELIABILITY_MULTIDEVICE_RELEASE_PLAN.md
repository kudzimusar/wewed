# Wewed Notification Reliability & Multi-device Release Plan

**Status:** AUTHORITATIVE — implementation and production qualification required before merge  
**Branch:** `feature/notification-reliability-multidevice`  
**Baseline:** `main` at `14b14063cc1ce532bc76f54a1f0b542049c7af02`  

## Goal

Finish the notification system as one account-level attention model with reliable multi-device delivery and exact source navigation. A notification may fan out to multiple enabled delivery endpoints, but read/acknowledged/resolved state is canonical per recipient account and must stay consistent across devices.

## Release invariants

1. **One logical notification state per recipient account.** Opening, reading, acknowledging or resolving on one device must be reflected when the same account is viewed elsewhere.
2. **Acknowledged is not new.** An acknowledged notification may remain historically visible until its source is resolved, but it must never render as unread/new attention.
3. **Source remains authoritative.** Acknowledging a notification never completes the underlying task, budget item, engagement, RSVP or contract action.
4. **Exact deep links across channels.** In-app, email, WhatsApp and push must converge on one authorization-rechecking Wewed open route that records the open/read event before redirecting to the canonical source.
5. **Strict role targeting.** An unassigned Planner planning task must not notify Couple/Vendor accounts merely because they share the wedding. Couple/Vendor attention requires explicit audience/source semantics.
6. **External channels are additive.** In-app notification creation never depends on email, WhatsApp or push availability.
7. **Email readiness matches the actual Resend transport contract.** Capability checks must use the same environment variables as the sender and require a verified communication endpoint plus consent.
8. **Push is standards-based and multi-device.** Each browser/PWA device registers its own subscription; a single user-level notification may fan out to every active subscription.
9. **PWA identity is Wewed-wide.** The manifest must not contain a specific wedding/couple identity.
10. **Production health fails closed for required scheduled infrastructure.** Cron authentication remains required and must not be weakened.

## Implementation phases

### Phase 1 — Cross-device lifecycle reliability
- Add focus/visibility revalidation to Notification Center and attention surfaces.
- Present acknowledged state explicitly.
- Exclude acknowledged items from unread/new attention while keeping source action visible where appropriate.
- Add executable browser coverage for same-account refresh/revalidation.

### Phase 2 — Canonical notification open route
- Add an authenticated notification-open endpoint/route keyed by Notification id.
- Recheck current recipient/source authorization.
- Mark active notification read before redirecting.
- Redirect only to safe same-origin canonical deep links.
- Use this route for in-app external-channel deep links.

### Phase 3 — Planner recipient isolation
- Preserve explicit task assignee targeting.
- For unassigned PlannerTask due/overdue attention, target active Planner-role planning members only.
- Do not implicitly target Couple or Vendor accounts.
- Add positive/negative scheduler regression coverage.

### Phase 4 — Email readiness and sender repair
- Align notification capability checks with `RESEND_API_KEY`, `WEWED_EMAIL_FROM`, and `WEWED_EMAIL_REPLY_TO`.
- Preserve verified EMAIL endpoint + communication consent requirement.
- Surface endpoint verification separately from transport readiness.
- Verify production sender formatting/configuration before enabling notification email.

### Phase 5 — WhatsApp exact-source CTA
- Preserve current approved-template requirement outside service windows.
- Support a dedicated notification template contract with dynamic notification title/context and exact Wewed open URL button parameter.
- Fail closed if the configured approved template contract cannot carry the required URL rather than silently degrading to a misleading generic link.
- Keep test-mode allowlisting intact.

### Phase 6 — Direct standards-based Web Push
- Replace the mandatory generic push-gateway dependency with direct server-side Web Push using VAPID credentials.
- Keep optional gateway compatibility only if explicitly configured.
- Fan out to every active PushSubscription for the recipient.
- Disable 404/410 expired subscriptions.
- Use the canonical notification-open URL in payloads.
- Preserve service-worker same-origin validation.

### Phase 7 — Wewed PWA identity and mobile readiness
- Replace wedding-specific manifest metadata with generic Wewed identity, stable scope/id, icons and install metadata.
- Preserve global service-worker registration.
- Add installation/push guidance appropriate to browser/PWA capability without claiming unsupported native-app behavior.

### Phase 8 — UAT and release qualification
- Unit/contracts for lifecycle filters, open route safety, recipient isolation, channel capability parity and push payloads.
- Browser UAT for focus refresh, acknowledged presentation, exact open redirect and push settings.
- Full existing repository workflow matrix.
- Exact-head Vercel preview READY.
- No main drift before merge.
- Production configuration verification for cron, Resend, WhatsApp template, VAPID/Web Push.
- Merge only after safe configuration and exact-head gates are green.
- Post-merge verify production health, scheduler/delivery cron, exact source open, cross-device database state and channel capability responses.

## Production configuration expected

- `CRON_SECRET`
- `RESEND_API_KEY`
- `WEWED_EMAIL_FROM`
- `WEWED_EMAIL_REPLY_TO`
- WhatsApp Cloud sender credentials plus approved notification template configuration
- `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY`
- server-side VAPID private key and subject/contact configuration

Secrets are never committed to the repository.
