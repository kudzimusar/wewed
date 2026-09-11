# Wewed Native Mobile Platform — Completion & Release Qualification Plan

**Plan ID:** WW-NATIVE-MOBILE-CLOSEOUT-2026-09-10-01  
**Date:** 2026-09-10  
**Branch:** `feat/native-mobile-platform-20260910`  
**Starting head:** `e11c28bcaf24053d4b720fe6c6e80b64945b7686`  
**Authority:** Continuation of the existing Wewed native-mobile migration. This document does not replace or reinterpret the architecture already established on this branch; it converts the remaining work into an ordered completion and release-gate programme.

## 1. Goal

Finish the Wewed native mobile migration without weakening the current web platform, database model, role permissions, communications controls, booking governance, contribution reconciliation, contract immutability, AI governance, or existing production release discipline.

The target remains one Wewed platform with multiple clients:

- `wewed.pro` remains the web/public/admin and fallback client.
- Android and iOS become first-class native React Native / Expo clients.
- Both clients use the existing Wewed API, business rules, permissions, Supabase/Postgres data, Prisma-backed server logic, Wewed AI Core, communications system, booking governance and contract system.
- The current Bubblewrap/TWA Android app remains in place until the native app is fully qualified and the production replacement is explicitly approved.

## 2. Non-negotiable constraints

1. No direct Prisma/database access from the mobile app.
2. No duplicate mobile-only business rules when an existing server rule exists.
3. Web cookie authentication remains supported; native authentication uses the same signed server-verified application session over a bearer transport and secure device storage.
4. Native UI must not become a WebView reconstruction of the current site.
5. Contract review/acceptance semantics must remain exact-version, explicit-decision and cryptographically governed.
6. Booking enquiries must not be represented as bookings; booking drafts must not be represented as confirmed bookings.
7. AI remains the existing Wewed AI Core with the existing privacy, retrieval, rate-limit and human-confirmation boundaries.
8. Contribution and budget funding attribution must remain separate from couple-paid amounts.
9. Existing Playwright planner regression/UAT behaviour remains a release contract.
10. Do not merge or replace the Play Store TWA until the exact native release candidate passes all automated, emulator and real-device gates.

## 3. Completion sequence

### Phase A — Build correctness and mobile runtime baseline

- Reconcile `apps/mobile/package.json`, Expo SDK, React Native and Expo Router versions against current supported Expo packages.
- Add deterministic mobile scripts for typecheck, lint/doctor, tests, Android prebuild/build and CI.
- Run TypeScript/static validation and fix all native compile errors before adding additional product behaviour.
- Keep the root Next.js/Vercel build unchanged.
- Confirm the web server still typechecks/builds after bearer-session additions.

**Gate A:** Native TypeScript/static checks pass; root web build/tests are not regressed.

### Phase B — Finish the role-aware native product shell

- Complete `More` as the mobile control centre for account, active wedding, role-aware tools, legal/help/privacy, secure sign-out and app information.
- Implement active-wedding switching with session rotation and query-cache invalidation.
- Keep full desktop Admin workflows on web where dense administration is materially better there, but provide native Admin triage/communication/health shortcuts where existing APIs support them.
- Add vendor-specific commercial surfaces backed by the existing vendor booking/document/catalog APIs.
- Ensure Couple/Planner/Vendor/Admin views never expose actions outside their server permissions.

**Gate B:** Every supported authenticated role lands on a coherent native experience and can safely switch permitted wedding context.

### Phase C — Close commercial and AI loops

- Add native booking list/detail surfaces using `/api/bookings` and `/api/bookings/[id]`.
- Add bookable catalogue discovery where the canonical server exposes a true published booking item.
- Preserve the booking lifecycle: configure -> draft -> explicit submit -> governed transition -> terms/deposit/confirmation as allowed by server state.
- Add Wewed AI Copilot using `/api/ai/chat`, not a separate mobile model stack.
- Preserve AI read/write boundaries: suggestions/drafts may be generated, but mutations continue through explicit Wewed action-review workflows.
- Expose tokenized contract review links without bypassing the existing secure review/decision implementation.

**Gate C:** Mobile can discover, enquire, message, inspect real bookings, submit governed drafts where permitted, and use Wewed AI without creating a second authority model.

### Phase D — Deep links, install recovery and notification routing

