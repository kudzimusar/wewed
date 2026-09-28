# Wewed Native Mobile Platform Migration Plan

**Status:** STAMPED — AUTHORITATIVE IMPLEMENTATION PLAN — IMPLEMENTATION NOT STARTED  
**Stamp:** `WW-NATIVE-MOBILE-2026-09-10-01`  
**Baseline:** `8bc64d3648db6dbdcebcab72b4f501e291b4b7bc` (`main`)  
**Planning branch:** `docs/native-mobile-platform-plan-20260910`  
**Intended implementation branch after approval:** `feat/native-mobile-platform-20260910`  
**Date:** 2026-09-10

This document is the authoritative implementation, regression, mobile-experience, testing, release and handoff reference for replacing Wewed's current Trusted Web Activity/PWA-based Android application with a real React Native mobile client while preserving the existing Wewed platform, web application and server authority.

Future implementation commits, pull requests, UAT records, mobile store releases, test evidence and closeout documentation for this initiative must reference stamp `WW-NATIVE-MOBILE-2026-09-10-01`.

If implementation choices conflict with this document, implementation must be brought back into conformance or this document must be explicitly amended before the conflicting change is merged. Do not silently reinterpret the plan during implementation.

---

## 1. Executive decision

Wewed will **not** be rebuilt from scratch and will **not** replace the existing Next.js platform.

Wewed will move to a **multi-client architecture**:

```text
                    WEWED PLATFORM
                          │
          ┌───────────────┼────────────────┐
          │               │                │
     Wewed Web       Android Native     iOS Native
      Next.js        React Native       React Native
          │               │                │
          └───────────────┼────────────────┘
                          ↓
                    Wewed API Layer
                          ↓
             Wewed Domain / Security Core
                          ↓
      Prisma / PostgreSQL / Supabase / AI / Integrations
```

The current Android project under `/android` is a Bubblewrap-generated Trusted Web Activity that launches `https://wewed.pro/app?source=google-play`. It therefore remains fundamentally a web/PWA client. The native initiative replaces that client runtime; it does **not** replace the database, Wewed backend, business rules, AI architecture, marketplace, planner data, invitation authority, communications or website.

The core implementation decision is:

> **Create a real React Native + Expo mobile application inside the existing Wewed repository, reuse the existing server/data platform, extract platform-independent domain/API contracts for sharing, and retire the TWA only after the native Android build passes complete release qualification.**

---

## 2. Why this initiative exists

The current packaged PWA can be distributed through Google Play, but it inherits browser behaviour and web presentation assumptions. Symptoms include browser-style zoom/viewport behaviour, desktop-oriented layouts appearing on phones, web sharing patterns, browser navigation semantics, in-app-browser edge cases, installation/deep-link discontinuity and UI density inherited from responsive desktop components.

The objective is not merely to hide browser chrome. The objective is to create a mobile product whose interaction model is native from the beginning:

- native stack/tab navigation;
- Android back gesture/button semantics;
- iOS swipe-back semantics;
- native share sheets;
- native camera/photo/file pickers;
- native push notifications;
- native secure credential storage;
- app links / universal links;
- native status/navigation bar handling;
- safe-area-aware screens;
- native keyboard and focus behaviour;
- one-hand-friendly layouts;
- resilient state restoration after interruptions;
- offline/poor-network behaviour suitable for real mobile conditions;
- no desktop-only interaction assumptions such as hover, right-click, double-click, precision pointer use or horizontal desktop tables as the primary interface.

The project remains Zimbabwe-first and mobile-first. Low-bandwidth resilience, mid-range Android performance, intermittent connectivity, WhatsApp-originated journeys and fast recovery from app interruptions are first-class requirements rather than edge cases.

---

## 3. Existing repository reality and preserved assets

The repository currently contains:

- Next.js 16 / React 19 application code;
- Prisma and PostgreSQL persistence;
- Supabase authentication/infrastructure;
- extensive server routes under `src/app/api`;
- Wewed role/session logic;
- planner, couple, vendor, admin, guest/invitation and marketplace functionality;
- AI services and shared domain logic under `src/lib`;
- Playwright configuration with `desktop-chromium` and Pixel 5-based `mobile-chromium` projects;
- existing mobile/responsive regression specs including messages, planner navigation and deep-link tests;
- the current Bubblewrap/TWA Android package.

The following assets are preserved unless a separately approved migration requires a change:

| Existing capability | Native migration rule |
| --- | --- |
| PostgreSQL / production data | Reuse unchanged as authoritative data store |
| Prisma schema | Reuse; mobile never imports Prisma directly |
| Supabase | Reuse for supported auth/storage responsibilities |
| Wewed API routes | Reuse/refactor into explicit mobile-safe contracts |
| Couple/planner/vendor/admin identities | Reuse same accounts and permissions |
| Wedding data | Reuse same records |
| Guest lists | Reuse same records |
| Tasks | Reuse same records |
| Budget/contributions | Reuse same records and integrity rules |
| Vendor marketplace | Reuse same data and authority |
| Booking | Reuse same server workflows |
| Contracts | Reuse same server authority and immutability rules |
| Communications | Reuse same message records/routing |
| Wewed AI Core | Reuse same server-side AI orchestration |
| Invitations/QRs | Reuse same canonical `wewed.pro` URLs and server authority |
| Web/PWA | Retain as a first-class web client |
| Current TWA | Keep live only until native Android replacement is proven |

No migration phase may create a second disconnected Wewed database, a separate mobile user model or client-side copies of authority rules.

---

## 4. Target repository structure

The target is a monorepo-style structure inside the existing repository. Exact package-manager/workspace mechanics may be adjusted to fit the current Bun/Next.js toolchain, but the separation of responsibilities is mandatory.

```text
wewed/
│
├── src/                         # existing Next.js web/server application
│   ├── app/
│   ├── components/
│   ├── hooks/
│   └── lib/
│
├── apps/
│   └── mobile/                  # NEW React Native + Expo application
│       ├── app/                 # Expo Router routes
│       ├── components/
│       ├── features/
│       ├── services/
│       ├── hooks/
│       ├── assets/
│       ├── app.config.ts
│       └── package.json
│
├── packages/
│   ├── domain/                  # portable business types/rules only
│   ├── contracts/               # Zod/API request-response contracts
│   ├── api-client/              # authenticated Wewed API client
│   └── design-tokens/           # brand tokens, not DOM components
│
├── prisma/
├── supabase/
├── tests/
│   ├── e2e/                     # Playwright web/API/browser regression
│   └── mobile/                  # native automation assets/scripts
│
├── android/                     # legacy TWA during migration only
└── docs/
```

After successful native release and rollback-window completion, the legacy TWA directory should be moved to an explicitly archival location or removed through a separate cleanup commit. Do not delete it early.

---

## 5. Technology contract

### 5.1 Native client

Use:

- React Native;
- Expo;
- Expo Router;
- TypeScript;
- React Query/TanStack Query where appropriate for server state;
- platform-secure storage for auth/session material;
- native-safe libraries for notifications, sharing, image/file picking, haptics and linking.

Do **not** implement the new mobile product as:

- another Trusted Web Activity;
- a generic WebView wrapper;
- Capacitor wrapping the existing HTML UI as the primary architecture;
- separate Kotlin and Swift feature codebases unless a narrowly scoped native module genuinely requires platform-specific code.

### 5.2 Server authority

The phone never connects to Prisma or a service-role Supabase client directly.

```text
Native screen
    ↓
Wewed API client
    ↓
Authentication + authorization
    ↓
Wewed domain/service layer
    ↓
Prisma / Supabase / external integrations
```

Every mutation must still pass the same role, wedding, business-account, invitation and security rules used by the web platform.

### 5.3 Shared code rule

Share **domain logic and contracts**, not DOM components.

Good candidates for sharing:

- role/wedding/provider/task types;
- Zod schemas;
- currency/date/status calculations;
- contribution and budget rules;
- booking rules;
- validation;
- AI request/response contracts;
- invitation routing semantics;
- API client contracts;
- permissions expressed as pure domain helpers where server authority remains final.

Do not attempt to share Radix/shadcn/HTML components into React Native. Reusing a desktop component tree through a WebView defeats this initiative.

---

## 6. Authentication and session migration

The current browser application uses Supabase sign-in and a Wewed signed HTTP-only application session cookie. That cookie model remains valid for the web client but must not be the native client's long-term session mechanism.

Implement a unified Wewed request-context resolver capable of accepting:

```text
Web request                         Native request
    │                                    │
HTTP-only Wewed session cookie      bearer/native auth token
    │                                    │
    └──────────────┬─────────────────────┘
                   ↓
          Wewed authenticated context
                   ↓
 user + role + wedding/business scope + permissions
```

Requirements:

1. Mobile credentials/tokens are stored only in OS-protected secure storage.
2. No service-role key, database credential or server signing secret is bundled into the mobile app.
3. Refresh/revocation/expiry are handled explicitly.
4. Sign-out invalidates local credentials and server session state where applicable.
5. Switching users cannot leak the prior user's cached wedding/message data.
6. The mobile client must recover cleanly from expired sessions and return the user to sign-in without corrupting in-progress local form state where safe.
7. Authenticated API calls must be protected against role escalation; client-side route guards are convenience only, not authority.
8. Existing web-cookie authentication must remain functional and regression-tested throughout migration.

