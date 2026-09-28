# Wewed Production Authority Contract — V1

**Contract:** `WewedProductionAuthorityV1` (version `1`)
**Master plan:** `WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01`, **Phase 2 — Define the shared production authority contract**
**Status:** Implemented on branches, with the Phase 2 review closure applied (§9); awaiting independent Rule-10 review. Not deployed. Not wired into any client.

This document specifies one contract under the master plan. It is not a competing architecture: where they differ, the master plan wins (§3 Rules 1–6, §7, D-002, D-003, D-005).

| Artefact | Location |
| --- | --- |
| Server types | `src/lib/production-authority/contract.ts` (branch `backend/shared-production-authority-phase2-20260922`) |
| Grant rules (pure) | `src/lib/production-authority/grants.ts` |
| Read-only resolver | `src/lib/production-authority/resolver.ts` — `resolveProductionAuthority(accessUserId, { authUserId })` |
| Tests | `grants.test.ts` (pure rules and the shared fixture); `production-authority.integration.test.ts` (disposable local PostgreSQL matrix and PWA comparison) |
| Shared fixture | `mobile/fixtures/production-authority-v1/multi-axis-actor.json` — produced by the server builder, decoded by Android and iOS |
| Native DTOs and mapper | branch `native-mobile/shared-production-authority-phase2-20260922`: Android `navigation/ProductionAuthority.kt`; iOS `Navigation/ProductionAuthority.swift` |

---

## 1. Principle

Authority is multi-axis. No single string decides what a person may open.

```text
identity
  + account/dashboard class          (User.role — free text; DashboardRole in the PWA)
  + BusinessAccount memberships      (wewed_admin.BusinessAccountMember — free-text role)
  + WeddingMemberships               (owner | planner | coordinator | viewer)
  + business links                   (BusinessAccountLink: wedding | couple | vendor | user)
  + vendor/service relationships     (BusinessAccountLink(vendor) → Vendor → ServiceEngagement)
  + platform-admin membership        (wewed_internal membership + PlatformAdministrator registry)
  = evidence
        ↓  explicit server rules (grants.ts)
workspace grants
        ↓  later: native context selection (Phase 5)
ActorAssignment / NavigationContext
```

The contract carries **both** layers: every axis as evidence, and normalised grants derived from them. Clients map grants. They never interpret raw role strings, and never call `AppRole.fromId` on server data.

## 2. The axes (evidence)

| Axis | Contract field | Source | Notes |
| --- | --- | --- | --- |
| Identity | `identity` | `public."User"`, `public."UserProfile"` | `accountStatus` is `authorized` only for an active access user **with a verified `authUserId` supplied by the caller**, whose UserProfile (if a row exists) is not banned. Anything else carries **no grants** (§9.2). |
| Dashboard/account class | `identity.dashboardClass`, `isDashboardClass` | `User.role` | Exactly as stored, including `viewer`. **Never a grant by itself.** |
| Business membership | `businessMemberships[]` | `BusinessAccountMember` ⋈ `BusinessAccount` (via the `public` security-invoker views) | Every membership in any status, with business type, status, `onboardingStatus`, `subscriptionStatus`, owner, role and permissions. No `LIMIT 1`. |
| Business links | `businessLinks[]` | `BusinessAccountLink` for businesses with an active membership | Raw `entityType` / `entityId` / `relationship`. |
| Wedding membership | `weddingMemberships[]` | `WeddingMembership` ⋈ `Wedding` | Every membership with role, status, `governedAccess` and resolved permissions. `governedAccess` is evaluated with the PWA's own `GOVERNED_WEDDING_ACCESS` SQL; permissions come from the PWA's own `resolveWeddingPermissions`. |
| Operational (vendor) | `vendorEngagements[]` | `BusinessAccountLink(entityType='vendor')` → `Vendor` → `ServiceEngagement` (same `vendorId` + `weddingId`) | Real engagements only, with `lifecycleStatus` / `origin` / `recordMode`. |
| Platform | `platform` | wewed_internal memberships, and `wewed_admin."PlatformAdministrator"` with its scopes | Exact internal roles (`internalMemberships[].role`) plus the registry state. `effectiveRole` / `effectiveSource` mirror `requireWewedAdmin`. Never reduced to `isAdmin: true`. |
| Onboarding/account | `onboarding` | Stored dimensions only | `userActive`, `profileBanned`, per-business `onboardingStatus` / `status` / `subscriptionStatus` / membership status, and invited wedding memberships. **No invented aggregate onboarding enum.** |

