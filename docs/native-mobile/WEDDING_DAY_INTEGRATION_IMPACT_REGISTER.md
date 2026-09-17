# Wewed Wedding Day & Native Mobile Integration Impact Register

## Executive Overview
This document constitutes the canonical architectural register defining how the **Ivory Invitation**, the **Wewed Wedding Pass**, and the **Next-Generation Native Mobile Applications (iOS & Android)** operate as an indivisible, cohesive ecosystem.

```text
                  IVORY INVITATION (Ceremonial Reveal)
                              │
                              ↓
                  INVITATION RELATIONSHIP TOKEN
                              │
                              ↓
                  WEWED WEDDING PASS (Identity & Access)
                              │
                              ↓
              NEXT NATIVE MOBILE OPERATING MODES
         ┌────────────────────┼────────────────────┐
         │                    │                    │
    GUEST MODE           PLANNER MODE         VENDOR MODE
  (Schedule, Table,    (Attendance, Log,   (Status, Arrival,
   Pass, News, Chat)    Tasks, Broadcast)    Area, Dispatch)
```

---

## Domain Impact Matrix

### 1. Native iOS Architecture (Swift + SwiftUI)
- **Component Path**: `apps/ios/Wewed/`
- **Impact & Responsibilities**:
  - Genuine native SwiftUI implementations without WebView reliance.
  - Native gesture-driven Ivory Invitation scene (`IvoryInvitationView.swift`) utilizing interactive fold angles, scale transitions, and spring animations.
  - AVFoundation camera QR scanner with reticle overlay, zero-delay feedback, and admittance counter.
  - Secure-storage abstraction with an in-memory implementation currently used by the isolated native baseline. Production Keychain backing remains a hardening item and must not be claimed as complete until implemented and qualified.
  - Actor-isolated local manifest store (`OfflineManifestStore.swift`) with durable restart persistence and attendee-level offline queue state.
  - Root-signed manifest trust persistence (`WeddingDayManifestTrustStore.swift`) and isolated-domain synchronization (`WeddingDaySyncService.swift`).
  - Native haptic feedback via `UIImpactFeedbackGenerator` (success, warning, light selection).

### 2. Native Android Architecture (Kotlin + Jetpack Compose)
- **Component Path**: `apps/android/app/src/main/java/pro/wewed/app/`
- **Impact & Responsibilities**:
  - Jetpack Compose Material 3 implementation.
  - Native animated Ivory Invitation card (`IvoryInvitationScreen.kt`) with folding envelope transitions and gold foil shimmer highlights.
  - CameraX and barcode scanning reticle with permission contract handling.
  - Secure-storage abstraction with an in-memory implementation currently used by the isolated native baseline. Production encrypted preferences/storage remains a hardening item.
  - Mutex-synchronized persistent offline manifest and attendee-level check-in queue (`OfflineManifestStore.kt`).
  - Root-signed manifest trust persistence (`WeddingDayManifestTrustStore.kt`) and isolated-domain synchronization (`WeddingDaySyncService.kt`).
  - Haptic feedback and visual confirmation banners for gate admissions.

### 3. Ivory Invitation Experience
- **Role in Ecosystem**: The ceremonial gateway and initial engagement surface.
- **Visual Design Identity**:
  - Palette: Warm Ivory stationery (`#FBF5E9`), Champagne Gold accents (`#B3833F`), Espresso ink (`#42372F`), Stage backdrop (`#17130F`).
  - Motion: Ceremonial tri-fold reveal, wax seal / ribbon gesture, gentle elevation.
  - Content: Personalized greeting for guest/household, ceremony time, venue estate, RSVP CTA.
- **Transition Contract**:
  - Tapping "Confirm RSVP & Get Pass" records attendance, provisions the persistent signed Wedding Pass, and transitions into the Wedding Day experience.

### 4. Invitation & RSVP State Machine
- **States**: `INVITED` → `OPENED` → `RSVP_ATTENDING` | `RSVP_DECLINED` → `PASS_ISSUED` → `CHECKED_IN` (Partial / Full).
- **Invariants**:
  - RSVP confirmation generates/reuses the immutable wedding-scoped `passSerial` and cryptographic nonce.
  - Household headcount is represented by stable attendee keys (`primary`, `plus-one`, `child-N`) rather than a count-only admission mutation.
  - Re-opening an already confirmed invitation loads the same persistent active Wewed Wedding Pass.

### 5. Guest Membership & Relationship Tokens
- **Frictionless Auth**: Guests do not need traditional email/password credentials to access their invitation or pass.
- **Relationship Token**: A signed/scoped invitation relationship represented by the wedding invitation URL and guest RSVP token.
- **Persistence**: Native secure persistence of the relationship credential remains part of production hardening; the isolated implementation proves the server relationship, RSVP persistence and stable pass lifecycle first.

