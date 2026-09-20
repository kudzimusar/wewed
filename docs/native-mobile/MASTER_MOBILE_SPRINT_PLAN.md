# Wewed Native Mobile Sprint — Master Architecture & Execution Plan

**Plan ID:** `WW-NATIVE-MOBILE-IOS-ANDROID-2026-09-17-01`  
**Governing Status:** LOCKED & AUTHORITATIVE  
**Target Release:** Dual-Native Production (iOS Swift/SwiftUI + Android Kotlin/Jetpack Compose)

## Current Execution Addendum — 2026-09-18

The current authoritative next-sprint manual is:

**WEWED_NATIVE_SHADOW_INTEGRATION_REAL_WEDDING_PARITY_PLAN_2026-09-18.md**  
Plan ID: **WW-NATIVE-SHADOW-REAL-WEDDING-PARITY-2026-09-18-01**

It governs the transition from the qualified fixture-backed whole-product shell to a realistic Mobile Shadow environment using the **Charity & Kudzie** wedding and the **Eleven Eleven Testing** planner context as the real-world reference scenario.

This addendum does **not** unlock production integration. Production remains a read-only source during the shadow phase; no shadow writes may flow back to production. The permanent architecture, isolation, security, dual-native and release gates in this Master Plan remain in force.

For agent onboarding and required document reading order, see **docs/native-mobile/README.md**.

---

## Executive Summary & Core Mandate

> **Wewed Mobile is not a wrapper around the PWA. It is a dual-native implementation of the Wewed product: SwiftUI on iOS, Jetpack Compose on Android, both driven by one shared product contract and qualified together before production integration.**

The existing web/PWA application serves as the **functional reference and behavioural benchmark**, but not as the codebase or architecture of the native clients.

---

## 1. The Governing Architecture

```text
                         WEWED PLATFORM
                              │
                     Existing Wewed Backend
                              │
                    Canonical API Contract
                              │
               ┌──────────────┴──────────────┐
               │                             │
        Shared Mobile Layer          Shared Product Spec
               │                             │
      ┌────────┼─────────┐          ┌────────┼────────┐
      │        │         │          │        │        │
   Tokens    Models   Fixtures    Flows   Roles    Tests
      │        │         │          │        │        │
      └────────┴────┬────┘          └────────┴───┬────┘
                    │                           │
           ┌────────┴──────────┐       ┌────────┴──────────┐
           │                   │       │                   │
        iOS Native         Android Native          Maestro/E2E
     Swift + SwiftUI    Kotlin + Compose
           │                   │
      Apple APIs           Android APIs
           │                   │
           └──────────┬────────┘
                      │
                MOBILE QA GATE
                      │
           TestFlight + Play Testing
                      │
             Production Integration
```

---

## 2. The Six Permanent Workstreams

| Workstream | Responsibility & Authority | Primary Tooling |
|---|---|---|
| **A0 — Mobile Moderator / Architect** | Sole authority over scope, architecture, contract enforcement, dependency approvals, parity review, and release gates. Blocks PRs attempting to touch web code. | `github-mcp-server`, Architecture specs |
| **A1 — Shared Product Foundation** | OpenAPI contracts, generated data classes, design tokens, feature schemas, fixtures, localization contracts, analytics definitions, deep-link specs, Native Capability Registry. | Stitch MCP (visual tokens), Style Dictionary, OpenAPI codegen |
| **A2 — iOS Native** | Swift, SwiftUI, Apple Lifecycle, Keychain, APNs, PassKit, ActivityKit, ContactsUI, EventKit, BackgroundTasks, native iOS accessibility & ergonomics. | `xcode-project-setup`, SwiftData, Apple Vision |
| **A3 — Android Native** | Kotlin, Jetpack Compose, Android Lifecycle, Keystore, FCM, Google Wallet SDK, Contacts Provider, Calendar, WorkManager, predictive back, Material 3 ergonomics. | `android-cli`, Room, Google ML Kit |
| **A4 — Mobile QA** | Independent validation of parity, Maestro cross-platform E2E journeys, XCUITest, Compose UI tests, device qualification matrices, offline resilience, accessibility audits. | Maestro CLI, Firebase Test Lab, Local Simulators/Emulators |
| **A5 — Release / Observability** | Signing management (Match/Keyring), Fastlane pipelines, TestFlight distribution, Google Play Internal/Closed tracks, crash telemetry, release versioning & rollback. | Fastlane, Firebase Crashlytics |

---

## 3. Strict Isolation Guardrails (Mandatory)

