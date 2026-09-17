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
  - Secure storage backed by iOS Keychain with in-memory test fallback.
  - Actor-isolated local manifest store (`OfflineManifestStore.swift`) enabling sub-50ms offline verification.
  - Native haptic feedback via `UIImpactFeedbackGenerator` (success, warning, light selection).

### 2. Native Android Architecture (Kotlin + Jetpack Compose)
- **Component Path**: `apps/android/app/src/main/java/pro/wewed/app/`
- **Impact & Responsibilities**:
  - Jetpack Compose Material 3 implementation.
  - Native animated Ivory Invitation card (`IvoryInvitationScreen.kt`) with folding envelope transitions and gold foil shimmer highlights.
  - CameraX and barcode scanning reticle with permission contract handling.
  - Jetpack Security (`EncryptedSharedPreferences`) for persistent tokens and session credentials.
  - Mutex-synchronized offline manifest and check-in sync engine (`OfflineManifestStore.kt`).
  - Haptic feedback and visual confirmation banners for gate admissions.

### 3. Ivory Invitation Experience
- **Role in Ecosystem**: The ceremonial gateway and initial engagement surface.
- **Visual Design Identity**:
  - Palette: Warm Ivory stationery (`#FBF5E9`), Champagne Gold accents (`#B3833F`), Espresso ink (`#42372F`), Stage backdrop (`#17130F`).
  - Motion: Ceremonial tri-fold reveal, wax seal / ribbon gesture, gentle elevation.
  - Content: Personalized greeting for guest/household, ceremony time, venue estate, RSVP CTA.
- **Transition Contract**:
  - Tapping "Confirm RSVP & Get Pass" immediately records attendance, provisions the offline-verifiable pass, and seamlessly transitions into the Wedding Day Hub without page reloads or authentication roadblocks.

### 4. Invitation & RSVP State Machine
- **States**: `INVITED` → `OPENED` → `RSVP_ATTENDING` | `RSVP_DECLINED` → `PASS_ISSUED` → `CHECKED_IN` (Partial / Full).
- **Invariants**:
  - RSVP confirmation generates the immutable `passSerial` and cryptographic nonce.
  - Household headcount is bounded by maximum party size allocated to the invitation.
  - Re-opening an already confirmed invitation immediately loads the active Wewed Wedding Pass.

### 5. Guest Membership & Relationship Tokens
- **Frictionless Auth**: Guests do not need traditional email/password credentials to access their invitation or pass.
- **Relationship Token**: A cryptographically signed bearer token issued alongside the invitation URL:
  $$\text{wewed://invite?wedding}=\langle\text{slug}\rangle\&\text{token}=\langle\text{relationship\_token}\rangle\&\text{card}=\text{ivory-floral-gold}$$
- **Persistence**: Stored securely on the mobile device upon first open. When the user launches the native app, the relationship token is retrieved to automatically restore their wedding guest context.

### 6. Planner Day-Of Operations
- **Mobile Operational Hub**:
  - Real-time attendance counter: Admitted count vs. Total expected headcount.
  - Live ceremony vs. reception check-in gauges.
  - Real-time vendor presence monitor: tracks which vendors are en-route, arrived, or actively providing service.
  - Programme milestones countdown: visual alerts for upcoming schedule items.
  - Emergency announcements broadcaster.

### 7. Vendor Presence & Logistics
- **Role Surface**: Simplified, high-contrast vendor dashboard.
- **Status Lifecycle**:
  `SCHEDULED` → `EN_ROUTE` → `ARRIVED_ON_SITE` → `SERVICE_ACTIVE` → `COMPLETED`.
- **Location & Dispatch**:
  - Shows assigned service area (e.g. "Main Lawn — Marquee", "Kitchen Prep Bay").
  - One-tap status update synchronized to planner in real time.
  - Direct contact link to day-of wedding coordinator.

### 8. Day-Of Communications & Announcements
- **Channels**: Push notifications, local alerts, in-app banner announcements.
- **Urgency Levels**:
  - `INFO`: General updates ("Drinks are now being served on the terrace").
  - `ACTION`: Guest movement ("Please take your seats in the Grand Ballroom").
  - `ALERT`: Schedule or location adjustments ("Due to light rain, photos moving to the covered veranda").

### 9. Database & Schemas (Reference Model)
- **Shared Source of Truth**:
  - `Wedding`: Core metadata, couple, date, venue, branding.
  - `Guest`: Name, household, party size, RSVP status, table assignment, dietary needs.
  - `WeddingPass`: Serial, event bitmask, issuance date, status.
  - `CheckInRecord`: Pass serial, count admitted, timestamp, usher ID, gate location, sync status.
  - `VendorStatus`: Vendor ID, service category, presence state, arrival timestamp.
  - `Announcement`: Title, body, timestamp, target audience (All, Vendors, Planners).

### 10. Authentication & Security
- **Role Tiering**:
  - `GUEST`: Token-authenticated, scoped strictly to their household pass, wedding schedule, table, and live wall.
  - `USHER`: Gate-authenticated session, authorized to verify passes, search roster, and record check-ins.
  - `VENDOR`: Service-authenticated session, authorized to report arrival and view logistics.
  - `COUPLE` / `PLANNER`: Full administrative authorization.

### 11. Deep Links & Deferred Installation
- **Canonical Schemes**:
  - `wewed://invite?wedding=<slug>&token=<token>&card=<style>`
  - `wewed://pass?wedding=<slug>&serial=<serial>`
  - `https://wewed.pro/w/<slug>?rsvp=<token>&card=<style>`
- **Deferred Resume**: When a guest installs the app from an invitation link, the install referrer passes the relationship token so the app opens directly into their personalized Ivory Invitation.

### 12. Offline Manifest & Field Operation
- **Zimbabwe-First Rural Venue Resilience**:
  - Gate check-in requires zero internet connectivity at the venue.
  - Pre-cached AES-encrypted guest manifest on usher devices.
  - Local append-only SQLite journal for recorded check-ins.
  - Automatic background reconciliation upon regaining Wi-Fi or cellular coverage.

### 13. Notifications & Native Haptics
- **Haptic Tactility**:
  - Envelope opening: Light soft impact.
  - Successful QR scan: Medium double impact (`.success`).
  - Duplicate / Invalid pass scan: Heavy warning vibration (`.error`).
- **Timely Alerts**: Local notification scheduled 1 hour before ceremony start with directions and pass shortcut.
