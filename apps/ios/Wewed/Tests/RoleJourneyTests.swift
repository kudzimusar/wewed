import XCTest
@testable import WewedKit

/// Playbook §22 (Step 20) role-navigation qualification, mirroring the Android suite.
///
/// Each journey walks a role's documented route end to end and asserts at every hop that the
/// destination resolves, the Level-2 section exists in the contract, and the active wedding
/// identity is unchanged.
final class RoleJourneyTests: XCTestCase {

    private func context(_ role: AppRole) -> NavigationContext {
        AuthorizedContexts.authorized(role, environment: .privateRealShadow)
    }

    /// Walks destinations, asserting each resolves and never changes the wedding identity.
    private func walk(_ role: AppRole, _ destinationIds: String...) {
        let start = context(role)
        for destinationId in destinationIds {
            guard case let .allowed(_, resolved) = Entitlements.resolve(start, destinationId: destinationId) else {
                XCTFail("\(role.roleId) could not reach \(destinationId)")
                continue
            }
            XCTAssertEqual(
                start.activeWeddingId,
                resolved.activeWeddingId,
                "Wedding identity lost navigating to \(destinationId)"
            )
        }
    }

    private func assertSection(_ role: AppRole, _ destinationId: String, _ section: String) {
        let sections = IANavigationContract.forRole(role).sections(destinationId)
        XCTAssertTrue(
            sections.contains(section),
            "\(role.roleId)/\(destinationId) has no documented section '\(section)' (has \(sections))"
        )
    }

    func testCoupleJourney() {
        walk(.couple, "home", "plan", "guests", "wedding_day", "more")
        assertSection(.couple, "plan", "Budget")
        assertSection(.couple, "wedding_day", "My Pass")
        // Returning to a previously visited workspace keeps the same wedding.
        walk(.couple, "plan", "home")
    }

    func testPlannerJourney() {
        walk(.planner, "clients", "workspace", "daily_ops", "wedding_day", "more")
        assertSection(.planner, "clients", "Active Weddings")
        assertSection(.planner, "workspace", "Guests")
        assertSection(.planner, "more", "Planner Actions")
    }

    func testGuestJourney() {
        walk(.guest, "home", "invitation", "pass", "wedding_day", "more")
        assertSection(.guest, "invitation", "RSVP")
        assertSection(.guest, "pass", "Wedding Pass")
    }

    func testVendorJourney() {
        walk(.vendor, "home", "jobs", "schedule", "messages", "more")
        assertSection(.vendor, "jobs", "Service Details")
        assertSection(.vendor, "schedule", "Calendar")
    }

    func testGateJourney() {
        walk(.usher, "scan", "admissions", "guests", "incidents", "more")
        assertSection(.usher, "admissions", "Manual Admission")
        assertSection(.usher, "incidents", "Admission Exception")
        assertSection(.usher, "more", "Offline Status")
    }

    func testCoordinatorJourney() {
        walk(.coordinator, "today", "run_sheet", "team", "wedding_day", "more")
        assertSection(.coordinator, "team", "Assignments")
        assertSection(.coordinator, "wedding_day", "Programme Status")
    }

    func testAdminJourney() {
        walk(.admin, "dashboard", "cases", "accounts", "audit", "more")
        assertSection(.admin, "accounts", "Role Memberships")
        assertSection(.admin, "audit", "Check-ins")
    }

    // MARK: - Role-boundary assertions on every journey (playbook §22)

    func testNoJourneyCrossesIntoAnotherRolesWorkspace() {
        let everyDestinationId = Set(
            IANavigationContract.all.values.flatMap { $0.primary }.map(\.id)
        )

        for (role, navigation) in IANavigationContract.all {
            let ownIds = Set(navigation.primary.map(\.id))
            for foreignId in everyDestinationId.subtracting(ownIds) {
                guard case .denied = Entitlements.resolve(context(role), destinationId: foreignId) else {
                    XCTFail("\(role.roleId) must be denied foreign destination \(foreignId)")
                    continue
                }
            }
        }
    }

    func testPrivateRealShadowStillResolvesEveryRoleJourney() {
        // Shadow qualification must exercise the same routes as fixture (playbook §23).
        for (role, navigation) in IANavigationContract.all {
            for destination in navigation.primary {
                guard case .allowed = Entitlements.resolve(context(role), destinationId: destination.id) else {
                    XCTFail("\(role.roleId)/\(destination.id) failed under PRIVATE_REAL_SHADOW")
                    continue
                }
            }
        }
    }

    func testWeddingIdentitySurvivesEntireMultiRoleJourney() {
        // Simulates switching roles on the same wedding, as a planner-owned account would.
        let original = AuthorizedContexts.wedding
        for role in [AppRole.planner, .coordinator, .usher, .couple] {
            // Each role re-resolves its own assignment; nothing is inherited from the previous role.
            let ctx = context(role)
            for destination in IANavigationContract.forRole(role).primary {
                guard case .allowed = Entitlements.resolve(ctx, destinationId: destination.id) else {
                    XCTFail("\(role.roleId)/\(destination.id) unreachable after role switch")
                    continue
                }
            }
            XCTAssertEqual(original, ctx.activeWeddingId, "Wedding identity lost switching to \(role.roleId)")
        }
    }
}