1. **Zero Modifications to Existing Web/PWA:** Current `src/`, `prisma/`, `supabase/`, and deployment files are **strictly read-only**.
2. **Beside, Not Inside:** All work is confined to `apps/ios/`, `apps/android/`, `mobile/`, and `docs/native-mobile/`.
3. **Dedicated Branching Model:**
   ```text
   main
     └── native-mobile/integration (Protected mobile hub)
           ├── native-mobile/shared
           ├── native-mobile/ios
           ├── native-mobile/android
           ├── native-mobile/qa
           └── native-mobile/release
   ```
   *No mobile code merges into `main` until Milestone B is formally approved.*
4. **Deferred Backend Changes:** Missing backend requirements are recorded in `docs/native-mobile/PROPOSED_BACKEND_INTEGRATION_SPEC.md` and mocked locally in `mobile/fixtures/`.
5. **Two Distinct Milestones:**
   * **Milestone A (Native Qualified):** iOS + Android complete, parity confirmed, tests pass against mobile sandbox. Work halts.
   * **Milestone B (Production Integration):** Authorized only after formal review of `INTEGRATION_READINESS_REPORT.md`.

---

## 4. Wewed Wedding Pass & Wedding Day (Zimbabwe-First)

The primary Wedding Day credential is the **Wewed Wedding Pass**—owned, generated, authenticated, and operated entirely by Wewed.

```text
                  WEWED INVITATION / RSVP
                             │
                    WEWED WEDDING PASS
                             │
     ┌───────────────────────┼───────────────────────┐
     ▼                       ▼                       ▼
  WhatsApp Living Link    Mobile Web (/pass/)      Printed Cardstock
     │                       │                       │
     └───────────────────────┼───────────────────────┘
                             ▼
                    Universal Signed QR
                             │
                             ▼
                 NATIVE USHER CHECK-IN
            • Sub-100ms camera scan (Vision / ML Kit)
            • Local AES-GCM offline manifest
            • Instant fuzzy name/phone search fallback
```

### Core Tenets:
* **Zero App Requirement for Guests:** Guests access their pass via WhatsApp or mobile browser with zero account creation and a sub-50KB data footprint.
* **Living Link:** Date, time, venue, or table updates reflect immediately without re-issuing invitations.
* **Zero Dependency on Apple Pay/Google Pay:** Payments/contributions (EcoCash, InnBucks, USD) are completely decoupled from access credentials.
* **Optional Convenience Adapters:** Apple Wallet and Google Wallet are secondary options; Wewed never depends on their availability.
* **Offline Robustness:** Ushers can validate credentials in airplane mode using pre-cached encrypted manifests.

---

## 5. Automated Tooling & Accelerators

1. **Design Tokens:** Style Dictionary compiles `mobile/design-tokens/tokens.json` directly into:
   * iOS: `Tokens.swift` (`Color.wewedGold`, `Font.wewedHeadline`)
   * Android: `Tokens.kt` (`WewedTheme.colors.gold`, `WewedTypography.headline`)
2. **API Codegen:** `mobile/contracts/openapi.yaml` generates type-safe networking clients:
   * iOS: `swift-openapi-generator`
   * Android: Kotlinx Serialization + Retrofit/Ktor
3. **Visual References:** Stitch MCP generates canonical UI variants (HIG vs Material 3) for parity alignment.
4. **Single-Spec E2E:** Maestro YAML journeys execute against both platforms identically.
5. **Cinematic Assets (Phase 14):** Higgsfield AI pipelines generate animated save-the-dates and AFTER-mode recap reels *after* core app stability is proven.

---

## 6. Definition of Feature Complete

A feature is **not complete** when a screen is rendered. A feature is complete strictly when:

```text
Contract: PASS

iOS:
  UI: PASS
  Read: PASS
  Write: PASS
  Error states: PASS
  Offline/recovery: PASS
  Native tests: PASS

Android:
  UI: PASS
  Read: PASS
  Write: PASS
  Error states: PASS
  Offline/recovery: PASS
  Native tests: PASS

Shared:
  Maestro E2E journey: PASS
  Accessibility: PASS
  Role boundaries: PASS
  Parity matrix check: PASS
```

---

## 7. The 27-Step Locked Execution Sequence

