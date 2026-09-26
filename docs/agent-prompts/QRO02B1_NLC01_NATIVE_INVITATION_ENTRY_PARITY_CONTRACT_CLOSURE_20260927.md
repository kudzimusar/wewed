# QRO02B1 / NLC01 — Native Invitation Entry + Parity Contract Closure

## Repository

`kudzimusar/wewed`

Authoritative integration branch:

`integration/phase13-live-account-data-convergence-20260926`

Required starting integration SHA:

`f63f2baf77e5ed87ea4b6853745ab83ac511c7f6`

Create a dedicated closure branch from that exact SHA:

`closure/phase13-qro02b-native-entry-parity-nlc01-20260927`

Documentation branch:

`docs/native-pwa-production-convergence-plan-20260922`

Moderator decision:

**D-074 — QRO02B authenticated live-read moderator review**

Moderator decision commit:

`be5bc387812d33c9db15834288657cb5ea333895`

Queued later invitation convergence:

`docs/agent-prompts/QRO02C_INV01_CHARITY_KUDZIE_INVITATION_AUTHORITY_CONVERGENCE_20260927.md`

QRO02C is **NOT executable in this unit**.

---

# 1. Agent role

You are the implementation/closure agent for QRO02B1 / NLC01.

You are not the moderator and you are not the final independent certifier.

Sequence:

`verify exact remote state`
→ `investigate iOS/Android entry lifecycle`
→ `implement native closure`
→ `repair parity contract/tooling`
→ `add regressions`
→ `targeted Preview qualification`
→ `full relevant server/iOS/Android qualification`
→ `receipt`
→ `return to moderator`.

Do not release QRO02B re-certification yourself.

Do not execute QRO02C.

Do not release QRO03.

---

# 2. Moderator disposition

QRO02B is **PARTIALLY ACCEPTED**.

Independently proven:

- real desktop/PWA Guest Session works against Charity & Kudzie;
- real Planner browser account path works;
- real native account API path works;
- those server-side paths agree on the same real wedding, Planner authority, Guest, RSVP, party size and seating-table authority;
- live Charity & Kudzie invitation style is currently `botanical`;
- iOS workspace-root invitation entry contains a self-cancelling `.task(id: pendingInvitationEntry)` pattern;
- Android workspace-root invitation entry contains the analogous `LaunchedEffect(pendingInvitationEntry)` / consume pattern;
- one global `requiredClients` list in `wewed.parity.v1` is applied to every actor label;
- the Guest contract requires `passAvailability` even when Wedding Day is environment-disabled;
- one unintended production Guest-session POST occurred during QRO02B because a previously installed UAT build intercepted the URL; the POST performed no wedding business-data write.

Still not proven:

- real iOS Guest invitation exchange;
- real Android Guest invitation exchange;
- four-client live parity;
- Android exact runtime root cause.

This task closes those implementation/tooling gaps.

---

# 3. Exact authorized mission

Close the defects that prevented QRO02B from producing valid four-client read parity.

Required outcomes:

1. a real incoming Guest invitation can be opened from the ordinary iOS account/workspace root without the exchange task cancelling itself;
2. the equivalent Android path is instrumented, diagnosed and fixed;
3. invitation entry remains exactly-once and cannot replay on recomposition/view rebuild;
4. the Guest invitation still outranks sign-in/workspace navigation;
5. native qualification cannot accidentally route a real invitation into another installed Wewed build;
6. `wewed.parity.v1` can express actor-specific client requirements;
7. an environment-level `BLOCKED-ACTIVATION` can be represented without falsifying Wedding Pass business availability;
8. all relevant tests/builds pass.

No Charity & Kudzie wedding business-data mutation is authorized.

---

# 4. Required pre-edit verification

Before editing:

1. fetch remote state;
2. verify:
   `origin/integration/phase13-live-account-data-convergence-20260926`
   equals exactly:
   `f63f2baf77e5ed87ea4b6853745ab83ac511c7f6`;
3. verify `5e7a3162... -> f63f2baf...` changes only:
   - QRO02B receipt;
   - `scripts/parity/wewed-parity.ts`;
4. read D-074 directly;
5. verify QRO02C remains queued/not released;
6. create the closure branch from the exact integration SHA;
7. keep working tree clean before edits.

If the integration branch has advanced:

**STOP BEFORE MUTATION.**

Return the new SHA to the moderator.

Do not rebase/reset/cherry-pick/guess.

---

