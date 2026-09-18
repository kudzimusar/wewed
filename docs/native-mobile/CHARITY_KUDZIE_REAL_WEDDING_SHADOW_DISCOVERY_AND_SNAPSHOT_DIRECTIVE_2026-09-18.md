# Charity & Kudzie Real-Wedding Shadow Discovery & Snapshot Directive

**Directive ID:** WW-NATIVE-CHARITY-KUDZIE-REAL-SHADOW-2026-09-18-01  
**Status:** AUTHORITATIVE NEXT EXECUTION DIRECTIVE  
**Parent plan:** `WW-NATIVE-SHADOW-REAL-WEDDING-PARITY-2026-09-18-01`  
**Reference wedding:** Charity & Kudzie  
**Reference planner context:** Eleven Eleven Testing  
**Implementation branch:** `native-mobile/shadow-setup-implementation-20260918`  
**Production writes:** PROHIBITED  
**Production integration:** NOT AUTHORIZED  
**Purpose:** Replace the current synthetic Charity & Kudzie Shadow values with production-derived Charity & Kudzie structure and values, while preserving privacy and keeping every native mutation inside Shadow.

---

## 0. Why this directive exists

The current dual-native Shadow implementation is technically qualified, but its Charity & Kudzie values are synthetic.

It currently proves:

- the native architecture can run on iOS and Android;
- the Planner, invitation, RSVP and Wedding Pass journeys work;
- the Shadow environment can be selected safely;
- the fixture and Shadow E2E suites can pass.

It does **not** yet prove that native represents the actual Charity & Kudzie wedding graph.

From this point forward, agents must stop inventing operational values for the reference wedding.

The governing objective is:

> Production is the source of truth for the Charity & Kudzie wedding data shape and operational state. Shadow is the only place where native development may mutate that state.

Target architecture:

```
WEWED PRODUCTION
Charity & Kudzie
        |
        | strictly read-only discovery/extraction
        v
PRIVATE REAL-WEDDING SNAPSHOT
        |
        | remove secrets/auth + classify privacy
        v
+------------------------+-------------------------+
|                                                  |
v                                                  v
PRIVATE SHADOW DATABASE                 SANITIZED GIT-SAFE DERIVATIVE
real operational values                 pseudonymized/reference-safe
|                                                  |
+-------------------------+------------------------+
                          |
                          v
                   Shadow API/adapters
                          |
               +----------+----------+
               |                     |
               v                     v
            SwiftUI                Compose
```

The intended end state is that later production integration replaces transport/environment wiring rather than forcing a product redesign.

---

# 1. Mandatory Gate 0 — reconcile local and remote before analysis

Local native workspace:

```
/Users/shadreckmusarurwa/Project AI/wewed-native-mobile
```

Protected active Wewed workspace:

```
/Users/shadreckmusarurwa/Project AI/wewed
```

Do not modify the protected active workspace.

Required branch:

```
native-mobile/shadow-setup-implementation-20260918
```

Run before opening implementation files, production credentials, SQL, simulators or databases:

```bash
cd "/Users/shadreckmusarurwa/Project AI/wewed-native-mobile"

pwd
git status --short
git branch --show-current
git rev-parse HEAD

git fetch origin --prune

git rev-parse origin/native-mobile/shadow-setup-implementation-20260918
git switch native-mobile/shadow-setup-implementation-20260918
git pull --ff-only origin native-mobile/shadow-setup-implementation-20260918

git rev-parse HEAD
git rev-parse origin/native-mobile/shadow-setup-implementation-20260918
git rev-list --left-right --count HEAD...origin/native-mobile/shadow-setup-implementation-20260918
git status --short
```

Required state:

- local branch is exactly `native-mobile/shadow-setup-implementation-20260918`;
- local HEAD equals remote HEAD;
- divergence is `0 0`;
- worktree is clean.

If the remote branch moved from the SHA recorded in the handoff message, use the **new fetched remote SHA** as authority and report it before implementation.

STOP on any dirty worktree, divergence or unexpected branch.

Do not use destructive reconciliation commands such as `git reset --hard`, `git checkout .`, `git clean -fd` or force push.

---

# 2. Read these files before implementation

