# WEWED NATIVE + PWA PRODUCTION CONVERGENCE MASTER PLAN

**Plan ID:** WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01  
**Status:** LOCKED — AUTHORITATIVE IMPLEMENTATION PLAN  
**Date:** 2026-09-22  
**Peer review date:** 2026-09-22  
**Reviewer:** Claude Code (Opus 5), independent repository peer review against remote refs — see §2.1  
**Verified repository SHAs:** identical to the §2 baseline table (re-fetched and re-verified at review time; plan commit 121b4071bdcfe21a3541d50deee72689970c03d2)  
**Accepted corrections:** C-1 … C-8 and hazard additions §8.8 … §8.13, recorded in §2.1. None changes the architecture, phase order or any invariant.  
**Scope:** Wewed PWA, Android, iOS, backend APIs, production database, invitation/Guest identity, stakeholder authority, Wedding Day/WW2, release infrastructure, and production qualification.
**Implementation governance:** `docs/WEWED_IMPLEMENTATION_GOVERNANCE.md` (repository execution rules; future agents must read it with this plan).

---

## 1. Purpose

This plan defines the single controlled path for finishing Wewed native Android/iOS while preserving and converging with the working PWA.

The target is **one Wewed platform**:

~~~text
Wewed production database
        ↓
shared server authority and business rules
        ↓
PWA APIs / mobile-safe API adapters / new shared security domains
        ↓
PWA + Android + iOS
~~~

The native apps are not a second Wewed. The PWA is not automatically authoritative when newer security/product contracts have superseded it. The database is not redesigned around one test wedding. Existing test accounts are acceptance probes, not architecture.

This plan combines two independent forensic reviews of the repository and fixes the central ambiguity they exposed:

> Mature PWA/server business domains should be reused. Newer Guest Session v2, invitation-entry, invitation-bound Guest identity, native context isolation, and WW2 Wedding Pass contracts must be preserved and promoted into the shared Wewed authority. Missing domains such as production Usher/Gate authority must be added deliberately rather than fabricated in native state.

No phase may be skipped without updating this document and recording the reason.

---

## 2. Verified baseline at plan creation

Remote state verified before this plan was written:

| Branch | SHA |
| --- | --- |
| main | ba4b08f8bca2d5cd5826e1ef1d2701d9049dd887 |
| native-mobile/guest-profile-invitation-20260921 | d7c4dddeabb594810a5833b4ac24d356883a8a3b |
| backend/guest-session-v2-promotion-20260921 | d1efffb251c96694c7add9110b5b0d51691e9f2a |
| backend/wedding-day-ww2-promotion-20260921 | 9fdf4bcd71cb41eebcc3f806d3a193c8ddc19e5d |
| native-mobile/integration | b55b6e5062b1a84c0dee755a2b9fb3326e24a1b5 |
| native-mobile/role-architecture-p0-20260919 | ac44acc1cde26b5036d9fc86353f131a8049c3ad |

Production currently runs main, not the Guest Session v2 or Wedding Day branches.

At this baseline:

- production Guest Session is v1 and embeds the RSVP token;
- production Wedding Day/WW2 endpoints are not deployed;
- the full native production repository is intentionally disabled on Android/iOS;
- production native Guest-only invitation flow exists;
- full production Couple/Planner/Vendor/Coordinator/Admin native workspaces do not;
- iOS AASA is not production-ready;
- Android assetlinks is present;
- Wewed production database catalog has not yet been authoritatively inspected from the current tooling environment.

### 2.1 Peer review record (2026-09-22)

Every foundation below was re-verified against the remote refs in §2 (read-only; `git show` / `git grep` on the refs, no production system touched).

| Claim | Verdict | Evidence |
| --- | --- | --- |
| AppRole fail-open | CONFIRMED, both platforms | Android `models/RoleWorkspaceModels.kt` `fromId … ?: COUPLE`; iOS `Models/RoleWorkspaceModels.swift` `from(roleId:) … ?? .couple` |
| Hardcoded production SessionState / SessionStore | CONFIRMED, both platforms | Android `state/SessionState.kt` defaults role COUPLE, name "Charity & Kudzie", persona `couple_owner`, wedding `cmqos70cb0004q6vxe9g9aiu5`; iOS `App/SessionStore.swift` defaults role `.couple`, same wedding id/title |
| EnvironmentWeddingDirectory production hardcoding | CONFIRMED, both platforms | `PRODUCTION` and `PRODUCTION_READ_VERIFY` → `cmqos70cb0004q6vxe9g9aiu5` |
| DevelopmentPersona / AuthorizedScenario reachability | CONFIRMED compiled into release; guarded only by environment checks | persona switching gated by `allowsDevelopmentPersonaSwitching`; the factory refuses mutable environments under `pro.wewed.app` |
| Production NativeRepositoryFactory disabled | CONFIRMED, both platforms | factory throws `ProductionDisabled`; iOS `NativeEnvironmentGuard` also rejects `.production` |
| Guest-only production path | CONFIRMED, both platforms | Android `MainActivity` → `GuestOnlyInvitationShell`; iOS `AppLaunchModeResolver` → `.guestOnly` → `GuestOnlyInvitationShellView` |
| Guest Session v1 vs v2 | CONFIRMED | main `src/lib/wedding-guest-session.ts` v1 payload carries `rsvpToken`, fixed 7-day TTL; v2 branch removes it, fingerprints the invitation, bounds expiry (30-day min, wedding + 90 days, 400-day cap), requires a dedicated `WEWED_SESSION_SECRET` in production, keeps v1 reads |
| Digital Invitation authority | CONFIRMED | `Wedding.invitationCardStyle` / `invitationCardMessage` + DB CHECK; registry `src/lib/digital-invitation-card.ts` |
| Returning Guest behaviour | CONFIRMED | both Guest shells: explicit link → splash → card; icon relaunch → Guest Home |
| Legacy vs modern onboarding | CONFIRMED (see C-7) | `src/app/api/onboarding/route.ts` ungated, local scrypt password, `privacy: "public"`, no Supabase / BusinessAccount / WeddingMembership |
| Three-axis role structure | CONFIRMED (see C-2, C-3, C-4) | `DashboardRole`; `WeddingMembership.role`; `wewed_admin."BusinessAccountMember".role` |
| Coordinator authority | CONFIRMED | `api/weddings/members` accepts `coordinator`; admin onboarding grants planner/coordinator membership |
| Absence of production Usher/Gate authority | CONFIRMED | no usher/gate literal, model or route in `src/` or `prisma/`; check-in is `RSVP.checkedIn` only |
| PWA Wedding Pass vs WW2 | CONFIRMED (see C-5) | main pass dialog is presentation only (a decorative QR icon, not a credential); WW2 P-256 exists only on the WW2 branch |
| Single-tenant PWA remnants | CONFIRMED, list extended (see §8.5) | `src/app/page.tsx` RSVP fallback to `charity-and-kudzie`; `api/comments` hardcoded slug; `FLAGSHIP_SLUG` in contributions + royalty routes |
| Wedding Day migration branch state | CONFIRMED | WW2 branch not merged, 12 commits ahead of main, contains all 7 Guest Session v2 commits |

Accepted corrections (factual precision only):

- **C-1 (§5.2).** v1 already fails closed on rotation, because the RSVP is looked up by the embedded token (`wedding-public-access.ts`). What v2 adds is removing the raw token, bounded wedding-aware expiry, and a dedicated secret that is mandatory in production. main already reads `WEWED_SESSION_SECRET`, but falls back to the service-role key.
- **C-2 (§7.3).** `BusinessAccountMember` is not in `prisma/schema.prisma`. It exists only in raw SQL (`wewed_admin` schema, migration `20260730173000`). `role` is free TEXT: default `member`, no CHECK. Observed values:
  - `business_owner`, `planner`, `coordinator`, `couple_owner`, `venue_manager`, `vendor_manager`, `viewer`, `billing_manager`;
  - five `wewed_*` internal roles.
- **C-3 (§7.1).** `User.role` / `UserProfile.role` are free-text columns, default `viewer`. The account class is the TS union `DashboardRole = admin | couple | planner | vendor`, and `viewer` is outside it. `PlatformAdministrator` has its own `wewed_*` role set.
- **C-4 (§7.2).** WeddingMembership `admin` is synthesized in code for global admins and never stored. Stored values: `owner | planner | coordinator | viewer`.
- **C-5 (§5.3, §8.7, Phase 11).**
  - The WW2 tables exist only as review SQL in `docs/native-mobile/migration-review/*.sql` on the WW2 branch. `schema.prisma` has no WW2 models on any branch.
  - The main pass dialog does not render a guest id/token QR.
  - Merging the WW2 branch also lands Guest Session v2, so the two promotions cannot be separated by merging the branch as-is.
- **C-6 (§2).** There is no committed AASA file. `src/app/.well-known/apple-app-site-association/route.ts` returns 404 unless `WEWED_APPLE_APPLICATION_IDENTIFIER_PREFIX` is a valid 10-character prefix: fail closed, and consistent with "not production-ready".
- **C-7 (§8.4).** In the modern path, Supabase identity is created by `/api/auth/register`. `/api/admin/onboarding` (admin-gated) then grants WeddingMembership, BusinessAccountLink and the `couple_owner` BAM role.
- **C-8 (§11, Phase 1 baseline).** The native Phase 1 baseline is `native-mobile/guest-profile-invitation-20260921`. `native-mobile/role-architecture-p0-20260919` has 8 unmerged commits: a divergent `RoleGrant` / role-shell rewrite. It contains none of the Phase 1 targets (`ActorAssignment`, `DevelopmentPersona`, `AuthorizedScenario`, `EnvironmentWeddingDirectory`, Guest shells), so it is not an implementation base. Its ideas may be mined in Phase 2, but it must not be merged wholesale.

Unresolved questions (listed, not guessed): the real production DB identity and application DB role (Phase 3); the production `WEWED_SESSION_SECRET` state (Phase 4); the Apple Team / Application Identifier Prefix (Phase 13).

---

## 3. Program constitution — rules that cannot be silently overridden

### Rule 1 — One authority, multiple clients

Business truth belongs in the production database and shared server/domain layer. PWA and native are clients.

Do not create native-only copies of:
- planner access rules;
- vendor business rules;
- wedding membership rules;
- guest eligibility rules;
- invitation design selection;
- RSVP authority;
- admin authority;
- contract/contribution/budget/task truth.

### Rule 2 — Newer security contracts override weaker legacy behavior

Where newer reviewed work deliberately hardens an older PWA contract, the newer contract is the target shared authority.

Explicit examples:
- Guest Session v2 supersedes Guest Session v1.
- Saved invitation style supersedes stale card query parameters.
- invitation-bound Guest identity remains separate from User/UserProfile/WeddingMembership.
- WW2 supersedes the PWA's presentation-only "Wedding Pass" as admission authority.
- cross-wedding database constraints supersede client-side assumptions.

### Rule 3 — Do not flatten roles

Wewed has multiple authority axes:

~~~text
account/global class
+
BusinessAccount membership
+
WeddingMembership
+
operational assignment
+
active context
~~~

A single role string must not replace these relationships.

### Rule 4 — Fail closed

Unknown role, missing assignment, stale session, invalid invitation, wrong wedding, wrong engagement, wrong gate, or unknown context means **deny / no assignment**, never a fallback to Couple, Admin, Guest, or a test persona.

### Rule 5 — No production fabrication

Production UI must never invent:
- names;
- weddings;
- vendors;
- engagements;
- roles;
- tables;
- tasks;
- counts;
- balances;
- programme items;
- gates;
- credentials.

Missing data is shown as missing/unsupported, not filled with fixture content.

### Rule 6 — Test accounts are probes, not architecture

Eleven Eleven Testing, Charity & Kudzie, Shadreck, known vendors, Admin test users and other controlled accounts may prove the system, but no production rule may identify them by name/id as a functional shortcut.

### Rule 7 — No migration before production catalog proof

Any schema migration requires:
1. positive identification of the real Wewed production database;
2. read-only catalog comparison;
3. production application DB-role identification;
4. production-shaped disposable migration rehearsal;
5. backup/rollback readiness;
6. explicit approval.

### Rule 8 — PWA regression is a release blocker

A shared backend change that breaks the working PWA is not acceptable merely because native works.

### Rule 9 — Native regression is also a release blocker

A PWA-compatible change that weakens Guest Session v2, native invitation sequencing, Guest isolation, WW2 security, or context isolation is not acceptable.

### Rule 10 — Independent verification closes every phase

Every implementation phase follows:

~~~text
agent implementation
→ independent code review of actual remote code
→ reviewer patches any discovered gap
→ tests rerun
→ phase accepted
→ next task issued
~~~

Agent self-report alone never closes a gate.

---

## 4. Authority precedence

When two generations of code disagree, use this order:

1. **Database integrity and persisted relationships**
2. **Shared server/domain authorization**
3. **Explicitly approved newer security/product contracts**
4. **PWA and native API contracts**
5. **PWA/native presentation**
6. **Shadow / fixtures / development personas**

Shadow data can prove behavior but can never define production authority.

---

## 5. Domain authority map

### 5.1 Mature domains to reuse

| Domain | Primary authority | Native strategy |
| --- | --- | --- |
| Account identity | Supabase + User/UserProfile | consume shared account authority |
| Couple/Wedding | Couple, Wedding | adapter/API only |
| Wedding access | WeddingMembership + wedding-access.ts | reuse |
| Planner portfolio | WeddingMembership + planner services | reuse |
| Planner tasks | PlannerTask | reuse |
| Budget | BudgetItem and related financial domain | reuse |
| Seating | SeatingTable + Guest | reuse |
| Vendor business identity | BusinessAccount, BusinessAccountMember, ProviderProfile | reuse |
| Vendor wedding work | Vendor + ServiceEngagement | resolve explicitly |
| Admin | Wewed internal business membership + admin services | reuse |
| Contracts/documents | existing contract/vault domain | reuse |
| Contributions | existing contribution domain | reuse |
| Wedding content | WeddingContent and content services | reuse |
| Programme | ProgrammeItem | reuse/project into Wedding Day |
| Notifications/messages | existing server domain | reuse |
| Invitation configuration | Wedding invitation fields + digital-invitation-card registry | reuse |
| RSVP | Guest + RSVP | reuse shared authority |

### 5.2 Shared domains that must be upgraded

| Domain | Current production | Target |
| --- | --- | --- |
| Guest remembered session | v1 with raw RSVP token | Guest Session v2 |
| Guest session expiry | fixed legacy lifetime | wedding-aware bounded v2 |
| invitation rotation | weaker v1 behavior | fingerprint invalidation |
| Guest profile | partial PWA projection | shared Guest authority consumed by native/PWA |
| native invitation entry | production Guest shell | preserve and reconcile routing contracts |