```text
01  Audit current Wewed/PWA
02  Create parity matrix (MOBILE_FEATURE_PARITY_MATRIX.md)
03  Freeze mobile product contract
04  Create shared design system/tokens (Style Dictionary)
05  Generate API clients & data models
06  Build iOS foundation (Lifecycle, Navigation shell, Storage)
07  Build Android foundation (Lifecycle, Navigation shell, Storage)
08  Establish native information architecture (Bottom tabs, stacks)
09  Complete authentication & onboarding
10  Implement domains in parity pairs (Planner, Guests, Budget, etc.)
11  Add required Tier-A native capabilities (Camera, Contacts, Share)
12  Implement Wedding Pass / Wedding Day V1 (Scanner, Offline manifest)
13  Add advanced native experiences (Live Activities, Widgets)
14  Add optional cinematic/AI features (Higgsfield video invites/recaps)
15  Complete platform tests (XCTest, JUnit, Compose UI)
16  Complete shared Maestro E2E test suites
17  Offline & resilience qualification
18  Security & credential audit
19  Performance & memory qualification
20  Device-matrix qualification (Small, standard, large, flagship)
21  Prepare TestFlight + Play Internal builds (Fastlane)
22  Full mobile UAT
23  Pass dual-platform release gate (All PASS)
24  Connect production integration (Replace sandbox adapters)
25  Repeat integration qualification
26  Production Release
27  Post-release monitoring & telemetry
```

---

## 8. Final Release Gate Matrix

| Requirement | iOS Status | Android Status | Gate Decision |
|---|:---:|:---:|:---:|
| Feature Parity | PASS | PASS | Required |
| Native Navigation | PASS | PASS | Required |
| Authentication & Session | PASS | PASS | Required |
| Roles & Permissions | PASS | PASS | Required |
| Persistence & Cache | PASS | PASS | Required |
| Deep Links / App Links | PASS | PASS | Required |
| Push Notifications | PASS | PASS | Required |
| Native Capabilities Registry | PASS | PASS | Required |
| Offline / Network Recovery | PASS | PASS | Required |
| Accessibility (a11y) | PASS | PASS | Required |
| Native Unit/UI Tests | PASS | PASS | Required |
| Maestro Cross-Platform E2E | PASS | PASS | Required |
| Physical Device Matrix | PASS | PASS | Required |
| Performance / Cold Start | PASS | PASS | Required |
| Security & Secrets Audit | PASS | PASS | Required |
| Telemetry & Crash Reporting | PASS | PASS | Required |
| Signed Release Artifacts | PASS | PASS | Required |

> **Rule:** Any critical `FAIL` blocks production integration unconditionally.

---

## Guest Invitation Exact-Parity Rule

**Task stamp:** `WW-NATIVE-INVITATION-EXACT-PARITY-RULE-2026-09-20-08`
**Full contract:** [NATIVE_GUEST_INVITATION_ENTRY_CONTRACT.md](./NATIVE_GUEST_INVITATION_ENTRY_CONTRACT.md)

> An invited Guest enters Wewed through **the actual configured digital invitation design selected
> for that wedding**. Native Android and iOS must not invent or substitute a simplified "ceremonial
> card", summary card, generic ivory card, or other invitation-like UI.

This rule is a standing gate on every future sprint, not a one-off correction. It follows from the
project-wide rule already in force:

> If the current Wewed website has a database-backed capability, the native app must either consume
> the same canonical service/domain or the route must be considered **FAIL**. "Unsupported" is only
> legitimate when Wewed itself does not have the capability — not when native simply has not wired
> it yet.

### What the rule requires

1. The design comes from `wedding.invitationCardStyle`, resolved through the generated registry in
   `mobile/contracts/invitation-styles.json`. Native never picks the design.
2. A style native cannot reproduce is **named and declined**. It is never silently substituted, and
   never aliased onto a style native happens to be able to draw.
3. Presentation state (`CLOSED`/`OPENING`/`OPEN`/`DETAILS`) is orthogonal to RSVP state. An answered
   guest meets the same invitation as everyone else; only what it *offers* changes.
4. An answered guest is never re-asked. A declined guest never receives a pass.
5. Resemblance is not reproduction. `ivory background + gold border + floral ornament` is a **FAIL**.

### Release-gate consequence

| Gate row | Effect |
|---|---|
| Feature Parity | A wedding whose saved style has no native renderer is **FAIL** for that wedding's guest invitation route — not "unsupported". |
| Native Unit/UI Tests | The generated style registry and the artwork/geometry provenance are asserted on both platforms; drift fails the build. |
| Maestro Cross-Platform E2E | The pending, decline, returning-attending, returning-declined and ordinary-download journeys are required lanes. |

### Current standing

- **Ivory Floral Gold** — exact native renderer on both platforms, runtime-verified. **PASS**
- **The other eleven registry styles** — no native renderer. Each is named and declined at runtime.
- **Charity & Kudzie (the real UAT wedding)** is saved as `botanical` (Garden Romance), so its guest
  invitation route is **FAIL — native renderer missing**. Garden Romance is the next renderer
  required. The website's invitation was not changed to make native easier, and the wedding's saved
  style was not changed to make native pass.
