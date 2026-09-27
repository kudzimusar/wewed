# QRO04-UI01 — Production Native UI Authority + Shadow Separation Closure

## Repository
`kudzimusar/wewed`

## Starting point

QRO04 agent branch:
`closure/phase13-qro04-pass-gate-ci-path-filter-20260927`

Required starting HEAD:
`60c1af51ee8b8f863085d17e38009ae9ea52c3c0`

Create:
`closure/phase13-qro04-production-ui-authority-ui01-20260927`

Do not base from production main.

Do not discard the accepted one-line Wedding Pass CI workflow fix.

Moderator decision:
**D-084 — Shadow UI is not production UI evidence; QRO04 visual certification reopened**

## Why this unit exists

The owner supplied visible evidence that QRO04 was showing `Sanitized Shadow` / `Switch Persona` screens while a separate real Planner login showed a newer production-role UI.

Independent source review confirms:

- QRO04's Maestro Guest identity files explicitly launch `wewed_native_env: shadow`;
- the Shadow persona picker is development-only;
- QRO04 changed no native UI code;
- production and Shadow are separate runtime paths;
- the production Planner shell exists and is the correct visual family;
- the production invitation-bound Guest uses `LiveGuestShellView` / `LiveGuestShell.kt`, not Shadow `GuestShellView` / `GuestShell`;
- the production workspace selector is genuinely unfinished and can expose default-blue controls plus raw grant ids.

This unit closes those gaps before any WW2 live migration or later stakeholder phase.

# 1. NON-NEGOTIABLE UI AUTHORITY MAP

## Planner / Couple / Coordinator / Vendor / Admin

Production/account UI authority is the real role-shell family in:
- iOS `apps/ios/Wewed/Views/Roles/RoleWorkspaces.swift`;
- Android `apps/android/app/src/main/java/pro/wewed/app/ui/roles/RoleWorkspaces.kt`.

For Planner specifically:
- iOS `PlannerShellView`;
- Android `PlannerShell`.

The owner's `Professional Planner` screenshot with a `Production` badge, ivory/champagne styling and `Our Wedding Plan` cards is the target family.

Do not replace these shells with PersonaPicker/Shadow screens.

## Guest

Production Guest UI authority is invitation/session-bound:

iOS:
`apps/ios/Wewed/Views/Invitation/LiveGuestShellView.swift`

Android:
`apps/android/app/src/main/java/pro/wewed/app/ui/invitation/LiveGuestShell.kt`

Required real Guest path:
`Wewed splash -> approved Ivory invitation -> RSVP/details -> LiveGuestShell`

with:
`Home | Invitation | Pass | Wedding Day | More`.

Do not use:
- `GuestShellView`;
- Android `GuestShell`;
- `DevelopmentPersona.attending_guest`;
- `Sanitized Shadow`
as production Guest evidence.

## Gate

Production Gate authority must come only from a real server-resolved operational grant / `WeddingGateAssignment`.

Do not use `DevelopmentPersona.gate_usher` or a Shadow Gate assignment as production UI proof.

# 2. LAUNCH-LANE RULE

For every production-shaped DEBUG qualification:

use:
`production_preview`

not:
`shadow`
not:
`sanitized_shadow`
not:
`private_real_shadow`.

A production-preview launch must prove:
- `NativeDataEnvironment.PRODUCTION`;
- exact Preview origin;
- no PersonaPicker;
- no `Switch Persona`;
- no `Sanitized Shadow` badge;
- no `DevelopmentPersona` identity.

Note: DEBUG with no explicit native environment defaults to Sanitized Shadow by design. Therefore every production-shaped runtime test MUST pass an explicit environment.

Do not change that default merely to hide a test mistake unless a concrete product requirement demands it.

# 3. FIX THE PRODUCTION WORKSPACE SELECTOR — IOS + ANDROID

Current defects:
- iOS `GrantSelectionView.swift` uses default Button presentation and appears as blue links;
- Android counterpart is similarly minimal;
- the fallback displays raw `grantId`, causing strings like `planner-<uuid>` to appear.

Implement Wewed production styling:
- ivory background;
- serif Wewed heading;
- champagne/forest accents;
- card/surface rows;
- role/scope label;
- human-readable wedding/business/portfolio name;
- selected/tappable affordance consistent with the production Planner shell;
- explicit Sign out secondary action.