# 5. Frozen architecture and product rules

Do not change:

- Guest identity is invitation-bound, not account identity;
- native account identity remains separate from Guest Session;
- saved `Wedding.invitationCardStyle` is invitation authority;
- native must not hardcode Charity & Kudzie to Ivory;
- D-073 target remains `ivory-floral-gold`, but this unit does not mutate it;
- Invitation QR != Wedding Pass QR;
- Release origin remains fixed to `https://wewed.pro`;
- Preview qualification remains DEBUG-only and allowlisted;
- server-computed party size remains authoritative;
- seating-table authority remains server-issued ID;
- Wedding Pass timing T-14 / +24h / +36h remains frozen;
- Wedding Day/WW2 remains disabled in this unit.

---

# 6. iOS investigation and closure

Primary source:

`apps/ios/Wewed/Views/RootView.swift`

Current defect pattern:

```swift
.task(id: appState.pendingInvitationEntry) {
    guard let entry = appState.consumePendingInvitationEntry() else { return }
    liveInvitation = .exchanging
    liveInvitation = await liveCoordinator.enter(entry)
}
```

The task is keyed by the same state that `consumePendingInvitationEntry()` clears.

Required:

- prove cancellation semantics with a deterministic regression test or minimal instrumented reproducer;
- change the lifecycle so clearing/consuming the pending entry cannot cancel the exchange that was launched for that entry;
- preserve exactly-once semantics;
- preserve a newly arriving different invitation while one exchange is active;
- preserve Guest-entry precedence over account workspace;
- preserve Shadow/live separation;
- ensure failure states still render honestly and do not fall back to fixtures.

Do not merely add retries around a self-cancelling task.

Do not suppress cancellation globally.

---

# 7. Android investigation and closure

Primary source:

`apps/android/app/src/main/java/pro/wewed/app/ui/RootScreen.kt`

Current high-confidence suspect:

```kotlin
LaunchedEffect(pendingInvitationEntry) {
    val entry = appViewModel.consumePendingInvitationEntry() ?: return@LaunchedEffect
    liveInvitation = LiveInvitationState.Exchanging
    liveInvitation = liveCoordinator.enter(entry)
}
```

Required:

1. instrument the DEBUG qualification path sufficiently to establish whether state consumption cancels/restarts the active effect before the network call;
2. capture safe timing/state evidence;
3. if confirmed, fix with the same lifecycle invariant as iOS;
4. if another cause exists, fix the actual cause instead;
5. remove temporary diagnostic instrumentation before final return unless it is suitable permanent debug-only observability;
6. add deterministic regression coverage;
7. prove a real Preview request reaches Wewed from the app after the fix.

Do not assume Android is fixed merely because the source resembles iOS.

---

# 8. Native deep-link qualification isolation

QRO02B accidentally allowed a previously installed `pro.wewed.app.uatdev` build to receive a `wewed://` link and call production.

Close the qualification hazard.

Required:

- document and implement the safest existing test procedure so the qualification device/emulator has only the intended qualification build registered for the invitation scheme;
- where a test harness can use an explicit component/bundle target without changing production link semantics, prefer it;
- add a preflight assertion that identifies the installed target build, bundle/application ID and resolved Preview origin before opening the real invitation;
- fail the qualification before the invitation is opened if the intended build is not the sole/explicit receiver;
- do not weaken Release URL pinning.

This may be test/harness tooling rather than product code if that is sufficient.

---

# 9. Parity contract closure — actor-specific client requirements

Primary source:

`src/lib/parity/wewed-parity-v1.ts`

Current defect:

one run-level `requiredClients` list is applied to every label, so label `G` incorrectly requires a `native-api` account record even though Guest identity is not an account.

Required semantic model:

- requirements must be actor/label appropriate;
- Guest label `G` must never be required to fabricate account/native-api identity;
- Planner/Couple account labels must still require every client that is genuinely capable of resolving those account/workspace contexts;
- account-side Guest record labels such as `G-VIA-P` must still prove the clients that genuinely expose that Planner/Couple Guest record;
- a missing genuinely required client remains a hard failure;
- cross-label same-wedding assertions remain intact;
- equality checking must not be weakened.

A backward-compatible run shape is preferred if practical.

Add tests proving:
- `G` can require desktop+iOS+Android without native-api;
- `P` can require desktop+native-api+iOS+Android;
- `G-VIA-P` can require the appropriate account-side clients;
- omitting a required client still fails;
- an ID mismatch still fails even when requirements differ by label.

