import XCTest
@testable import WewedKit

/// Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 closure §1 — NativeRepositoryFactory
/// PRODUCTION closure.
///
/// `RootView` used to gate a role shell's render purely on the resolved workspace snapshot looking
/// right, then bind the real production repository from a `.task(id:)` that starts asynchronously
/// relative to that same body evaluation — leaving a real, reachable window where a shell that
/// "appears functional" could still read `appState.repository` while it was still the
/// always-throwing `ProductionBoundary*Repository` placeholder from construction. `repository` and
/// `plannerRepository` default to that placeholder in PRODUCTION and only `boundProductionGrantId`
/// is the honest, order-correct signal of when the swap has actually happened — these tests pin that
/// contract directly, without needing SwiftUI. The Android sibling is
/// `AppViewModelProductionBindingTest`.
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

    func testProductionStartsWithTheBoundaryRepositoriesAndNoBoundGrant() {
        let appState = productionBoundaryAppState()
        XCTAssertTrue(appState.repository is ProductionBoundaryWeddingRepository)
        XCTAssertTrue(appState.plannerRepository is ProductionBoundaryPlannerRepository)
        XCTAssertNil(appState.boundProductionGrantId)
    }

    func testBindingRealRepositoriesReplacesTheBoundaryDefaultAndFlipsBoundProductionGrantIdToThatExactGrant() {
        let appState = productionBoundaryAppState()
        let client = NativeDomainApiClient(baseURL: URL(string: "https://example.test")!)

        appState.bindProductionRepositories(
            grantId: "planner:wedding:w-1",
            wedding: ProductionWeddingRepository(client: client, sessionToken: "token", grantId: "planner:wedding:w-1", weddingId: "w-1"),
            planner: ProductionPlannerDashboardRepository(client: client, sessionToken: "token", grantId: "planner:wedding:w-1")
        )

        XCTAssertTrue(appState.repository is ProductionWeddingRepository)
        XCTAssertTrue(appState.plannerRepository is ProductionPlannerDashboardRepository)
        XCTAssertEqual(appState.boundProductionGrantId, "planner:wedding:w-1")
    }

    func testRebindingToADifferentGrantAfterAContextSwitchUpdatesBoundProductionGrantIdAgain() {
        let appState = productionBoundaryAppState()
        let client = NativeDomainApiClient(baseURL: URL(string: "https://example.test")!)

        appState.bindProductionRepositories(
            grantId: "planner:wedding:w-1",
            wedding: ProductionWeddingRepository(client: client, sessionToken: "token", grantId: "planner:wedding:w-1", weddingId: "w-1"),
            planner: ProductionPlannerDashboardRepository(client: client, sessionToken: "token", grantId: "planner:wedding:w-1")
        )
        appState.bindProductionRepositories(
            grantId: "planner:wedding:w-2",
            wedding: ProductionWeddingRepository(client: client, sessionToken: "token", grantId: "planner:wedding:w-2", weddingId: "w-2"),
            planner: ProductionPlannerDashboardRepository(client: client, sessionToken: "token", grantId: "planner:wedding:w-2")
        )

        // The render gate compares this against the newly active grantId; a stale value here would
        // let a shell for wedding B render while still holding wedding A's bound repository for one
        // frame, exactly the class of cross-context leak master plan §7 forbids.
        XCTAssertEqual(appState.boundProductionGrantId, "planner:wedding:w-2")
    }
}