The agent must implement and test this security foundation before broad feature migration.

---

## 7. API contract hardening

Before screens proliferate, formalize a stable mobile-facing contract around the existing server routes.

Required actions:

- identify direct browser assumptions in API routes;
- separate HTTP/browser concerns from domain services where necessary;
- define explicit request/response schemas in `packages/contracts`;
- make error shapes predictable;
- preserve idempotency for retryable mutations;
- establish an API base URL/environment strategy for local, preview and production;
- provide authenticated API client helpers in `packages/api-client`;
- keep backward compatibility for the web client during migration;
- avoid introducing a second business-rule implementation in the mobile app.

Where an existing route is unsuitable for mobile, refactor server internals or introduce a versioned mobile-safe endpoint. Do not expose raw database tables merely to avoid server work.

---

## 8. Mobile information architecture

The native app is not a compressed desktop interface.

### 8.1 Global shell

Use role-aware native navigation with a small number of stable top-level destinations. Recommended default model:

```text
Home      Weddings/Work      Messages      More
```

Exact labels vary by role. High-frequency destinations belong in the thumb zone; low-frequency tools belong under progressive disclosure.

No screen may require users to understand the desktop sidebar hierarchy.

### 8.2 Couple experience

Core destinations must include at minimum:

- wedding overview / today;
- tasks;
- budget and contributions;
- guests / invitations / RSVP context;
- vendors / bookings;
- messages;
- contracts where relevant;
- wedding site/share tools;
- AI planning/help;
- settings/account.

### 8.3 Planner experience

Core destinations must include at minimum:

- portfolio / wedding switching;
- active wedding overview;
- tasks;
- guests;
- budget/contributions;
- vendors/bookings;
- timeline where supported;
- team/invitations;
- communications;
- contracts;
- AI;
- settings/account.

The planner must never be forced to render desktop spreadsheet-like layouts as the primary phone interaction. Tables become cards, drill-down lists, filters, search and editable detail sheets where appropriate.

### 8.4 Vendor experience

Core destinations must include:

- vendor home;
- provider profile/status;
- services/listings;
- enquiries/bookings;
- messages;
- contracts;
- availability or fulfilment workflows supported by the backend;
- share/QR tools;
- settings/account.

### 8.5 Guest experience

Guest flows should be invitation-first and low-friction. Required journeys include:

- open invitation from WhatsApp/social link;
- identify/accept invitation securely;
- RSVP;
- view wedding information permitted to that guest;
- contribution/honeymoon information where enabled;
- directions/contact/share actions where permitted;
- recover invitation after install.

Do not require a guest to learn the authenticated workspace architecture to respond to an invitation.

### 8.6 Administrator experience

Native admin support must prioritize operational actions that benefit from being mobile:

- pending planner/vendor approvals/reviews;
- account or listing status checks;
- high-priority communications/support;
- alerts/attention items;
- safe approval/rejection actions with confirmation and audit context.

Heavy administrative reporting can remain web-first if it has no mobile value, but the native app must not create an authorization gap or silently expose admin-only functions to other roles.

---

## 9. Mobile experience contract — non-negotiable

A screen is not considered complete merely because the underlying CRUD works.

### 9.1 Zero browser leakage

Internal Wewed navigation stays inside the native app. External links intentionally open an external browser/app. Users should not unexpectedly land inside browser chrome for normal Wewed features.

No native screen should depend on pinch-zoom to make content usable.

### 9.2 Touch and one-hand use

- minimum practical touch target approximately 44–48 logical pixels;
- primary actions kept reachable without precision tapping;
- destructive actions separated from common actions;
- no hover-only affordances;
- no double-click requirements;
- contextual menus must have labelled alternatives;
- important actions must not depend on gestures alone.

### 9.3 Safe areas and system UI

All screens must respect:

- notches;
- Android cut-outs;
- gesture/navigation areas;
- status bar;
- iOS home indicator;
- bottom sheets above system gesture regions.

### 9.4 Keyboard and forms

Forms must remain usable when the keyboard is visible:

- focused input remains visible;
- Save/Continue is not hidden beneath the keyboard;
- appropriate keyboard type is used for email, phone, currency and numeric fields;
- return/next actions advance logically;
- pasted content behaves correctly;
- validation does not erase user input;
- unsaved changes survive harmless navigation interruptions where feasible.

### 9.5 Android back semantics