### 5.3 Genuinely additive domains

| Domain | Status |
| --- | --- |
| WW2 cryptographic pass | new backend/native domain |
| WeddingPassCredential / WeddingPassKey | proposed migration |
| immutable revocation/reissue lifecycle | new |
| offline P-256 verification | new |
| operational gate authority | missing |
| explicit Usher → Gate assignment | missing |
| Wedding Day check-in authority | partial; requires safe operator scope |

---

## 6. Non-negotiable Guest/invitation invariants

### 6.1 Identity

A private invitation is both:
- the wedding invitation;
- the onboarding credential for an invitation-bound Guest identity.

A Guest is not automatically a User, UserProfile or WeddingMembership.

### 6.2 Explicit invitation entry

Required production sequence:

~~~text
private invitation link
→ OS/native handoff
→ Wewed animated splash
→ credential validation/exchange
→ configured saved Digital Invitation FIRST
→ RSVP / invitation actions
→ Guest experience
~~~

No sign-in first.  
No Home first.  
No generic fallback invitation.  
No raw token persistence.

### 6.3 Returning Guest

The currently qualified production contract is:

~~~text
ordinary app icon
→ validate remembered Guest session
→ Guest Home
→ My Digital Invitation remains first-class and reopens the same saved card
~~~

Stale policies/comments that say every ordinary relaunch must replay the card must be reconciled before enabling the full production workspace.

### 6.4 RSVP capabilities

Guest identity exists before RSVP.

- pending: invitation/profile/wedding info; no pass;
- attending: attendee capabilities and pass when server authority exists;
- declined: identity/invitation retained; no pass/check-in.

Native must ultimately support the full server RSVP model, not only attending/dietary/message.

### 6.5 Guest replacement

A valid Guest B may replace Guest A only after B validates.

Invalid B must never expose A's card/data. The exact fail-closed replacement semantics must remain consistent on Android and iOS and be pinned by tests.

---

## 7. Account and stakeholder authority model

The production model must preserve distinct authority axes.

### 7.1 Account/global class

Current AppSession-level classes include:
- admin;
- couple;
- planner;
- vendor.

These identify broad workspace families, not complete operational authority.

### 7.2 Wedding relationship

WeddingMembership supplies wedding-specific relationship such as:
- owner;
- planner;
- coordinator;
- viewer;
- future sanctioned operational roles.

### 7.3 Business relationship

BusinessAccountMember supplies business membership such as:
- business owner;
- planner/coordinator;
- vendor/venue manager;
- couple owner;
- viewer;
- Wewed internal roles.

### 7.4 Operational relationship

Some operations need additional scope:
- Vendor → ServiceEngagement;
- Usher → Gate;
- check-in operator → permitted wedding/gate.

These must be explicit server-authoritative grants.

### 7.5 Active context

Native navigation should represent:

~~~text
authenticated identity
→ authorized grants
→ chosen role/workspace
→ active wedding/business/engagement/gate
→ entitlements
→ repository/API scope
~~~

Changing wedding/context does not change identity.

---

## 8. Known contradictions and hazards to eliminate

These are explicit plan items, not optional cleanup.

### 8.1 AppRole fail-open

Native AppRole.fromId currently falls back to Couple for unknown roles. This can map viewer, owner, business_owner, vendor_manager, venue_manager or other server strings into a privileged Couple surface.

**Required:** nullable/explicit mapping; unknown means deny.

### 8.2 Hardcoded native production state

SessionState/SessionStore and EnvironmentWeddingDirectory contain Charity & Kudzie/test-era defaults and a single production wedding id.

**Required:** production defaults must be empty/unknown; test personas restricted to debug/Shadow.

### 8.3 Dead/stale routing policy

InvitationEntryPolicy/GuestCeremonialEntry/LaunchRouter contain contracts not all used by production Guest shell.

**Required:** trace actual call sites, choose one contract, remove or update dead policies/tests.

### 8.4 Legacy onboarding split

Legacy /api/onboarding directly creates a partial older graph and may set privacy public. Modern /register + /api/auth/register + admin onboarding creates Supabase identity, BusinessAccount relationships, WeddingMembership and modern authority.

**Required:** do not wire native to legacy onboarding. Reconcile/deprecate old path before native onboarding.

### 8.5 Single-tenant PWA remnants

Known examples include Charity & Kudzie-specific RSVP fallback and hardcoded flagship routes/comments/royalty code.

**Required:** classify each as live compatibility, dead legacy or defect. Native must never consume these as generalized authority.

Peer-review inventory on main (for Phase 12; not Phase 1 work):
- `src/app/page.tsx` RSVP fallback;
- `api/comments` `WEDDING_SLUG`;
- `FLAGSHIP_SLUG` in `api/contributions` and seven royalty routes (all `/api/royalty*` currently 404 via `src/proxy.ts`);
- `|| 'charity-and-kudzie'` defaults in `api/wedding` and `api/wedding-content`;
- `api/internal/bootstrap-physical-invitation` hardcoded slug;
- admin-dashboard greeting copy;
- preview/UAT invitation routes.

### 8.6 Seed posture

Any production-reachable seed route with insufficient admin gating must be audited and locked before full production integration.

Peer-review findings on main (for Phase 12):
- `POST /api/seed` has no in-handler authorization. The proxy admits any valid dashboard session (couple/planner/vendor), not admin only.
- `GET /api/internal/bootstrap-physical-invitation` is unauthenticated. It runs only when `VERCEL_ENV === 'production'` and mutates `QRDestination`. It is still present, although its comment says it would be removed after a one-time bootstrap.

### 8.7 PWA pass naming collision

The existing PWA Wedding Pass is a UI projection, not WW2 admission authority.

**Required:** rename/upgrade semantics when WW2 becomes shared, so clients cannot silently use the wrong contract.

### 8.8 Restored session grants a default role (added at peer review)

Android `SessionViewModel.restoreSession()` and iOS `SessionStore.restoreSession()` treat any stored token as authenticated and grant `[currentRole]`, which defaults to Couple.

**Required (Phase 1):** a restored token without resolved authority grants nothing.

### 8.9 Workspace root always uses Shadow authority, with a default-wedding fallback (added at peer review)

The workspace roots (Android `RootScreen`, iOS `RootView`) construct `ShadowActorAssignmentSource` unconditionally, whatever the environment. For non-system roles, a missing assignment falls back to the session's default wedding id/title. iOS additionally defaults the actor to `"couple_owner"`.

**Required (Phase 1):** the Shadow source is only selectable in development environments; production/verify resolve no assignment until Phase 5 supplies a production source. There is no wedding or actor fallback.

### 8.10 Release builds still read environment/persona launch inputs (added at peer review)

`NativeLaunchConfiguration` honours `wewed_native_env` (Android intent extra; iOS env/argument) in release builds. Today the only barrier is the `pro.wewed.app` identity check in the factory.

**Required (Phase 1):** a release build resolves to Production regardless of launch inputs.

### 8.11 Stale Guest entry contracts in shared routing (added at peer review)

- `InvitationEntryPolicy` has no production caller on either platform.
- The recognised-guest branch of `LaunchRouter` has no caller on either platform. iOS does not call `LaunchRouter` at all.
- `GuestCeremonialEntry.shouldPresentCard` ("card on every entry session") is used only by the Shadow workspace root. It contradicts the qualified §6.3 contract.

### 8.12 Workspace-root live Guest path diverges from the Guest shell (Phase 5 blocker, added at peer review)

When the general repository is enabled, Android `MainActivity` no longer uses `GuestOnlyInvitationShell`. Links are then handled by the workspace root's live-invitation branch, which shows the card but has no Guest Home, My Digital Invitation or Back to My Wedding. Continue falls through to Welcome.

**Required (before Phase 5 enables the workspace):** Guest entry stays on the Guest-shell authority, or the root delegates to it. The Phase 1 invariants must be re-proven.

### 8.13 Fabricated content in workspace screens (added at peer review)

Role-workspace screens contain literal Charity & Kudzie weddings, fabricated account e-mail/name fallbacks, and fixture business data. Some are wired into role shells; many are unreferenced. None is production-reachable today, but only because the production repository is disabled.

**Required:** production-reachable fabrication is removed or isolated in Phase 1. Field-level LIVE/EMPTY classification remains Phase 8.

### 8.14 RoleShell initial/safe-return authorization bypass (found in Phase 1 independent review)

- The workspace root could build a `NavigationContext` with `assignment = nil` and still compose a role workspace.
- The role shell rendered its initial destination directly, without `Entitlements.resolve`.
- A denial moved the selection to its safe return, so dismissing the notice exposed that destination's content without it ever being resolved.

**Closed (Phase 1 closure, 83ef10eed8ba896fb5f399101096ede36b8cad51, Android + iOS).** `RoleShellAuthorization` is composed only from `Entitlements.resolve`, `Entitlements.relationshipHolds` and `NavigationContext`; it is not a second authorization model.
- The root admits a workspace only with an assignment, every required scope, and a relationship that holds. A system Admin still needs a system-scope assignment.
- The initial destination resolves through Entitlements.
- A denial keeps the last authorized destination; dismissal returns only there, or stays at the boundary.

Awaiting independent review.

### 8.15 Legacy global-admin wedding access (found in Phase 2)

In the PWA, `listAccessibleWeddings` gives a `User.role = admin` who is NOT a Wewed platform administrator every wedding, as a synthesized `admin` membership. `/api/auth/me` then opens a wedding workspace for them. The dashboard class alone therefore reaches every wedding.

**Phase 2:** the authority contract grants nothing from this and reports it as `legacy_global_admin_wedding_access`.

**Required (Phase 12):** classify it as compatibility or defect, and remove or contain it. Native must never consume it.

### 8.16 Divergent vendor-eligibility rules in the PWA (found in Phase 2)

`/api/auth/me` (`activeVendorIdentity`) admits only `vendor`-type businesses, `business_owner` / `vendor_manager` members, and a claimed/verified, published, non-claimable ProviderProfile. `providerBusinessForUser` (booking-commerce) admits `vendor` or `venue` businesses with any active member role. Both use `LIMIT 1`.

**Phase 2:** the contract follows `/api/auth/me` but enumerates every business.

**Required:** reconcile before native vendor activation (Phase 5/8). Venue eligibility is an open product decision.

---

## 9. Database cleanliness policy

The production database must remain a coherent stakeholder relationship graph.

### Required invariants

- Guest belongs to exactly the intended Wedding.
- RSVP belongs to the intended Guest.
- seating relationships cannot cross weddings.
- Vendor/ServiceEngagement relationships cannot cross weddings.
- Wedding Day credentials cannot cross wedding, guest or pass-key boundaries.
- check-in cannot reference another guest's credential.
- historical credentials are revoked/superseded, not silently rewritten.
- audit evidence is not physically destroyed without deliberate retention policy.
- no synthetic test-only relationship is inserted into production to satisfy UI.

### Migration discipline

Every production migration requires:
- review-only SQL first;
- isolated PostgreSQL proof;
- catalog preflight;
- exact role/RLS proof;
- lock/timeout strategy;
- pre/post assertions;
- rollback rehearsal;
- feature flag off until postflight is green.

---

# 10. Sequential implementation plan

## PHASE 0 — Plan lock and baseline preservation

### Goal
Freeze the architecture and stop cross-branch drift.

### Work
- Review this plan with the second agent.
- Amend factual errors only.
- Change status to **LOCKED** after peer review.
- Stamp the accepted starting SHAs.
- No feature implementation in this phase.

### Exit gate
- both reviews reconciled;
- plan marked LOCKED;
- unresolved questions listed rather than guessed.

---

## PHASE 1 — Make native state honest and fail closed

### Goal
Ensure enabling future production connectivity cannot expose test defaults or privilege escalation.

### Required work
- remove Charity & Kudzie/default wedding/default Couple values from production SessionState/SessionStore;
- fix AppRole.fromId fail-open behavior;
- isolate DevelopmentPersona/AuthorizedScenario/EnvironmentWeddingDirectory to debug/Shadow where appropriate;
- reconcile dead/stale invitation routing policies with actual Guest shell behavior;
- preserve production Guest-only entry;
- audit hardcoded sample metrics/content in role workspaces;
- close the peer-review hazards that belong to this phase: §8.8, §8.9, §8.10, §8.11 and the production-reachable part of §8.13. §8.12 is recorded as a Phase 5 blocker.

### Must not do
- enable production full repository;
- change production database;
- change Guest Session v2 behavior.

### Tests
- unknown role denied;
- viewer cannot become Couple;
- production session begins empty;
- Shadow personas still work only in allowed environments;
- explicit Guest invitation sequence unchanged;
- returning Guest Home sequence unchanged.

### Exit gate
No production-reachable fabricated identity or fail-open role mapping.

---

## PHASE 2 — Define the shared production authority contract

### Goal
Expose real stakeholder grants without inventing a parallel identity system.

### Required work
Build a server contract that can answer:

~~~text
Who is this account?
Which global/account classes apply?
Which BusinessAccount memberships apply?
Which weddings are accessible and with what WeddingMembership role/permissions?
Which Vendor/ServiceEngagement contexts apply?
Which contexts require selection?
What onboarding state is authoritative?
~~~

Reuse /api/auth/me, wedding-access.ts, business-access.ts and existing services. Extract shared domain logic where necessary rather than copying it.

The response must retain distinct role axes. Do not send one lossy role string.

### Native work
- define production grant DTOs;
- map server grants into ActorAssignment/NavigationContext/Entitlements;
- unknown/unsupported relationship remains denied;
- Guest remains on Guest Session authority, not this account contract.

### Exit gate
Contract tests show PWA and mobile authority resolve the same real relationships.

---

## PHASE 3 — Global read-only production database audit

### Goal
Prove that the actual Wewed production catalog and data relationships can support the shared authority contract.

### Scope
Audit the global ecosystem, not one couple:

- User/UserProfile;
- Couple/Wedding/WeddingMembership;
- BusinessAccount/BusinessAccountMember/BusinessAccountLink;
- ProviderProfile;
- Vendor/ServiceEngagement;
- Guest/RSVP/SeatingTable;
- planner tasks/budget/contributions/contracts/vault;
- programme/content/messages/notifications;
- admin authority;
- coordinator authority;
- any existing usher-like production data;
- migration history/RLS/roles/grants.

### Safety
Read-only only. No Charity-specific mutation. No repair in place.

### Exit gate
- real DB positively identified;
- application DB role known;
- catalog matches or discrepancies documented;
- integrity defects quantified;
- no unexplained partial migration objects.

---

## PHASE 4 — Promote Guest Session v2 as shared authority

### Goal
Remove raw RSVP credentials from remembered Guest sessions before broad native production integration.

