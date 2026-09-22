# Wewed Onboarding State Machine — V1

**Master plan:** `WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01`, **Phase 7 — Reconcile onboarding before exposing native onboarding**
**Status:** Documents the state machine as implemented on this branch. Not a new schema; every state below is an existing, already-persisted value.

This document is the canonical account/onboarding lifecycle. It exists so public registration, admin completion, any future web self-service flow, and native onboarding (Phase 8+) share one model instead of drifting into their own.

---

## 1. Principle

There is exactly one account-authority graph:

```text
Supabase auth identity
  → User                     (internal access-user id, cuid)
  → UserProfile               (id === Supabase auth uid, no separate column)
  → BusinessAccount           (wewed_admin schema; raw SQL only, no Prisma model)
  → BusinessAccountMember
  → Couple / Wedding / ProviderProfile   (where the account type requires them)
  → WeddingMembership / BusinessAccountLink
  → WewedProductionAuthorityV1 (resolveProductionAuthority)
```

`resolveProductionAuthority` is the only thing that turns this graph into workspace grants (master plan Phase 2). A row existing is not authority; a *governed* relationship is (`GOVERNED_WEDDING_ACCESS`, active `BusinessAccountMember`, `RECOGNISED_VENDOR_LINK_RELATIONSHIPS`, etc. — all unchanged by this phase).

`src/app/api/onboarding/route.ts` (legacy, Phase 7 fail-closed in production — §5 below) never produces this graph and is not part of this state machine.

## 2. Identity linking (audited, not changed)

- `UserProfile.id` **is** the verified Supabase auth user id. There is no separate foreign-key column; the primary key itself is the Supabase uid. `/api/auth/register` establishes this profile explicitly with `id = authUserId`. `/api/admin/onboarding` must not recreate or rebind that identity: it verifies that the existing `UserProfile` at `metadata.authUserId` still exists with the owner's email, then updates that existing profile. Missing/mismatched identity linkage fails closed with HTTP 409 before any Couple/Wedding/onboarding mutation.
- `User.id` is a separate, Prisma-generated `cuid()` — the "access user id" `resolveProductionAuthority(accessUserId, { authUserId })` takes as its first argument. It has no database-level foreign key to Supabase or to `UserProfile`.
- The two are correlated by the caller (session layer: `AppSession.authUserId` bound at sign-in; or, for a not-yet-approved application, `BusinessAccount.metadata.authUserId` read back explicitly by `/api/admin/onboarding`), never by email inference after authority has already been established. `User.email` is used only once, to find or create the matching `User` row at *registration* time — after that, the session/metadata-carried `authUserId` is authoritative for the rest of that identity's lifecycle.
- Phase 7 does not add a schema-level FK between `User` and `UserProfile`: `User` predates the modern identity model and a hard constraint now would be exactly the kind of unrehearsed production schema change master plan Rule 7 requires a dedicated migration/rehearsal cycle for, not a side effect of an onboarding-reconciliation phase. This is tracked as a documented, intentional non-change, not an oversight.

## 3. States

All states below are the *existing*, already-migrated `wewed_admin."BusinessAccount"` columns. No new column or competing taxonomy is introduced.

### 3.1 `status` (lifecycle / approval)