Android back button/gesture must:

1. close the topmost modal/sheet first;
2. return to the previous native screen next;
3. leave the app only from an appropriate root state;
4. never accidentally submit, duplicate or discard a mutation.

### 9.6 Native sharing

Use the OS share sheet for vendor profiles, invitations, wedding links and approved content. Internal canonical links remain `https://wewed.pro/...` so the same link can open the app when installed or the web fallback when not installed.

### 9.7 Native file/media handling

Camera, gallery and document access must use native pickers and modern permission patterns. Request permissions only when the user invokes the relevant action. Denial must not dead-end the app.

Images should be resized/compressed before upload when practical to protect mobile data and upload reliability.

### 9.8 Interruption resilience

The app must behave correctly when:

- a phone call interrupts it;
- the user jumps to WhatsApp and returns;
- the app backgrounds and resumes;
- Android kills the process under memory pressure;
- the device locks and unlocks;
- connectivity changes during a form or upload.

Navigation and important draft state should restore predictably. Sensitive screens may require re-authentication according to security rules.

### 9.9 Slow and unreliable network behaviour

Treat network failure as normal mobile reality.

Required patterns:

- visible loading states;
- bounded retries/backoff;
- clear offline state;
- cached read-only critical data where safe;
- mutation retry only when idempotency can be guaranteed;
- no duplicate bookings, messages, contributions or payments caused by repeated taps/retries;
- upload progress and cancellation where meaningful;
- background/retry strategy must respect platform restrictions rather than pretending all work can continue indefinitely.

### 9.10 Performance

Optimize for mid-range Android hardware, not only flagship phones.

- virtualize long lists;
- avoid mounting hidden complex screens;
- lazy-load heavy routes/modules;
- keep image memory under control;
- avoid large synchronous JSON transforms on the JS thread;
- avoid animation that blocks input;
- maintain responsive taps/scrolling during normal data volumes.

### 9.11 Accessibility

At minimum:

- meaningful accessibility labels;
- sensible focus order;
- screen-reader-operable actions;
- sufficient contrast;
- support for increased text size without clipping critical controls;
- reduced-motion respect where feasible;
- error messages associated with fields/actions;
- no information conveyed by colour alone.

### 9.12 Orientation and layout

Phone UX is primarily portrait-first unless a feature clearly benefits from landscape. Do not build a desktop-width screen and rely on landscape rotation as the workaround.

### 9.13 No accidental mutation

Mobile networks and impatient tapping create duplicate-action risk. Disable/reconcile repeated submit taps, use idempotency keys where server mutations warrant them and show clear success state before returning to an editable action.

---

## 10. Native differentiators — permitted after core parity

Wewed may be deliberately more useful on a phone than the web product, but differentiation must not delay or destabilize core functionality.

High-value differentiators to implement where the underlying data contract is ready:

- **Today / Wedding Pulse:** role-aware glanceable screen showing the few things requiring attention now;
- **Quick Capture:** add task, guest note, expense/contribution, vendor note or message from one native action surface;
- **QR Scanner:** scan Wewed invitation/vendor/project codes directly inside the app;
- **One-tap Share:** canonical Wewed links through the native share sheet;
- **Field Mode:** cached critical wedding-day information for planners/couples when connectivity is poor;
- **Smart Resume:** return users to the exact wedding/task/message they were using before interruption;
- **Contextual haptics:** subtle confirmation for safe completed actions, never as the only feedback mechanism;
- **Role-aware shortcuts:** surface planner, couple and vendor actions differently instead of forcing one universal dashboard.

These are enhancements, not excuses to omit planner, couple, vendor, guest or communication basics.

---

## 11. Deep links, App Links and Universal Links

Canonical public/internal links remain on `https://wewed.pro`.

Target behaviour:

```text
https://wewed.pro/invite/<token>
https://wewed.pro/vendor/<slug>
https://wewed.pro/booking/<id>
https://wewed.pro/contribute/<...>
https://wewed.pro/messages/<...>
```

When the native app is installed and the user has authority, supported links open the correct native screen. When not installed, the web route remains valid.

Implementation requirements:

- Android App Links with verified `assetlinks.json`;
- iOS Universal Links with `apple-app-site-association` when iOS shipping begins;
- Expo Router route mapping;
- explicit auth-gated continuation when a link requires sign-in;
- preserve intended destination through sign-in rather than dumping the user on Home;
- unauthorized links fail safely without exposing resource existence beyond current server policy;
- external URLs never masquerade as trusted Wewed internal routes.

Deep-link compatibility must be covered by both Playwright/browser fallback tests and native-device tests.

---

## 12. Deferred invitation handoff

