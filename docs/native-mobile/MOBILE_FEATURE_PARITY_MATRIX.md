# Wewed Mobile Feature Parity Matrix

**Plan ID:** `WW-NATIVE-MOBILE-IOS-ANDROID-2026-09-17-01`  
**Governing Document:** [`docs/native-mobile/MASTER_MOBILE_SPRINT_PLAN.md`](file:///Users/shadreckmusarurwa/Project%20AI/wewed-native-mobile/docs/native-mobile/MASTER_MOBILE_SPRINT_PLAN.md)  
**Status:** Canonical Reference

---

## 1. Authentication & Identity Lifecycle

| Feature ID | Domain | Feature Description | Web/PWA Route | Supported Roles | iOS Native | Android Native | Maestro E2E | Parity Status |
|---|---|---|---|---|:---:|:---:|:---:|:---:|
| `AUTH-01` | Auth | Email / Password Sign In | `/login` | Couple, Planner, Admin | Swift/Keychain | Kotlin/Keystore | PASS | In Parity |
| `AUTH-02` | Auth | Session Restore & Auto-login | `/` | All authenticated | Observation/Keychain | Coroutines/Keystore | PASS | In Parity |
| `AUTH-03` | Auth | Biometric Quick Unlock (FaceID / Fingerprint) | N/A (Native) | Couple, Planner | LocalAuthentication | BiometricPrompt | PASS | In Parity |
| `AUTH-04` | Auth | Zero-Auth Guest Pass Access | `/pass/[token]` | Guest, Public | URL Route / Token | URL Route / Token | PASS | In Parity |
| `AUTH-05` | Auth | Secure Sign Out & Cache Flush | `/settings` | All | Keychain & SwiftData wipe | Keystore & Room wipe | PASS | In Parity |
| `AUTH-06` | Auth | Session Expiry / 401 Recovery | Global | All | Interceptor / Re-auth sheet | Interceptor / Re-auth sheet | PASS | In Parity |

---

## 2. Wedding Day & The Wewed Wedding Pass (Zimbabwe-First)

| Feature ID | Domain | Feature Description | Web/PWA Route | Supported Roles | iOS Native | Android Native | Maestro E2E | Parity Status |
|---|---|---|---|---|:---:|:---:|:---:|:---:|
| `PASS-01` | Wedding Pass | Dynamic Digital Pass (Monogram, Date, Table) | `/pass/[token]` | Guest, Couple | Native SwiftUI Card | Native Compose Card | PASS | In Parity |
| `PASS-02` | Wedding Pass | WW2 Asymmetric ECDSA P-256 / SHA-256 QR Credential (WW1 HMAC legacy compat) | `/pass/[token]` | Guest | CryptoKit P-256 / SHA-256 | Java Security ECDSA / SHA-256 | PASS | In Parity |
| `PASS-03` | Wedding Pass | Save Pass to Camera Roll / Offline PNG | `/pass/[token]` | Guest | ImageRenderer (Photos) | Canvas Bitmap (Gallery) | PASS | In Parity |
| `PASS-04` | Wedding Pass | Usher Fast Camera Scanner (<100ms) | `/checkin` | Usher, Planner, Couple | AVFoundation + Vision | CameraX + Google ML Kit | PASS | In Parity |
| `PASS-05` | Wedding Pass | Offline Guest Manifest Verification (AES-GCM) | `/checkin` | Usher, Planner | SwiftData Local Cache | Room Local Cache | PASS | In Parity |
| `PASS-06` | Wedding Pass | Household / Party Size Stepper Check-In | `/checkin` | Usher, Planner | SwiftUI Stepper Sheet | Compose Quantity Sheet | PASS | In Parity |
| `PASS-07` | Wedding Pass | Instant Fuzzy Manual Guest Search Fallback | `/checkin` | Usher, Planner | Swift Predicate / SQLite | Room FTS / SQLite | PASS | In Parity |
| `PASS-08` | Wedding Pass | Real-Time Attendance Tracker (Live Arrived Count) | `/plan/attendance` | Planner, Couple | Combine / Polling | StateFlow / Polling | PASS | In Parity |

---

## 3. Wedding Overview & Timeline

| Feature ID | Domain | Feature Description | Web/PWA Route | Supported Roles | iOS Native | Android Native | Maestro E2E | Parity Status |
|---|---|---|---|---|:---:|:---:|:---:|:---:|
| `HOME-01` | Home | Couple Hero with Live Countdown Ticker | `/` | All | SwiftUI TimelineView | Compose LaunchedEffect | PASS | In Parity |
| `HOME-02` | Home | Wedding Programme (The Day Schedule Items) | `/#the-day` | All | LazyVStack / Grouped List | LazyColumn / Material Card | PASS | In Parity |
| `HOME-03` | Home | Venue Information & Native Map Directions | `/#the-venue` | All | MapKit / Apple Maps URI | Google Maps / Intent | PASS | In Parity |
| `HOME-04` | Home | Wedding Party / Bridal Team Profiles | `/#wedding-party` | All | Inset Grouped Carousel | Horizontal Pager | PASS | In Parity |
| `HOME-05` | Home | Live Announcement Banners | `/` | All | Dynamic Banner View | AnimatedVisibility Banner | PASS | In Parity |

---

## 4. Wedding Planner & Task Engine

| Feature ID | Domain | Feature Description | Web/PWA Route | Supported Roles | iOS Native | Android Native | Maestro E2E | Parity Status |
|---|---|---|---|---|:---:|:---:|:---:|:---:|
| `PLAN-01` | Planner | Task Checklist with Category & Status Filters | `/planner` | Couple, Planner | SwiftUI List / Segmented | Compose FilterChips | PASS | In Parity |
| `PLAN-02` | Planner | Task Completion Toggle with Haptic Feedback | `/planner` | Couple, Planner | UIImpactFeedbackGenerator | HapticFeedbackConstants | PASS | In Parity |
| `PLAN-03` | Planner | Task Create / Edit Native Sheet | `/planner` | Couple, Planner | SwiftUI Form Sheet | Compose ModalBottomSheet | PASS | In Parity |
| `PLAN-04` | Planner | Budget Allocation & Expense Tracking | `/planner` | Couple, Planner | Native Progress Gauge | CircularProgressIndicator | PASS | In Parity |
| `PLAN-05` | Planner | Offline Task Mutation Queue & Reconnect Sync | `/planner` | Couple, Planner | SwiftData Queue | Room Sync Worker | PASS | In Parity |

---

## 5. Guest Management & Seating

| Feature ID | Domain | Feature Description | Web/PWA Route | Supported Roles | iOS Native | Android Native | Maestro E2E | Parity Status |
|---|---|---|---|---|:---:|:---:|:---:|:---:|
| `GST-01` | Guests | Guest List with RSVP Status & Side Filters | `/planner` | Couple, Planner | Searchable List | SearchBar + LazyColumn | PASS | In Parity |
| `GST-02` | Guests | Guest Table Assignment Display | `/planner` | Couple, Planner, Usher | Badge / Grouped Section | AssistChip / Card | PASS | In Parity |
| `GST-03` | Guests | Quick Guest Import from Device Contacts | N/A (Native) | Couple, Planner | ContactsUI Framework | Android Contacts Provider | PASS | In Parity |
| `GST-04` | Guests | Dietary Preference & Meal Aggregations | `/planner` | Couple, Planner, Caterer | Breakdown Summary View | Summary Cards | PASS | In Parity |

---

## 6. Live Wall & Social Interactivity

| Feature ID | Domain | Feature Description | Web/PWA Route | Supported Roles | iOS Native | Android Native | Maestro E2E | Parity Status |
|---|---|---|---|---|:---:|:---:|:---:|:---:|
| `LIVE-01` | Live Wall | Real-time Guest Messages & Well Wishes Feed | `/live-wall` | All | Inset List / Auto-scroll | LazyColumn / Auto-scroll | PASS | In Parity |
| `LIVE-02` | Live Wall | Live Applause Burst with Particle Animation | `/live-wall` | All | SpriteKit / Canvas Burst | Compose Particle Canvas | PASS | In Parity |
| `LIVE-03` | Live Wall | Native Message Post Composer | `/live-wall` | All | Bottom Sheet Composer | Bottom Sheet Composer | PASS | In Parity |
| `LIVE-04` | Songbook | Song List with Spotify/Apple Deep Links | `/songbook` | All | OpenURL / Native Links | Intent / Android Links | PASS | In Parity |

---

## 7. Native Capabilities & System Integration

| Feature ID | Capability | iOS Implementation | Android Implementation | Fallback |
|---|---|---|---|---|
| `CAP-01` | Secure Keychain / Keystore | Security Framework / Keychain | Android Keystore / EncryptedSharedPreferences | Memory-only session |
| `CAP-02` | Barcode Camera Scanner | AVFoundation + Vision Framework | CameraX + Google ML Kit Barcode | Manual Name/Phone Search |
| `CAP-03` | Native Share Sheet | `ShareLink` / `UIActivityViewController` | `Intent.ACTION_SEND` | Clipboard copy |
| `CAP-04` | Haptic Celebrations | `UIImpactFeedbackGenerator` | `Vibrator` / `HapticFeedback` | Visual transition only |
| `CAP-05` | Native Maps Navigation | `MKMapItem.openMaps()` | `geo:` Intent / Google Maps | Web URL fallback |
| `CAP-06` | Universal / Deep Links | Associated Domains (`applinks:wewed.pro`) | Intent Filters (`https://wewed.pro`) | Web browser fallback |

---

## 8. Definition of Gate Completion

All features classified as `In Parity` must have:
1. Type-safe contract alignment with `mobile/contracts/openapi.yaml`.
2. Identical domain models derived from `mobile/design-tokens/tokens.json`.
3. Offline-resilient local repository implementations.
4. Independent compilation on iOS (Xcode/Swift) and Android (Gradle/Kotlin).
5. Passing automated verification suites.