### Required work
- verify/configure dedicated WEWED_SESSION_SECRET;
- production-equivalent build/test;
- promote clean Guest Session v2 release branch;
- preserve v1 read compatibility for migration;
- verify rotation invalidation;
- verify wedding-aware expiry;
- verify PWA invitation/RSVP behavior remains correct;
- verify Android/iOS secure storage and no logging/leakage.

### Exit gate
Production PWA and native Guest paths can operate on Guest Session v2 with no raw RSVP token in v2.

---

## PHASE 5 — Connect account authentication and read-only native workspaces

### Goal
Enable Couple/Planner/Vendor/Coordinator/Admin to authenticate and read real scoped data without enabling writes prematurely.

### Required work
- production-safe native authentication using existing Wewed/Supabase authority;
- ProductionActorAssignmentSource on Android/iOS;
- no Shadow source in production;
- remove production wedding hardcoding;
- establish active context selection;
- wire read-only repositories/adapters for mature domains.

### First stakeholders
1. Couple;
2. Planner;
3. Coordinator;
4. Admin;
5. Vendor.

Vendor must resolve business identity and actual ServiceEngagement where wedding-specific work is shown.

### Exit gate
Real account authority, real context, no invented data, no cross-context leakage.

---

## PHASE 6 — Multi-role and multi-context isolation

### Goal
Prove Wewed is an ecosystem, not a single-wedding app.

### Required qualification
- Planner: Wedding A → B → C;
- user with multiple legitimate roles: role A → role B → back;
- Vendor: engagement A → B;
- Admin: system → wedding A → wedding B → system;
- Coordinator: assigned wedding only;
- Guest: no arbitrary wedding switching;
- Account A sign-out → Account B sign-in with zero cached A graph;
- wedding context switch clears engagement/gate/guest-specific state.

### Exit gate
Authority and caches remain correct across every switch.

---

## PHASE 7 — Reconcile onboarding before exposing native onboarding

### Goal
Make onboarding one coherent server workflow.

### Required work
- fully audit reachability of legacy /api/onboarding;
- preserve modern /register + /api/auth/register + admin onboarding authority;
- deprecate, redirect or modernize legacy onboarding;
- define onboarding states by stakeholder;
- expose native onboarding/status through server authority, not native-created rows.

### Stakeholder-specific expectations
- Guest: never account-onboarded for initial invitation use;
- Couple: approved account → Couple/Wedding/Membership graph;
- Planner: business account can exist with zero client weddings;
- Vendor/Venue: verification/claiming flow respected;
- Coordinator: relationship granted through sanctioned membership workflow.

### Exit gate
No native path can create a partial legacy account graph.

---

## PHASE 8 — Achieve feature parity for mature native workspaces

### Goal
Patch the remaining native screens to existing server data while keeping PWA behavior intact.

### Work by domain
- Planner: tasks, budget, seating, guests, timeline, vendors, contributions, contracts;
- Couple: same wedding planning data under Couple permissions;
- Vendor: portfolio + wedding-specific engagements;
- Coordinator: permitted wedding operational/planning views;
- Admin: system support/administration scope.

For each screen classify every field as:
- LIVE;
- DERIVED;
- EMPTY;
- UNSUPPORTED;
- TEST ONLY.

No hardcoded production values.

### Exit gate
Native is a real client of mature Wewed domains.

---

## PHASE 9 — Complete Digital Invitation + RSVP convergence

### Goal
Preserve the upgraded Guest journey while closing native/PWA capability differences.

### Required work
- maintain saved invitation style as authority;
- maintain explicit link → splash → card-first sequence;
- keep My Digital Invitation first-class;
- keep returning Guest Home behavior;
- bring native RSVP writes to the full supported server model:
  - attendance;
  - meal;
  - plus-one;
  - plus-one name/meal;
  - children/count;
  - adults-only rule;
  - dietary notes;
  - message;
- keep originGuestId stale-context protection;
- ensure PWA and native edit the same RSVP record.

### Exit gate
Same Guest record, same invitation design, same RSVP truth across PWA/Android/iOS.

---

## PHASE 10 — Design and add missing Usher/Gate authority

### Goal
Create the minimum production authority needed for safe gate operations.

### Existing facts
- WeddingMembership can technically store strings but current sanctioned routes do not establish production Usher scope;
- no authoritative Gate model exists;
- Shadow gate assignments are synthetic;
- free-text gateId is insufficient.

### Required design
Prefer a minimal explicit domain such as:

~~~text
WeddingGate
- id
- weddingId
- name/status

WeddingGateAssignment
- gateId
- weddingId
- userId or authorised operator identity
- role/capabilities
- active/revoked timestamps
~~~

Exact schema must follow production catalog review, not this example blindly.

### Requirements
- Usher A at Gate A cannot operate Gate B;
- revoked operator cannot check in;
- Admin support does not implicitly become gate operator;
- audit trail records operator/gate;
- no native-only assignment.

### Exit gate
Server can mint, revoke and enforce real operational grants.

---

## PHASE 11 — Wedding Day / WW2 production migration and activation

### Goal
Introduce cryptographic admission without duplicating mature data.

### Reuse
- ProgrammeItem for programme;
- Guest/RSVP/SeatingTable for identity/attendance/table;
- Wedding for date/venue;
- existing announcement/content models where sufficient.

### Add only where necessary
- WeddingPassKey;
- WeddingPassCredential;
- WeddingCheckIn;
- minimum additional Wedding Day records proven necessary.

### Migration gates
- hardened composite FKs;
- RESTRICT/audit-safe credential history;
- revocation/reissue tests;
- expiry cutoff tests;
- concurrency protection;
- production DB role/RLS proof;
- rollback rehearsal.

### Secrets
- P-256 WW2 signing key;
- root signing authority;
- key IDs;
- safe preflight;
- no private key logging.

### Activation
Feature flag remains off through migration/postflight. Enable only after signed end-to-end verification.

### Exit gate
Attending Guest gets real WW2 pass; pending/declined do not; authorized gate verifies/checks in; revoked token remains rejected.

---

## PHASE 12 — Remove/contain single-tenant and unsafe PWA remnants

### Goal
Ensure the PWA itself is safe as a multi-wedding shared platform.

### Explicit audit/remediation list
- Charity-specific root RSVP fallback;
- comments route hardcoded wedding;
- royalty/flagship routes;
- seed endpoint authorization;
- any other hardcoded wedding/account IDs;
- legacy demo/sample data paths.

Each is classified:
- required backward compatibility;
- safe to parameterize;
- safe to retire;
- production defect.

Backward compatibility must never become native authority.

### Exit gate
No mature shared API used by native is secretly single-tenant.

---

## PHASE 13 — Release identity and deep-link infrastructure

### Goal
Prove real signed native builds, not simulator/debug substitutes.

### Android
- actual Play identity/version state;
- production-signed AAB;
- assetlinks certificate match;
- direct Chrome App Link proof.

### iOS
- verified Apple Team/Application Identifier Prefix;
- correct AASA on wewed.pro;
- signed archive/TestFlight;
- direct Safari Universal Link proof.

### Both
Explicit private invitation must survive real browser → OS → native handoff with no raw-token persistence.

### Exit gate
Real distribution identities and real links proven.

---

## PHASE 14 — Full ecosystem UAT

### Goal
Prove Wewed as a relationship ecosystem across stakeholders.

### UAT matrix

#### Couple
- own wedding;
- planner collaboration;
- guests/invitations;
- budget/tasks/seating/vendor data.

#### Planner
- multiple client weddings;
- context switching;
- correct client isolation.

#### Vendor
- business portfolio;
- multiple engagements;
- contract/payment/document context isolation.

#### Coordinator
- assigned wedding access;
- no unauthorized wedding access.

#### Usher
- assigned gate only;
- offline/online pass verification;
- check-in audit.

#### Guest
- private invitation;
- Guest Session v2;
- Digital Invitation;
- RSVP;
- remembered Guest Home;
- Wedding Day;
- WW2 pass where attending.

#### Admin
- system scope;
- inspect/support multiple accounts;
- never implicitly inherits couple/vendor/usher authority.

### Known test accounts
Controlled existing accounts may be used as probes only after global authority is proven. No special-case code.

### Exit gate
All stakeholder paths pass on real production-shaped data with no cross-role/context leakage.

---

## PHASE 15 — Staged production rollout

### Goal
Promote in reversible increments.

Recommended order:
1. server/domain refactors with no behavior change;
2. Guest Session v2;
3. account read-only mobile authority;
4. native authenticated read-only workspaces;
5. controlled writes by mature domain;
6. onboarding;
7. Usher/Gate authority;
8. Wedding Day migration;
9. WW2 activation;
10. signed mobile release expansion.

Every promotion requires:
- production health check;
- PWA smoke;
- Android smoke;
- iOS smoke;
- rollback point.

---

## 11. Branch and promotion policy

Feature branches remain separate until their phase gate is satisfied.

Do not merge historical mixed branches merely because tests pass.

For production promotion:
- create clean release-candidate branches from current main;
- port only accepted final changes;
- compare diff against main;
- exclude unrelated build hacks/placeholders;
- run complete target qualification;
- merge only after independent review.

---

## 12. Test strategy

### Unit
- role mapping/fail-closed;
- context clearing;
- invitation parsing;
- Guest Session v2;
- fingerprint rotation;
- RSVP policy;
- WW2 signing/verifying;
- gate assignments.

### Contract
Same actor/data must produce equivalent authority for:
- PWA;
- mobile authority endpoint;
- Android;
- iOS.

### Integration
Use disposable/local PostgreSQL and synthetic multi-stakeholder graphs.

### Device UI
- Android connected instrumentation;
- iOS UI tests;
- signed release link tests.

### Production read-only probes
Allowed only after target identity is verified.

---

## 13. Production-readiness definition

Wewed is not production-complete for native until all are true:

### Shared authority
- no hardcoded production actor/wedding defaults;
- no fail-open role mapping;
- production ActorAssignmentSource live;
- multi-role/multi-wedding context proven.

### Guest
- Guest Session v2 live;
- raw RSVP absent from v2;
- explicit invitation card-first;
- returning Guest Home;
- full RSVP parity;
- Guest identity isolated.

### Stakeholders
- Couple/Planner/Vendor/Coordinator/Admin connected to real authority;
- Usher/Gate has real server authority.

### Database
- real catalog inspected;
- integrity clean or exceptions resolved;
- Wedding Day migration reviewed/rehearsed/applied safely;
- RLS/application role verified.

### WW2
- keys configured;
- issuance/revocation/reissue proven;
- offline verification proven;
- check-in scoped to authorized gate/operator.

### Distribution
- Android signed/Play App Link proof;
- iOS signed/TestFlight Universal Link proof.

### PWA
- mature workflows still pass;
- shared APIs not single-tenant;
- legacy unsafe paths isolated/deprecated.

---

## 14. Stop conditions

Stop implementation and report rather than guess when:
- production DB identity is uncertain;
- role mapping is ambiguous;
- a new schema appears to duplicate an existing model;
- production secret/key state is unknown;
- Apple/Play identity is unknown;
- a migration changes authority semantics without a reviewed plan amendment;
- a test only passes with a named wedding/account special case.

---

## 15. Required completion report for every future phase

Every task report must include:

~~~text
START STATE
branch:
starting SHA:

IMPLEMENTED
files:
behavior:

PWA REGRESSION
relevant PWA tests:
behavior changed: YES / NO

NATIVE REGRESSION
Android tests:
iOS tests:
Guest invariants preserved: YES / NO

DATABASE
schema changed: YES / NO
production data touched: YES / NO
migration applied: YES / NO

AUTHORITY
new role/permission logic introduced: YES / NO
source of authority:
fail-closed proof:

HARDCODED DATA
production-reachable fixture/test data introduced: YES / NO

END STATE
ending SHA:
pushed: YES / NO

PHASE GATE
PASS / FAIL

remaining blockers:
1.
2.
...
~~~

No phase is accepted until independent review confirms the report against actual remote code.

---

## 16. Decision log

### D-001 — PWA is not universally authoritative
Accepted. Mature PWA/server business domains are reused, but Guest Session v2, native Guest entry, and WW2 are newer approved contracts.

### D-002 — Guest remains a separate identity domain
Accepted. Initial invited Guest use never requires User/UserProfile/WeddingMembership.

### D-003 — Production roles are multi-axis
Accepted. Native may not infer full authority from AppSession.role or a flat AppRole enum.

### D-004 — WW2 is admission authority
Accepted. Existing PWA "Wedding Pass" is not a security substitute.

### D-005 — Test accounts are acceptance probes
Accepted. No architectural special casing.

### D-006 — No production migration before catalog proof
Accepted.

### D-007 — Production full native repository remains disabled until authority foundation is ready
Accepted.

### D-008 — Patches discovered in independent review are closed before issuing the next task
Accepted.

### D-009 — Plan locked after repository peer review (2026-09-22)
Accepted. Status set to LOCKED. Factual corrections C-1 … C-8 and hazards §8.8 … §8.13 recorded in §2.1 / §8. No architectural change. Phase 0 exit gate satisfied: review reconciled, plan locked, unresolved questions listed in §2.1.

### D-010 — Native Phase 1 baseline
Accepted. Phase 1 branches from `native-mobile/guest-profile-invitation-20260921` @ d7c4dddeabb594810a5833b4ac24d356883a8a3b, not from `native-mobile/role-architecture-p0-20260919` (C-8).

### D-015 — Phase 4 status (2026-09-22)
**ACCEPTED — independent Rule-10 review passed after reviewer-owned closure patches. Phase 5 may begin; production Guest-session activation remains configuration-gated.**

Accepted Phase-4 branch:
- `backend/guest-session-v2-phase4-qualification-20260922`
- final accepted review head: `3205332488ed22d27c738333032396e04c2cb47e`
- implementation-agent head reviewed: `c2bea65b4f592933c97e4232dd1b05eac71bec1c`
- reviewer starting point: `4b6253665573b1bdff2ac153963e99eac576359a`

Independent review confirmed from actual remote code:
- Guest Session v2 payload is exactly `version + weddingId + guestId + invitationVersionFingerprint + expiresAt`; no raw RSVP token is embedded;
- all new production-like v2 issuance uses `primarySessionSigningSecret()`, which requires dedicated `WEWED_SESSION_SECRET`;
- the historical service-role signer is verification-only for approved legacy v1 Guest Session / Guest portfolio / shared-invitation formats;
- a v2 Guest Session signed only by the historical service-role key is rejected;
- current invitation-token/fingerprint rotation invalidates remembered Guest access;
- expiry remains 30-day minimum, wedding+90-day target, 400-day maximum, with no ordinary sliding renewal;
- the current saved `Wedding.invitationCardStyle` is authoritative on exchange, cold launch, portfolio picker and wedding switching;
- Android/iOS Guest clients persist only the server-issued opaque Guest Session credential after exchange and do not persist the raw RSVP credential.