### 6. Planner Day-Of Operations
- **Mobile Operational Hub**:
  - Real-time attendance counter: admitted people vs. expected people derived from person-level `WeddingCheckIn` rows.
  - Programme milestones and Planner tasks from existing Wewed domains.
  - Wedding-scoped vendor presence monitor.
  - Persistent emergency/day-of announcements.

### 7. Vendor Presence & Logistics
- **Role Surface**: Simplified, high-contrast vendor dashboard.
- **Status Lifecycle**:
  `CONFIRMED` → `EN_ROUTE` → `ARRIVED_ON_SITE` → `SERVICE_ACTIVE` → `COMPLETED`.
- **Authority Boundary**:
  - Presence is scoped to the existing `ServiceEngagement`, not global Vendor identity.
  - Vendor mutation is restricted to the vendor/service relationship for the active wedding.
  - Planner/couple/admin retain broader wedding-scoped operational authority.

### 8. Day-Of Communications & Announcements
- **Persistent Domain**: `WeddingAnnouncement` is wedding-scoped and audience-scoped (`all`, `guest`, `planner`, `vendor`).
- **Delivery Surfaces**: In-app presentation is implemented against the same persistent domain; push/local-notification delivery remains a separate integration concern.

### 9. Database & Schemas (Implemented Isolated Model)
- Existing source-of-truth models are reused rather than duplicated: `Wedding`, `Guest`, `RSVP`, `WeddingMembership`, `Vendor`, `ServiceEngagement`, `PlannerTask`, and `ProgrammeItem`.
- Wedding Day-specific additive structures:
  - `WeddingPassKey`: wedding-scoped public verification keys, activation/expiry/revocation state and rotation identity (`keyId`).
  - `WeddingPassCredential`: persistent guest/pass relationship, WW2 token material, nonce, event mask, expiry/revocation state and signing-key reference.
  - `WeddingCheckIn`: person-level attendee admission row with event key, gate/device metadata, actor identity and idempotent client event identity.
  - `WeddingServicePresence`: wedding + service-engagement-scoped operational vendor presence.
  - `WeddingAnnouncement`: persistent, audience-scoped Wedding Day broadcast record.
- Legacy RSVP `checkedIn` remains as a compatibility projection and is not the authoritative admission ledger.

### 10. Authentication & Security
- **Role Tiering**:
  - `GUEST`: relationship/session scoped to their invitation, pass and guest Wedding Day data.
  - `USHER`: WeddingMembership-authorized gate operation and manifest access.
  - `VENDOR`: WeddingMembership/vendor-service-authorized presence mutation.
  - `COUPLE` / `PLANNER` / `ADMIN`: wedding-scoped operational authorization according to the server route.
- **WW2 Trust Contract**:
  - Six-part token grammar is preserved: `WW2.<weddingShortId>.<passSerial>.<hexMask>.<nonce>.<p1363SignatureHex>`.
  - ECDSA P-256/SHA-256 uses 64-byte IEEE-P1363 signatures encoded as hex.
  - Manifest v2 is root-signed and contains public key rotation metadata only; no signing private key is distributed to native clients.
  - Native clients resolve a pass through `credential.keyId` and reject inactive/revoked/expired keys or mismatched pass metadata.

### 11. Deep Links & Deferred Installation
- **Canonical Schemes**:
  - `wewed://invite?wedding=<slug>&token=<token>&card=<style>`
  - `wewed://pass?wedding=<slug>&serial=<serial>`
  - `https://wewed.pro/w/<slug>?rsvp=<token>&card=<style>`
- Deferred-install/referrer production plumbing remains separate from this isolated Wedding Day integration boundary.

### 12. Offline Manifest & Field Operation
- **Implemented isolated contract**:
  - `GET /api/wedding-day/manifest` returns manifest v2 under operator RBAC and `private, no-store` HTTP semantics.
  - Root-signed canonical payload includes `weddingId`, `weddingShortId`, `eventKey`, expiry, pass verification keys, guest/pass mapping, exact household attendee keys and current checked-in attendee keys.
  - iOS and Android persist verified public-key trust plus the admission roster across process restart.
  - Offline admissions append exact attendee keys to a durable local queue with stable queue ID + device ID.
  - Reconciliation uses `POST /api/wedding-day/check-in` with `source: "offline-sync"`, exact `attendeeKeys`, `deviceId` and `clientEventId` equal to the durable queue ID.
  - Legacy count-only queue entries are deliberately blocked from automatic replay because reinterpreting a count as whole-household admission would be unsafe.
- **Production hardening still deferred**:
  - At-rest AES/Keychain/Keystore hardening and SQLite journal replacement are not yet claimed complete.
  - Background OS scheduling for automatic sync is separate from the proven reconciliation service.