Read in this exact order:

1. `docs/native-mobile/WEWED_NATIVE_SHADOW_INTEGRATION_REAL_WEDDING_PARITY_PLAN_2026-09-18.md`
2. `docs/native-mobile/SHADOW_SETUP_IMPLEMENTATION_STATUS_2026-09-18.md`
3. this directive
4. `mobile/shadow/README.md`
5. `mobile/shadow/snapshot-manifest.schema.json`
6. `mobile/shadow/tools/01_discover_reference_wedding_readonly.sql`
7. `mobile/shadow/tools/02_audit_reference_wedding_counts_readonly.sql`
8. `mobile/shadow/tools/validate_shadow_material.py`
9. current iOS/Android repository interfaces and Shadow repositories.

Do not redesign the product before completing discovery.

---

# 3. Existing qualified work that must be preserved

The current branch already contains qualified:

- default Fixture E2E;
- synthetic Shadow E2E;
- Ivory Floral Gold invitation accept/decline E2E;
- Wedding Pass/Gate regression;
- environment guards;
- Shadow repository factory boundary;
- stable cross-platform test identifiers.

Do not replace the existing fixture environment.

Do not change WW2 credential verification architecture.

Do not treat current synthetic Shadow values as production-derived data.

Current synthetic files include:

```
mobile/fixtures/shadow-reference/reference-wedding-sanitized.json
apps/ios/Wewed/Services/ShadowReferenceWeddingRepository.swift
apps/android/app/src/main/java/pro/wewed/app/services/ShadowReferenceWeddingRepository.kt
apps/ios/Wewed/Services/PlannerDashboardRepository.swift
apps/android/app/src/main/java/pro/wewed/app/services/PlannerDashboardRepository.kt
```

Their current values are scaffolding only.

---

# 4. Phase 1 — prove the production access path is genuinely read-only

Before querying Charity & Kudzie, identify the exact production database/environment and the credential being used.

The agent must prove that the connection is read-only.

Minimum evidence:

```sql
BEGIN TRANSACTION READ ONLY;

SELECT current_user;
SHOW transaction_read_only;
SHOW default_transaction_read_only;

ROLLBACK;
```

The session must report `transaction_read_only = on` during the discovery transaction.

Use an explicitly authorized read-only role/replica. If the only available credential is the normal production application writer credential, STOP and report:

```
BLOCKED: no independently read-only production access path is available.
```

Do not use a write-capable production credential merely because the SQL statements are SELECTs.

Do not load production database credentials into either native app.

Do not copy production credentials into Git, chat, screenshots, test logs or Markdown.

---

# 5. Phase 2 — validate the prepared discovery SQL against current production schema

Before execution, compare the two prepared SQL files with the current production schema/reference on `main`.

Prepared files:

```
mobile/shadow/tools/01_discover_reference_wedding_readonly.sql
mobile/shadow/tools/02_audit_reference_wedding_counts_readonly.sql
```

Confirm every referenced table and column exists.

If schema drift is found:

- correct only the discovery SQL/templates on the native branch;
- keep all queries read-only;
- document the reason;
- commit/push the corrected scripts before executing them.

Do not alter production schema.

---

# 6. Phase 3 — identify the authoritative Charity & Kudzie graph

Run the discovery script only after Phases 1 and 2 pass.

Resolve from authoritative production records:

## Identity

- wedding/project ID;
- wedding slug/domain;
- couple record;
- Charity/Kudzie membership relationships;
- planner user/profile ID;
- Eleven Eleven Testing organization/profile ID;
- planner membership role/status;
- wedding lifecycle;
- wedding date;
- venue;
- timezone;
- locale/currency.

Do not guess IDs from names or chat.

If multiple Charity/Kudzie candidate weddings exist, STOP and report all non-sensitive distinguishing metadata rather than choosing one.

If Eleven Eleven Testing is not directly linked to the resolved wedding, STOP and report the mismatch.

---

# 7. Phase 4 — discover operational shape before exporting private records

Use the authoritative wedding ID with the count/status audit.

Collect a **data map first**, not a raw PII dump.

At minimum capture:

## Planner/tasks