## 3. Workspace grants

```text
WorkspaceGrant {
  grantId, workspaceKind, scopeKind,
  weddingId?, weddingTitle?, coupleId?, businessAccountId?, vendorId?,
  serviceEngagementIds[], permissions[], platformRoles[], sources[]
}
```

- `workspaceKind` ∈ `couple | planner | coordinator | vendor | admin`. Not `guest`, not `usher`.
- `scopeKind` ∈ `wedding | portfolio | business | system`.
- `grantId` is deterministic: `couple:wedding:<weddingId>`, `planner:portfolio:<businessAccountId>`, `vendor:wedding:<businessAccountId>:<vendorId>`, `admin:system`.

### 3.1 Grant rules

| Kind / scope | Issued when | PWA rule mirrored |
| --- | --- | --- |
| `couple` / `wedding` | active `WeddingMembership.role = owner` that passes governed access | `listAccessibleWeddings` (owners are always governed). **Never** from `User.role = couple`, never from a `couple_owner` business row. |
| `planner` / `wedding` | active `WeddingMembership.role = planner` that passes governed access | `listAccessibleWeddings` + `GOVERNED_WEDDING_ACCESS` |
| `planner` / `portfolio` | active membership, role `business_owner` or `planner`, in an **active, onboarding-complete `planning_company`** | Business-level planner authority. One grant per business, **never a placeholder wedding**. |
| `coordinator` / `wedding` | active `WeddingMembership.role = coordinator` that passes governed access | `listAccessibleWeddings`. Independent of `User.role`: a coordinator is typically `User.role = planner`. |
| `vendor` / `business` | active membership, role `business_owner` or `vendor_manager`, in an active, complete `vendor` business with a `claimed`/`verified`, `published`, non-claimable ProviderProfile | `activeVendorIdentity` in `/api/auth/me` — but **every** qualifying business, not `LIMIT 1`. |
| `vendor` / `wedding` | a `vendor` business grant **plus** `BusinessAccountLink(entityType='vendor', relationship='represents')` → `Vendor(weddingId)`, for that same business (§9.1) | Engagement ids are the real `ServiceEngagement`s for that Vendor on that wedding. An empty list means none exist. Nothing is invented or auto-selected. |
| `admin` / `system` | `User.role = admin` **and** the platform entry gate (active wewed_internal membership with a `wewed_*` role) **and** an effective membership (active registry row, or with no registry row the highest active legacy role; an inactive registry row denies) **and** an effective role in `WEWED_INTERNAL_ADMIN_ROLES` (§9.3) | `isWewedPlatformAdministrator` + `requireWewedAdmin`. `platformRoles` carries the exact effective role. |

### 3.2 Relationships that grant nothing (reported in `nonGrantingRelationships`)

- `viewer_relationship` — `viewer`, and any unrecognised wedding role.
- `membership_not_active` — invited, suspended or revoked, on either axis.
- `wedding_access_not_governed` — fails `GOVERNED_WEDDING_ACCESS`, as in the PWA.
- `business_not_active_or_incomplete`
- `business_role_not_workspace` — e.g. `coordinator` or `viewer` inside a business.
- `business_type_not_workspace` — `couple`, `client`, `venue` and unknown types.
- `provider_profile_not_published`
- `vendor_link_relationship_not_recognised`
- `platform_membership_not_effective`
- `legacy_global_admin_wedding_access` — see §6.

### 3.3 Context selection

`contextSelection[]` lists the grant ids per workspace kind, with `selectionRequired = true` when there is more than one. The contract **never** selects a wedding, business or engagement on the person's behalf. `/api/auth/me` does select one; see §6.

## 4. Exclusions

- **Guest** — invitation-bound identity on Guest Session v2 (D-002). Declared in `unsupported[]`, never granted, and rejected by the native account mapper.
- **Usher/Gate** — no production authority exists until Phase 10. Declared in `unsupported[]`, never inferred from coordinator, planner or admin, and rejected by the native mapper.

