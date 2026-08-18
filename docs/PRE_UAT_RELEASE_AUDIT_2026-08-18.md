# Wewed Pre-UAT Release Audit — 2026-08-18

**Status:** QUALIFICATION PENDING  
**Audit baseline:** `4449ff4077beb17e35f80de1e8a361fcd7ea92a7` (`main`)  
**Hardening branch:** `hardening/pre-uat-release-audit-20260818`  
**Related navigation plan:** `WW-ADAPTIVE-NAV-2026-08-18-01`

This audit was requested immediately before restarting Planner UAT. Its purpose is to qualify the actual combined production tree after the adaptive-navigation conformance release, the Phase 1 Vault/communications release and the Task Test 11 closure all landed on `main`.

## Production evidence at audit start

- Vercel Production is serving `main` commit `4449ff4077beb17e35f80de1e8a361fcd7ea92a7` on `wewed.pro`.
- No Vercel runtime errors were reported in the preceding six-hour scan.
- Current-production runtime logs contained no HTTP 5xx responses in the inspected window.
- Planner production data checks found zero invalid task priorities, zero invalid task statuses, zero orphan tasks, zero orphan budget items, zero orphan budget/vendor links, zero cross-wedding seating links and zero over-capacity seating tables.
- Task Test 11's exact priority predicate and executable browser reproducer remain present on current `main`.

## Findings and classification

### 1. Supabase RLS advisory — reviewed, not blindly applied

Supabase's generic table inspection reports many tables with RLS disabled. Wewed intentionally uses server-side database authority and revoked browser-role grants for these areas. A direct privilege audit across tables in `public`, `wewed_communications` and `wewed_admin` found no table granting `anon` or `authenticated` SELECT/INSERT/UPDATE/DELETE.

Therefore the generic RLS warning is retained as a structural hardening advisory, not treated as proof of a current browser-role data exposure. Do not enable RLS indiscriminately: doing so without matching policies can block legitimate server workflows.

### 2. Vault storage bucket absent before first upload — intentional lazy initialization

Production currently has no `wewed-vault` bucket and no Vault objects. This is expected before the first file upload. `prepareVaultUpload` calls `ensurePrivateVaultBucket`, which creates `wewed-vault` only when required with `public: false` and the 25 MB Vault limit.

The source test is strengthened in this branch so future changes must preserve private lazy bucket initialization and must not replace it with public URLs.

### 3. Provider identity helper functions — hardening required

Supabase security advisors identified mutable `search_path` on:

- `wewed_admin.normalize_provider_identity(text)`;
- `wewed_admin.provider_identity_requires_review(text,text)`.

Both functions are `SECURITY INVOKER` rather than `SECURITY DEFINER`, and `anon`/`authenticated` already lack `USAGE` on `wewed_admin`, so this was not an immediate privilege-escalation path. However both inherited `PUBLIC` execute and had no fixed lookup path.

This branch adds a canonical migration that recreates the same function semantics with `SET search_path = pg_catalog, wewed_admin` and revokes function execution from `PUBLIC`, `anon` and `authenticated`. A real-PostgreSQL CI contract verifies that both helpers exist, have a fixed hardened lookup path and do not grant PUBLIC execute.

### 4. Supabase leaked-password protection — platform security advisory

Supabase reports leaked-password protection as disabled. This does not alter Planner worksheet data semantics and is not a code regression introduced by this release, but it remains a platform-security improvement to enable through the Auth configuration when the account/security rollout is scheduled. It must not be misreported as fixed by repository code.

## Release qualification rule

Do not start manual UAT from this hardening branch or merge it merely because the changes are small.

Before UAT resumes:

1. the exact PR head must pass the full Wewed pull-request workflow matrix;
2. the complete Prisma migration chain must apply on clean PostgreSQL with no drift;
3. the new provider-function PostgreSQL security contract must pass;
4. the strengthened Vault source/security contract must pass;
5. the full executable Planner browser release gate, including Task Test 11, must pass;
6. the exact-head Vercel preview must be READY;
7. the provider hardening migration must be applied through the controlled Supabase production migration authority and physically reverified;
8. the merged Production deployment must be READY and runtime-clean;
9. no unrelated open PR should be merged into `main` during the manual UAT sequence unless it is intentionally requalified as part of the UAT baseline.

After those conditions are satisfied, Task Test 11 manual retest is the first UAT checkpoint.