The native initiative must incorporate the server-side deferred invitation strategy so WhatsApp/social invitation context survives installation.

Required Android journey:

```text
Guest taps invitation
      ↓
wewed.pro invitation handoff
      ↓
app installed?
  yes        no
   ↓          ↓
native       Play Store
invite          ↓
             install
                ↓
       Google Play Install Referrer
                ↓
       Wewed server handoff lookup
                ↓
        native invitation screen
```

Rules:

- do not depend on a WhatsApp/Facebook in-app-browser cookie surviving installation;
- store only a bounded, opaque server-side handoff identifier in the Play referrer;
- the referrer must not contain sensitive wedding/guest data in plaintext;
- handoffs expire;
- replay is controlled;
- invalid/expired handoffs degrade to a safe route;
- installed-app App Links remain the preferred direct path when possible.

This flow is a release-critical integration, not an optional follow-up.

---

## 13. Notifications and communication

Implement native push notification infrastructure after authentication and deep-link routing are stable.

Notifications must:

- map to a safe native destination;
- re-check authorization when opened;
- avoid exposing sensitive content on a locked screen unless product/privacy rules permit it;
- support role/context-specific categories;
- avoid duplicate delivery caused by multiple provider paths;
- respect user/platform notification permissions;
- retain in-app communication history as the authoritative record where applicable.

Push delivery is an alert mechanism, not the canonical data store.

---

## 14. Offline/cache strategy

Wewed is not required to become a fully offline database application in the first native release, but it must degrade intelligently.

Cache candidates:

- current user/role context;
- wedding identity/basic summary;
- current task list;
- selected guest/timeline information useful in the field;
- vendor contact/profile summary;
- recent messages metadata, subject to privacy rules.

Do not permit offline writes for financially or contractually sensitive actions unless the server has an explicit idempotent reconciliation protocol.

Budget, contribution, booking, payment and contract mutations must fail safely rather than create ambiguous local truth.

---

## 15. Functional migration order

The implementing agent must execute in the following order. Do not jump ahead to cosmetic screens while security, contracts or navigation foundations are incomplete.

### Phase A — repository and tooling foundation

1. Rebase/cut implementation branch from current `main` after approval.
2. Add workspace/monorepo support without breaking existing web build.
3. Create `apps/mobile` with Expo/React Native/Expo Router.
4. Establish environment handling for local/preview/production API URLs.
5. Add shared package structure.
6. Add native lint/type/test commands.
7. Preserve TWA build untouched except where coexistence requires metadata documentation.

**Gate A:** existing Next.js build and Playwright web suite remain green; minimal native shell builds.

### Phase B — shared contracts and API client

1. Inventory mobile-required APIs.
2. Extract shared schemas/types.
3. Add predictable errors and client helpers.
4. Add request context capable of mobile credentials.
5. Add API contract/unit tests.

**Gate B:** native client can authenticate against non-production/local or approved test environment and call `/me`/equivalent securely.

### Phase C — authentication and app shell

1. Native sign-in/sign-out/session restoration.
2. Secure token storage.
3. Role resolution.
4. Role-aware navigation shell.
5. deep-link pending destination preservation through auth.
6. safe account switching/sign-out cache clearing.

**Gate C:** admin/couple/planner/vendor test users reach only authorized native roots; session expiry/restart tested.

### Phase D — core planner/couple workflows

Implement in vertical slices with real API data:

1. Home/overview.
2. wedding switching/active project context.
3. Tasks CRUD/filter/status.
4. Guests/invitations/RSVP-related management.
5. Budget.
6. Contributions.
7. Vendors/marketplace discovery.
8. Bookings.
9. Timeline/other major planner surfaces currently relied upon.

**Gate D:** core planner/couple workflows work on native Android and still pass web regression.

### Phase E — communications, vendor and guest flows

1. Messages/inbox/thread/reply.
2. Vendor portfolio/profile/services/enquiries/bookings.
3. Guest invitation/RSVP/contribution journeys.
4. native share sheet and QR tools.
5. photo/file picker integration where existing workflows require uploads.

**Gate E:** role-to-role communication and invitation flows pass both browser/server and native-device qualification.

### Phase F — contracts and AI

1. Contract viewing/approval actions supported on mobile.
2. Preserve immutable/multi-party contract authority.
3. Native AI chat/assistant surfaces call the existing Wewed AI Core.
4. Streaming/loading/cancel/error behaviour is mobile-safe.

**Gate F:** contract authority and AI responses match server rules; no client-side privileged shortcuts.

### Phase G — links, deferred install and notifications