### 13. Notifications & Native Haptics
- Haptics remain native UI behavior.
- Push transport and scheduled local reminders are outside the isolated database/API acceptance boundary and must be qualified separately before production integration.

### 14. Planner ↔ Vendor Task Annotation Architecture (Non-Destructive Linkage)
- **Design Principle**: Vendor arrival events never silently mutate, overwrite, or auto-complete Planner tasks unless explicitly approved by the planner.
- **Correlation Mechanism**:
  - Existing Planner tasks remain authoritative.
  - Vendor/service presence may be presented as contextual task information or completion suggestion.
- **Planner Agency**: Task state changes remain explicit Planner actions; vendor presence is an operational signal, not an automatic task completion command.

---

## Isolated Qualification Status — 17 September 2026

The current work remains strictly isolated on `native-mobile/integration` in `/Users/shadreckmusarurwa/Project AI/wewed-native-mobile`; it is **not merged, deployed, or connected to the protected active Wewed baseline or production database**.

### Status Classification

| Capability / Surface | Status | Verification Summary |
|---|---|---|
| Real Isolated Chromium E2E (`wedding-day-application-e2e.spec.ts`) | **TESTED** | 6/6 passed (37.0s) against real Next.js dev server, real Next API routes, and isolated database `wewed_wedding_day_test` |
| Mock/Contract Acceptance Suite (`reference-pass-verification` & `wedding-day-e2e-journey`) | **TESTED** | 17/17 passed (3.1s) under mobile Chromium emulation |
| iOS Swift Native Unit & Offline Suite (`swift test`) | **TESTED** | 24/24 passed (0.058s) covering WW2 P-256 CryptoKit, DER parsing, offline manifest store, attendee queues, trust persistence |
| Android Kotlin Native Unit & Offline Suite (`./gradlew testDebugUnitTest`) | **TESTED** | 24/24 passed (0.39s) covering NIST P-256 ECDSA, attendee-level offline queue, crash/restart survival, key rotation |
| Native Maestro Android Smoke (`.maestro/native-wedding-journey.yaml`) | **TESTED** | 30/30 steps passed on Android emulator (`emulator-5554` / Pixel_8) with `gate-scanner-done` optional iOS preservation and `Close` Android fallback |
| Native Maestro iOS Journey | **DEFERRED** | Swift Package Manager architecture boundary (`Package.swift` builds `WewedKit` & `WewedApp`); Xcode `.app` bundle archive and simulator runner deferred |
| Production Secure Storage (Keychain / EncryptedSharedPreferences) | **DEFERRED** | Durable disk/file persistence verified; hardware-backed secure storage remains post-qualification production hardening |
| Background OS WorkManager / BGTaskScheduler Sync | **DEFERRED** | Deterministic foreground reconciliation service verified; OS background worker registration remains post-qualification hardening |
| Controlled Migration to Production Baseline | **INTEGRATION-REQUIRED** | Requires separate project-owner authorization; migrations must NEVER be run against production/UAT without explicit authority |

### Verified Qualification Evidence
1. **Real Application Playwright E2E**: 6/6 passed.
   - Ivory reveal flow verified: `closed` → user clicks "Open invitation" → `open` transition → user clicks "Review my RSVP" in `#rsvp` → `premium-invitation-rsvp-dialog` opens.
   - RSVP submission persists attendance, plus-one, children count, and issues signed WW2 token.
   - Same WW2 token and pass serial re-read across fresh browser context sessions.
   - Person-level partial household admission, duplicate scan idempotency, and capacity limiting verified.
   - Service-scoped vendor presence verified: `ASSIGNED` → `EN_ROUTE` → `ARRIVED_ON_SITE` → `SERVICE_ACTIVE` → `COMPLETED`.
   - Persistent announcements created by Planner operational API and displayed on guest pass.
   - Server-side RBAC verified: guest blocked from planner and check-in APIs, cross-vendor mutation rejected with 403.
   - WW2 token tampering rejected and root-signed offline manifest verified.
2. **Mock / Contract Playwright Suite**: 17/17 passed.
3. **iOS Swift Package Test Suite**: 24/24 passed (`WewedTests` 20/20, `WeddingDayOfflineTests` 4/4).
4. **Android Unit & Offline Test Suite**: 24/24 passed (`WewedTests` 20/20, `WeddingDayOfflineTest` 4/4).
5. **Android Native Maestro Journey**: 30/30 actions and assertions passed on running emulator.

### Baseline Protection Confirmation
- Protected active Wewed build modified: **NO** (`/Users/shadreckmusarurwa/Project AI/wewed` untouched).
- Production modified: **NO**.
- Production database modified: **NO**.
- Shared UAT database modified: **NO**.
- Merged into main: **NO**.
- Production deployment performed: **NO**.