Update CLI/checker serialization as required.

---

# 10. Parity contract closure — activation blocker vs Pass availability

Do **not** add `blocked_activation` as a fake Wedding Pass business availability state.

`passAvailability` must remain reserved for actual Wedding Pass business states returned by the Wedding Day authority.

Required:

- introduce an explicit qualification/blocker representation at run or record level that can state that Wedding Pass observation was blocked because Wedding Day is not activated;
- when that blocker is present and validated, Guest parity may leave actual `passAvailability` unobserved/null without producing a misleading `REQUIRED_FIELD_MISSING`;
- the checker must still require and compare `passAvailability` when Wedding Day is active/observable;
- an active Pass must still require the exact credential digest;
- a non-active Pass must still forbid a live credential digest;
- the blocker cannot be used to suppress unrelated missing fields or client records.

Use exact classification:

`BLOCKED-ACTIVATION`

in human-readable output.

Keep machine representation explicit and non-secret.

Update shared contract/tests/native record shape only if genuinely required.

---

# 11. Collector fix carry-forward

QRO02B changed:

`authority.accessUserId`

to:

`authority.identity.accessUserId`

in:

`scripts/parity/wewed-parity.ts`.

Preserve that fix.

Add/retain regression coverage that would fail if the collector reads the old path again.

---

# 12. Targeted real Preview proof allowed

The owner-provided credential source remains:

`~/.wewed-qa/qro02b.env`

It may be used only for targeted read-only qualification after source fixes.

Do not print or commit its values.

The separate:

`~/.wewed-qa/admin.env`

is out of scope and must not be read.

Keep:

`WEWED_PARITY_ALLOW_PASS_GET`

unset.

Allowed real operations:

- Guest invitation/session authentication;
- Planner/native account authentication;
- read-only API calls;
- local iOS/Android Preview qualification.

Wedding business-data writes authorized:

**0**

---

# 13. Required regression coverage

At minimum add/adjust tests for:

## iOS
- consuming/clearing the invitation entry does not cancel the exchange;
- one entry exchanges once;
- a second distinct entry can be processed afterward;
- Guest entry outranks account workspace;
- failure remains fail-closed.

## Android
- same invariants as iOS;
- an effect/state transition cannot cancel the exchange it launched.

## Parity
- actor-specific client requirements;
- blocked-activation representation;
- Guest without native-api account record;
- required-client omission failure;
- equality mismatch failure;
- active Pass digest rules unchanged;
- secret-material rejection unchanged;
- native account identity collector path.

---

# 14. Build and qualification requirements

Run the full relevant qualification, not only unit tests.

Required server/tooling:
- parity unit tests;
- qualification-origin/network-evidence tests;
- any collector tests;
- production build if shared TS source changed.

Required iOS:
- Swift/unit tests covering the lifecycle;
- simulator build;
- DEBUG productionPreview build;
- unsigned Release build or the existing accepted Release compile lane;
- targeted real Preview Guest-session transport proof on a dedicated simulator containing only the intended test build, with legacy Botanical visual rendering not used as acceptance evidence. Full real visual Guest UAT is deferred until QRO02C has changed the saved style to `ivory-floral-gold`.

Required Android:
- `testDebugUnitTest`;
- `assembleDebug`;
- `assembleUat` or the current accepted UAT compile lane;
- targeted real Preview Guest-session transport proof on a dedicated emulator/device containing only the intended test build, with legacy Botanical visual rendering not used as acceptance evidence. Full real visual Guest UAT is deferred until QRO02C has changed the saved style to `ivory-floral-gold`.

For both real native transport probes:
- record exact source SHA;
- bundle/application ID;
- Preview origin;
- device/simulator identity;
- sanitized runtime evidence;
- verify Preview received the expected Guest-session request;
- do not use Botanical visual output as acceptance evidence;
- verify production received **zero** invitation-exchange requests from the qualification window.

Do not claim final four-client parity certification. The first real visual Charity & Kudzie native Guest test happens after QRO02C has changed the live saved style to `ivory-floral-gold`.

---

# 15. Security and data boundaries

Forbidden:

- Charity & Kudzie invitation-style mutation;
- RSVP mutation;
- Guest edits;
- invitation token rotation;
- Pass GET that can issue a credential;
- Pass issue/revoke;
- Gate write/check-in;
- Wedding Day migration;
- WW2/ROOT key provisioning;
- WW2 activation;
- wedding-date change;
- production environment mutation;
- production deploy;
- merge to `main`;
- store publication;
- Admin credential access;
- Coordinator/Usher account creation.