## 5. Native mapping rules (Phase 2: pure, not activated)

1. Decode `WewedProductionAuthorityV1`. An unknown `workspaceKind` or `scopeKind` decodes to an explicit `Unknown` value, and the mapper denies it.
2. **Available grants ≠ active assignment.** Grants are the server's list of possibilities. An `ActorAssignment` exists only for the ONE grant the person has selected.
3. `PRODUCTION` mapping, from the explicit grant kind only (never `AppRole.fromId(serverRole)`):

| Grant | ActorAssignment |
| --- | --- |
| couple / wedding | `COUPLE`, weddingId |
| planner / wedding | `PLANNER`, weddingId |
| coordinator / wedding | `COORDINATOR`, weddingId |
| vendor / wedding | `VENDOR`, weddingId, vendorId; engagementId only when the selection names one of the grant's real engagements, or exactly one exists |
| admin / system | `ADMIN`, weddingId = nil (system scope) |
| planner / portfolio | **none yet.** Stays a portfolio grant until a real wedding is selected. `NavigationContext` keeps its required wedding scope. |
| vendor / business | **none yet.** Stays a business grant until a real wedding is selected. |
| viewer, guest, usher, unknown | **denied** |

4. The account is refused entirely unless `contract == WewedProductionAuthorityV1`, `version == 1` and `accountStatus == authorized`. Every other status fails closed automatically, including `unverified_auth_identity` and any future status.
5. Nothing in `SessionViewModel` / `SessionStore` / `ActorAssignmentSources` / `NativeRepositoryFactory` / `RootScreen` / `RootView` uses these types yet. Activation is Phase 5.

## 6. PWA compatibility

- No PWA behaviour changed. The only edits to existing files add `export` to `GOVERNED_WEDDING_ACCESS`, `BUSINESS_TEAM_MANAGEMENT_ACCESS` and `resolveWeddingPermissions` (wedding-access.ts), and add the `WEWED_INTERNAL_ADMIN_ROLES` constant (business-access.ts). `/api/auth/me` is untouched.
- The comparison tests assert agreement on:
  - accessible weddings, roles, statuses and permissions (`listAccessibleWeddings`);
  - platform-admin eligibility (`isWewedPlatformAdministrator`);
  - the vendor business `/api/auth/me` picks being among the contract's vendor grants;
  - planner-portfolio agreement;
  - coordinator membership agreement;
  - platform-workspace agreement.
- **Intentional differences**, which serve different purposes:

| Topic | `/api/auth/me` | Authority contract |
| --- | --- | --- |
| Selection | selects ONE current workspace and writes `currentWeddingId` | enumerates every legitimate grant; selects nothing; writes nothing |
| Pending memberships | accepts them (`acceptPendingMemberships`) | reports them as `invited`; grants nothing |
| Vendor | `LIMIT 1` business | every qualifying business |
| Planner portfolio | any `planner`-class user with zero active weddings | requires an active, complete planning-company membership (stricter; no business, no portfolio grant) |
| `User.role = admin` without the platform gate | opens **every** wedding as a synthesized `admin` membership | no grant; reported as `legacy_global_admin_wedding_access` (master plan §8.15) |

## 7. Transport handoff to Phase 5

Phase 2 ships **no endpoint**, and invents no bearer token, native password scheme, API key or Supabase bypass. `resolveProductionAuthority(accessUserId, { authUserId })` takes BOTH ids, which the caller has already verified through existing Wewed authority (the Supabase user bound to the AppSession, exactly as `/api/auth/me` verifies it). Without a verified `authUserId` it returns `unverified_auth_identity` with no grants. Phase 5 must decide how a native client obtains that verified identity, and must reuse this resolver rather than widen `/api/auth/me`.

## 8. Unresolved production-catalog assumptions (inputs to Phase 3)

These were verified only against the repository's migrations on a disposable database, never against production.