| Value | Meaning | Set by |
| --- | --- | --- |
| `pending_review` | Application submitted, awaiting admin approval | `/api/auth/register` (`INSERT ... status = 'pending_review'`) |
| `active` | Approved; the account may proceed to onboarding completion | Admin approval action (outside this phase's routes — the existing account-approval endpoint, unchanged) |
| `rejected` | Application declined | Admin action, unchanged |
| `suspended` / `blocked` / `cancelled` / `archived` | Post-approval lifecycle states | Admin/billing actions, unchanged |

### 3.2 `onboardingStatus` (completion progress within an `active` account)

| Value | Meaning | Set by |
| --- | --- | --- |
| `not_started` | Application submitted, not yet approved | `/api/auth/register` (initial insert) |
| `in_progress` | **Pre-existing, not new in this phase.** Approved (`status = active`) but internal onboarding (Couple/Wedding/WeddingMembership provisioning, or Planner marketplace activation) has not begun. Audited during this phase: set automatically by the existing `wewed_admin.validate_business_lifecycle` trigger the instant an admin approves a `public_registration`-sourced account (`pending_review` → `active`), whenever `onboardingStatus <> 'complete'`. This phase does not write this value from application code anywhere — see §6 for why an earlier draft of this fix incorrectly tried to. | `wewed_admin.validate_business_lifecycle` trigger (on approval, unchanged by this phase) |
| `complete` | Onboarding finished; the account's real workspace grant now exists | `/api/admin/onboarding` (final update in the same transaction) |
| `blocked` | Reserved value in the existing CHECK constraint for a stalled/manually-held application | Not written by any route in this phase; available for a future manual-hold workflow |

### 3.3 `subscriptionStatus` (billing; unrelated to onboarding progress, tracked here only because Phase 7 fixes its default — §7)

Allowed values are unchanged: `free | trialing | active | past_due | unpaid | incomplete | incomplete_expired | paused | cancelled`. Every current writer sets it explicitly; Phase 7 additionally corrects the column's own default so a future writer that omits it does not violate the table's own CHECK constraint.

## 4. Transitions

```text
                 (register)                      (admin approves — existing route)
  [ no row ]  ───────────────►  pending_review  ───────────────────────────────►  active
                 status=pending_review            status=active
                 onboardingStatus=not_started      onboardingStatus auto-flips to in_progress
                                                    (existing validate_business_lifecycle trigger)
                                                        │
                                                        │ admin completion request
                                                        ▼
                                              in_progress  (row-locked re-check; §6)
                                                        │
                                          ┌─────────────┴─────────────┐
                                          │ success                    │ failure (throws)
                                          ▼                            ▼
                                       complete                  (unchanged — remains
                                 (Couple/Wedding/Membership,      in_progress; retry the
                                  or Planner marketplace,          completion request)
                                  now provisioned)
```

`rejected` / `suspended` / `blocked` / `cancelled` / `archived` are terminal or admin-only side branches from `pending_review`/`active`, unchanged by this phase.

## 5. Which objects exist at each state

| State | `User` | `UserProfile` | `BusinessAccount` | `BusinessAccountMember` | `Couple`/`Wedding` | `WeddingMembership` | Production authority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `pending_review` / `not_started` | yes (`isActive: false` unless reserved-vendor fast path) | yes (`id = authUserId`) | yes | yes, `status: invited` | no | no | **none** — `accountStatus` may be `authorized` (identity is real) but `workspaceGrants` is empty; nothing in `not_started`/`pending_review` satisfies any grant rule |
| `active` / `not_started` (approved, not yet completed) | yes | yes | yes | yes, `status: invited` | no | no | **none** — same as above; approval alone is not a grant |
| `active` / `in_progress` | yes | yes | yes | yes | being created (Couple branch) or unaffected (planning-company branch) | being created/updated | **none** — a request currently writing this graph has not committed; a reader sees the pre-transaction state |
| `active` / `complete` (Couple) | `role: couple`, `coupleId`, `currentWeddingId` set | `role: couple`, `coupleId` set | yes | `role: couple_owner`, `status: active` | yes, both | `role: owner`, `status: active` | real `couple/wedding` grant |
| `active` / `complete` (planning-company, zero wedding) | `role: planner` | `role: planner` | yes | `status: active` | no | no | real `planner/portfolio` grant (§7.2 of the authority contract) — **no fabricated wedding** |
| `active` / `complete` (planning-company, one attached wedding) | `role: planner` | `role: planner` | yes | `status: active` | no (Couple/Wedding not created by this branch; only linked) | `role: planner` or `coordinator` (from `account.memberRole`), `status: active` | a `business_owner`/`planner`-role member gets **both** `planner:portfolio:<businessAccountId>` and `planner:wedding:<weddingId>` (independent evidence sources: business membership vs. `WeddingMembership`); a `coordinator`-role member gets only `coordinator:wedding:<weddingId>` — `coordinator` is deliberately outside `PLANNER_PORTFOLIO_BUSINESS_ROLES` (see contract §7.2), so it never also grants a portfolio |

## 6. Idempotency (master plan Phase 7 §13)

The pre-transaction reads in `/api/admin/onboarding` (`account.status`, `account.onboardingStatus`) are ordinary `SELECT`s and, on their own, only protect against a *sequential* retry after a request has already committed. They do **not** stop two near-simultaneous completion requests for the same `accountId` from both passing the check before either commits.

An earlier draft of this fix tried to claim the transition by writing `onboardingStatus = 'in_progress'` at the start of the transaction, treating it as a free third value alongside `not_started`/`complete`. That was wrong: `in_progress` is **not** free. The pre-existing `wewed_admin.validate_business_lifecycle` trigger already writes it, unconditionally, the moment an admin approves a `public_registration` account (`pending_review` → `active`) — so by the time this route ever runs, a real approved-but-incomplete account is *already* sitting at `in_progress`. A claim conditioned on `onboardingStatus NOT IN ('complete', 'in_progress')` therefore never matches a real account and fails every completion outright. This was caught by this phase's own disposable-database integration tests (every completion test failed with 409 on first run) before it reached the moderator.

The actual fix takes a real Postgres row lock instead of repurposing the enum, as the first statement inside the transaction:

```sql
SELECT "onboardingStatus" FROM wewed_admin."BusinessAccount" WHERE id = $1 FOR UPDATE
```

The application code then re-checks the *locked, freshly-read* value: if it is already `'complete'`, it throws `OnboardingAlreadyInProgressError` (HTTP 409) before creating anything. Two concurrent completions for the same `accountId` both reach this `SELECT ... FOR UPDATE`; the second blocks until the first's transaction commits or rolls back, then observes the row exactly as the winner left it. No new value is written to `onboardingStatus` by this mechanism at all — the existing final `UPDATE ... SET "onboardingStatus" = 'complete'` (unchanged from before this phase) is what a reader now blocks on.

Every other relationship write remains idempotent (`WeddingMembership` keyed on `@@unique([userId, weddingId])`, `BusinessAccountLink` via `ON CONFLICT ... DO UPDATE`). `UserProfile` is no longer an idempotent-create seam at completion: registration owns creation; admin completion requires the existing verified profile and performs an `update`, so corrupted `authUserId` metadata cannot silently manufacture a new identity link.

Separately, and not written by this phase: the pre-existing `wewed_admin.validate_public_onboarding_completion` trigger (`BEFORE UPDATE OF "onboardingStatus"`) already refuses to let *any* writer set `onboardingStatus = 'complete'` unless the owner's `User`/`UserProfile`/`BusinessAccountMember`/`WeddingMembership`/`BusinessAccountLink` graph is fully coherent (active membership, linked wedding with a consistent couple, synchronized auth profile, correct dashboard role). This is the database itself enforcing item 6's "coherent graph" requirement, independent of and in addition to the application code's own write order.

## 7. F-7 — the zero-wedding Planner invariant was unenforceable (found and fixed in this phase)

Discovered by this phase's own disposable-database qualification, not a carry-forward finding. `wewed_admin.validate_public_onboarding_completion()` required an active, linked wedding before letting **any** public-registration account reach `onboardingStatus = 'complete'` — unconditionally, before its own couple-vs-planning_company branch. A zero-wedding Planning company (master plan Phase 2's, and this phase's item 7's, explicitly required legitimate state) could therefore never be marked complete: `/api/admin/onboarding`'s own zero-wedding branch (which by design never creates a wedding) was unconditionally rejected with:

```text
ERROR: Public onboarding requires a linked wedding and active wedding membership
```

reproduced by this phase's own integration test before the fix, against a disposable database migrated with this repository's own chain. Migration `20260922130000_fix_planner_zero_wedding_onboarding_completion_trigger` makes the wedding-link check conditional: still mandatory for `type = 'couple'` (unchanged — a Couple account without a wedding was never valid), and for `type = 'planning_company'` only when a wedding link actually exists for that business (the one-wedding case). A zero-wedding planning company now skips the check entirely, matching the invariant the master plan requires. No existing row is touched; not applied to production by this task.

## 8. F-4 — `BusinessAccount.subscriptionStatus` default (fixed in this phase)

`subscriptionStatus` has been `NOT NULL DEFAULT 'inactive'` since migration `20260730173000_wewed_business_admin_console`. The CHECK constraint added minutes later, in `20260730224000_harden_wewed_data_pipeline`, has never allowed `'inactive'`. Reproduced against a disposable database migrated with this repository's own chain:

```text
ERROR: new row for relation "BusinessAccount" violates check constraint
"BusinessAccount_subscription_status_check"
```

Every current application-code writer already passes an explicit value (usually `'free'`), which is exactly why Phase 3 found existing production rows clean — the defect was latent, not yet triggered. Migration `20260922120000_fix_business_account_subscription_status_default` changes only the column's default to `'free'` (matching the same migration's own backfill fallback for legacy rows, and the value every current writer already uses). No existing row is touched. Not applied to production by this task.

## 9. What is explicitly out of scope for this phase

- **Partial-failure reconciliation UI/automation.** `/api/auth/register` already deletes the just-created Supabase auth user if any later DB write throws (best-effort; an orphaned Supabase identity can still remain if that cleanup itself fails). This phase audits and tests that behavior; it does not add new reconciliation tooling.
- **F-3, F-6, `WEWED_SESSION_SECRET`.** Unchanged carry-forward gates; see the master plan.
- **Native onboarding UI.** Not built in this phase (master plan §16).