No default system-blue link presentation.

No raw:
- grant id;
- accessUserId;
- UUID;
- businessAccountId;
- vendorId
may appear as the primary label.

Human label policy:
1. wedding title when present;
2. presentation-only business/vendor name from the already-authorized authority document when available;
3. safe role/scope label such as `Planner Portfolio`, `Vendor Business`, `Wewed Administration`, `Coordinator Workspace`;
4. never a raw identifier fallback.

It is acceptable to change `GrantSelectionView` / `GrantSelectionScreen` to receive the full `ProductionAuthority` or a presentation-label resolver. Presentation data must not become authority.

# 4. FIX THE PRODUCTION CONTEXT SWITCHER — IOS + ANDROID

Apply the same Wewed visual language to:
- iOS `ContextSwitcherSheet.swift`;
- Android `ContextSwitcherDialog`.

Requirements:
- no default-blue link list;
- no raw grant IDs in visible labels;
- human role + wedding/business label;
- current context clearly marked;
- Gate options say Gate name + wedding;
- preserve the same selection authority functions — styling must not invent or broaden grants.

# 5. MAKE SANITIZED SHADOW UNMISTAKABLY SYNTHETIC

Current Shadow fixture improperly mirrors Charity & Kudzie.

Remove real C&K identity from the Sanitized Shadow test graph/personas.

At minimum, Shadow must not use:
- real C&K wedding id;
- `Charity & Kudzie`;
- `Imba Manor`;
- the real 2026-12-23 date;
- real Planner/account names where those names make Shadow look like production.

Use unmistakably synthetic values, for example:
- wedding id `wewed-shadow-wedding-001`;
- title `Wewed Shadow Wedding`;
- venue `Wewed Test Garden`;
- future synthetic date;
- `Shadow Planner`, `Shadow Vendor`, etc.

Update:
- iOS/Android `DevelopmentPersona` definitions;
- `mobile/fixtures/shadow-reference/reference-wedding-sanitized.json`;
- platform Shadow repositories/fixture mappings that duplicate those values;
- affected tests/snapshots.

Do not change Private Real Shadow or Production data to accomplish this.

Do not use a real customer/wedding identity as a “sanitized” visual fixture.

# 6. SHADOW RAW-DATE GAP

The Shadow Invitation surface currently emits the stored raw date.

Even though Shadow is no longer production evidence, fix the shared presentation debt:
- render a human date through the existing native date-display helper;
- no `2026-12-23 14:00:00` / ISO-like raw timestamps in UI.

Do not change server authority/date values.

# 7. PRODUCTION UI REGRESSION TESTS

Add deterministic tests proving:

1. `production_preview` resolves `NativeDataEnvironment.PRODUCTION` on both platforms.
2. production / production_preview cannot expose PersonaPicker / `Switch Persona`.
3. Shadow persona files cannot satisfy a test named/declared as production UI qualification.
4. live production Guest dispatch uses:
   - iOS `LiveGuestShellView`;
   - Android `LiveGuestShell`;
   and does not dispatch to Shadow `GuestShellView` / `GuestShell`.
5. production Planner dispatch reaches real `PlannerShellView` / `PlannerShell` after authority/grant selection.
6. Grant selector visible labels never fall back to `grantId`.
7. Grant selector/context switcher source does not use unstyled/default blue as its intended Wewed presentation.
8. Sanitized Shadow fixture contains no Charity & Kudzie ID/name/venue/date.
9. Shadow Invitation date is human-formatted.

Keep existing Shadow tests, but name/classify them explicitly as Shadow test-harness tests.

# 8. VISIBLE IOS PROOF

Use a dedicated iOS DEBUG build from this exact branch.

### Real Planner

Launch explicitly with:
`WEWED_NATIVE_ENV=production_preview`

using the current authorized integration Preview origin and the real Planner account from the existing secure credential file.

Prove:
- no Shadow entry/persona;
- no `Sanitized Shadow`;
- environment badge = `Production`;
- styled `Choose a workspace`;
- no blue raw-link list;
- no raw `planner-<uuid>`;
- choose Charity & Kudzie;
- arrive at the polished `Professional Planner` shell;
- `Our Wedding Plan` / real role workspace visible.