- total task count;
- status distribution;
- blocked count;
- completed count;
- overdue count;
- priority distribution;
- task category distribution;
- assignee relationship availability.

## Budget

- line-item count;
- estimated total;
- actual total;
- paid total;
- outstanding total;
- category distribution;
- vendor links;
- contribution/funding links.

## Contributions

- contribution count;
- contribution types;
- statuses;
- verified/unverified;
- allocated/unallocated;
- budget links;
- direct-vendor-payment links.

## Vendors/service engagements

- engagement count;
- categories;
- booking state;
- contract state;
- payment state;
- task/timeline relationships.

## Guests/RSVP

- guest count;
- household count where represented;
- attending count;
- pending count;
- declined count;
- party-size distribution;
- checked-in count if any.

## Seating

- table count;
- capacities;
- assigned count;
- unassigned count;
- over-capacity state;
- guest/household/table relationships.

## Timeline/programme

- event count;
- ordering;
- location availability;
- vendor link availability.

## Invitations/Pass

- invitation state distribution;
- RSVP-to-pass eligibility relationship;
- no real secret invitation/pass token values in the report.

## Other relevant domains

Record availability/counts for:

- bookings;
- contracts;
- messages/threads;
- announcements;
- notifications;
- Vault/document metadata;
- Wedding Day attendance.

Do not retrieve message bodies, document binaries or contract bodies during this first data-map pass.

---

# 8. Phase 5 — produce the Live ↔ Native parity ledger before UI changes

Create a repository-safe ledger:

```
docs/native-mobile/CHARITY_KUDZIE_NATIVE_LIVE_PARITY_LEDGER_2026-09-18.md
```

It must compare current native synthetic values against production-derived operational facts.

Required shape:

| Capability | Current native Shadow | Production-derived Charity & Kudzie | Action |
|---|---|---|---|
| Tasks | current synthetic | actual count/statuses | replace/derive |
| Planning health | synthetic 78% | derived from actual graph | recalculate |
| Budget | synthetic | production-derived | replace |
| Contributions | synthetic | production-derived | replace |
| Vendors | synthetic | actual engagements | replace |
| Guests | synthetic | actual count/state | replace |
| Seating | synthetic | actual assignments | replace |
| Timeline | synthetic | actual events | replace |
| Wedding date | placeholder | actual | replace |
| Venue | Reference Venue | actual/private equivalent | replace |
| Planner context | Eleven Eleven Testing label | verified relationship | preserve/correct |

Do not place private guest contact data or secrets in this ledger.

If a value is sensitive, record:

```
PRIVATE-SNAPSHOT
```

instead of the value.

No native UI implementation should proceed until this ledger exists.

---

# 9. Phase 6 — create the private real-wedding snapshot outside Git

Private snapshot root:

```
$HOME/.wewed-shadow/charity-kudzie/
```

Create it with restrictive permissions:

```bash
mkdir -p "$HOME/.wewed-shadow/charity-kudzie"
chmod 700 "$HOME/.wewed-shadow"
chmod 700 "$HOME/.wewed-shadow/charity-kudzie"
```

Never write private snapshot output under the Git repository.

The private snapshot may preserve real operational values needed for fidelity, including:

- real wedding date/lifecycle;
- real task structure/titles where permitted;
- real vendor relationships/names where permitted;
- real budget/contribution relationships;
- real timeline structure;
- real seating topology/table names;
- real guest/household topology where required for correct app behavior.

It must exclude:

- password/password hash;
- sessions/cookies;
- access/refresh tokens;
- OTP secrets;
- API keys;
- private signing keys;
- payment credentials;
- webhook secrets;
- invitation secret tokens;
- real Wedding Pass signing secrets;
- any credential capable of authentication or mutation.

Contact data such as guest phone/email must be excluded unless explicitly required for a later approved mobile capability. The default is to omit it from the snapshot.

No external side effect may be triggered during extraction.

---

# 10. Phase 7 — manifest, checksum and secret scan

Every private snapshot must have a manifest matching:

```
mobile/shadow/snapshot-manifest.schema.json
```

Record:

- snapshot ID;
- source environment = `production-read-only`;
- source wedding identifier stored privately;
- export timestamp;
- schema/sanitization version;
- included/excluded domains;
- row counts;
- SHA-256;
- operator;
- `productionWritesPerformed = false`;
- secret scan result;
- privacy classification result.