1. Android App Links.
2. deferred invitation/referrer handoff.
3. native push infrastructure.
4. notification deep-link routing.
5. install/upgrade/reinstall scenarios.

**Gate G:** real physical Android device can receive/open supported links and recover a deferred invitation after a clean install.

### Phase H — mobile hardening

1. offline/read-cache behaviour;
2. poor-network handling;
3. upload resilience;
4. accessibility;
5. keyboard/safe-area/system navigation;
6. performance on long lists;
7. interruption/process-restart recovery;
8. duplicate-submit/idempotency audits;
9. empty/error/loading states;
10. visual consistency and Wewed brand polish.

**Gate H:** no known release-blocking mobile UX defect remains.

### Phase I — release qualification and replacement

1. Run complete web regression.
2. Run Playwright mobile Chromium matrix.
3. Run native automation.
4. Run physical-device UAT.
5. Build signed Android App Bundle using the existing Play identity `pro.wewed.app` and established Play signing process.
6. Release to closed/internal testing first.
7. Verify upgrade from existing TWA-installed version to native version.
8. Verify links, sessions, saved data and invitation handoff post-upgrade.
9. Expand rollout only after evidence is clean.
10. Retire TWA code only after production verification and rollback window.

---

## 16. Testing architecture

Testing is deliberately layered. No single tool proves the whole system.

### 16.1 Tier 0 — static/unit/domain

Mandatory on every implementation head:

- TypeScript checks for web and mobile;
- lint;
- existing Bun/unit tests;
- new shared-contract tests;
- pure domain tests for extracted shared logic;
- API auth/permission tests for mobile request context.

### 16.2 Tier 1 — Playwright + desktop Chromium regression

The current Playwright configuration already defines `desktop-chromium`. Preserve this project and keep the existing web application green.

At minimum, regression must cover:

- authentication;
- planner CRUD/data workflows;
- budget/contributions;
- guest/invitation routes;
- messages;
- marketplace/vendor pages;
- bookings;
- contracts;
- AI critical flows;
- admin approvals relevant to mobile changes;
- deep-link web fallbacks.

Native development may not weaken the desktop/web product.

### 16.3 Tier 2 — Playwright + mobile Chromium

The current `mobile-chromium` project uses a Pixel 5 profile and `@mobile` test tagging. Preserve it and expand mobile-browser coverage for the migration.

Required mobile-Chromium purposes:

- verify `wewed.pro` fallback remains usable when app is absent;
- verify invitation landing/handoff pages in a phone viewport;
- verify deep-link canonical URLs return safe browser experiences;
- verify auth routes remain mobile-safe;
- verify responsive public/vendor/wedding pages;
- verify no new horizontal overflow/desktop-only controls are introduced into fallback surfaces;
- verify link generation/redirect semantics consumed by the native app;
- verify server mutations independently of native presentation where appropriate.

Add additional Chromium device profiles where they materially expose layout/viewport problems, for example a small Android viewport and a larger modern Android viewport. Device emulation is not a substitute for a physical phone.

### 16.4 Playwright limitation — explicit

Playwright/Chromium cannot fully prove a compiled React Native UI because that UI is not a Chromium DOM application.

Therefore:

> **A green Playwright suite is necessary but insufficient for native release approval.**

Do not create a fake web version of the native app merely so Playwright can click it and call that native testing.

### 16.5 Tier 3 — native automation

Use a black-box native automation layer, preferably Maestro for the first implementation unless repository/tooling evidence strongly justifies Detox.

Automate at minimum:

- cold launch;
- sign in;
- role landing;
- planner wedding selection;
- task create/update/filter;
- guest lookup/basic mutation;
- budget/contribution read and safe write path;
- vendor search/profile;
- message send/read;
- invitation App Link;
- sign out;
- relaunch/session restore;
- Android back behaviour;
- permission-denied recovery;
- network/error retry where automatable.

Native automation evidence should be stored as CI artifacts where possible.

### 16.6 Tier 4 — Android emulator qualification

Run the native app on at least:

- one small/older-style phone profile;
- one mainstream modern Android profile;
- one current target-SDK emulator image.

Check keyboard, navigation mode, status bars, dark/light mode, font scaling and rotation behaviour.

### 16.7 Tier 5 — physical Android device UAT

A real physical device is mandatory before Play closed-test promotion because emulator/browser tests cannot fully validate:

- App Links association;
- Play Install Referrer;
- Play Store upgrade path;
- WhatsApp-originated link behaviour;
- push notifications;
- real camera/photo picker;
- real sharing targets;
- OS memory/background behaviour;
- manufacturer-specific Android quirks;
- network switching between Wi-Fi/mobile data.

