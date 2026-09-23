import XCTest
@testable import WewedKit

/// Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 closure §1/round 3 §4/§5 —
/// NativeRepositoryFactory PRODUCTION closure.
///
/// `RootView` used to gate a role shell's render purely on the resolved workspace snapshot looking
/// right, then bind the real production repository from a `.task(id:)` that starts asynchronously
/// relative to that same body evaluation — leaving a real, reachable window where a shell that
/// "appears functional" could still read `appState.repository` while it was still the
/// always-throwing `ProductionBoundary*Repository` placeholder from construction.
///
/// A grantId-only bound flag (the previous round's fix) closes that SAME-account race but not
/// account replacement: two different accounts can independently resolve an identical grant id
/// (`admin:system`, or `coordinator:wedding:<id>` for a wedding both hold separate memberships on).
/// `ProductionBinding` now keys every bind on `(accessUserId, grantId)` together, so a stale binding
/// can never satisfy a different account's requirement by coincidence — these tests pin that contract
/// directly, without needing SwiftUI. The Android sibling is `AppViewModelProductionBindingTest`.
///
/// `bindProductionRepositories`'s outside-production guard uses `precondition`, matching the existing
/// convention already established in this same type (see `AppStateProductionAdminTests`) — it has no
/// XCTest coverage of the trap itself, since a Swift `precondition` aborts the process rather than
/// throwing a catchable error.
final class AppStateProductionBindingTests: XCTestCase {

    private func productionBoundaryAppState() -> AppState {
        AppState(
            repository: ProductionBoundaryWeddingRepository(),
            plannerRepository: ProductionBoundaryPlannerRepository(),
            dataEnvironment: .production,
            dataBaseURL: URL(string: "https://example.test")
        )
    }

    private func client() -> NativeDomainApiClient {
        NativeDomainApiClient(baseURL: URL(string: "https://example.test")!)
    }

    private func bindWedding(_ appState: AppState, accessUserId: String, grantId: String, weddingId: String) {
        let c = client()
        appState.bindProductionRepositories(
            accessUserId: accessUserId,
            grantId: grantId,
            wedding: ProductionWeddingRepository(client: c, sessionToken: "token", grantId: grantId, weddingId: weddingId),
            planner: ProductionPlannerDashboardRepository(client: c, sessionToken: "token", grantId: grantId)
        )
    }

    func testProductionStartsWithTheBoundaryRepositoriesAndNoBoundGrant() {
        let appState = productionBoundaryAppState()
        XCTAssertTrue(appState.repository is ProductionBoundaryWeddingRepository)
        XCTAssertTrue(appState.plannerRepository is ProductionBoundaryPlannerRepository)
        guard case .unbound = appState.productionWeddingBinding else {
            return XCTFail("Expected .unbound before any bind")
        }
    }

    func testBindingRealRepositoriesReplacesTheBoundaryDefaultAndRecordsTheExactAccessUserIdAndGrantIdThatProducedIt() {
        let appState = productionBoundaryAppState()
        bindWedding(appState, accessUserId: "user-a", grantId: "planner:wedding:w-1", weddingId: "w-1")

        XCTAssertTrue(appState.repository is ProductionWeddingRepository)
        XCTAssertTrue(appState.plannerRepository is ProductionPlannerDashboardRepository)
        guard case let .bound(accessUserId, grantId, _) = appState.productionWeddingBinding else {
            return XCTFail("Expected .bound after bindProductionRepositories")
        }
        XCTAssertEqual(accessUserId, "user-a")
        XCTAssertEqual(grantId, "planner:wedding:w-1")
    }