Reviewer-owned closure:
1. Fixed stale portfolio/switcher invitation-style authority at the implementation head.
2. Identified and removed Phase-4 tests' global `@/lib/db` mocks that contaminated unrelated Planner Stage-2 teardown.
3. Added production-neutral optional database injection to shared Guest access resolvers for isolated tests.
4. Synchronized `unified-navigation-privacy.test.ts` after the injected database local identifier changed.
5. Removed eager runtime Prisma initialization from injected test paths: production callers lazily resolve the same real `@/lib/db` singleton when no override is provided, while injected tests do not initialize Prisma.

Execution evidence on final accepted head:
- focused Phase-4 suite: 91/91 pass;
- `wedding-guest-projection-v2.test.ts`: 3/3 standalone pass;
- `wedding-privacy-semantics.test.ts`: 15/15 standalone pass;
- the two previously problematic files together: 18/18 pass;
- `unified-navigation-privacy.test.ts`: 7/7 pass;
- Planner Stage-2 named failures match fresh `main` and no longer exhibit Guest-test DB contamination;
- fresh `main`: 801 pass / 34 fail / 6 reported Bun error blocks;
- Phase-4 branch: 812 pass / 36 fail / 8 reported Bun error blocks, with zero branch-only named failing assertions;
- the two additional content-empty full-run blocks attributed to the added Guest tests reproduce only when the same pre-existing `server-only` resolution failures from `main` are present, disappear standalone/together/focused and when those pre-existing failing files are excluded, and therefore are recorded as a Bun reporter/shared-process echo rather than a new Phase-4 executable failure;
- production-equivalent build with a synthetic, non-committed secret: PASS;
- Android: 314/314;
- iOS: 316/316;
- Vercel commit build/status for the accepted head is successful.

Acceptance rationale:
- the locked Phase-4 exit gate is security/behavioral convergence, not literal equality of Bun's error-block display count;
- no new named assertion failure, security regression, runtime regression, PWA Guest regression, native Guest regression or production schema/data change is present;
- therefore the pre-existing `server-only` test-harness defect on `main` is not allowed to block Phase 4 once its non-regression was isolated and proven.

External configuration carry-forward:
- `WEWED_SESSION_SECRET` is still absent from Vercel Preview and Production according to names-only checks;
- no secret value was read, created, rotated or printed;
- live Preview/Production Guest Session v2 HTTP activation remains blocked until the owner explicitly authorizes configuring the dedicated secret;
- this is an operational promotion gate, not an unresolved Phase-4 code defect;
- secret strictness must not be weakened and no production deployment/promotion is authorized by this acceptance.

Phase gate:
- implementation contract review: PASS;
- reviewer closure: PASS;
- execution verification: PASS for Phase-4 acceptance;
- production activation: BLOCKED on explicit secret authorization;
- Phase 4: **ACCEPTED**;
- Phase 5: **READY TO BEGIN**.

### D-025 — Phase 9 closure round 3: RSVP pre-open refresh & 12-style native matrix (2026-09-23)
**IMPLEMENTATION-AGENT SUBMISSION, NOT A MODERATOR VERDICT.** Phase 9 acceptance is the moderator's
decision alone.

**Independent Moderator Review Findings Addressed:**
1. **Round-2 Multi-Status RSVP Reachability Accepted:** Independent inspection accepted the Round-2
   reachability fix across `PENDING`, `ACCEPTED`, and `DECLINED` states with dynamic `"RSVP"` / `"Update RSVP"`
   action labeling as valid implementation closure.
2. **Round-2 Fresh-State Claim Rejected (Blocker 1):** Reopening the RSVP editor previously relied on
   local UI state re-creation (`key(presentation)`/`.id(formSessionId)`) without re-fetching server truth.
   If an RSVP was edited concurrently on the PWA or another device, reopening the native editor displayed
   stale snapshot values, risking silent overwrites of newer server fields.
3. **Pre-existing 1/12 Native Invitation Design Parity Blocker (Blocker 2):** Only `ivory-floral-gold` had
   a native renderer; the other 11 configured styles routed to a fail-closed unsupported screen. To satisfy
   the Phase-9 exit gate (*the same Guest record, the same configured Digital Invitation design, and the same
   RSVP truth across PWA, Android, and iOS*), all 12 styles must render natively.

**Implementation & Parity Semantics:**
1. **Pre-Open Server Refresh (Blocker 1 Resolved):**
   - Android & iOS Coordinators (`LiveGuestInvitationCoordinator`): Added `prepareRsvpEdit(currentGuestId)`.
     When the guest taps RSVP or Update RSVP, the coordinator loads a fresh snapshot directly via
     `client.loadInvitation(activeWeddingSlug)`.
   - Identity Verification: Asserts `refreshedSnapshot.guestId == currentGuestId`. If the session was rotated,
     revoked, or swapped, returns `StaleOrReplacedGuest` or `RevokedOrUnauthorized`, keeping the editor closed.
   - Dedicated Editor Presentation: On successful refresh, produces `RsvpEditPreparation.Ready` containing
     `LiveInvitationPresentation.from(refreshedSnapshot)`. Native views bind `rsvpEditorPresentation` to this
     fresh snapshot; the editor form binds exclusively to `rsvpEditorPresentation`.
   - Failure Semantics: Transport/network errors produce `Unavailable(status)`. The editor does NOT open; a
     retryable `RefreshUnavailableNotice` is displayed while preserving the card presentation.
   - Executable Regression Proof: On both platforms, regression tests simulate an initial load (`meal = beef`,
     `message = old`), an out-of-band PWA update (`meal = vegan`, `message = newer`), tapping Update RSVP,
     verifying the form opens with fresh server truth, modifying only dietary notes, and saving—proving newer
     server fields are preserved without stale client overwrites.
2. **Authoritative 12-Style Native Design Matrix (Blocker 2 Resolved):**
   - Single Source of Authority: Extended `mobile/contracts/generate_invitation_style_contract.py` to extract
     authoritative palettes (`stage`, `paper`, `ink`, `primary`, `accent`, `muted`), motion presets, and
     atmosphere presets from `src/lib/digital-invitation-card.ts` into `mobile/contracts/invitation-styles.json`,
     `GeneratedInvitationStyles.kt`, and `GeneratedInvitationStyles.swift`.
   - Flagship & Generic Engines: `ivory-floral-gold` retains its dedicated `IvoryFloralGoldNative` renderer.
     The other 11 styles share a native generic premium motion engine (`GenericMotionInvitationNative` on
     both Android and iOS) implementing the 6 motion presets (`gate-fold`, `envelope-letter`, `book-open`,
     `single-card-lift`, `floral-reveal`, `sleeve-pull`) and 7 atmosphere presets (`champagne-glow`,
     `soft-bokeh`, `petals`, `candlelight`, `stars`, `watercolour-bloom`, `minimal`).
   - Opening Ceremony & Actions: All 12 styles begin closed with an explicit reveal ceremony (respecting
     reduced-motion), full personalization, and interactive actions (RSVP / Update RSVP across all statuses,
     Calendar, Venue, Gift, Note, Guest Pass, Couple Website, Continue).
   - Fallback & Fail-Closed: Missing/invalid styles normalize server-side to `botanical` (Garden Romance), which
     renders natively (not Ivory). Truly unknown styles fail closed to an unsupported notice.
   - Matrix Verification: Android `InvitationStyleMatrixTest` and iOS `InvitationStyleMatrixTests` verify every
     one of the 12 styles individually.

**Server Qualification Retention Evidence:**
- Server product code was completely untouched; zero server product changes or regressions.
- Retained server qualification run: `35826332669` (`_tmp-phase9-server-qualification.yml`) —
  PASS at product SHA `72f34663535d5fbbfbbb6bb79319ae69327a2994`.
- Server branch head: `e70ead6febf9cb29303738b949607f4438cd8c4a`.

**Native Reviewer Qualification Evidence:**
- Temporary native reviewer workflow: run `35834561726` (`_tmp-phase9-native-qualification.yml`) — PASS.
  - Android: `testDebugUnitTest` (418 passed, 0 failed), `assembleDebug`, `assembleRelease` — PASS.
  - iOS: `swift test` (415 passed, 0 failed), `swift build`, `xcodegen generate`, Simulator Debug build, unsigned generic-device Release build — PASS.
- Exact native product SHA: `2a71fc5d6bdaa151376eaa0100f7dec9672b73f4`.
- Temporary reviewer workflow removed after successful run in commit `48dab24aad4f6b6a3aea55cc5a159efcb3035d1d`.
- Cleaned native branch tip SHA: `48dab24aad4f6b6a3aea55cc5a159efcb3035d1d`.

**Phase Gate:**
- Phase 9: **Implementation agent reports both moderator blockers fully resolved and requalified; acceptance
  is NOT self-declared and awaits moderator review of the remote code**.
- Phase 10: **NOT STARTED / NOT AUTHORIZED**.

### D-024 — Phase 9 independent moderator review finding resolution & native requalification (2026-09-23)
**IMPLEMENTATION-AGENT SUBMISSION, NOT A MODERATOR VERDICT.** Phase 9 acceptance is the moderator's
decision alone.

**Independent Moderator Review Finding:**
Independent inspection of the Phase 9 native code confirmed that server-side convergence is complete,
genuine, and verified. However, native Android and iOS UI previously surfaced the RSVP editor only while
an RSVP was in the `PENDING` state:
- Android: `onRsvp = if (status == RSVPStatus.PENDING) { { rsvpPrompt = true } } else null`
- iOS: `onRsvp: presentation.rsvpStatus == .pending ? { rsvpPrompt = true } : nil`
Furthermore, `IvoryFloralGoldNative` on both platforms gated the RSVP hit region behind
`rsvp.awaitsResponse ? actions.onRsvp : nil`.
Consequently, once a guest submitted an RSVP as `ACCEPTED` or `DECLINED`, the action was suppressed or
hidden, preventing the guest from reopening the editor to update choices (meal, plus-one, children, notes)
or change attendance—diverging from the PWA, which allows reopening and re-saving against the same
record.

**Native UI Fix & Parity Semantics:**
1. **Unconditional Action Reachability Across All Statuses:**
   - Android (`apps/android/.../ui/invitation/LiveGuestInvitationScreen.kt`): Extracted
     `resolveLiveInvitationActions(presentation, onRsvpPrompt, ...)` providing `onRsvp` unconditionally
     across `PENDING`, `ACCEPTED`, and `DECLINED`.
   - iOS (`apps/ios/.../Views/Invitation/LiveGuestInvitationView.swift`): Extracted
     `resolveLiveInvitationActions(presentation:onRsvpPrompt:...)` providing `onRsvp` unconditionally
     across all response statuses.
   - Journey wrappers (`GuestInvitationJourneyScreen.kt` / `GuestInvitationJourneyView.swift`):
     `onRsvp = { rsvpPrompt = true }` across all statuses.
2. **Dynamic CTA Action Labeling & Visual Status Fidelity:**
   - Android (`IvoryFloralGoldNative.kt`) & iOS (`IvoryFloralGoldNative.swift`): Added
     `ivoryRsvpActionLabel(rsvp)` mapping to `"RSVP"` while awaiting response (`PENDING`), and
     `"Update RSVP"` once answered (`ACCEPTED` or `DECLINED`). Passed `actions.onRsvp` directly to the hit target.
   - Preserved card status visual fidelity: confirmed attendance renders the badge (`RSVP confirmed`),
     while declining renders the status banner (`Response recorded — not attending`), with the action
     target remaining fully reachable and responsive.
3. **Session Freshness & Elimination of Dirty State on Reopen:**
   - Android: Wrapped `LiveRsvpForm` in `key(presentation)` and keyed all form state to
     `remember(initial)` so reopening immediately reflects the latest server snapshot without carrying
     over abandoned local edits.
   - iOS: Attached `.id(formSessionId)` to `LiveRsvpFormView` with a fresh UUID generated on each
     prompt opening, ensuring fresh form initialization from the latest presentation snapshot.
4. **Lifecycle Semantics Confirmed:**
   - `PENDING -> RSVP editable` (action label: "RSVP")
   - `ACCEPTED -> RSVP editable` (action label: "Update RSVP")
   - `DECLINED -> RSVP editable` (action label: "Update RSVP")
   - Each edit reloads and mutates the same Guest Session-backed RSVP truth
     (`PUT /api/weddings/[slug]/guest-session`). Partial-update non-destructiveness and dormant field
     preservation are maintained end-to-end across multiple update cycles (e.g. pending -> accepted ->
     declined -> re-accepted).

**Executable Test Evidence:**
- **Android (`apps/android`):**
  - `IvoryInvitationGeometryTest.kt`: Added `ivoryRsvpActionLabelTracksAwaitingState` verifying action
    label mapping.
  - `LiveGuestInvitationCoordinatorTest.kt`:
    - `rsvpActionRemainsReachableAcrossAllStatuses`: asserts `resolveLiveInvitationActions` exposes
      `onRsvp != null` across `PENDING`, `ACCEPTED`, and `DECLINED`.
    - `exerciseMutationCyclesThroughExistingGuestSessionPath`: exercises a full 4-stage mutation cycle
      (`pending -> attending -> declined -> attending`) via `coordinator.answer()` and
      `coordinator.refresh()`, asserting that `presentedGuestId` is enforced, dormant fields are preserved
      across status changes, and server truth is accurately reloaded.
  - Test run: `./gradlew :app:testDebugUnitTest` (25 tasks executed, all passed).
- **iOS (`apps/ios/Wewed`):**
  - `IvoryInvitationGeometryTests.swift`: Added `testIvoryRsvpActionLabelTracksAwaitingState`.
  - `LiveGuestInvitationCoordinatorTests.swift`:
    - `testRsvpActionRemainsReachableAcrossAllStatuses`: asserts actions resolution keeps `onRsvp != null`
      across all response statuses.
    - `testExerciseMutationCyclesThroughExistingGuestSessionPath`: exercises the identical 4-stage mutation
      cycle against coordinator and asserts dormant field persistence and presentation accuracy.
  - Test run: `swift test` (408 tests executed, 0 failures).

**Server Qualification Retention Evidence:**
- Server product code was completely untouched; zero server product changes or regressions.
- Retained server qualification evidence: run `35826332669` (`_tmp-phase9-server-qualification.yml`) —
  PASS at product SHA `72f34663535d5fbbfbbb6bb79319ae69327a2994`.
- Server branch documentation head: `e70ead6f634ecfa1a095ce81223fe9b7fef833df`.