- Build one route resolver for `https://wewed.pro/...`, `wewed://...`, notification payloads and deferred-install payloads.
- Support direct native routes for internal mobile destinations (messages, provider profiles, booking details and planner surfaces).
- Preserve secure/canonical web handoff for routes whose security semantics are not yet reproduced natively (for example exact contract review and public token flows).
- Persist interrupted destinations through authentication/app restart and resume after session hydration.
- Configure Android App Links and iOS Universal Links.
- Integrate Android Google Play Install Referrer/deferred invitation handoff with the existing server-side invitation-handoff design.
- Do not claim deferred-install success without a real Google Play closed-test install path.
- Add native notification registration and route notifications through the same resolver.

**Gate D:** Installed-app links open the intended native destination; authenticated interruptions resume correctly; Play deferred-install remains feature-gated until real-store qualification.

### Phase E — Native device capabilities and resilience

- Add native document/image selection and uploads only through existing upload/API boundaries.
- Add native sharing for Wewed links/provider profiles/invitations using the OS share sheet.
- Add camera/gallery support where the Wewed workflow genuinely needs media.
- Implement conservative offline/Field Mode: cache recent planner/timeline/guest/task/communication data for read access; queue only operations proven safe/idempotent; never queue financial/contract authority transitions blindly.
- Provide clear stale/offline indicators and explicit reconnect/retry behaviour.
- Add lightweight haptics and accessibility-safe touch targets; preserve reduced-motion/system settings.

**Gate E:** The app remains usable under intermittent Zimbabwean mobile connectivity without fabricating successful financial, booking, contract or communication mutations.

### Phase F — Automated qualification

- Add mobile unit/component tests for auth hydration, API-client auth headers, route resolution, wedding switching and critical state transitions.
- Extend existing Playwright coverage for bearer-compatible server paths and ensure web planner regressions remain green.
- Add a native E2E smoke suite (Maestro or equivalent) covering sign-in, Home, Tasks priority filter, Guests/Seating, Budget/Contributions, Messages, Marketplace and More.
- Add CI jobs for mobile dependency validation, TypeScript, tests and Android build/prebuild smoke.
- Keep existing root CI gates intact.

**Gate F:** Exact branch head passes web regression + native static/unit + native E2E smoke + Android build gates.

### Phase G — Android/iOS release qualification

- Generate native Android project/build from the Expo app without overwriting the existing root TWA wrapper during transition.
- Preserve Android application ID `pro.wewed.app` and the Play Store continuity requirements.
- Validate App Links, notification routing, cold start, process death, low-memory restart, keyboard/safe-area behaviour and representative mid-range Android performance.
- Produce a signed release candidate/AAB only through the authorized signing pipeline.
- Qualify the exact candidate on emulator and physical Android hardware.
- Upload to Google Play Closed Testing only after automated gates pass.
- Validate Play -> install -> Install Referrer -> first launch -> invitation/deep-link continuation on the store-delivered build.
- Prepare iOS configuration/build path in parallel, but do not make Android production replacement depend on App Store availability unless product policy requires it.

**Gate G:** Store-delivered native Android candidate passes real-device closed-test qualification.

### Phase H — Production cutover

- Compare native release candidate behaviour against the current production TWA for sign-in, planning, guests, budget, contributions, vendors, messages, marketplace, deep links and account safety.
- Keep production feature flags fail-closed for deferred-install behaviour until verified.
- Replace the TWA only after exact-head and exact-AAB qualification is documented.
- Monitor crash/auth/API error rates after rollout and retain rollback instructions.

**Gate H:** Production replacement is approved only when the evidence shows native parity/superiority on the required mobile journeys with no material regression.

## 4. Explicit non-goals for this closeout

- Rewriting the entire Next.js web application in React Native.
- Removing `wewed.pro` or the public wedding-site experience.
- Porting every dense Admin table to a small screen merely for nominal parity.
- Creating new mobile-only databases, roles, AI providers, contracts, payment rules or communication systems.
- Replacing secure server workflows with client-side trust.

## 5. Required evidence at final closeout

The closeout report must include:

- exact branch/head SHA;
- commits implementing each phase;
- native dependency/doctor/typecheck results;
- root web typecheck/build/regression results;
- native unit/E2E results;
- Android prebuild/build result;
- emulator/device matrix and outcomes;
- App Link and notification-route outcomes;
- Google Play closed-test deferred-install result;
- known limitations that are still intentionally web-only;
- production cutover/rollback decision.

If any required external qualification (for example a real Google Play install path or signing credential) is unavailable, the implementation may be complete but the release must remain explicitly blocked rather than simulated or claimed as passed.