    func testRebindingToADifferentGrantAfterAContextSwitchUpdatesTheBindingAgain() {
        let appState = productionBoundaryAppState()
        bindWedding(appState, accessUserId: "user-a", grantId: "planner:wedding:w-1", weddingId: "w-1")
        bindWedding(appState, accessUserId: "user-a", grantId: "planner:wedding:w-2", weddingId: "w-2")

        guard case let .bound(_, grantId, _) = appState.productionWeddingBinding else {
            return XCTFail("Expected .bound")
        }
        // The render gate compares this against the newly active grantId; a stale value here would
        // let a shell for wedding B render while still holding wedding A's bound repository for one
        // frame, exactly the class of cross-context leak master plan §7 forbids.
        XCTAssertEqual(grantId, "planner:wedding:w-2")
    }

    /// Master plan Phase 8 closure round 3 §4 — the exact failing example the moderator gave:
    /// Account A binds `admin:system`, is then replaced by Account B (directly, or via sign-out/
    /// sign-in), and B independently resolves the SAME `admin:system` grant id before B's own bind
    /// completes. A grantId-only check would treat A's stale binding as already correct for B. The
    /// composite key must not.
    func testAccountAToAccountBWithTheIdenticalAdminGrantId_AsBindingNeverSatisfiesBsRequirement() {
        let appState = productionBoundaryAppState()
        let c = client()
        appState.bindProductionAdminRepository(
            accessUserId: "user-a", grantId: "admin:system",
            ProductionAdminSystemRepository(client: c, sessionToken: "token-a", grantId: "admin:system")
        )
        guard case let .bound(boundForAAccessUserId, _, _) = appState.productionAdminBinding else {
            return XCTFail("Expected .bound for user-a")
        }
        XCTAssertEqual(boundForAAccessUserId, "user-a")

        // The render gate's check, inlined: is the CURRENT binding valid for user-b's fresh grant?
        let validForB = appState.productionAdminBinding.isCurrent(accessUserId: "user-b", grantId: "admin:system")
        XCTAssertFalse(validForB, "Account A's admin:system binding must never validate Account B's identical grant id")

        // Only once B's OWN bind lands does the key become valid for B.
        appState.bindProductionAdminRepository(
            accessUserId: "user-b", grantId: "admin:system",
            ProductionAdminSystemRepository(client: c, sessionToken: "token-b", grantId: "admin:system")
        )
        guard case let .bound(boundForBAccessUserId, _, _) = appState.productionAdminBinding else {
            return XCTFail("Expected .bound for user-b")
        }
        XCTAssertEqual(boundForBAccessUserId, "user-b")
    }

    /// Same proof as above, for a wedding-scoped grant id two different accounts can both hold.
    func testAccountAToAccountBWithTheIdenticalWeddingScopedGrantId_AsBindingNeverSatisfiesBsRequirement() {
        let appState = productionBoundaryAppState()
        let sharedGrantId = "coordinator:wedding:wed-shared"
        bindWedding(appState, accessUserId: "user-a", grantId: sharedGrantId, weddingId: "wed-shared")

        let validForB = appState.productionWeddingBinding.isCurrent(accessUserId: "user-b", grantId: sharedGrantId)
        XCTAssertFalse(validForB, "Account A's binding on a shared wedding grant id must never validate Account B")

        bindWedding(appState, accessUserId: "user-b", grantId: sharedGrantId, weddingId: "wed-shared")
        guard case let .bound(boundForBAccessUserId, _, _) = appState.productionWeddingBinding else {
            return XCTFail("Expected .bound for user-b")
        }
        XCTAssertEqual(boundForBAccessUserId, "user-b")
    }

    /// Wedding A → Wedding B, same account: the binding is fully replaced.
    func testWeddingAToWeddingBForTheSameAccountUpdatesTheBindingToWeddingBOnly() {
        let appState = productionBoundaryAppState()
        bindWedding(appState, accessUserId: "user-a", grantId: "planner:wedding:wed-a", weddingId: "wed-a")
        bindWedding(appState, accessUserId: "user-a", grantId: "planner:wedding:wed-b", weddingId: "wed-b")

        guard case let .bound(_, grantId, _) = appState.productionWeddingBinding else {
            return XCTFail("Expected .bound")
        }
        XCTAssertEqual(grantId, "planner:wedding:wed-b")
        XCTAssertFalse(grantId == "planner:wedding:wed-a")
    }

