# WEWED NATIVE + PWA PRODUCTION CONVERGENCE MASTER PLAN

**Plan ID:** WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01  
**Status:** AUTHORITATIVE CONCEPT PLAN — change-controlled, pending peer review before LOCKED status  
**Date:** 2026-09-22  
**Scope:** Wewed PWA, Android, iOS, backend APIs, production database, invitation/Guest identity, stakeholder authority, Wedding Day/WW2, release infrastructure, and production qualification.

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

### 8.6 Seed posture

Any production-reachable seed route with insufficient admin gating must be audited and locked before full production integration.

### 8.7 PWA pass naming collision

The existing PWA Wedding Pass is a UI projection, not WW2 admission authority.

**Required:** rename/upgrade semantics when WW2 becomes shared, so clients cannot silently use the wrong contract.

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
- audit hardcoded sample metrics/content in role workspaces.

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