### 16.8 Tier 6 — iOS qualification when shipping iOS

Before App Store release, add:

- iOS Simulator automation;
- physical iPhone UAT;
- Universal Links;
- push/APNs;
- iOS Keychain/session restore;
- keyboard/safe-area/dynamic type;
- share sheet/photo picker;
- background/resume behaviour.

Android delivery must not block forever on iOS if the approved business sequence is Android-first, but the architecture must not make iOS a rewrite.

---

## 17. Required regression matrix by capability

Every release candidate must record PASS/FAIL for the relevant rows.

| Capability | Web Playwright desktop Chromium | Web Playwright mobile Chromium | Native automation | Physical device |
| --- | --- | --- | --- | --- |
| Sign in/out/session | PASS | PASS | PASS | PASS |
| Role authorization | PASS | PASS where browser route exists | PASS | PASS |
| Wedding/project switching | PASS | PASS | PASS | PASS |
| Planner tasks | PASS | PASS | PASS | PASS |
| Guests/invitations | PASS | PASS | PASS | PASS |
| Budget | PASS | PASS | PASS | PASS |
| Contributions | PASS | PASS | PASS | PASS |
| Vendor discovery/profile | PASS | PASS | PASS | PASS |
| Booking | PASS | PASS | PASS | PASS |
| Messages | PASS | PASS | PASS | PASS |
| Contracts | PASS | PASS | PASS | PASS for supported actions |
| AI | PASS | PASS | PASS | PASS |
| Canonical link fallback | PASS | PASS | N/A | PASS |
| App Link native open | N/A | browser fallback verified | PASS | PASS |
| Deferred install invite | browser handoff verified | browser handoff verified | partial | PASS mandatory |
| Native share | N/A | fallback share verified | PASS | PASS |
| Push notification | N/A | N/A | where automatable | PASS mandatory |
| Camera/photo/file picker | N/A | browser fallback as applicable | partial | PASS mandatory |
| Back/gesture/safe area | N/A | responsive only | PASS | PASS |
| Poor network/interruption | selected API cases | selected browser cases | PASS | PASS |

A feature may be marked not-applicable only with an explicit reason in the release record.

---

## 18. Existing Playwright suite preservation

Existing specs such as planner CRUD/data workflows, adaptive navigation, deep-link navigation, messages-mobile and other current E2E tests are regression contracts.

The agent must prefer extending/reusing these tests rather than deleting tests because native architecture makes them inconvenient.

If a test becomes genuinely obsolete because a web feature is explicitly retired, document the product decision and replacement coverage before removing it.

The current Playwright practices—single worker, retry in CI, traces on first retry, screenshots on failure and retained failure video—should remain unless there is a measured reason to alter them.

---

## 19. CI/release gates

The implementation branch must not be merged merely because the native app launches.

Before merge, the exact PR head must pass:

1. web build;
2. mobile build/type validation;
3. unit/domain/API tests;
4. existing Playwright desktop Chromium suite;
5. existing/expanded Playwright mobile Chromium suite;
6. native automation smoke/core flows;
7. security review of mobile auth and secret handling;
8. deep-link association checks;
9. release-candidate Android build.

Before Play promotion, add:

10. physical Android UAT;
11. App Link verification from real WhatsApp/browser sources;
12. clean install deferred invitation test;
13. upgrade test from the current TWA Play version;
14. push/share/photo-picker checks;
15. production API smoke test with authorized test accounts;
16. rollback plan verification.

---

## 20. Upgrade and Play Store continuity

The native Android app should replace the current TWA under the existing Play application identity where technically and signing-policy compatible.

Preserve:

- package/application ID `pro.wewed.app`;
- Play App Signing continuity;
- upload-key handling outside the repository;
- version code monotonicity;
- existing production domain association.

A user upgrading from the TWA must not lose server data because server data is authoritative. Local browser cookies are not assumed to become native credentials; a controlled re-authentication may be required if secure session migration is not possible.

The upgrade test must prove:

- installation succeeds over the previous Play build;
- launch does not crash;
- canonical links route correctly;
- user can sign in to the same Wewed account;
- wedding/vendor/planner data is unchanged;
- no stale TWA-only launch URL hijacks the native navigation.

---

## 21. Security and privacy checklist

Before release:

- no server secrets in bundle/source maps;
- no service-role Supabase key in client;
- secure token storage;
- TLS-only production API;
- authorization enforced server-side;
- logs do not expose invitation/auth tokens;
- deep links validate scheme/host/path and authorization;
- notification content respects privacy;
- clipboard use is minimized for secrets;
- screenshots/screen recording restrictions may be considered only for narrowly sensitive screens and must not damage normal UX;
- analytics/crash reporting must not capture sensitive message, contract, payment or guest content by default;
- local caches are cleared on sign-out/account switch;
- expired invitation/deferred-handoff tokens fail closed.

