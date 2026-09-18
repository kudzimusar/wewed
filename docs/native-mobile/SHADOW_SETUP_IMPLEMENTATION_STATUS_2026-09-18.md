# Wewed Native Shadow Setup Implementation Status — 2026-09-18

**Plan authority:** \`WW-NATIVE-SHADOW-REAL-WEDDING-PARITY-2026-09-18-01\`  
**Implementation branch:** \`native-mobile/shadow-setup-implementation-20260918\`  
**Implementation checkpoint before this status document:** \`b233e5637ae3f68b42a14276979ee026a4b84c50\`  
**Production main reference:** \`2be25d724b51539f4677f2f15050e0deb873922e\`  
**Production writes performed:** NO  
**Production database snapshot created:** NO  
**Production application workspace modified:** NO  
**Simulator qualification performed for this branch:** NO  
**Native compile/unit qualification performed for this branch:** NOT YET — local intervention is the next gate.

---

## 1. Purpose of this checkpoint

This branch turns the approved Shadow Real-Wedding plan into executable native setup and a materially improved dual-native Planner/Home/Invitation architecture **without connecting the apps to production**.

It is intentionally the last remote-only implementation checkpoint before a local compile/unit-test gate.

No agent should call this branch E2E-qualified or parity-passed until the non-simulator local preflight succeeds.

---

## 2. Repository and isolation state

At the checkpoint used to create this document:

- the implementation branch was 54 commits ahead of the documentation-plan base;
- 41 files differed from the plan base;
- every changed path was inside the authorized native scope:
  - \`apps/ios/**\`
  - \`apps/android/**\`
  - \`mobile/**\`
  - \`docs/native-mobile/**\`
  - \`.maestro/**\` if later required;
- no \`src/**\`, \`prisma/**\`, deployment, production web, or main-application file was modified.

Agents must independently re-run Gate 0 because branch HEAD will move when this status document is committed.

---

## 3. Shadow setup implemented

### 3.1 Environment contract

Both native clients now have an explicit data-environment model:

- Fixture
- Shadow
- Production Read Verify
- Production

Mutable development is allowed only in Fixture and Shadow.

A native environment badge is displayed in the authenticated role banner to reduce accidental environment confusion.

### 3.2 Runtime production guard

Both platforms include a \`NativeEnvironmentGuard\`.

Current rules:

- native \`production\` runtime is disabled during this sprint;
- a Shadow runtime rejects known production hosts;
- environment validation occurs at the AppState/AppViewModel boundary.

This does **not** replace infrastructure access controls. It is an additional native safety guard.

### 3.3 Snapshot contract

Added:

- \`mobile/shadow/snapshot-manifest.schema.json\`
- \`mobile/shadow/tools/validate_shadow_material.py\`
- \`mobile/shadow/shadow.env.example\`

The manifest contract requires:

- source environment = production-read-only;
- source wedding ID;
- schema/sanitization version;
- included/excluded domains;
- row counts;
- SHA-256;
- operator;
- productionWritesPerformed = false.

### 3.4 Read-only production discovery templates

Added:

- \`mobile/shadow/tools/01_discover_reference_wedding_readonly.sql\`
- \`mobile/shadow/tools/02_audit_reference_wedding_counts_readonly.sql\`

These scripts:

- explicitly open READ ONLY transactions;
- first identify the Charity & Kudzie wedding and Eleven Eleven Testing account/profile candidates;
- then audit operational counts/statuses using the authoritative wedding ID;
- deliberately avoid guest contact fields, RSVP tokens, message bodies, passwords, payment references and contract payloads.

**They have not been executed against production.**

The Supabase connector available during this remote implementation exposed only an unrelated project named \`Sessions Music\`. It did not expose a Wewed production project, so no Wewed database query was attempted through it.

The first production discovery must therefore occur later through the authorized local/read-only Wewed database path.

---

## 4. Sanitized real-wedding reference harness

Added:

\`mobile/fixtures/shadow-reference/reference-wedding-sanitized.json\`

Important:

- it is synthetic;
- it is labeled \`isProductionSnapshot: false\`;
- it uses the Charity & Kudzie / Eleven Eleven Testing scenario only as the reference shape;
- it contains no production IDs, secrets, private messages, payment credentials or real guest contact details.

It exists to prepare the UI/repository architecture before the private real snapshot is available.

---

## 5. Planner architecture implemented on both platforms

New domain repository:

- iOS: \`PlannerDashboardRepositoryProtocol\`
- Android: \`PlannerDashboardRepository\`

The fixture implementation now exposes typed data for:

- Planner Overview
- Budget lines
- Contributions
- Vendor engagements
- Seating tables
- Timeline entries

The existing WeddingRepository remains in place for already-qualified Wedding Pass/Gate functionality.

This split is intentional: it begins the planned move away from one monolithic repository without rewriting the stable gate vertical slice.

---

## 6. Planner UI improvement

The Planner root on both SwiftUI and Compose has been rebuilt from the earlier simple budget/task screen.

It now presents:

1. planner/wedding identity;
2. planning-health score;
3. Needs Attention;
4. Planning Areas:
   - Tasks
   - Budget
   - Contributions
   - Vendors
   - Guests
   - Seating
   - Timeline
5. Priority Tasks;
6. Recent Activity;
7. explicit isolated-data source indicator.

The Planner root now answers:

> What needs attention in this wedding right now?

rather than behaving primarily as a checklist.

### Data-driven module destinations added

Both platforms now include repository-driven screens for:

- Budget
- Contributions
- Vendors
- Seating
- Timeline

These are still sanitized-fixture backed. They are not production data.

### Task contract correction

Both native platforms now represent the production task status:

- To Do
- In Progress
- Blocked
- Done

The prior native omission of \`blocked\` has been corrected in both the Planner root and full Tasks workspace.

---

## 7. Home UI improvement

Both platforms now distinguish lifecycle intent:

- before/wedding-planning state → **Wedding Command Centre**
- wedding-day lifecycle → **Wedding Day**

Before the day-of experience takes over, Home now adds a Planning Pulse containing:

- readiness score;
- planning-area summaries;
- attention signal;
- direct Planner navigation.

This is the first implementation step toward the governing rule:

> Wedding Day is the culmination/lifecycle mode of Wewed, not the definition of the whole application.

Existing Pass, announcements, quick actions, vendor operations and day programme remain preserved.

---

## 8. Ivory Floral Gold invitation implementation

The existing premium invitation was preserved and improved.

Changes now prepared on both platforms:

- monogram derives from the invitation couple names instead of hard-coded \`T&S\`;
- accept RSVP remains supported;
- decline RSVP is represented and does not expose a Wedding Pass;
- close can be disabled when RSVP-first flow is required;
- decline/accept callbacks can drive an enclosing guest journey;
- no canonical pass/security changes were made.

### Canonical guest journey components added

Both platforms now have an isolated guest-entry coordinator:

\`\`\`
Wewed animated splash
    ↓
Ivory Floral Gold invitation
    ↓
RSVP
    ├── accept → Wedding Pass
    └── decline → response acknowledgement, no Pass
\`\`\`

Files:

- iOS: \`GuestInvitationJourneyView.swift\`
- Android: \`GuestInvitationJourneyScreen.kt\`

The existing Home Invitation action now launches this canonical splash-to-invitation sequence.

The default Guest role shell has deliberately **not** been replaced by this new journey yet. That wiring is deferred until local compile/unit and visual qualification prove the new components stable.

---

## 9. Wedding Pass / Gate preservation

This branch does not intentionally change the previously qualified:

- WW2 ECDSA P-256/SHA-256 verifier;
- public-key-only scanner model;
- gate duplicate handling;
- partial household admission;
- capacity enforcement;
- offline manifest concepts;
- gate audit;
- deterministic gate-scanner dismissal.

Any local failure in these areas is a regression blocker.

---

## 10. Tests added but not yet executed

### iOS

Added tests for:

- Planner dashboard sanitized reference contract;
- required Planner module set;
- NativeDataEnvironment mutability;
- environment guard rejecting production host;
- environment guard allowing local Shadow;
- production runtime disabled.

### Android

Equivalent JUnit coverage added.

**No PASS is claimed yet.**

These files must compile and execute locally.

---

## 11. One-command non-simulator local gate

The branch now contains:

\`mobile/shadow/tools/native_local_preflight.sh\`

The local agent should run only after aligning to the exact remote branch:

\`\`\`bash
cd "/Users/shadreckmusarurwa/Project AI/wewed-native-mobile"

git fetch origin --prune
git switch native-mobile/shadow-setup-implementation-20260918
git pull --ff-only

bash mobile/shadow/tools/native_local_preflight.sh
\`\`\`

The script verifies:

1. expected branch;
2. local HEAD == remote HEAD;
3. zero divergence;
4. clean worktree;
5. no changed paths outside authorized native scope;
6. iOS \`swift test\`;
7. iOS \`swift build\`;
8. Android \`./gradlew testDebugUnitTest\`;
9. Android \`./gradlew assembleDebug\`.

No simulator is involved.

A failure at any step blocks simulator intervention.

---

## 12. Simulator remains intentionally deferred

Do **not** start Xcode Simulator, Android emulator, Maestro, camera qualification or visual screenshot review yet.

First requirement:

\`native_local_preflight.sh = PASS\`

Only then perform:

1. iOS install/launch;
2. Android install/launch;
3. focused Planner visual review;
4. Ivory Splash → Invitation → RSVP → Pass visual review;
5. existing Wedding Journey regression;
6. persona switching regression;
7. new Planner navigation E2E;
8. physical-camera qualification later.

---

## 13. Known transitional gaps

These are deliberate and must not be hidden:

1. No private Charity & Kudzie production snapshot exists yet.
2. Planner uses a sanitized reference fixture shaped around the target scenario.
3. The legacy WeddingRepository still uses earlier Tariro & Shadreck / Jane fixture records to preserve existing Pass/Gate qualification.
4. Therefore the repository is **not yet one fully coherent Charity & Kudzie wedding graph**.
5. The GuestShell has not yet been switched to invitation-first entry by default.
6. Shadow HTTP repositories do not exist yet because the Shadow backend has not been created.
7. No production read comparison has occurred.
8. No production write is authorized.
9. Compile/unit results for this new implementation branch are pending local execution.

These gaps are the reason the next gates exist.

---

## 14. Next sequence after local non-simulator PASS

After the preflight passes:

### A. Limited simulator intervention

Validate layout/navigation only.

### B. Phase 1 read-only discovery

Use an authorized Wewed read-only database path to run the two prepared discovery SQL scripts and populate:

\`docs/native-mobile/SHADOW_REAL_WEDDING_DISCOVERY_REPORT_TEMPLATE.md\`

Do not export private payloads yet.

### C. Snapshot design

Confirm:

- authoritative wedding ID;
- Eleven Eleven Testing planner membership;
- domain counts;
- privacy classes;
- export boundary.

### D. Private snapshot + sanitized derivative

Only after the discovery gate is accepted.

### E. Replace the sanitized reference architecture with the actual shadow graph

Begin with Planner and preserve the repository interfaces introduced on this branch.

---

## 15. Agent handoff rule

A future agent should not restart this work.

It should:

1. read the authoritative real-wedding plan;
2. read this status file;
3. run Gate 0;
4. run \`native_local_preflight.sh\`;
5. fix compile/unit failures only;
6. preserve the exact passing commit;
7. request simulator intervention only after non-simulator PASS.

Do not connect production simply because the current Planner now looks more complete.
