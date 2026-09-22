# WEWED PRODUCTION DATABASE — PHASE 3 AUDIT

**Plan ID:** WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01
**Phase:** 3 — Global read-only production database audit
**Branch:** `backend/production-database-audit-phase3-20260922`
**Audit evidence SHA:** `d4241650bdb398cdefc5bd377ba6265c32e11854`  
**Accepted Phase-3 closure SHA:** `81c77884b8fe4d84a17918b9310d53bf4541791d`
**Status:** INDEPENDENT RULE-10 REVIEW COMPLETE — ACCEPTED after reviewer-owned cleanup/corrections. Phase 4 may begin; it has not started.

## 1. Safety boundary

This phase is read-only. Every finding below was produced by hard-coded `SELECT`/catalog queries run inside a single Postgres transaction, opened with `SET TRANSACTION READ ONLY`, executed once, and then deliberately rolled back by the calling code (a sentinel error is thrown after the queries complete, so Prisma's `$transaction` never commits). No `INSERT`, `UPDATE`, `DELETE`, `UPSERT`, DDL, `GRANT`/`REVOKE`, migration application, secret rotation, or data repair was executed at any point in this phase.

The temporary audit route (`/api/uat/phase3/database-audit`) was used only on the exact protected Preview branch. It fingerprinted `DATABASE_URL` in memory, refused SQL unless the expected Wewed project ref matched, accepted no request-supplied SQL, executed hard-coded reads under `SET TRANSACTION READ ONLY`, and rolled the transaction back. **The reviewer removed that route and its fingerprint helper/tests after validating the audit evidence.** No audit HTTP surface remains on the accepted Phase-3 branch.

Every value reported below is either: a count, a distinct-value list, a boolean/version/constraint-definition catalog fact, or — for the contract probes in §10 — a grant **shape** (`workspaceKind` + `scopeKind` only). No row of customer data (name, email, phone, token, address, message body) was read or is reproduced anywhere in this document. Verified directly: both raw JSON responses returned zero matches for `postgres://`/`postgresql://`, `password`, `service_role`, `jwt`, `secret`, or an email-address pattern.

## 1.1 Phase-3 artifacts

Final retained artifacts:
- `scripts/production-authority-catalog-preflight.sql` — standalone, rerunnable, `SELECT`-only catalog reference, including the follow-up `security_invoker` reloption check and full migration-ledger status list used during the audit.
- This sanitized audit document.

Temporary reviewer/agent audit scaffolding was removed at closure:
- `src/app/api/uat/phase3/database-audit/route.ts`;
- `src/lib/phase3-database-fingerprint.ts` and its test;
- the audit-only injectable Prisma transaction client added to `src/lib/production-authority/resolver.ts`.

The production-authority resolver has been restored byte-for-byte to the accepted Phase-2 implementation.

## 2. Database identity (positively confirmed)

| Field | Value |
| --- | --- |
| Supabase project ref (from connection username) | `kjigkhjdeymukwradoqu` — matches the repository's expected ref exactly |
| Database host | `aws-0-eu-central-1.pooler.supabase.com` |
| Database name | `postgres` |
| Connection username | `postgres.kjigkhjdeymukwradoqu` |
| `current_database()` | `postgres` |
| `current_user` | `postgres` |
| `session_user` | `postgres` |
| PostgreSQL version | `17.6` |

This was proven from **inside** the actual Vercel Preview deployment built from this branch (`VERCEL_GIT_COMMIT_REF` matched, `DATABASE_URL` was the value Vercel injects into that deployment's runtime — the exact same environment variable the production/preview server process uses), not inferred from any local file or CLI metadata. The password and full connection string were never printed, logged, stored, or returned by any tool call in this task.

## 3. Application database role

| Property | Value |
| --- | --- |
| Role name | `postgres` |
| `LOGIN` | true |
| `SUPERUSER` | **false** |
| `BYPASSRLS` | **true** |
| `INHERIT` | true |
| Owner of all inspected tables/views | `postgres` (confirmed via `pg_get_userbyid(relowner)` on every object in §4) |

The application role is not a Postgres superuser, but it bypasses row-level security and owns every table and view it needs to read. Table-privilege grants (`information_schema.role_table_grants`) confirm full `SELECT/INSERT/UPDATE/DELETE/REFERENCES/TRIGGER/TRUNCATE` on every one of the 8 authority-relevant relations checked (both the `public` compatibility views and the underlying `wewed_admin` tables, plus `WeddingMembership` and `ServiceEngagement`). The role can also read `auth.users` (`has_table_privilege(...) = true`), which is load-bearing for §9.

**Consequence for RLS (see §5.2):** because the role bypasses RLS entirely, RLS policy gaps found below do not affect the production application today, but they would affect any other role (e.g. a Supabase `anon`/`authenticated` client role) attempting to read those tables directly.

## 4. Schema topology

All twelve schemas the master plan and the Phase-2 specification named were checked; all exist and the application role has `USAGE` on every one: `public`, `wewed_admin`, `wewed_booking`, `wewed_communications`, `wewed_contracts`, `wewed_contributions`, `wewed_media`, `wewed_notebook`, `wewed_planner`, `wewed_safety`, `private`, `auth`.

### 4.1 BusinessAccount / BusinessAccountMember / BusinessAccountLink / ProviderProfile

Confirmed exactly as the repository migrations declare:

| Object | `public` | `wewed_admin` |
| --- | --- | --- |
| `BusinessAccount` | **view** | **table**, RLS enabled |
| `BusinessAccountMember` | **view** | **table**, RLS enabled |
| `BusinessAccountLink` | **view** | **table**, RLS enabled |
| `ProviderProfile` | **view** | **table**, RLS **not** enabled |
| `PlatformAdministrator` | — | table, RLS not enabled |
| `PlatformAdministratorScope` | — | table, RLS not enabled |

Owner of every one of these objects is `postgres` (same as the application role).

**`security_invoker` (PASS).** `pg_get_viewdef()` only prints a view's body, not its storage options, so a second targeted read of `pg_class.reloptions` was required (added in a follow-up commit to this same guarded route). Result: all four `public` compatibility views (`BusinessAccount`, `BusinessAccountMember`, `BusinessAccountLink`, `ProviderProfile`) have `security_invoker = true`. Their bodies are plain, unfiltered `SELECT <columns> FROM wewed_admin."<Table>"` pass-throughs — no `WHERE`, no row filtering, no column redaction.

**RLS / policies.** `WeddingMembership` and `ServiceEngagement` were checked as well: `WeddingMembership` has RLS **enabled**; `ServiceEngagement` does not. `pg_policies` returned **zero rows** for all eight relations checked (`BusinessAccount`, `BusinessAccountMember`, `BusinessAccountLink`, `ProviderProfile`, `PlatformAdministrator`, `PlatformAdministratorScope`, `WeddingMembership`, `ServiceEngagement`), across `public`, `wewed_admin`, `wewed_booking`, and `private`.

**Finding F-1 (LOW severity for the current application, MEDIUM for defense-in-depth).** RLS is enabled with zero policies on `wewed_admin."BusinessAccount"`, `"BusinessAccountMember"`, `"BusinessAccountLink"`, and `public."WeddingMembership"`. Postgres's default behaviour for "RLS enabled, no policy, non-owner/non-bypass role" is to return **zero rows**, not to leak them — so this fails closed for any role other than the owning `postgres` role. It does not affect the current application (which owns these tables and also carries `BYPASSRLS`), but it means these tables have no actual row-level access control defined; any future role granted `SELECT` without `BYPASSRLS` and without being the owner would see nothing at all (a usability trap, not a leak) unless an explicit policy is added. Proposed remediation: define explicit RLS policies (or intentionally document "postgres-only access, no direct client access") before any client role other than the server's own service connection is ever granted table access. No production change made in this phase.

### 4.2 Migration ledger

Aggregate: 11 rows in `public._prisma_migrations` (8 finished, 2 rolled-back, 1 unresolved), first `20260729000000_init_postgres`, last `20260910110000_native_deferred_invitation_handoff`, against **98 migration folders** in the repository.

Full list read directly (migration filenames are internal catalog metadata, not customer data):

| Status | Migration |
| --- | --- |
| FINISHED | `20260729000000_init_postgres` |
| FINISHED | `20260804014000_digital_invitation_cards` |
| FINISHED | `20260729070000_phase1_wedding_memberships` |
| FINISHED | `20260729071500_harden_wedding_memberships` |
| FINISHED | `20260729102000_phase5_restore_flagship_venue` |
| ROLLED BACK | `20260729131000_normalize_planner_metadata` (attempt) |
| FINISHED | `20260729131000_normalize_planner_metadata` (retried) |
| ROLLED BACK | `20260729134500_normalize_task_assignee` (attempt) |
| FINISHED | `20260729134500_normalize_task_assignee` (retried) |
| **UNRESOLVED** | `20260730173000_wewed_business_admin_console` |
| FINISHED | `20260910110000_native_deferred_invitation_handoff` |

**Finding F-2 (informational, informs migration hygiene).** Production's `_prisma_migrations` ledger tracks only 11 of the repository's 98 migration folders. That does **not** prove that 87 migrations are missing: the catalog directly contains objects/constraints consistent with later repository DDL. It does prove that migration-ledger history is incomplete as a source of truth. The mechanism by which unledgered DDL reached production (`prisma db push`, manually applied SQL, another deploy path, etc.) was **not established by this audit** and must not be asserted as fact.

**Finding F-3 (MEDIUM severity — Phase 5/8 blocker input, not a Phase 3 blocker).** `20260730173000_wewed_business_admin_console` is recorded as **UNRESOLVED** (`finished_at IS NULL`, not rolled back). Production contains DDL and several link shapes associated with that migration, but contains **zero** `vendor/represents` and `wedding/serves` links (§7). The audit does **not** establish why. Plausible explanations include: there were no Vendor rows when the backfill executed; the vendor-specific statements did not execute/complete; or later data lifecycle removed/replaced those rows. No one explanation is proven from the sanitized evidence. Before any migration-ledger repair or Vendor backfill, a later remediation must inspect the migration log/deployment history and current Vendor-to-business provenance. Only then may `prisma migrate resolve` or a new idempotent backfill be considered.

## 5. Business / wedding role and permission shapes

### 5.1 `BusinessAccountMember`

| role | status | count |
| --- | --- | --- |
| business_owner | active | 4 |
| couple_owner | active | 3 |
| business_owner | invited | 1 |
| wewed_super_admin | active | 1 |
| wewed_operations_admin | active | 1 |
| wewed_operations_admin | revoked | 1 |

**11 rows total. Every role value observed is inside the Phase-2 recognised set** (`business_owner`, `couple_owner`, the two `wewed_*` internal roles). No unrecognised role string was found. `vendor_manager`, `venue_manager`, `coordinator`, `planner`, `viewer`, and `billing_manager` — all listed as possible values in the Phase 2 specification — are simply **absent** from production today, not present-but-unhandled.

Permission shapes (`BusinessAccountMember.permissions`): `string_array` (8 rows), `empty_array` (3 rows). No `null`, no object, no malformed scalar.

### 5.2 `BusinessAccount`

| type | status | count |
| --- | --- | --- |
| vendor | active | 4310 |
| venue | active | 40 |
| couple | active | 6 |
| planning_company | active | 3 |
| couple | archived | 1 |
| vendor | pending_review | 1 |
| wewed_internal | active | 1 |

Onboarding: `not_started` 4207, `in_progress` 139, `complete` **16**. Subscription status: `free` 4361, `active` 1 — **no row holds a value outside the CHECK constraint's allowed set**, and critically **no row holds `'inactive'`** (the historical concern in the repository, §5.3 below).

**Interpretation.** The 4,362 `BusinessAccount` rows are overwhelmingly (4,350) auto-discovered marketplace vendor/venue listings (`ProviderDiscoveryCandidate`/`ProviderDiscoveryJob` in the schema), not hand-onboarded accounts — only 16 are fully onboarded. This is a normal marketplace-catalog shape, not a defect.

### 5.3 Subscription-status integrity (resolves repository item)

**Finding F-4 (MEDIUM latent schema defect; production data currently clean).** The repository/production column default for `BusinessAccount.subscriptionStatus` is `'inactive'`, while the same table's CHECK constraint rejects `'inactive'` and permits `free|trialing|active|past_due|unpaid|incomplete|incomplete_expired|paused|cancelled`. Production currently has **zero** violating rows because successful write paths have supplied valid explicit values. The contradiction is nevertheless a real write-time defect: any insert that relies on the database default can fail its own CHECK constraint. This must be corrected by a controlled schema change before exposing or expanding onboarding/business-account write paths (at latest Phase 7). No production change was made in Phase 3.

### 5.4 `WeddingMembership`

| role | status | count |
| --- | --- | --- |
| planner | active | 9 |
| owner | active | 8 |
| owner | revoked | 1 |
| planner | revoked | 1 |

**19 rows total, all four values inside the Phase-2 recognised set (`owner`/`planner`).** No `coordinator` and no `viewer` role exists in production `WeddingMembership` today — both are legitimate, supported values with zero rows, not unrecognised ones.

Permission shapes: `text_present` (10 rows), `null` (9 rows). No malformed values.

## 6. Business links — global distribution

| entityType | relationship | count |
| --- | --- | --- |
| wedding | manages | 9 |
| wedding | owns | 7 |
| couple | owns | 7 |
| wedding | hosts | 4 |

**27 rows total.** Every combination is one the repository migrations are known to produce (`manages` from planning-company backfill/live writes, `owns` from the couple/wedding backfill, `hosts` from the venue backfill). **No `vendor`-entityType link of any relationship value exists in production** — see §7 for the full analysis. No unexpected `entityType` or `relationship` value was found anywhere in the table.

## 7. Vendor / ServiceEngagement graph

| Metric | Value |
| --- | --- |
| Eligible Vendor businesses (active member + active/complete business + published listing) | **1** |
| Vendor businesses with 0 `vendor`-entityType links | **4,311 (all of them)** |
| Vendor businesses with 1+ `vendor`-entityType links | 0 |
| Orphan `vendor`-entityType links (pointing at a missing `Vendor` row) | 0 |
| `vendor`-entityType link relationship values present | *(none — zero rows)* |
| Real `Vendor` rows with 0 ServiceEngagements | 3 |
| Real `Vendor` rows with 1 ServiceEngagement | 5 |
| Real `Vendor` rows with 2 ServiceEngagements | 2 |
| ServiceEngagement ↔ Vendor cross-wedding mismatches | **0** |
| Orphan `Vendor` rows (no matching `Wedding`) | **0** |

`ServiceEngagement.lifecycleStatus` × `origin` × `recordMode`: `historical_capture`/`historical`/`record_only` (7), `draft`/`current`/`record_only` (1), `draft`/`current`/`managed_contract` (1). No unrecognised value in any of the three columns.

**Finding F-3 (continued from §4.2).** The wedding-scoped Vendor/ServiceEngagement graph is internally clean (zero orphans, zero cross-wedding leaks — see also §9) but is **completely disconnected** from the BusinessAccount/BusinessAccountLink graph the Phase-2 authority contract relies on for `vendor:wedding:*` grants. Today, in production: `vendor:business:*` (portfolio-level) grants are reachable — exactly one business qualifies, and the Phase-2 contract probe (§10) confirms it resolves correctly — but **no `vendor:wedding:*` grant can currently be produced from production data**, because the link that would connect a vendor business to a specific wedding-scoped `Vendor` row does not exist for any of the 10 real `Vendor` rows. This is not a logic defect (the contract correctly and safely denies rather than fabricates), and it does not block the Phase 3 exit gate (a discovery phase), but it is a hard input for Phase 5/8: native vendor-wedding-workspace activation has no live production data path to exercise today, and the remediation options are exactly the two named in F-3.

## 8. Multi-stakeholder reality

| Business memberships (active) | Users |
| --- | --- |
| 1 | 9 |
| 2+ | **0** |

| Wedding memberships (active) | Users |
| --- | --- |
| 1 | 9 |
| 2+ | **2** |

Multi-business-type combinations: none (zero users hold 2+ active business memberships today). Multi-role wedding combinations (a user holding 2+ *distinct* WeddingMembership roles across weddings): none — the 2 users with multiple wedding memberships each hold the *same* role (e.g. planner+planner) on both.

**Interpretation.** Production does not yet contain a user with two or more active *business* memberships. It does contain two users each with two active wedding memberships. The multi-axis pattern (one business relationship **and** one wedding relationship on the same identity) does exist — see the `multi_axis` contract probe in §10 — but with the wedding-owner grant as the only currently-qualifying grant for that particular actor; the coexisting business relationship is real evidence but of a business type (`couple`) that the Phase-2 contract correctly does not map to any workspace.

## 9. Platform admin parity

| Check | Result |
| --- | --- |
| `PlatformAdministrator.role` CHECK constraint | present, restricts to exactly the 5 sanctioned `wewed_*` roles |
| Active `wewed_internal` `BusinessAccountMember` rows | 2 |
| `PlatformAdministrator` registry rows | 3 |
| Active legacy membership with no registry row | 0 |
| Registry row with no matching active legacy membership | **1** |
| Role mismatch between paired legacy membership and registry | 0 |
| Application role can read `PlatformAdministrator` / `PlatformAdministratorScope` | **YES** (full table privileges; `BYPASSRLS = true` also makes this moot even if RLS were later enabled) |

**Finding F-5 (LOW severity).** One `PlatformAdministrator` registry row has no corresponding active `wewed_internal` membership. Given §5.1 shows exactly one `wewed_operations_admin` membership was **revoked**, this is very likely that same person's stale registry entry, never deactivated when the underlying membership was revoked. Effect today: none — `resolveProductionAuthority`'s admin-grant logic requires *both* an active legacy/registry match *and* the platform entry gate (an active `wewed_internal` membership) to be true, so a registry row alone, with no active membership, produces no grant. Recommended for later cleanup: deactivate or delete orphaned registry rows when the paired membership is revoked. No production change made in this phase.

## 10. Legacy global-admin hazard (master plan §8.15)

| Metric | Value |
| --- | --- |
| Active `User.role = 'admin'` accounts with **no** valid Wewed-internal platform authority | **1** |
| Weddings that account could see via the PWA's legacy `listAccessibleWeddings` synthesized-admin path | **10** (all weddings in the system) |

**Finding F-6 (the master-plan §8.15 hazard is live in production, not merely theoretical).** Exactly one active `admin`-class account exists that would fall through to the PWA's legacy global-admin branch and be shown a synthesized `'admin'` membership on every wedding (10, i.e. all of them) if that account signs in. The Phase-2 authority contract already refuses to grant anything for this shape (`legacy_global_admin_wedding_access` non-granting reason) — this finding is about the **existing PWA** `/api/auth/me` + `listAccessibleWeddings` behaviour, not the new contract. Per the task instructions, this is reported as a count only; no PWA change was made in this phase. Remediation belongs to Phase 12.

## 11. UserProfile ↔ Supabase auth identity (master-plan/Phase-2 assumption)

**PROVEN**, not `UNVERIFIED`: the application role can read `auth.users` (`has_table_privilege = true`).

| Check | Result |
| --- | --- |
| `UserProfile` rows whose `id` matches a real `auth.users.id` | **15 / 15 (100%)** |
| `UserProfile` rows with no matching `auth.users` row | **0** |

The Phase 2 specification's working assumption (`UserProfile.id = Supabase auth user id`) holds for every profile currently in production.

## 12. Global relationship integrity

Every check below returned **zero**:

| Relationship | Orphans / mismatches |
| --- | --- |
| `Wedding` → `Couple` | 0 |
| `WeddingMembership` → `User` | 0 |
| `WeddingMembership` → `Wedding` | 0 |
| `Guest` → `Wedding` | 0 |
| `RSVP` → `Guest` | 0 |
| `SeatingTable` → `Wedding` | 0 |
| `Guest` seating cross-wedding mismatch (guest's table belongs to a different wedding) | 0 |
| `Vendor` → `Wedding` | 0 |
| `BusinessAccountLink` target orphan (vendor) | 0 |
| `BusinessAccountLink` target orphan (wedding) | 0 |
| `BusinessAccountLink` target orphan (couple) | 0 |
| `BusinessAccountLink` target orphan (user) | 0 |
| Duplicate `(userId, weddingId)` `WeddingMembership` rows | 0 |

**The core relational graph is fully clean.** This is the strongest positive result of the audit: no orphaned relationships, no cross-wedding data leakage, and no duplicate memberships exist anywhere in the checked graph.

## 13. Mature PWA domain catalog health

| Domain | Row count |
| --- | --- |
| `PlannerTask` | 342 |
| `BudgetItem` | 68 |
| `GuestContribution` | 4 |
| `Contract` | 0 |
| `VaultObject` | 0 |
| `ProgrammeItem` | 46 |
| `WeddingContent` | 317 |
| `Message` | 3 |
| `Notification` | 10 |
| `wewed_booking."Booking"` | 1 |

Every one of these tables/schemas is present and readable by the application role; no schema-divergence blocker was found for any mature domain a native adapter would later consume. `Contract`/`VaultObject` being empty reflects that those features are not yet in active use for any wedding — a legitimate zero, not a query failure (a query failure would have surfaced as `-1` per this audit's own error-handling convention).

## 14. Usher/Gate production authority

**Searched:** every schema in the database (excluding `pg_catalog`/`information_schema`) for any table, view, or other relation whose name contains `usher`, `gate`, `checkin`/`check_in`, `admission`, or `scanner`.

**Result: NO** — zero matching objects exist anywhere in production. This confirms the master plan's expectation: no Usher/Gate production authority exists today; Phase 10 remains the design phase for this domain, with a clean slate to design against.

## 15. Wedding Day partial-object state

**Searched:** every schema for any relation named like `weddingpass`/`wedding_pass`, `weddingcheckin`, `weddingannouncement`, or `servicepresence`.

**Result: NO** — zero matching objects. No partial Wedding Day migration exists in production.

**`Guest(id, weddingId)` composite unique constraint:** **absent**. `Guest` currently has only its primary-key uniqueness; the `Guest_id_weddingId_key`-style composite unique constraint the master plan names as a Wedding Day migration prerequisite does not yet exist. This is the expected starting state (Wedding Day has not been migrated), not a defect — it is a fact Phase 11's migration must account for.

## 16. Phase-2 contract probes against controlled production accounts

Every probe below selected its candidate purely by **relationship shape** (an internal SQL `JOIN`/`HAVING` pattern matching the stakeholder shape being tested) — never by name, email, or any hand-picked identifier — and the accepted, unmodified `resolveProductionAuthority()` resolver was invoked, inside the same read-only transaction, against that one candidate. Only `accountStatus` and each grant's `workspaceKind`/`scopeKind` (never an id, name, or email) are reported.

| Stakeholder | Result |
| --- | --- |
| **Couple** | **PROVEN** — `authorized`; one `couple`/`wedding` grant. |
| **Planner, one wedding** | **PROVEN** — `authorized`; `planner`/`portfolio` + one `planner`/`wedding` grant (selection required within the `planner` kind, as designed). |
| **Planner, multiple weddings** | **PROVEN** — `authorized`; `planner`/`portfolio` + **two** `planner`/`wedding` grants; no automatic collapse to one. |
| **Planner portfolio (zero weddings)** | **NOT PROVEN IN PRODUCTION** — no candidate matched (active planning-company membership with zero active wedding memberships). Every planning-company member in production today already holds at least one wedding. Not fabricated. |
| **Coordinator** | **NOT PROVEN IN PRODUCTION** — no `WeddingMembership.role = 'coordinator'` row exists in production today (§5.4). The rule itself is proven correct by the disposable-database integration tests (Phase 2); production simply has no live example yet. |
| **Vendor** | **PROVEN** — `authorized`; one `vendor`/`business` grant (matches the single eligible vendor business found in §7). No `vendor`/`wedding` grant, consistent with F-3. |
| **Admin** | **PROVEN** — `authorized`; one `admin`/`system` grant. |
| **Multi-axis actor** | **PROVEN** — `authorized`; the resolved candidate holds both an active `WeddingMembership` and an active `BusinessAccountMember` (a `couple`-type business) simultaneously. Only the wedding-owner grant currently qualifies (the co-existing `couple`-type business membership correctly maps to no workspace per §3.1 of the Phase-2 specification) — this is the intended non-erasing behaviour: the business-axis relationship is real evidence and does not interfere with the wedding-axis grant. |

## 17. Summary of findings requiring later remediation (none actioned in this phase)

| ID | Severity | Domain | Summary | Owning phase |
| --- | --- | --- | --- | --- |
| F-1 | Low/defense-in-depth | RLS | RLS enabled with zero policies on `wewed_admin.BusinessAccount/Member/Link` and `public.WeddingMembership`; harmless today only because the application role bypasses RLS and owns the tables. | Later hardening (not yet scheduled) |
| F-2 | Informational | Migrations | Ledger tracks 11/98 repository migrations; row count is not a reliable signal of applied schema state; content-level checks were used instead. | N/A (informs future migration hygiene) |
| F-3 | Medium | Vendor authority | Zero `BusinessAccountLink(entityType='vendor')` rows exist; no `vendor:wedding:*` grant is reachable from production data today. The unresolved migration is correlated evidence, but the root cause is **not proven**. | Phase 5 / Phase 8 |
| F-4 | Medium (latent) | Subscription status | Column default `'inactive'` contradicts the table CHECK constraint. Existing rows are clean, but an insert that relies on the default can fail. | Fix before/within Phase 7 onboarding writes |
| F-5 | Low | Platform admin | One `PlatformAdministrator` registry row has no matching active internal membership (likely a stale entry for a revoked admin). No effect on grants. | Later hardening (not yet scheduled) |
| F-6 | Medium (PWA-only) | Legacy admin | Master plan §8.15 hazard confirmed live: 1 account, 10 potentially-affected weddings via the PWA's own legacy code path. The new authority contract already denies this shape. | Phase 12 |

No production data, schema, or permissions were changed to produce or in response to any of these findings.

## 18. Exit-gate checklist

1. **Real Wewed production database positively identified** — YES, from inside the live deployment's own injected `DATABASE_URL`, matching the expected project ref exactly (§2).
2. **Application DB role identified** — YES: `postgres`, not superuser, `BYPASSRLS = true`, owns every relevant object (§3).
3. **Global read-only audit completed** — YES, covering catalog topology, role/permission shapes, business links, the vendor graph, multi-stakeholder reality, platform-admin parity, the legacy global-admin hazard, the UserProfile↔auth identity assumption, global relational integrity, mature-domain catalog health, Usher/Gate discovery, and Wedding Day partial-object discovery (§4–15).
4. **Production mutation remained zero** — YES (§1, and independently confirmed by re-reading every query in the committed route source).
5. **Independent reviewer inspection** — PASS. The reviewer inspected the remote audit implementation/report, corrected unsupported causal language, reclassified the contradictory subscription default as a latent schema defect, removed the temporary Preview audit surface, and restored the accepted Phase-2 resolver.

**Overall:** Phase 3 is **ACCEPTED**. The production catalog supports `WewedProductionAuthorityV1` for the currently proven relationship shapes. Phase 4 may proceed because the remaining findings do not affect Guest Session v2 promotion. Carry-forward gates are explicit: F-3 blocks native Vendor wedding-scoped activation until provenance/backfill is resolved in Phase 5/8; F-4 must be corrected before/within Phase 7 onboarding/business-account write expansion; F-6 remains a Phase-12 PWA remediation. No finding requires reopening accepted Phase 1 or Phase 2.