Run:

```
mobile/shadow/tools/validate_shadow_material.py
```

against the private snapshot/manifest before import.

STOP on any secret/auth material finding or checksum mismatch.

---

# 11. Phase 8 — create a Git-safe production-derived derivative

The Git-safe derivative must preserve the real graph shape while pseudonymizing sensitive entities.

Required preservation:

- exact domain counts where safe;
- task status/category relationships;
- party sizes;
- RSVP states;
- seating assignments/topology;
- vendor categories and relationship topology;
- contract/payment states without secret references;
- contribution types/relationships;
- timeline order and relationship structure;
- wedding lifecycle;
- module availability.

Required pseudonymization/removal:

```
Real guest name      -> Guest G001
Real household name  -> Household H001
Real contributor     -> Contributor C001
Private vendor name  -> Vendor V001 where necessary
Phone/email/address  -> removed
Secret IDs/tokens    -> removed
Private messages     -> removed
Document contents    -> removed
```

Financial values are private by default. The Git-safe derivative may use rounded/normalized amounts or relationship-preserving values unless explicit approval exists to commit exact figures.

The private Shadow database, not the Git-safe derivative, is the place for exact sensitive operational values.

---

# 12. Phase 9 — create/import the Mobile Shadow database

The Shadow database is separate from production.

Required properties:

- separate database/instance;
- no production write route;
- resettable;
- outbound side effects disabled;
- no production credentials stored in native apps;
- all imported records marked with snapshot provenance.

Before creating infrastructure, inspect available local tooling.

If local Docker/Postgres support is available, use an isolated Shadow instance.

If the required database runtime is unavailable, STOP after producing the validated private snapshot and parity ledger and report the infrastructure blocker. Do not invent another database architecture.

The Shadow data import must preserve the production-derived relationship graph.

---

# 13. Phase 10 — side-effect firewall

Before native clients use the Shadow backend, prove these are disabled or routed to null/sandbox adapters:

- email;
- WhatsApp/SMS;
- push notifications;
- payment capture;
- refunds;
- contract signing/acceptance;
- external webhooks;
- real calendar invites;
- real vendor/customer notifications.

Shadow may record an attempted side effect as an internal test event, but must not deliver it to a real person/service.

---

# 14. Phase 11 — wire native repositories to Shadow transport

Only after the Shadow database and backend are available.

Preserve the current repository boundaries.

Do not let SwiftUI or Compose access production Postgres directly.

Replace the current synthetic Shadow repository source behind the repository interfaces with Shadow API/transport adapters.

The environment contract remains:

```
Fixture
  -> deterministic qualified fixtures

Shadow
  -> production-derived private Shadow database/backend

Production Read Verify
  -> still locked unless separately authorized

Production
  -> still disabled
```

Do not delete the Fixture environment.

---

# 15. Phase 12 — update Planner first from the real graph

Planner remains the proving ground.

Native Planner must derive from the real Shadow graph:

- Overview;
- Tasks;
- Budget;
- Contributions;
- Vendors;
- Guests bridge;
- Seating;
- Timeline.

Rules:

- no hard-coded 78% planning health;
- no hard-coded 38/47 tasks;
- no hard-coded 92 guests;
- no hard-coded $18.4k budget;
- no hard-coded 9 vendors;
- no hard-coded 24 timeline events;
- no `Reference Venue`;
- no invented task/vendor/guest/table names in production-derived Shadow mode.

Planning Health must be explicitly derived from documented inputs, not invented.

If production has missing/incomplete data, native must represent that truthfully rather than filling it with plausible values.

---

# 16. Phase 13 — preserve the Ivory invitation / Pass / Wedding Day sequence

After Planner is real-data-backed, carry the same Shadow wedding graph through:

```
Ivory Floral Gold invitation
    -> RSVP
    -> Wedding Pass eligibility
    -> issued Shadow pass
    -> Gate validation
    -> attendance
    -> seating / live state
```

Do not use production RSVP secret tokens or production pass credentials.

Create Shadow-only invitation/pass identifiers for the imported Shadow records.

