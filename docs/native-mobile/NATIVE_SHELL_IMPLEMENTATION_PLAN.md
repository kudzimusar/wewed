# WEWED NATIVE SHELL IMPLEMENTATION PLAN

**Directive:** Whole Product Authority & Application Shell Directive  
**Branch:** `native-mobile/whole-product-shell-20260917`  
**Execution Mode:** Pure Isolated Dual-Native (Zero Production Networking, Zero Backend Changes)  

---

## 1. Objectives & Exit Criteria

1. **Role-Aware Native Architecture:** Introduce switchable native workspaces on iOS (SwiftUI) and Android (Jetpack Compose) representing:
   - `Couple` (Home, Plan, Guests, Pass, Live)
   - `Planner` (Portfolio, Plan & Tools, Inquiries, Notebook, More)
   - `Coordinator` (Timeline, Operations, Gate, Radio)
   - `Vendor` (Schedule, Job Day Presence, Catalog, Documents)
   - `Usher` (Scanner, Roster Search, Manifest Sync, Metrics)
   - `Guest` (Pass Credential, Schedule, Registry, Live Wall)
   - `Admin` (System Status, Weddings, Planners, Audit)
2. **Deterministic Persona Switching:** Developer-friendly switcher that dynamically mounts the selected workspace with realistic context.
3. **Domain Repository Decoupling:** Break apart the monolithic `WeddingRepository` into focused domain protocols:
   - `AuthRepositoryProtocol`
   - `PlannerRepositoryProtocol`
   - `VendorRepositoryProtocol`
   - `GateRepositoryProtocol`
   - `GuestRepositoryProtocol`
4. **Preservation of Qualified Capabilities:**
   - Wedding Pass (WW2 Asymmetric ECDSA P-256 verification)
   - Gate Scanner with capacity checking & dismissal
   - Maestro E2E test passes on both iOS and Android
5. **Screen State Quality:** All new surfaces implement populated, empty, loading, error, and attention states from fixtures.

---

## 2. Implementation Phasing

### Phase 1: Foundational Models & Domain Repositories
- Define `AppRole` enum and `Persona` catalog in both Swift and Kotlin.
- Establish clean domain interfaces for Auth, Planner, Vendor, Gate, and Guest services.
- Provide comprehensive, self-contained fixtures covering all 8 personas and multi-role operations.

### Phase 2: iOS SwiftUI Dynamic Shell
- Refactor `RootView.swift` to evaluate active `AppRole` and render the appropriate shell view.
- Implement `CoupleShellView`, `PlannerShellView`, `CoordinatorShellView`, `VendorShellView`, `UsherShellView`, `GuestShellView`, `AdminShellView`.
- Build shared `PersonaPickerSheet` and wire role switching into the navigation bar.
- Verify `swift test` passes 100%.

### Phase 3: Android Jetpack Compose Dynamic Shell
- Refactor `RootScreen.kt` to observe `currentRole` and render matching composable shells.
- Implement `CoupleShell`, `PlannerShell`, `CoordinatorShell`, `VendorShell`, `UsherShell`, `GuestShell`, `AdminShell`.
- Build `PersonaPickerDialog` and wire into top bar action.
- Verify `./gradlew testDebugUnitTest` passes 100%.

### Phase 4: Verification & Maestro E2E Tests
- Rebuild iOS and Android application binaries.
- Run Maestro E2E test verifying:
  - Existing Couple journey (Home, Plan, Guests, Pass, Scanner, Live)
  - Persona switching across Planner, Vendor, and Usher workspaces
- Verify 100% PASS on both platforms.