1. The physical location of `BusinessAccount` / `BusinessAccountMember` / `BusinessAccountLink` / `ProviderProfile`. The migrations move them to `wewed_admin`, with `public` security-invoker views that the PWA queries. The production views and grants must be confirmed.
2. The real `BusinessAccountMember.role` values (free text, no CHECK), and whether any production role outside the recognised sets exists.
3. The real `BusinessAccountMember.permissions` JSON shapes (arrays of strings are assumed).
4. The real `WeddingMembership.permissions` text shapes (a JSON string array or null is assumed).
5. `BusinessAccountLink.relationship` values in production, especially for `entityType='vendor'`: only the repository-sanctioned `represents` is recognised, and everything else, including the column default `owns`, fails closed. Also confirm `'manages'` for planning companies.
6. Vendor-link completeness: whether vendor businesses actually hold `BusinessAccountLink(vendor)` rows for their wedding Vendor records, or whether that work lives only in `wewed_booking."Booking".serviceEngagementId`.
7. ServiceEngagement completeness and `lifecycleStatus` values for vendor-selectable work.
8. How many users hold multiple business memberships, and of which types.
9. The `PlatformAdministrator` registry. Migrations sync it from wewed_internal memberships by trigger; production parity with legacy memberships must be confirmed.
10. `BusinessAccount.subscriptionStatus`. The column default `'inactive'` violates the later CHECK constraint, so explicit values are required on insert. The production state must be checked.
11. `UserProfile.id` equal to the Supabase auth user id, as `/api/auth/me` assumes.
12. Venue businesses. `/api/auth/me` excludes `venue` from the vendor workspace, while `providerBusinessForUser` (booking-commerce) includes it. The contract follows `/api/auth/me` and grants nothing for venue; the product decision is open.

## 9. Phase 2 review closure (Rule-10)

### 9.1 Canonical Vendor link semantics

Every repository path that writes `BusinessAccountLink` was enumerated:
- `prisma/migrations/20260730173000_wewed_business_admin_console`;
- admin onboarding;
- marketplace engagement authorisation;
- the two planner membership business-link writers;
- UAT scripts.

Exactly one path writes `entityType = 'vendor'`: the canonical backfill, which turns each wedding-scoped `Vendor` into a `vendor` business `vendor-<Vendor.id>` (active, complete) with:

| entityType | relationship | Meaning in the contract |
| --- | --- | --- |
| `vendor` | `represents` | **The** Vendor entity link. It produces the `vendor/wedding` grant when the business also holds a `vendor/business` grant. |
| `wedding` | `serves` | Companion evidence only. It is not a substitute for the Vendor entity link and grants nothing on its own. |

`RECOGNISED_VENDOR_LINK_RELATIONSHIPS = {represents}`. The column default `owns` is written by no repository path for vendor links, and it fails closed with every other value (`vendor_link_relationship_not_recognised`). A link is only ever evaluated for the business that holds it: Business A's link never grants Business B.

The backfill creates no member users and no ProviderProfile. A canonical Vendor therefore receives grants once its business also has an operating member (`business_owner` / `vendor_manager`) and a claimed/verified, published listing, the same eligibility as `/api/auth/me`.

### 9.2 Verified auth identity and banned profiles

Mirrors `/api/auth/me`, which verifies the Supabase identity, binds it to the AppSession's access user, and enforces `UserProfile.isBanned`:

| Situation | `accountStatus` | Grants |
| --- | --- | --- |
| unknown `accessUserId` | `unknown_identity` | none |
| inactive `User` | `inactive_identity` | none |
| active `User`, `authUserId` missing or blank | `unverified_auth_identity` | none |
| verified `authUserId`, `UserProfile.isBanned = true` | `banned_identity` | none |
| verified `authUserId`, no `UserProfile` row | `authorized` | normal |
| verified `authUserId`, profile not banned | `authorized` | normal |

A missing UserProfile row never blocks an otherwise valid account. The native mappers accept only `authorized`.

**Fail-closed disclosure rule:** any non-`authorized` result is status-only for authority purposes. It carries no identity PII, business memberships/links, wedding memberships, vendor engagements, internal platform memberships, or onboarding relationship lists. This prevents a future transport bug or an unverified resolver call from turning “no grants” into an account-relationship data leak.

### 9.3 Admin defense-in-depth

The `admin/system` grant additionally requires the effective role (registry or legacy) to be one of `WEWED_INTERNAL_ADMIN_ROLES`. The database CHECK constrains `PlatformAdministrator.role` to that set today; the contract re-checks it so that schema drift discovered in Phase 3 cannot widen admin authority. PWA admin behaviour is unchanged.