Authentication/session cookie creation is allowed.

Wedding business-data writes must remain 0.

---

# 16. Required receipt

Create:

`docs/QRO02B1_NLC01_NATIVE_INVITATION_ENTRY_PARITY_CONTRACT_CLOSURE_RECEIPT_20260927.md`

Include:

- start branch/SHA;
- closure branch/final SHA;
- exact changed files;
- iOS root cause and fix;
- Android diagnosis and fix;
- deep-link isolation change/procedure;
- parity contract old/new semantics;
- blocked-activation representation;
- tests and exact counts;
- CI run/job IDs where used;
- iOS build/runtime proof;
- Android build/runtime proof;
- Preview request proof;
- explicit production request count during final qualification window;
- explicit `Wewed wedding business-data writes: 0`;
- unresolved items;
- confirmation QRO02C/QRO03 not executed.

No raw credentials, invitation tokens, cookies, bypass values or session secrets.

---

# 17. Failure classifications

Use exact programme vocabulary:

`ACCEPTED`

`PARTIALLY ACCEPTED`

`NOT PROVEN`

`FALSE / STALE`

`BLOCKED-ENV`

`BLOCKED-ACTIVATION`

Examples:

- iOS fix compiles but real Preview request still never reaches server → `NOT PROVEN`;
- Android cause cannot be isolated because local tooling unavailable → `BLOCKED-ENV`;
- qualification link opens production → `FALSE / STALE` and STOP;
- Wedding Day remains disabled → `BLOCKED-ACTIVATION`, which is expected and not a reason to activate it.

---

# 18. Safety freeze

QRO02C:

`QUEUED / NOT EXECUTABLE`

QRO03:

`NOT RELEASED`

QRO04:

`NOT RELEASED`

Coordinator:

`PARKED`

Vendor:

`PARKED`

Admin:

`PARKED`

No production release action.

---

# 19. Stop conditions

Stop and return to moderator if:

1. integration branch advanced from `f63f2baf...`;
2. fixing native entry requires weakening Guest/session security;
3. Android diagnosis reveals a materially different architecture defect outside this closure scope;
4. any real test requires a wedding business-data write;
5. a production request occurs during final targeted qualification;
6. iOS/Android local tooling is unavailable;
7. parity closure would require weakening equality instead of correcting requirements;
8. production deployment/configuration becomes necessary;
9. QRO02C invitation-style mutation would be required to prove this closure.

---

# 20. Other-agent disposition

Do not run independent QRO02B re-certification yourself.

Do not execute QRO02C.

Do not release QRO03.

Return the closure branch to the moderator.

The moderator will independently review this implementation. If accepted, the moderator will release QRO02C first to converge Charity & Kudzie to the owner-approved `ivory-floral-gold` authority, then issue the independent final QRO02B certification against that final intended state.

---

# 21. Exact completion line

Success:

`QRO02B1 NATIVE INVITATION ENTRY + PARITY CONTRACT CLOSURE COMPLETE — IOS/ANDROID TARGETED PREVIEW ENTRY PROVEN — 0 WEDDING BUSINESS-DATA WRITES — RETURNING TO MODERATOR FOR INDEPENDENT QRO02B RE-CERTIFICATION RELEASE.`

Blocked:

`QRO02B1 NATIVE/PARITY CLOSURE <BLOCKED-ENV|NOT PROVEN|FALSE / STALE> — <exact one-line reason> — RETURNING TO MODERATOR.`


## Moderator sequencing correction — D-076

After QRO02B1 returns and is accepted, **do not release QRO02C immediately**.

First release:

`INV-CANON01 — Ivory Floral Gold Canonical Reference Closure`

Task:
`docs/agent-prompts/INV_CANON01_IVORY_FLORAL_GOLD_CANONICAL_REFERENCE_20260927.md`

Reason: the web Invitation Studio currently uses a generic `DigitalInvitationCard(... compact)` tile for Ivory, while the actual canonical closed Ivory stationery exists separately in `IvoryFloralGoldTriFold`. The canonical closed-card visual reference must be established before the live Charity & Kudzie style is changed and before real visible UAT resumes.

Revised sequence:

`QRO02B1 -> INV-CANON01 -> QRO02C -> final QRO02B four-client Ivory certification -> QRO03`.