---

## 22. Observability

The mobile release requires enough diagnostics to support real users without guessing.

Capture at minimum, using privacy-safe identifiers/events:

- app version/build;
- platform/OS version;
- cold-start success/failure;
- API error class and endpoint family;
- auth/session expiry/recovery;
- deep-link routing success/failure;
- deferred invitation recovery result;
- push-open routing result;
- crash/non-fatal errors;
- major workflow completion metrics where product analytics already permits them.

Do not log raw passwords, tokens, private messages, contract contents or sensitive guest/payment data.

---

## 23. Definition of done

This initiative is complete only when all of the following are true:

1. A genuine React Native Android client exists in the repository and builds reproducibly.
2. The app is not a TWA/WebView presentation of the existing website.
3. Existing Wewed accounts and server data are reused.
4. Mobile auth is secure and server-authorized.
5. Planner, couple, vendor and guest major journeys work natively.
6. Mobile admin supports the approved high-value operational actions.
7. Tasks, guests, budget, contributions, vendors, bookings, messages, contracts and AI work according to the server's supported scope.
8. Internal sharing uses canonical `wewed.pro` links and native share UI.
9. Android App Links work on a physical device.
10. Deferred invitation recovery works after Play installation.
11. Push notifications route safely where enabled.
12. Keyboard, back gesture, safe areas, accessibility and interruption behaviours are acceptable on real devices.
13. Poor-network states do not create duplicate/ambiguous writes.
14. Existing web/PWA remains functional.
15. Playwright desktop Chromium is green.
16. Playwright mobile Chromium is green.
17. Native automation is green for the agreed core suite.
18. Physical Android UAT is green.
19. Upgrade from the TWA release to the native Play build is verified.
20. The native Android release is promoted and production-smoked successfully.
21. The legacy TWA is not retired until rollback confidence is established.

---

## 24. Agent execution contract — “one go” means end-to-end ownership

After explicit user approval, the implementing agent must treat this as one coordinated programme rather than a sequence of disconnected experiments.

The agent must:

- align to this stamped document before changing code;
- inspect the latest `main` and amend baseline notes if `main` has advanced;
- create the implementation branch;
- implement phases A through I in order;
- keep web and native builds green at each gate;
- commit meaningful vertical slices;
- run tests after each material slice rather than postponing all regression until the end;
- preserve existing data/security semantics;
- resolve regressions encountered inside this scope rather than declaring them “normal mobile behaviour”;
- avoid asking the user to make routine coding decisions that can be resolved from this plan/repository;
- document genuine blockers when external credentials/store actions are required;
- never expose signing keys or secrets in the repository;
- produce a final release matrix with exact PASS/FAIL evidence;
- do not merge or promote the replacement Play build until the exact release head passes the required gates.

“One go” does **not** mean one giant untested commit. It means the agent owns the whole migration continuously, follows the gates, and does not stop after creating a shell or proof of concept.

---

## 25. Explicit non-goals / anti-patterns

Do not:

- rewrite Wewed's backend merely because a native client is being added;
- fork user/business data into a mobile database;
- expose Prisma directly to the device;
- ship service secrets in the app;
- reproduce desktop pages pixel-for-pixel on mobile;
- depend on pinch zoom;
- use WebView as the standard screen renderer;
- replace server permissions with client route checks;
- remove web tests to make CI green;
- call Playwright native-app testing when only Chromium was exercised;
- remove the TWA before native rollback confidence exists;
- let UI polish delay core functional parity indefinitely;
- treat WhatsApp in-app browser persistence as the deferred-install mechanism.

---

## 26. First implementation goal after approval

The first goal is **not** to port a planner screen.

The first goal is to establish the permanent foundation:

> **A native Expo/React Native app boots inside the existing repo, authenticates securely against Wewed, resolves the same role/wedding authority as the web app, calls a typed Wewed API contract, and passes the unchanged web Playwright baseline.**

Only after that foundation is proven should the agent migrate feature slices.

This prevents Wewed from ending up with a beautiful second client whose security, permissions and data semantics drift from the platform.

---

## 27. Approval boundary

At the time this plan is stamped:

- planning/documentation is approved;
- implementation is **not yet approved**;
- no native migration code should be merged on the basis of this document alone;
- implementation begins only after the user explicitly gives the go-ahead.

When approval is given, this document becomes the execution checklist and release authority for the native migration.