Read-only only.

### Real Guest

Use the existing real C&K Guest invitation credential through `production_preview`.

Prove:
- splash;
- approved ornate Ivory closed invitation;
- open/details;
- live Guest persistent shell;
- `Home | Invitation | Pass | Wedding Day | More`;
- no `Sanitized Shadow`;
- no PersonaPicker;
- no Shadow Guest G007/G011 fixture identity;
- C&K Guest authority remains real and unchanged.

Do not change RSVP.

# 9. VISIBLE ANDROID PROOF

Repeat the same two production-shaped paths:
- Planner real account in explicit `production_preview`;
- real invitation-bound Guest in explicit `production_preview`.

Required:
- production environment;
- no Shadow/persona;
- styled workspace selector;
- production Planner shell;
- live Guest shell;
- no raw grant id;
- no Shadow fixture identity.

Use exact component routing so another installed build cannot intercept the link.

# 10. PASS/GATE VISUAL PROOF

QRO04 backend WW2 X/revoke/Y contract is already accepted under D-084.

Do NOT mutate C&K to obtain an active Pass.

For active Wedding Pass/Gate visual UI:
- use a local/disposable synthetic authority;
- launch native in the production-shaped lane (`production_preview` against approved loopback origin) if supported;
- do not use DevelopmentPersona/Shadow for the final visual evidence.

If a production-shaped local Gate account/authority cannot be constructed without changing architecture or creating a real live account, classify that visual subcheck `BLOCKED-ENV` and return to moderator. Do not fall back to Shadow and call it production.

# 11. QRO04 WORKFLOW FIX

Preserve the QRO04 accepted workflow correction:
`.github/workflows/wedding-pass-convergence-ci.yml`

The valid Guest-session path filter must remain:
`src/app/api/weddings/*/guest-session/**`.

Re-run Wedding Pass convergence CI after this closure.

# 12. LIVE WW2 MIGRATION FREEZE

Do not apply:
`20260924000000_wedding_day_ww2_authority`
or any other migration to the live database in this unit.

Do not enable WW2 in production/shared Preview.

The live schema activation decision comes only after this UI closure returns to the moderator.

# 13. RECEIPT

Create:
`docs/QRO04_UI01_PRODUCTION_NATIVE_UI_AUTHORITY_SHADOW_SEPARATION_RECEIPT_20260927.md`

Include:
- start/final SHA;
- exact diff;
- canonical UI map;
- Shadow-vs-production launch proof;
- list of Shadow identity values removed;
- iOS/Android grant selector before/after evidence;
- no raw identifier proof;
- production Planner visible proof;
- production live Guest visible proof;
- Gate visual result/classification;
- date-format proof;
- unit/build results;
- Maestro/runtime results;
- Wedding Pass CI run;
- C&K business-data writes = 0;
- production mutations = 0;
- migration changes = 0;
- secret scan.

Do not commit screenshots containing a real Guest's name unless redacted.

## Success

`QRO04-UI01 PRODUCTION NATIVE UI AUTHORITY CONVERGED — SHADOW TEST HARNESS SEPARATED FROM PRODUCTION — PLANNER + LIVE GUEST USE CANONICAL ROLE UI ON IOS/ANDROID — RAW WORKSPACE IDS/BLUE FALLBACK REMOVED — CHARITY & KUDZIE UNCHANGED — RETURNING TO MODERATOR.`

## Failure

`QRO04-UI01 <NOT PROVEN|BLOCKED-ENV|FALSE / STALE> — <exact one-line reason> — SHADOW NOT ACCEPTED AS PRODUCTION EVIDENCE — RETURNING TO MODERATOR.`

# 14. SAFETY FREEZE

Do not:
- merge to main;
- deploy production;
- apply live WW2 migrations;
- activate WW2 live;
- change C&K RSVP/date/style/token;
- issue C&K Pass;
- create C&K Gate/check-in;
- create real Coordinator/Usher accounts;
- read Admin credentials;
- publish native apps.

Coordinator/account-class work remains blocked until QRO04-UI01 is reviewed.