**Native Reviewer Qualification Evidence:**
- Temporary native reviewer workflow: run `35830241807` (`_tmp-phase9-native-qualification.yml`) —
  PASS (Android in 7m37s, iOS in 5m37s).
  - Android: `testDebugUnitTest`, `assembleDebug`, `assembleRelease` — PASS.
  - iOS: `swift test`, `swift build`, `xcodegen generate`, Xcode Simulator Debug build, unsigned generic-device Release build — PASS.
- Exact native product SHA: `5fef6c0b905e40807d8300c516f24946d577f596`.
- Temporary reviewer workflow removed after successful run.
- Cleaned native branch tip SHA: `417b47b6be887503cb1e82aaeba3d6682609fec6`.

**Phase Gate:**
- Phase 9: **Implementation agent reports moderator finding fully resolved and requalified; acceptance
  is NOT self-declared and awaits moderator review of the remote code**.
- Phase 10: **NOT STARTED / NOT AUTHORIZED**.

### D-023 — Phase 9 execution evidence, submitted for moderator review (2026-09-23)
**IMPLEMENTATION-AGENT SUBMISSION, NOT A MODERATOR VERDICT.** Phase 9 acceptance is the moderator's
decision alone. New branches created directly from the D-022-accepted Phase-8 heads, never from
`main`:
- server `backend/digital-invitation-rsvp-phase9-20260923` from `ba38cf3c66105f5a7326bef27aecf428e47f3f5e`;
- native `native-mobile/digital-invitation-rsvp-phase9-20260923` from `1e7ec407f04de2366fa64b3bbc735b22bc58f63e`.

**§5 — RSVP mutation domain reconciled.** `PUT /api/weddings/[slug]/guest-session` (Guest Session
v2) and `POST /api/rsvp` (a second, older guest-facing transport) had drifted into two separate
implementations of RSVP business rules: `/api/rsvp` had NO adults-only enforcement at all, and
unconditionally overwrote `plusOneName`/`plusOneMeal`/`dietaryNotes`/`message` with `null` whenever
a caller omitted them, silently erasing previously-saved answers on every partial edit. Extracted
the actual mutation semantics into a new shared operation, `applyGuestRsvpUpdate`
(`src/lib/guest-rsvp-mutation.ts`), used by both routes; each route keeps its own transport-specific
authorization (`originGuestId` stale-context check on guest-session, cookie-based
`resolveWeddingAccessForRequest` on `/api/rsvp`). `songRequests` (a real but not-yet-converged RSVP
column) is intentionally excluded — no current caller, outside Phase 9's 9-field scope.

**§6-9 — full native RSVP field parity, both platforms.** Android/iOS `saveRsvp`/`answer` previously
sent only `attending`/`dietaryNotes`/`message`. Both platforms gained a `GuestRsvpUpdate` (all 9
converged fields, `nil`/`null` = omit-from-request, never coerced to a destructive overwrite) and a
`GuestRsvpRecord` (the full authoritative stored row), and a full RSVP form (meal, plus-one +
name/meal, children + count respecting server-provided adults-only policy, dietary notes, message)
replacing the previous 2-button accept/decline dialog — mirroring the PWA's own
`premium-invitation-rsvp-dialog.tsx` submission shape field-for-field. `originGuestId`/
`presentedGuestId` stale-context binding is unchanged on both platforms. A `CHILDREN_NOT_ALLOWED`
response now surfaces its own distinct message instead of being folded into the generic
"reopen your invitation" notice (a real, if minor, pre-existing UX defect fixed on both platforms).

**§10 — invitation-style authority proven for all 12 styles.** The wedding's own saved
`invitationCardStyle` was already authoritative server-side (`resolvePersonalInvitation`'s
`requestedCard` parameter is deliberately never read); added disposable-DB executable proof across
every supported style, not just the Ivory flagship.

**§11-13 — explicitly unchanged, verified by construction.** No entry/navigation code, invitation
motion/style visual presentation, or Guest Session v2 credential/fingerprint code was touched by
this round; the full pre-existing regression suites on both platforms and the server continue to
pass unchanged, proving these invariants survived intact rather than merely asserting it.

**§14-16 — same-record and policy-matrix proof.** A new disposable-DB integration suite
(`src/lib/guest-rsvp-convergence.integration.test.ts`, 16 tests) proves: the full field/policy
matrix (attendance, meal, plus-one, children, dietary, message, adults-only refusal, partial-update
non-destructiveness); the `originGuestId` stale-context matrix (missing, mismatched, invalid
session, expired session); and that both guest self-service transports read/write the exact SAME
`RSVP` row — no replication, no second record, no mobile-only schema.

Qualification (temporary reviewer CI, removed after a successful run):
- server: run `35826332669` (`_tmp-phase9-server-qualification.yml`) — PASS at
  `72f34663535d5fbbfbbb6bb79319ae69327a2994` (fresh Postgres, full migration chain, the new Phase 9
  guest-RSVP-convergence suite, Guest Session v2/projection regressions, digital-invitation/
  navigation/privacy source-contract regressions, Phase 2/7/8 disposable-DB regressions, production
  build);
- native: run `35826403947` (`_tmp-phase9-native-qualification.yml`) — PASS at
  `26baf9cc04f985a4621660880a9a9d9abaf095f3` (Android `testDebugUnitTest`/`assembleDebug`/
  `assembleRelease`; iOS `swift test`/`swift build`, XcodeGen, real Simulator Debug build, unsigned
  Release device build).

Full `bun test src` regression: byte-identical to the documented clean baseline (850 pass / 36 fail
/ 8 errors — the 36/8 are pre-existing and unrelated to this phase).

Production safety (verified via the GitHub Deployments API): every deployment recorded for every SHA
produced this phase, on both branches, is `environment: "Preview"` — never `"Production"`. No
production database read or written, no production migration applied, `WEWED_SESSION_SECRET` never
read or changed, F-3/F-4/F-6 untouched, no Android/iOS build published, no signing credential
touched, Phase 10 not started.

Remaining, honestly, unchanged in scope: `songRequests` convergence, Gate/Usher authority, WW2
production activation, Wedding Day migrations, F-3/F-4/F-6, `WEWED_SESSION_SECRET` configuration,
universal/app-links (Phase 13) — none of this was in scope for Phase 9 and none of it was attempted.

Phase gate:
- Phase 9: **implementation agent reports the Digital Invitation + RSVP convergence work complete
  and independently re-verified; acceptance is NOT self-declared and awaits moderator review of the
  actual remote code above**;
- Phase 10: **NOT STARTED / NOT AUTHORIZED**.

### D-022 — Phase 8 accepted; Phase 9 authorized (2026-09-23)
**PHASE 8 — ACCEPTED.** Moderator acceptance date: 2026-09-23. This is a moderator decision, not an
implementation-agent submission — unlike D-019/D-020/D-021, which are left unmodified below as the
historical record leading to this acceptance.

Accepted heads:
- server `backend/native-workspace-parity-phase8-20260922` @ `ba38cf3c66105f5a7326bef27aecf428e47f3f5e`;
- native `native-mobile/workspace-parity-phase8-20260922` @ `1e7ec407f04de2366fa64b3bbc735b22bc58f63e`.

Qualification evidence relied upon:
- server: run `35813862536`, product SHA `36e02adc9420b96f9dd18f8063fc7b55ed74f110` (fresh Postgres,
  full migration chain, Phase 2/7/8 disposable-DB suites, Guest Session v2/projection regressions,
  production build);
- native: run `35819038509`, product SHA `df1d4829e45eb406d8cc85b685d1e1e9dd4192a5` (Android unit/
  debug/release; iOS swift test/build, XcodeGen, real Simulator build, unsigned Release device
  build).

The accepted heads above advance past those qualified product SHAs only by documentation and
temporary-reviewer-workflow-removal commits — no additional product code was introduced after
qualification on either branch.

Carried forward — explicitly NOT Phase-8 blockers, tracked as ongoing gates/scope for later phases:
- F-3 production Vendor link evidence;
- F-4 production migration application;
- F-6 legacy PWA global-admin path;
- `WEWED_SESSION_SECRET` Preview/Production configuration;
- unsupported mature writes not enabled during Phase 8 (Contracts/Vault write actions, Budget line
  edits, Seating/Timeline/Vendor-planning writes);
- remaining non-required Admin extensions (command center, bookings, service engagements, contract
  intelligence, contributions analytics, account identity, productivity, cross-wedding vault
  browsing).

Phase gate:
- Phase 8: **ACCEPTED**;
- Phase 9: **AUTHORIZED**.

### D-021 — Phase 8 closure round 5 execution evidence, submitted for moderator review (2026-09-23)
**IMPLEMENTATION-AGENT SUBMISSION, NOT A MODERATOR VERDICT.** Phase 8 acceptance remains the
moderator's decision alone. This entry does not rewrite D-020: round 4's repository-free-factory
work (`NativeRepositoryOutcome.ProductionBootstrap`, `ProductionRepositoryUnbound`) was correct as
recorded there. Independent moderator inspection of the actual round-4 remote code separately found
that the production root's `ActorAssignmentSources` call site still required a repository argument
neither PRODUCTION branch actually needed, and that requirement — not the factory itself — is what
caused a real defect:

- **Android:** the authenticated root's `remember(...) { ActorAssignmentSources.forEnvironment(env,
  appViewModel.repository, appViewModel.plannerRepository, ...) }` evaluated
  `appViewModel.repository` as a call argument BEFORE the function ran, and before the
  `LaunchedEffect` that binds a real production repository had any chance to execute. Round 4's own
  fix — `appViewModel.repository` now throws `ProductionRepositoryUnbound` while unbound in
  PRODUCTION, instead of returning a same-typed placeholder — turned this pre-existing coupling into
  an actual unbound-production-repository-read-before-bind crash during root composition, not a
  theoretical one.
- **iOS:** the equivalent read was masked by an invalid production fallback,
  `(try? appState.repository) ?? FixtureWeddingRepository()`, present only because
  `ActorAssignmentSources.forEnvironment` still demanded a repository parameter. The production
  branch of `ActorAssignmentSources` never actually consumed it, so this was not a demonstrated data
  leak, but it was still an incorrect production code path that should not exist.

**Correction applied:** `ActorAssignmentSources` is split into three narrowly-typed constructors on
both platforms — `forShadow(repository, plannerRepository, environment)` (the only one that takes a
repository, for Shadow/Fixture/dev-persona environments only), `forProduction(productionAuthority,
selectedGrantIds, selectedEngagementId)`, and `empty()` — the latter two have NO repository parameter
at all, so production resolution cannot read one even by accident; this is a structural (compile-
time) guarantee, not merely a runtime one. `RootScreen.kt`/`RootView.swift` now branch on
`dataEnvironment`/authority themselves BEFORE ever touching a repository, delegating to a new pure,
directly unit-tested `resolveActorAssignmentSource` helper on each platform, replacing the old
single `forEnvironment(...)` function (deleted on both platforms) and iOS's Fixture fallback
(deleted outright).

**New regression tests** (`RootAssignmentBootstrapTest.kt` / `RootAssignmentBootstrapTests.swift`,
6 tests each platform) prove directly: PRODUCTION unbound + valid authority builds a real
`ProductionActorAssignmentSource` with no `ProductionRepositoryUnbound` thrown and no Fixture/Shadow
repository constructed or required; PRODUCTION unbound + no authority yields `EmptyActorAssignmentSource`,
also without touching a repository; Shadow environments are unchanged and still require a real
repository; `clearProductionBinding()` leaves assignment resolution safe while the mature repository
domains remain correctly unreachable until a fresh bind; Account A → Account B never mixes
assignments or consults a stale repository; and the Vendor same-grant `selectedEngagementId` (D-020)
still flows through the new three-constructor API unchanged.

Qualification (temporary reviewer CI, removed after a successful run): native-only run
`35819038509` (`_tmp-phase8-round5-native-qualification.yml`) — PASS at
`df1d4829e45eb406d8cc85b685d1e1e9dd4192a5` (Android `testDebugUnitTest`/`assembleDebug`/`assembleRelease`;
iOS `swift test`/`swift build`, XcodeGen, real Simulator Debug build, unsigned Release device build,
including the new bootstrap tests). No server product code changed this round; D-020's server
qualification evidence (run `35813862536`, product SHA `36e02adc9420b96f9dd18f8063fc7b55ed74f110`) is
retained, not rerun.

Round-5 heads:
- server (docs-only, no product code changed): `ba38cf3c66105f5a7326bef27aecf428e47f3f5e`.
- native starting: `0e1180d10bef185fd69bbeed1b0f79e53bc2bd6e`; qualified: `df1d4829e45eb406d8cc85b685d1e1e9dd4192a5`; final (workflow removed): `1e7ec407f04de2366fa64b3bbc735b22bc58f63e`.

Production safety (verified via the GitHub Deployments API): every deployment recorded for every SHA
produced this round is `environment: "Preview"` — never `"Production"`. No production database read
or written, no production migration applied, `WEWED_SESSION_SECRET` never read or changed, no F-3
relationship fabricated, F-4 unchanged, Guest invitation/RSVP behavior unchanged, no Android/iOS
build published, no signing credential touched, Phase 9 not started.

P1-N4 clarification: D-020's completion report stated the 20 dead `PlannerDestinationRoute`
composables remained. That statement was stale — independent inspection of the current native files
found only explanatory comments documenting an already-completed deletion, not a reachable
fabricated surface. No P1-N4 work was reopened or reattempted this round.

Remaining Phase-8 blockers, honestly, unchanged in scope by this round: Contracts/Vault write
actions, Budget line edits, Seating/Timeline/Vendor-planning writes, Admin domains beyond
overview/accounts/support/incidents, F-3, F-4, F-6, and the `WEWED_SESSION_SECRET`
Preview/Production configuration gate — exactly as carried forward through D-020.

Phase gate:
- Phase 8: **implementation agent reports this round's single defect (the production-root
  repository dependency) closed and independently re-verified, on top of D-020's unchanged closures;
  acceptance is NOT self-declared and awaits moderator review of the actual remote code above**;
- Phase 9: **NOT STARTED / NOT AUTHORIZED**.

### D-020 — Phase 8 closure round 4 execution evidence, submitted for moderator review (2026-09-23)
**IMPLEMENTATION-AGENT SUBMISSION, NOT A MODERATOR VERDICT.** Phase 8 acceptance remains the
moderator's decision alone; this entry records what round 4 changed and independently verified, in
direct response to defects the moderator found by inspecting round 3's actual shipped code (not its
completion report). It does not itself accept or reject Phase 8, and Phase 9 has not been started.

Round-4 starting heads (round-3 final, reviewer-clean):
- server `backend/native-workspace-parity-phase8-20260922` @ `259d1074ff7f5c9be57441cc38df91e56e76d13d`;
- native `native-mobile/workspace-parity-phase8-20260922` @ `1a0fb05371e323c3b7d1b2ebcb7317ff6a379dcc`.

Defects the moderator found in round 3's shipped code, and what round 4 changed:
1. `NativeRepositoryFactory.PRODUCTION` still constructed a same-typed
   `ProductionBoundaryWeddingRepository`/`ProductionBoundaryPlannerRepository` placeholder for the
   unbound state (round 3 had only fixed a same-account render race, not this). Replaced with a
   sealed `NativeRepositoryOutcome`/`.productionBootstrap` that carries no wedding/planner value at
   all; every production repository getter now throws a new `ProductionRepositoryUnbound` while
   unbound instead of returning anything repository-shaped. The five dead `ProductionBoundary*`
   classes are deleted on both platforms.
2. The Vendor production binding was keyed only on `(accessUserId, grantId)`, but one
   `vendor:wedding:<business>:<vendor>` grant can carry multiple `serviceEngagementIds`; round 3's own
   "engagement A to B" test only proved grant-to-grant switching, not same-grant engagement selection.
   The binding gained an `engagementId` field; the bind effect and render gate on both platforms now
   key on it; the server's `/api/native/vendor/engagement` route now fails closed with
   `422 ENGAGEMENT_SELECTION_REQUIRED` for a multi-engagement grant with no `engagementId` supplied,
   instead of auto-selecting `serviceEngagementIds[0]`.
3. Contracts' round-3 "LIVE (server + native client)" classification for the Deal Room was premature —
   the native client only ever called the engagement-list endpoint. Added
   `NativeDomainApiClient.dealRoom(...)` + `ContractsRepository.getDealRoom(...)` (DTOs mirroring the
   PWA's own `DealRoomRecord` shape) on both platforms, and a tap-to-expand Deal Room detail view
   within the existing Vendors/"Contracts & Engagements" surface — no new IA navigation entry.

Full detail, file-level and code-level, is recorded in
`docs/native-mobile/WEWED_NATIVE_PHASE8_FIELD_CLASSIFICATION.md` §13 (server repo).

Independent verification performed by the implementation agent (re-run personally, not merely
claimed by a sub-task): Android `testDebugUnitTest` (401/401 pass), `assembleDebug`/`assembleRelease`;
iOS `swift build`/`swift test` (397/397 pass), `xcodegen generate` + `xcodebuild` Debug Simulator
build + unsigned Release generic-device build — all four iOS/Android build artifacts rebuilt and
re-verified directly by the implementation agent after a background port, not accepted on the
sub-task's self-report alone; server disposable-DB suite (26/26, including four new same-grant
multi-engagement Vendor tests), Phase 2/7 disposable-DB regressions (36/36), full `bun test src`
byte-identical to the documented local baseline (850 pass / 36 fail / 8 errors / 68 skip), production
`next build` succeeded.

Qualification (temporary reviewer CI, removed after a successful run, matching rounds 2/3):
- server: run `35813862536` (`_tmp-phase8-round4-server-qualification.yml`) — PASS at
  `36e02adc9420b96f9dd18f8063fc7b55ed74f110` (fresh Postgres, full migration chain, Phase 2/7/8
  disposable-DB suites, Guest Session v2/projection regressions, production build);
- native: run `35816354919` (`_tmp-phase8-round4-native-qualification.yml`) — PASS at
  `951859ee5c70817df3af2290e1fed1e81cfe2f05` (Android unit/debug/release; iOS swift test/build,
  XcodeGen, real Simulator build, unsigned Release device build).

Round-4 final heads (temporary workflows removed, field classification updated, working trees clean):
- server: `11d492e92a0cb0cc58083a4a9b554604c3a8e196`;
- native: `0e1180d10bef185fd69bbeed1b0f79e53bc2bd6e`.

Production safety (verified via the GitHub Deployments API, not inferred): every deployment recorded
for every SHA produced this round, on both branches, is `environment: "Preview"` — never
`"Production"`. No production database read or written, no production migration applied,
`WEWED_SESSION_SECRET` never read or changed, no F-3 relationship fabricated, F-4 unchanged, Guest
invitation/RSVP behavior unchanged, no Android/iOS build published, no signing credential touched,
Phase 9 not started.

Remaining Phase-8 blockers, honestly, unchanged in scope by this round (none of this was in scope for
round 4 and none of it was attempted):
- Contracts/Vault write actions (draft/versioning/acceptance, upload) remain UNSUPPORTED — this round
  closed the Deal Room READ path only, as scoped;
- Budget line edits, Seating/Timeline/Vendor-planning writes remain UNSUPPORTED;
- Admin domains beyond overview/accounts/support/incidents (command center, bookings, service
  engagements, contract intelligence, contributions analytics, account identity, productivity,
  cross-wedding vault browsing) remain UNSUPPORTED;
- the 20 dead `PlannerDestinationRoute` composables noted as remaining P1-N4 cleanup in the field
  classification document are still not removed (unchanged from round 3 — out of scope for round 4's
  three-item mandate);
- F-3 still blocks real production Vendor wedding grants; F-4 remains unapplied to production; F-6 and
  the `WEWED_SESSION_SECRET` Preview/Production configuration gate remain later/operational gates,
  exactly as carried forward through every prior checkpoint.

Phase gate:
- Phase 8: **implementation agent reports the three round-3-identified defects closed and
  independently re-verified; acceptance is NOT self-declared and awaits moderator review of the actual
  remote code above**;
- Phase 9: **NOT STARTED / NOT AUTHORIZED**.

### D-019 — Phase 8 review checkpoint (2026-09-23)
**NOT ACCEPTED — substantial mature-domain parity exists, but the locked Phase-8 exit gate is not yet satisfied. Continue Phase 8; Phase 9 remains closed.**

Implementation-agent heads reviewed:
- server `backend/native-workspace-parity-phase8-20260922` @ `108a8c9416a6bebced85cb27256219b9fdb250f8`;
- native `native-mobile/workspace-parity-phase8-20260922` @ `5e278e0ff44253fe8be620945886dae641afd7fc`.

Reviewer-clean continuation heads:
- server: `f602586b9d176bfa4b7d964b2faee9f2f60b8bad`;
- native: `3cfc0d8734d346709da67bdac1aa6dd5bd7c63b3`.

Accepted progress within Phase 8:
- Couple/Planner/Coordinator wedding-scoped production shells now consume real native-safe adapters for overview, tasks, budget, guests, seating, timeline and planning-side vendors;
- task create/update/toggle is production-backed, though the shared PWA/native mutation domain still needs further extraction;
- Vendor business/catalog/bookings and Admin pending-onboarding server adapters exist and are authority-tested;
- production hardcoded/fabricated legacy screens were reduced;
- field classification exists at `docs/native-mobile/WEWED_NATIVE_PHASE8_FIELD_CLASSIFICATION.md`;
- server disposable-database qualification passed on the reviewer server head;
- reviewer native gate on product head `b34ee8524ca1aa122228a769825e22372faba5a7` passed iOS Swift tests/build, simulator build, unsigned Release build, and Android unit/debug/release assembly. Temporary qualification workflows were then removed.

Moderator-owned closure patches before this checkpoint:
1. Added explicit native-domain error codes so 401, real grant revocation, permission denial, scope denial and engagement denial are distinguishable.
2. Android/iOS clients now clear the account session only for session invalidation, and clear a grant/context only for explicit grant revocation/authority loss; generic 403/404 no longer revoke a valid context.
3. LIVE production-domain failures no longer silently become empty lists/empty programme data.
4. Production Planner UI no longer displays Shadow-only authorization/enquiry claims.
5. Unsupported Planner client-portfolio, attention/activity, contribution/document and Wedding-Day operational streams now render as UNSUPPORTED rather than falsely claiming no records.
6. Coordinator production UI no longer derives gate/vendor-arrival counts from deliberately empty Phase-8 Wedding-Day placeholders.
7. SwiftUI reviewer patch was corrected after an intermediate qualification head failed to compile; the final exact product head passed the full native reviewer gate.

Remaining Phase-8 blockers:
- Vendor server adapters are not wired into a real production Vendor portfolio/engagement role shell; Production still falls back to the Phase-5/6 minimal snapshot.
- Admin production UI still falls back to the minimal snapshot and only one Admin metric is connected; mature system domains remain unwired.
- Contributions, contracts/deal-room and documents/vault remain unsupported for Couple/Planner despite mature PWA/server domains existing.
- `NativeRepositoryFactory.PRODUCTION` still constructs boundary repositories and relies on reactive root rebinding for only some roles; this transitional architecture must be closed for mature production workspaces.
- Task validation/format helpers are shared, but create/update mutation logic remains duplicated between PWA and native routes instead of one shared server-domain operation.
- Production-reachable Shadow-era/dead Planner destination surfaces require a final reachability/static-data cleanup.
- Every production-visible mutation or empty-state must be audited so transport/permission failures never appear as real empty data.
- F-3 still blocks real production Vendor wedding grants; implementation must support legitimate grants without fabricating production evidence.
- F-4 remains unapplied to production; F-6 and `WEWED_SESSION_SECRET` remain later/operational gates.

Phase gate:
- Phase 8: **NOT ACCEPTED**;
- continue Phase 8 from the reviewer-clean heads above;
- Phase 9: **NOT STARTED / NOT AUTHORIZED**.

### D-018 — Phase 7 status (2026-09-22)
**ACCEPTED — onboarding is reconciled to the canonical Supabase/account relationship graph, F-4 is closed at migration-code level, zero-wedding Planner completion is repaired, native onboarding remains unavailable, and independent server/native qualification passed. Phase 8 may begin.**

Accepted server branch:
- `backend/onboarding-reconciliation-phase7-20260922`
- final clean head: `4e17c12ceb116a39dd48beff5f6ca65ba9997dba`
- implementation-agent head reviewed: `1b6c255a950b47cc38406730e2c52fd4b2659f34`
- executable reviewer qualification head: `7d8ef1adce5805a599f3580428346ae706c24473`

Accepted native branch:
- `native-mobile/onboarding-reconciliation-phase7-20260922`
- final clean head: `8024de5e7cb7e4ae3cdda3471aff522d3c9417fd`
- implementation-agent head reviewed: `7128ad409aeab431907dfe82d8fb546246ed3635`
- executable reviewer qualification head: `6f67ad7c3aa28dc5687ccdd44b3de628bd0c745a`

Independent review confirmed:
- legacy `/api/onboarding` is not part of the canonical authority graph and fails closed with HTTP 410 in real production while preserving its documented local/CI seeding use;
- modern public registration remains `/api/auth/register` using Supabase identity plus `User`, `UserProfile`, `BusinessAccount`, `BusinessAccountMember` and provider records as applicable;
- admin completion remains the controlled graph-provisioning path for Couple and planning-company accounts;
- Couple completion creates the coherent Couple/Wedding/WeddingMembership/BusinessAccountLink graph and resolves to the real Couple wedding grant;
- zero-wedding planning-company completion creates no placeholder wedding and resolves to the Planner portfolio grant;
- an attached Planner wedding reuses the existing wedding and yields legitimate portfolio + wedding grants;
- Coordinator authority remains strictly WeddingMembership-scoped;
- Vendor/Venue applicants do not fabricate wedding/business authority and dedicated stakeholder activation remains gated;
- Guest remains a separate identity domain and Phase-7 onboarding does not create account rows for Guest access;
- admin completion uses a database row lock to make concurrent completion idempotent.

Schema/migration closure:
- F-4: `wewed_admin."BusinessAccount"."subscriptionStatus"` default changes from invalid `inactive` to allowed `free`; no existing row is rewritten;
- F-7 discovered in Phase 7: the existing public-onboarding completion trigger incorrectly required a wedding for every planning company, making the accepted zero-wedding Planner portfolio impossible to complete;
- additive migration `20260922130000_fix_planner_zero_wedding_onboarding_completion_trigger` preserves all previous identity/membership/profile/Couple integrity checks while making the wedding-membership requirement conditional for planning companies with no wedding link;
- neither Phase-7 migration was applied to production.

Moderator-owned closure:
1. **Legacy production containment was code-inspected but not executed in the agent's integration suite.**
   - Added a direct production-environment route test proving `POST /api/onboarding` returns 410 before the legacy graph can be written.
2. **Admin completion could recreate/rebind the Supabase identity profile from metadata.**
   - The agent correctly documented `UserProfile.id` as the Supabase auth uid, but completion still used `userProfile.upsert`.
   - Moderator changed completion to require the existing `UserProfile` at `metadata.authUserId` with the same owner email before any onboarding mutation.
   - Couple/Planner completion now updates that already-verified profile; missing/mismatched profile linkage fails closed with 409 rather than manufacturing a new auth relationship.
   - Added disposable-DB regression corrupting `metadata.authUserId` and proving no Couple/Wedding/profile rebind occurs.
   - Canonical onboarding-state documentation synchronized to registration-owned profile creation + completion-owned verification/update.

Independent server qualification:
- temporary reviewer workflow used disposable PostgreSQL 16 only;
- full repository migration chain, including both Phase-7 migrations, applied successfully;
- Phase-7 onboarding + authority qualification passed;
- carried-forward native-account, authority and Guest Session/invitation regressions passed;
- production application build passed;
- Vercel status for the implementation branch was successful;
- no production database, secret value, deployment or live account graph was touched.

Independent native qualification:
- iOS `swift test`: **358 tests, 14 expected skips, 0 failures**;
- Swift package build: PASS;
- XcodeGen project generation: PASS;
- iOS simulator build: PASS;
- unsigned iOS Release/device build: PASS;
- Android `testDebugUnitTest assembleDebug assembleRelease`: **BUILD SUCCESSFUL**;
- native onboarding remains unavailable; no native source calls `/api/auth/register`.

Carry-forward:
- **F-3 Vendor production-link gap remains open**; no Vendor wedding authority was fabricated.
- **F-4 is closed in repository migration code but still requires the later governed production-migration process before production write expansion.**
- **F-6 legacy PWA global-admin hazard remains open** for Phase 12.
- **`WEWED_SESSION_SECRET` remains an operational Preview/Production activation gate**; not read, created or rotated.
- native onboarding remains unexposed.
- no merge to main, production deployment, production migration, Play/TestFlight publication or production data mutation was authorized/performed.

Phase gate:
- canonical onboarding graph: PASS;
- legacy parallel production onboarding contained: PASS;
- deterministic auth-profile linkage: PASS;
- Couple/Planner/Coordinator authority post-conditions: PASS;
- Vendor/Venue no-fabrication: PASS;
- F-4 migration-code fix: PASS;
- zero-wedding Planner completion: PASS;
- concurrency/idempotency: PASS;
- Guest separation: PASS;
- native onboarding unavailable: PASS;
- independent server/native qualification: PASS;
- Phase 7: **ACCEPTED**;
- Phase 8: **READY TO BEGIN**.

### D-017 — Phase 6 status (2026-09-22)
**ACCEPTED — independent Rule-10 review passed after moderator-owned multi-account, engagement-context and test-qualification closure. Phase 7 may begin.**

Accepted server branch:
- `backend/multi-context-isolation-phase6-20260922`
- final clean head after temporary qualification-workflow removal: `aa8fe5e02805afcf7f80184b71cb505caa5fe8f0`
- implementation-agent head reviewed: `7ad797ae6f8b3d9ddd710b39f486680b93e9043c`
- executable disposable-Postgres qualification head: `94b22c069d8f385ef52f5454b35634601cd47d20`

Accepted native branch:
- `native-mobile/multi-context-isolation-phase6-20260922`
- final clean head after temporary native qualification-workflow removal: `d9fd25887b7b4425ffaf710b77bff64d5a148ef4`
- implementation-agent head reviewed: `38988838f85d7e588df7ef713f6666bb1467551d`
- final executable qualification head: `052113e7e464bbd115fdeee26b5c0d60aea837e8`

Independent review accepted:
- explicit context switching after a workspace is already active;
- Planner switching across three genuine wedding grants A → B → C → A without signing out;
- one selected grant per workspace kind, with ambiguous persisted same-kind state failing closed;
- multi-role switching such as Couple ↔ Planner and Planner ↔ Admin/system without flattening authority to role strings;
- Admin/system remaining wedding-less and clearing prior wedding-scoped state;
- Coordinator remaining restricted to actual Coordinator wedding grants;
- account identity retained separately from active context;
- old workspace snapshot removed synchronously before a new context fetch can render;
- transient workspace failure withholding data without destroying the identity credential;
- revoked grants clearing active grant/role/wedding/context rather than guessing a replacement;
- Guest remaining a separate authority/bootstrap path outside account context switching;
- Shadow remaining unavailable as production authority.

Moderator-owned defects found and closed:
1. **Persisted context preference was not actually account-owned across process restart.**
   - `wewed.account.selected-grants` had no verified-account owner.
   - An ownerless/stale preference could be inherited by Account B if a grant-id string happened to collide.
   - Android/iOS now persist the verified `accessUserId` alongside the grant selection; owner mismatch or legacy ownerless storage fails closed and requires reselection.
   - Identity change, unusable authority and sign-out clear both selection and selection-owner state.
2. **Vendor engagement selection did not reach navigation authority.**
   - Session/workspace UI knew the selected engagement, but `ProductionActorAssignmentSource` still mapped the Vendor grant without `selectedEngagementId`.
   - Android/iOS assignment-source factories now propagate the chosen engagement through `ProductionGrantMapper → ActorAssignment.engagementId → NavigationContext`.
   - Foreign engagement ids fail closed.
3. **iOS navigation-context refresh keyed only on selection count.**
   - A same-count grant switch could leave the old resolved context alive.
   - iOS now re-resolves on exact active grant, complete selected-grant set and engagement id; Android dependencies were synchronized.
4. **Context switcher discarded safe presentation names.**
   - The authority contract already carries `businessMemberships[].businessName` and `vendorEngagements[].vendorName`.
   - Native decoders/switchers now use those presentation-only names where available rather than exposing raw ids. These fields remain non-authoritative.
5. **Phase-6 Planner test did not literally prove A → B → C → A.**
   - Reviewer strengthened Android/iOS fixtures to three genuine Planner wedding grants and pinned singular same-kind selection across the full cycle.
6. **Reviewer qualification fixtures contained ordinary test defects.**
   - Fixed invalid iOS Vendor-grant JSON construction/string interpolation.
   - Fixed account-owned persisted-selection assertions that incorrectly assumed which unrelated legitimate axis must become initially active.
   - These were test defects only; runtime authority remained fail closed.

Vendor engagement result:
- server workspace reads re-resolve `WewedProductionAuthorityV1` every time;
- client-supplied `engagementId` is accepted only if it belongs to the freshly resolved Vendor grant;
- one engagement may resolve deterministically;
- multiple engagements require explicit choice;
- invalid/revoked engagement clears engagement context/snapshot without revoking the still-valid wedding grant;
- no production Vendor authority was invented and Phase-3 F-3 remains open.

Server qualification:
- temporary workflow used disposable PostgreSQL 16 only;
- repository migrations applied successfully;
- Phase-6 authority/workspace + carried-forward account/Guest regression suites: **129 pass / 0 fail**;
- migrated-database Vendor engagement selection and foreign-engagement rejection executed rather than remaining source-only;
- production-equivalent application build passed;
- no production database, live account graph, production secret value or deployment was touched.

Native qualification on `052113e7...`:
- iOS `swift test`: **355 tests, 14 expected skips, 0 failures**;
- iOS `swift build`: PASS;
- XcodeGen project generation: PASS;
- iOS simulator app build: PASS;
- unsigned iOS Release/device build: PASS;
- Android `testDebugUnitTest assembleDebug assembleRelease`: **BUILD SUCCESSFUL**;
- exact Phase-6 switching/account-isolation/engagement tests passed on the qualification head.

Carry-forward gates:
- **F-3 Vendor production link gap remains open**; no synthetic production Vendor wedding grant was created.
- **F-4 BusinessAccount subscription default remains open** and is now a direct Phase-7 onboarding/write-safety gate.
- **F-6 legacy PWA global-admin hazard remains open** for Phase 12.
- **`WEWED_SESSION_SECRET` remains an operational Preview/Production gate**; no secret value was read, created or rotated in Phase 6.
- no merge to main, production deployment, schema mutation, Play/TestFlight publication, production data write, or WW2 activation was authorized or performed.

Phase gate:
- multi-wedding isolation: PASS;
- multi-role isolation: PASS;
- account A/B persisted-context isolation: PASS;
- Admin system/wedding separation: PASS;
- Coordinator wedding isolation: PASS;
- Vendor engagement isolation: PASS;
- Wedding A/B stale-data adversarial test: PASS;
- Android/iOS symmetry: PASS;
- Guest separation: PASS;
- server-side revalidation: PASS;
- Phase 6: **ACCEPTED**;
- Phase 7: **READY TO BEGIN**.

### D-016 — Phase 5 status (2026-09-22)
**ACCEPTED — independent Rule-10 review passed after reviewer-owned activation, isolation, and read-only data closure. Phase 6 may begin.**

Accepted server branch:
- `backend/native-account-readonly-phase5-20260922`
- final clean head after temporary reviewer-CI removal: `75ea4044b37822ba5dd8e3cdebd74296a9c344cd`
- implementation-agent head reviewed: `b3eb76fc1d06f6e6140acbe644806b2fd96ef8e6`
- server reviewer qualification code head: `c935993f005f7ef020d65abaf08f43c04fd656b2`
- disposable-Postgres reviewer workflow head: `9def48aec8747e3a988e7b0f95356a89586d50f7`

Accepted native branch:
- `native-mobile/account-readonly-phase5-20260922`
- final clean head after temporary reviewer-CI removal: `65931b817884b9ecee961f860161345c3a9cf5cf`
- implementation-agent head reviewed: `2431bde1d8bd8387297e9bac94eba566e7c2cc0f`
- final executable reviewer qualification head: `eeaec4e09d1e307c6dc8e2ad6885cdba4c6c9001`

Independent review confirmed the implementer correctly introduced:
- native account sign-in using direct Supabase credential verification rather than delegating to the mutable browser sign-in path;
- an identity-only native account session containing `version + accessUserId + authUserId + email + expiresAt`, with no role/wedding/grant authority embedded;
- dedicated `WEWED_SESSION_SECRET` signing for new native account sessions, with no service-role fallback;
- a read-only `GET /api/native/account/authority` returning the existing unflattened `WewedProductionAuthorityV1`;
- Android/iOS `ProductionActorAssignmentSource` using the accepted `ProductionGrantMapper`, not flat `AppRole.fromId(serverRole)`;
- fresh authority revalidation on sign-in/session restoration;
- explicit selection of multi-grant contexts;
- Planner zero-wedding portfolio and Vendor business grants remaining real authority without fake wedding assignments;
- Coordinator authority deriving from wedding membership; Admin remaining system-scoped;
- Guest Session v2 remaining a separate identity domain.

Reviewer-owned defects found and closed:
1. **Production account code was unreachable in actual release bootstrap.**
   - Android/iOS production launch still intentionally degraded/refused while the new authority client existed only as unused code.
   - Production now boots a read-only account workspace when no Guest relationship owns the launch.
2. **Production `NativeRepositoryFactory` still threw.**
   - Replaced only for production with fail-closed boundary repositories; legacy mutable/fixture repository domains remain unavailable.
   - Full mature domain parity remains Phase 8.
3. **No real production workspace data rendered.**
   - Added `GET /api/native/account/workspace?grantId=...`.
   - The server re-resolves `WewedProductionAuthorityV1` on every request, validates the selected server-issued grant, accepts no raw wedding/business/vendor scope IDs from the client, performs no write, and returns a minimal real read-only wedding/business/system snapshot.
   - Android/iOS render that snapshot inside the existing shell; no fixture/Shadow fallback is permitted.
4. **Mobile sign-in risked browser cookie-session side effects.**
   - Native sign-in now uses a non-persisting Supabase client (`persistSession=false`) and issues only the native identity credential.
5. **Grant-selection union bug.**
   - Selecting Wedding B after Wedding A could preserve both same-kind grant IDs.
   - Selection is now one-per-workspace-kind; ambiguous persisted same-kind selections fail closed.
6. **Grant-selection UI deadlock.**
   - The picker originally depended on `currentRole`, although `currentRole` cannot exist until one of multiple same-kind wedding grants is selected.
   - Selection is now reachable pre-assignment and is constrained to the active role when one already exists.
7. **Planner portfolio/Vendor business were falsely presented as “no workspace.”**
   - A sole unambiguous portfolio/business grant now has a real read-only landing while still producing no fake wedding `ActorAssignment`.
8. **Revoked workspace snapshot could leave stale active context fields.**
   - 403/404 clears active grant/role/wedding and removes the revoked persisted selection; no replacement context is guessed from stale authority.
9. **Remembered Guest/account isolation asymmetry on iOS.**
   - iOS could instantiate account restoration before deciding a remembered Guest owned launch.
   - Guest ownership is now decided before constructing the production account session client, matching Android separation.
10. **Stale Phase-1 “production disabled” tests/comments.**
   - Synchronized with Phase-5 invariant: production read-only bootstrap is allowed, Shadow/fixture substitution remains forbidden.
11. **Reviewer test defects.**
   - Fixed async XCTest autoclosure misuse and fake workspace transports so unconfigured snapshot reads model transient unavailability rather than false revocation.

Server execution evidence:
- temporary reviewer workflow used disposable PostgreSQL 16, applied repository migrations, synthetic non-production Supabase/session values only;
- `WewedProductionAuthorityV1` disposable-database integration suite executed rather than skipped;
- Phase-5 account-session/contract + Phase-2 authority + carried-forward Phase-4 Guest suites: **108 pass / 0 fail** across 9 files;
- authority integration proved Couple, Planner one/multiple/zero wedding, Coordinator, multi-axis actor, Viewer denial, Vendor link isolation, Admin, inactive/unknown, Guest/Usher exclusion, verified-auth requirements, banned-profile denial, PWA agreement, and no automatic single-workspace flattening;
- Vercel build/status for the server code head succeeded;
- no production database, live account graph, real secret value, deployment, or migration target was touched.

Native execution evidence on reviewer qualification head `eeaec4e...`:
- iOS `swift test`: **334 tests, 14 expected skips, 0 failures**;
- iOS `swift build`: PASS;
- generated Xcode project: PASS;
- iOS simulator app build: PASS;
- unsigned iOS Release/device build: PASS;
- Android `testDebugUnitTest assembleDebug assembleRelease`: **BUILD SUCCESSFUL**;
- native authority/session tests include production assignment mapping, same-kind ambiguous selection fail-closed, singular grant replacement, portfolio no-fake-wedding behavior, stale/revoked selection handling, and production boundary repository qualification.

Read-only Phase-5 scope:
- production account launch now reaches real authentication, fresh authority, explicit grant/context selection, `ActorAssignment`, `NavigationContext`, and a real server-revalidated minimal workspace snapshot;
- old mutable native repositories remain unavailable in production;
- task/budget/guest/seating/vendor/timeline/document/full Admin data parity is deliberately not enabled here and remains Phase 8 scope.

Guest regression:
- explicit/remembered Guest continues to use Guest Session v2, separate secure storage, and Guest-only bootstrap;
- account identity is not required for Guest access;
- remembered Guest launch does not restore account authority in the background;
- Phase-4 Guest regression suites passed in server qualification.

Carry-forward gates:
- **F-3 Vendor production link gap remains open**: real production Vendor wedding grants remain constrained by missing production `BusinessAccountLink(entityType='vendor')` evidence; Phase 5 does not invent them.
- **F-4 BusinessAccount subscription default remains open** for later write expansion.
- **F-6 legacy PWA global-admin hazard remains open** for Phase 12.
- **`WEWED_SESSION_SECRET` remains absent from Vercel Preview/Production** according to the prior names-only checks. No secret was read/created/rotated. Live Preview/Production HTTP qualification of Guest Session v2 and native account endpoints remains operationally blocked pending explicit owner authorization.
- Phase-5 acceptance authorizes no merge, production deployment, schema migration, secret creation, Play/TestFlight publication, or production data mutation.

Phase gate:
- account identity/session: PASS;
- shared production authority: PASS;
- explicit context selection: PASS;
- production read-only bootstrap: PASS;
- server-revalidated minimal real workspace data: PASS;
- Android/iOS symmetry: PASS;
- Guest separation/regression: PASS;
- reviewer execution qualification: PASS;
- Phase 5: **ACCEPTED**;
- Phase 6: **READY TO BEGIN**.

### D-014 — Phase 4 preflight (2026-09-22)
**READY TO BEGIN — reviewer preflight patch applied before implementation handoff.**

Before issuing Phase 4, the reviewer inspected the existing `backend/guest-session-v2-promotion-20260921` candidate and found a migration-compatibility gap: production Guest Session v1, Guest portfolio and shared-invitation cookies historically could be signed by the `SUPABASE_SERVICE_ROLE_KEY` fallback when `WEWED_SESSION_SECRET` was absent. Configuring a new dedicated `WEWED_SESSION_SECRET` and verifying only against that key would have invalidated those remembered legacy cookies immediately, contradicting Phase 4's v1-read-compatibility requirement.

Reviewer-owned correction is now on:
- `backend/guest-session-v2-promotion-20260921` @ `e4dc7d14cc5d394c398bd9ceb143b924bb0261fa`.

The patch:
- requires the dedicated `WEWED_SESSION_SECRET` for all newly-signed production credentials;
- permits the historical service-role signer only as a verification key for legacy v1 Guest Session / Guest portfolio / shared-invitation cookie formats during migration;
- refuses a v2 Guest Session signed only by the legacy service-role key;
- adds regression coverage for that exact rotation boundary.

This patch is a Phase-4 input only. Phase 4 itself has not started, no production secret was changed, and no production deployment occurred.

Reviewer qualification branch:
- `backend/guest-session-v2-phase4-qualification-20260922` from `e4dc7d14cc5d394c398bd9ceb143b924bb0261fa`;
- reviewer found and fixed one ordinary branch-local defect before handoff: `wedding-shared-invitation-session.ts` referenced `primarySessionSigningSecret` / `legacySessionVerificationSecrets` without importing them;
- patched qualification head: `4b6253665573b1bdff2ac153963e99eac576359a`;
- this branch is the Phase-4 implementation/qualification starting point; the original promotion branch remains preserved for provenance.

### D-013 — Phase 3 status (2026-09-22)
**ACCEPTED — independent Rule-10 review passed after reviewer-owned cleanup/corrections.** Phase 4 may begin; it has not started.

Accepted Phase-3 branch:
- `backend/production-database-audit-phase3-20260922`
- final review/cleanup head: `d8b0fdadac3418c9f3bd2cd081b8004404faf926`
- audit evidence head supplied by the implementation agent: `d4241650bdb398cdefc5bd377ba6265c32e11854`

Verified production facts:
- Wewed Supabase project ref `kjigkhjdeymukwradoqu` was positively identified from the Vercel-injected database connection inside the protected Preview audit bridge;
- application role is `postgres`, not SUPERUSER, with `BYPASSRLS = true`;
- the global relationship graph checks returned zero core orphans/cross-wedding mismatches for the audited Couple/Wedding/WeddingMembership/Guest/RSVP/Seating/Vendor/ServiceEngagement/link relationships;
- no production Usher/Gate authority objects exist;
- no Wedding Day/WW2 production objects are partially present;
- `Guest(id,weddingId)` composite uniqueness is absent, matching the expected pre-Wedding-Day state;
- controlled production authority probes proved Couple, Planner one/multiple weddings, Vendor business scope, Admin and a multi-axis relationship shape; Planner zero-wedding portfolio and Coordinator had no live production example and therefore remain production-unproven, not fabricated.

Reviewer corrections/closure:
- removed the temporary Preview audit route and its DATABASE_URL fingerprint helper/tests;
- restored `src/lib/production-authority/resolver.ts` byte-for-byte to the accepted Phase-2 implementation, leaving no audit-only runtime code in the accepted branch;
- retained only the sanitized audit document and the SELECT-only catalog preflight script;
- reviewer additionally synchronized the retained preflight script with the final audit evidence by preserving the `security_invoker` reloption query and full migration-ledger status list before pinning the accepted head;
- corrected unsupported causal language around the unresolved `20260730173000_wewed_business_admin_console` ledger row: the missing Vendor links are proven, but the historical root cause is not;
- reclassified the `BusinessAccount.subscriptionStatus` default `inactive` vs CHECK-constraint contradiction as a real latent write-time schema defect, despite current rows being clean.

Carry-forward gates:
- **F-3 Vendor authority:** zero `BusinessAccountLink(entityType='vendor')` rows means no production `vendor/wedding` grant is currently reachable. Root cause/provenance must be established and remediation approved before Vendor wedding-scoped native activation in Phase 5/8.
- **F-4 BusinessAccount default:** the contradictory `subscriptionStatus` default must be fixed by controlled schema work before/within Phase 7 onboarding/business-account write expansion.
- **F-6 legacy global-admin hazard:** 1 active legacy admin-class account can synthesize access to all 10 weddings through the current PWA path; remediation remains owned by Phase 12.
- RLS zero-policy and stale PlatformAdministrator registry findings remain hardening items but do not block Phase 4.

Safety result:
- production INSERT/UPDATE/DELETE/DDL/GRANT/REVOKE/data repair: **ZERO**;
- no production secret was committed or exposed;
- Phase 3 accepted with the above deferred, explicitly owned remediation items.

### D-012 — Phase 2 status (2026-09-22)
**ACCEPTED — independent Rule-10 review passed after reviewer-owned closure patch.** Phase 3 may begin; it has not started.

- **Accepted server branch:** `backend/shared-production-authority-phase2-20260922` @ `ebf18558916a0dd27f6ef172d54e3dd40f8169f6` (authority code accepted at `18f3561655607ef0679404b2f8ef5eadbe6dfbdd`; later commit adds only the root governance pointer).
- **Accepted native branch:** `native-mobile/shared-production-authority-phase2-20260922` @ `6d8d9b71c17beff9c32f626a798ac989ba0014b1` (native contract accepted at `996550b4d679eff554d2fc0d7a836fa9efa6d563`; later commit adds only the root governance pointer).
- **Agent closure before review:** server 7dcfab3e → 15603eba; native 311b085a → d9839417.
- **Reviewer-owned patch:** the independent review found that non-`authorized` contract results still returned identity and relationship evidence even though they issued no grants. The server contract now redacts identity PII, memberships, business links, weddings, vendor engagements, platform evidence and onboarding relationship lists for unverified/inactive/banned results. A pure regression test and matching specification update were added. The native fixture did not change; the native branch received the synchronized specification only.
- **Verification:** reviewer re-inspected the final remote code and shared-document blobs. The agent's pre-review execution evidence remains 24/24 pure, 22/22 integration, Android 314/314 and iOS 316/316; the reviewer patch adds one pure regression test but was not independently executed in this environment.

Prior status (superseded): **REVIEW CLOSURE IMPLEMENTED — awaiting independent Rule-10 review.**

The closure addressed:
- **A. Canonical Vendor links.** The only repository writer of `entityType='vendor'` links is the canonical backfill, which uses `represents`. The recognised set is now exactly `{represents}`; the unwritten default `owns`, the wedding `serves` companion and unknown values fail closed. A canonical migrated Vendor now receives its wedding grant.
- **B. Verified auth identity mandatory.** A missing or blank `authUserId` gives the new `accountStatus` `unverified_auth_identity` with no grants. A banned UserProfile gives no grants. A missing UserProfile row does not block a valid account (mirrors `/api/auth/me`).
- **Admin defense-in-depth.** The effective role must be in `WEWED_INTERNAL_ADMIN_ROLES`.

Evidence:
- pure tests 24/24;
- integration 22/22 on a disposable local PostgreSQL;
- full `bun test src` failure set identical to main;
- Android 314/314; iOS 316/316.

The shared fixture is regenerated and byte-identical on both branches. `/api/auth/me`, PWA behaviour, schema and native activation are unchanged. Specification §9 added.

Prior status (superseded): IMPLEMENTED — awaiting independent review (Rule 10).

- **Server:** `backend/shared-production-authority-phase2-20260922` @ 7dcfab3eed799fad63af1287757f2681f2fdd4f7 (from main ba4b08f8).
  - Contains `WewedProductionAuthorityV1`, pure grant rules, and the read-only `resolveProductionAuthority`.
  - No endpoint, no new auth transport.
  - Existing files changed by exports only.
- **Native:** `native-mobile/shared-production-authority-phase2-20260922` @ 311b085ad3c224baace6fe3b6599fa3e696dbc6f (from accepted Phase 1, 83ef10ee).
  - Contains the Android/iOS DTOs, strict decoder and conservative grant mapper; not activated.
- **Specification:** `docs/native-mobile/WEWED_PRODUCTION_AUTHORITY_CONTRACT_V1.md`, on both branches.
- **Shared fixture:** byte-identical on both branches.
- **Evidence:**
  - server pure tests 16/16;
  - server integration 16/16 on a disposable local PostgreSQL migrated with the repository's own migrations, covering the matrix plus agreement with `listAccessibleWeddings`, `isWewedPlatformAdministrator` and `/api/auth/me`;
  - full `bun test src`: failure set identical to main (the database-dependent suites);
  - Android unit 314/314; iOS 316/316.
- **Planner portfolio** is a distinct `portfolio` scope, never a placeholder wedding. It maps to `RequiresWeddingSelection`, not to an `ActorAssignment`.
- **Phase 3 inputs:** the unresolved production-catalog questions in the specification §8 (items 1–12).
- **New hazards:** §8.15, §8.16.

### D-011 — Phase 1 status (2026-09-22)
**ACCEPTED — independent review passed.** Accepted SHA: 83ef10eed8ba896fb5f399101096ede36b8cad51 (branch `native-mobile/production-authority-foundation-phase1-20260922`). The Rule-10 review confirmed §8.14 and P1-N1 closed against the pushed code. Retained as test-harness debt, not authority defects: the Maestro cold-start rerun flake, and the dev-build `https://wewed.pro` chooser (deferred to Phase 13 signed-link qualification). Phase 2 may begin.