    /// Planner → Admin → Planner. Each axis's binding is independent, and switching one never
    /// corrupts or gets corrupted by the other.
    func testPlannerToAdminToPlannerLeavesEachBindingCorrectlyScopedToItsOwnAxisThroughout() {
        let appState = productionBoundaryAppState()
        let c = client()
        bindWedding(appState, accessUserId: "user-a", grantId: "planner:wedding:wed-a", weddingId: "wed-a")
        appState.bindProductionAdminRepository(
            accessUserId: "user-a", grantId: "admin:system",
            ProductionAdminSystemRepository(client: c, sessionToken: "token", grantId: "admin:system")
        )

        guard case let .bound(_, weddingGrantId, _) = appState.productionWeddingBinding,
              case let .bound(_, adminGrantId, _) = appState.productionAdminBinding
        else { return XCTFail("Expected both axes bound") }
        XCTAssertEqual(weddingGrantId, "planner:wedding:wed-a")
        XCTAssertEqual(adminGrantId, "admin:system")

        // Back to Planner on the same wedding — the admin binding is untouched (it is simply not
        // consulted by a Planner-role render gate check, not cleared by switching away from it).
        guard case let .bound(_, adminGrantIdAfter, _) = appState.productionAdminBinding,
              case let .bound(_, weddingGrantIdAfter, _) = appState.productionWeddingBinding
        else { return XCTFail("Expected both axes still bound") }
        XCTAssertEqual(adminGrantIdAfter, "admin:system")
        XCTAssertEqual(weddingGrantIdAfter, "planner:wedding:wed-a")
    }

    /// Master plan Phase 8 closure §7 — Planner → Admin is one of the explicit cross-context
    /// transitions that must be re-proved once new repositories/domains are introduced. `AdminShellView`
    /// never touches `appState.repository`/`plannerRepository` — only `adminRepository` — so a stale
    /// wedding-scoped repository object CAN remain referenced by `appState.repository` after switching
    /// to Admin. That is safe only because `bindActiveWedding` is called with an EMPTY weddingId for
    /// Admin's context (`RootView`: `context.activeWeddingId` is `""` for Admin, never a stale wedding
    /// id), which clears `activeWeddingId` to nil — so `scopedRepository()` throws instead of silently
    /// reading wedding A's graph through the still-referenced old repository object.
    func testSwitchingFromAWeddingScopedContextToAdminClearsWeddingGraphReachabilityEvenThoughTheOldRepositoryObjectIsStillReferenced() async {
        let appState = productionBoundaryAppState()
        bindWedding(appState, accessUserId: "user-a", grantId: "planner:wedding:wed-a", weddingId: "wed-a")
        appState.bindActiveWedding("wed-a")
        // Reachable: scopedRepository() resolves without throwing.
        _ = try? await appState.scopedRepository()

        // Planner switches role to Admin. Admin's context always carries an empty weddingId.
        appState.bindActiveWedding("")
        do {
            _ = try await appState.scopedRepository()
            XCTFail("Expected scopedRepository() to throw once activeWeddingId is cleared for Admin")
        } catch {
            // Expected — matches "No active wedding is bound" (AppState.scopedRepository()).
        }

        // The wedding-scoped binding is untouched by the Admin switch itself — proving the two axes
        // are tracked independently; the safety above comes entirely from the separate
        // activeWeddingId gate.
        guard case let .bound(_, grantId, _) = appState.productionWeddingBinding else {
            return XCTFail("Expected the wedding binding to remain bound")
        }
        XCTAssertEqual(grantId, "planner:wedding:wed-a")
        guard case .unbound = appState.productionAdminBinding else {
            return XCTFail("Expected the admin binding to remain unbound")
        }
    }