The guest/household/table relationship must derive from the same imported wedding graph.

---

# 17. Testing vocabulary

Do not call the current synthetic suite “real-wedding parity”.

Use:

```
SANITIZED-REFERENCE-E2E
```

for the existing synthetic Charity & Kudzie suite.

Create a separate qualification level:

```
REAL-SNAPSHOT-SHADOW
```

Only use `REAL-SNAPSHOT-SHADOW PASS` after the native apps are actually driven by the imported production-derived Shadow graph.

---

# 18. Mandatory qualification after real Shadow wiring

Run on the exact tested commit:

1. `bash mobile/shadow/tools/native_local_preflight.sh`
2. default Fixture Maestro regression on iOS and Android;
3. REAL-SNAPSHOT-SHADOW Planner E2E on iOS and Android;
4. invitation accept E2E;
5. invitation decline E2E;
6. Pass/Gate regression;
7. parity assertions against the Live ↔ Native parity ledger.

Any pass from an uncommitted tree is diagnostic only.

After PASS:

```
PRESERVE DIFF
-> COMMIT TESTED STATE
-> PUSH
-> FETCH
-> VERIFY LOCAL == REMOTE
-> then report PASS
```

---

# 19. STOP conditions

STOP immediately if:

- local/remote repository state diverges;
- worktree is unexpectedly dirty;
- only write-capable production credentials are available;
- Charity & Kudzie resolves to multiple ambiguous weddings;
- Eleven Eleven Testing cannot be verified as the intended planner context;
- discovery requires a production mutation;
- snapshot contains secrets;
- snapshot output would be written inside Git;
- Shadow infrastructure cannot guarantee side-effect isolation;
- an implementation step would require modifying `/Users/shadreckmusarurwa/Project AI/wewed`;
- a step would enable native production writes;
- current qualified Fixture/Pass/Gate behavior regresses.

Do not guess around a STOP condition.

---

# 20. Required agent report

Report each stage with PASS / FAIL / BLOCKED / NOT RUN.

```
REMOTE PREFLIGHT
Remote branch:
Remote HEAD before work:

LOCAL ALIGNMENT
Local branch:
Local HEAD:
Remote HEAD:
Divergence:
Worktree:

PRODUCTION READ-ONLY SAFETY
Production environment identified:
Read-only credential/replica:
transaction_read_only:
Write-capable credential used:
Production writes performed:

AUTHORITATIVE WEDDING
Charity & Kudzie wedding uniquely resolved:
Eleven Eleven Testing planner relationship verified:
Lifecycle:
Date:
Venue:
Currency/timezone:

DOMAIN DISCOVERY
Tasks:
Budget:
Contributions:
Vendors/service engagements:
Guests/households:
Seating:
Timeline:
Invitations/RSVP:
Bookings/contracts:
Messages/notifications:
Vault:
Wedding Day:

LIVE ↔ NATIVE PARITY LEDGER
Created:
Repository path:
Sensitive values excluded:

PRIVATE SNAPSHOT
Private snapshot created:
Private path:
Manifest:
Checksum:
Secret scan:
PII classification:
Snapshot committed to Git: NO

GIT-SAFE DERIVATIVE
Created:
Pseudonymization:
Secret scan:

SHADOW DATABASE
Created/imported:
Side effects disabled:
Production write route present: NO

NATIVE SHADOW WIRING
iOS:
Android:
Fixture environment preserved:
Production environment still disabled:

QUALIFICATION
Non-simulator gate:
Fixture iOS:
Fixture Android:
Real-snapshot Planner iOS:
Real-snapshot Planner Android:
Invitation accept iOS:
Invitation accept Android:
Invitation decline iOS:
Invitation decline Android:
Pass/Gate regression:

FINAL PRESERVATION
Final tested commit:
Pushed:
Local HEAD:
Remote HEAD:
Divergence:
Worktree:

PRODUCTION WRITES:
NO

ACTIVE PRODUCTION WORKSPACE MODIFIED:
NO

PRODUCTION INTEGRATION:
NO

Remaining blockers:
```

The agent must not continue to the next phase after a FAIL/BLOCKED gate unless the blocking condition is resolved explicitly.