Prior status (superseded): **CLOSURE IMPLEMENTED — awaiting independent review (Rule 10).** The Rule-10 review of c6b71eaf found §8.14 and required P1-N1 to be fixed. Both are closed at 83ef10eed8ba896fb5f399101096ede36b8cad51, the proposed accepted ending SHA. Phase 1 is not accepted until independent review confirms this against remote code. Phase 2 has not started.

Closure evidence (at 83ef10ee):
- Android unit 301/301; Android instrumentation 6/6;
- iOS `swift test` 304/304; iOS GuestProfileUITests 5/5, with the fake Guest server running;
- Android Maestro Shadow flows passed: guest-pass-identity, role-traversal, persona-switching, shadow-deep-link-invitation, invitation-returning-attending. guest-pass-identity and role-traversal failed on the first run right after install and passed on immediate rerun: a cold-start timing flake, not an authorization failure (the planner workspace was confirmed rendering on direct launch);
- `native-invitation-invalid-fails-closed` was not run, because `https://wewed.pro` still resolves to the OS chooser on this emulator (P1-N3).

Original Phase 1 implementation record (c6b71eaf):

- **Branch:** `native-mobile/production-authority-foundation-phase1-20260922`
- **Start:** d7c4dddeabb594810a5833b4ac24d356883a8a3b
- **Proposed accepted ending SHA:** c6b71eaf996631e2373ceb6a8dea41675098ea98