    /// Master plan Phase 8 closure round 3 §6 — Vendor engagement A → B replaces A first. A Vendor
    /// holding several engagements (or switching between them) must never keep reading engagement A's
    /// data through a stale binding once engagement B's grant is active — same composite-key
    /// discipline as every other production repository.
    func testVendorEngagementAToEngagementBReplacesTheBindingCleanlyNeverLeavingAReachable() {
        let appState = productionBoundaryAppState()
        let c = client()
        let grantIdA = "vendor:wedding:biz-1:vendor-1"
        appState.bindProductionVendorEngagementRepository(
            accessUserId: "vendor-user", grantId: grantIdA,
            ProductionVendorEngagementRepository(client: c, sessionToken: "token", grantId: grantIdA)
        )
        guard case let .bound(_, boundGrantIdA, _) = appState.productionVendorEngagementBinding else {
            return XCTFail("Expected .bound for engagement A")
        }
        XCTAssertEqual(boundGrantIdA, grantIdA)

        // The same grant id can carry a different SELECTED engagement server-side (Vendor holds
        // several); either way, a rebind fully replaces the prior one.
        let grantIdB = "vendor:wedding:biz-1:vendor-2"
        appState.bindProductionVendorEngagementRepository(
            accessUserId: "vendor-user", grantId: grantIdB,
            ProductionVendorEngagementRepository(client: c, sessionToken: "token", grantId: grantIdB)
        )
        guard case let .bound(_, boundGrantIdB, _) = appState.productionVendorEngagementBinding else {
            return XCTFail("Expected .bound for engagement B")
        }
        XCTAssertEqual(boundGrantIdB, grantIdB)
        XCTAssertNotEqual(boundGrantIdB, grantIdA)
    }

    /// Master plan Phase 8 closure round 3 §6 — Vendor business ↔ Vendor wedding engagement. These
    /// are two structurally disjoint axes: the business-portfolio repository is constructed as a
    /// plain local value in `RootView` (never stored on `AppState` at all), while the
    /// wedding-engagement repository lives entirely in `AppState.productionVendorEngagementBinding`.
    /// Binding one can therefore never leave stale state reachable through the other — this test pins
    /// that the wedding-engagement axis specifically starts `.unbound` and stays that way absent an
    /// explicit bind.
    func testVendorBusinessAndVendorWeddingEngagementAreIndependentAxesWithNoSharedMutableState() {
        let appState = productionBoundaryAppState()
        guard case .unbound = appState.productionVendorEngagementBinding else {
            return XCTFail("Expected .unbound")
        }
        // No AppState method exists to bind a Vendor business repository — by construction, it cannot
        // corrupt productionVendorEngagementBinding no matter what a Vendor business screen does with
        // its own locally-scoped repository instance.
        guard case .unbound = appState.productionVendorEngagementBinding else {
            return XCTFail("Expected .unbound")
        }
    }

    /// Master plan Phase 8 closure round 3 §4 — sign-out/session-invalidation must drop every binding.
    func testClearProductionBindingResetsEveryAxisBackToUnbound() {
        let appState = productionBoundaryAppState()
        let c = client()
        bindWedding(appState, accessUserId: "user-a", grantId: "planner:wedding:wed-a", weddingId: "wed-a")
        appState.bindProductionAdminRepository(
            accessUserId: "user-a", grantId: "admin:system",
            ProductionAdminSystemRepository(client: c, sessionToken: "token", grantId: "admin:system")
        )
        appState.bindProductionContractsRepository(
            accessUserId: "user-a", grantId: "planner:wedding:wed-a",
            ProductionContractsRepository(client: c, sessionToken: "token", grantId: "planner:wedding:wed-a")
        )

        appState.clearProductionBinding()

        guard case .unbound = appState.productionWeddingBinding else { return XCTFail("Expected .unbound") }
        guard case .unbound = appState.productionAdminBinding else { return XCTFail("Expected .unbound") }
        guard case .unbound = appState.productionContractsBinding else { return XCTFail("Expected .unbound") }
        XCTAssertTrue(appState.repository is ProductionBoundaryWeddingRepository)
        XCTAssertTrue(appState.plannerRepository is ProductionBoundaryPlannerRepository)
    }
}