Closed on Android and iOS:
- §8.1 fail-open AppRole;
- §8.2 production session and wedding defaults;
- §8.8 restored-token authority;
- §8.9 unconditional Shadow authority and default-wedding/actor fallback;
- §8.10 release launch inputs;
- §8.11 stale Guest entry contracts (one contract: `GuestCeremonialEntry.opensOnInvitation`);
- production-reachable §8.13 fabrication (Settings identity, Event Switcher).

Evidence:
- Android unit 290/290; Android instrumentation 6/6;
- iOS `swift test` 293/293; iOS GuestProfileUITests 5/5;
- Android Maestro Shadow flows requalified: guest-pass-identity, role-traversal, persona-switching, shadow-deep-link-invitation, invitation-returning-attending.

Discovered during Phase 1 (recorded, not fixed — outside Phase 1 scope):
- **P1-N1 (§6.5) — CLOSED at 83ef10ee, awaiting independent review.** Found: after a refused Guest B, both coordinators still held Guest A's `presentedGuestId` / `activeWeddingSlug`, so `refresh()` / `answer()` could target A. Fixed on Android and iOS:
  - `enter()` clears the presentation binding before any validation, so a refused, unreachable or rejected B leaves nothing actionable as A (`answer()` returns ReopenRequired with no PUT; `refresh()` returns Idle with no read of A);
  - A's stored secure session is untouched (the client writes only on success), and an explicit `restoreRememberedGuest()` can restore a still-valid A;
  - pinned by coordinator tests on both platforms.
- **P1-N2 (Shadow harness).**
  - The Shadow Guest workspace's Invitation destination is a section list, not the configured card. Under the single contract, Shadow therefore cannot qualify "My Digital Invitation → same card".
  - The production Guest shells remain qualified by the Android instrumentation and iOS UI suites.
- **P1-N3 (test environment).**
  - Maestro flows that open `https://wewed.pro/...` links (e.g. `native-invitation-invalid-fails-closed`) cannot reach `pro.wewed.app.dev` on an emulator where it is not domain-verified; the OS chooser intercepts. This is environmental and does not depend on app code.
  - iOS GuestProfileUITests require `scripts/native-mobile/guest-profile-ui-server.py` running on 127.0.0.1:8768.
- **P1-N4 (Phase 8).** These fabricated screens are compiled into release but have no callers, so they are not production-reachable:
  - Android: `HomeScreen`, `PlannerScreen`, `GuestsScreen`, `PassScreen`, `MasterCalendarScreen`, `VendorCatalogScreen`, `AdminGovernanceScreen`, `MarketplaceDirectoryScreen`, and 20 of 24 `PlannerDestinations`;
  - iOS: the equivalent views.

  Phase 8 must delete them or rebuild them on live data. They must not be wired in as-is.
- **P1-N5 (parity).** iOS `RootView` does not call `LaunchRouter`, while Android `RootScreen` does. Behaviour matches, but the state machine is asserted rather than executed on iOS.

Remaining Phase 2 blockers / inputs:
1. independent review of Phase 1 (Rule 10);
2. the server grant contract (Phase 2) must supply multi-axis grants, because `AppRole.fromId` is now strictly a native-id parser, and production resolves no assignments and no weddings until Phase 5;
3. §8.12 (workspace-root live Guest path) must be resolved before Phase 5 enables the workspace;
4. ~~P1-N1~~ closed at 83ef10ee, pending review.

---

## 17. Immediate next phase after this plan is locked

**Phase 1 — Make native state honest and fail closed.**

It is intentionally first because it reduces risk before any production account connection.

The first implementation task after plan lock must:
1. remove production-reachable hardcoded Couple/wedding defaults;
2. fix AppRole fail-open fallback;
3. isolate test personas/scenarios;
4. reconcile dead/stale invitation routing policies without changing the qualified Guest runtime;
5. run full native regression suites;
6. make no production database or backend deployment change.

Only after Phase 1 is independently accepted should Phase 2 begin.

---

## 18. Final north star

The final product must behave as one coherent relationship system:

~~~text
Identity
  ↓
authoritative relationships
  ↓
active context
  ↓
capabilities
  ↓
shared server/business truth
  ↓
PWA / Android / iOS presentation
~~~

And the Guest path remains a deliberately separate invitation-bound identity path:

~~~text
private invitation
  ↓
Guest Session v2
  ↓
configured Digital Invitation
  ↓
RSVP
  ↓
Guest Home
  ↓
Wedding Day + WW2 when eligible
~~~

The program is complete only when both paths coexist without cross-role leakage, test-data dependency, PWA regression, or native security regression.
