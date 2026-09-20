import XCTest
@testable import WewedKit

/// Role-boundary and data-pipeline assertions for IA V2 §13, mirroring the Android suite.
final class EntitlementsTests: XCTestCase {

    private struct SharedContract: Decodable {
        let capabilities: [String: [String]]
        let deniedCapabilityAssertions: [String: [String]]
    }

    private var contract: SharedContract!

    override func setUpWithError() throws {
        try super.setUpWithError()
        var dir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        while dir.path != "/" {
            let candidate = dir.appendingPathComponent("mobile/contracts/ia-v2-navigation.json")
            if FileManager.default.fileExists(atPath: candidate.path) {
                contract = try JSONDecoder().decode(SharedContract.self, from: Data(contentsOf: candidate))
                return
            }
            dir = dir.deletingLastPathComponent()
        }
        throw XCTSkip("Shared IA V2 contract not found")
    }

    private func context(
        _ role: AppRole,
        weddingId: String = AuthorizedContexts.wedding
    ) -> NavigationContext {
        AuthorizedContexts.authorized(role, weddingId: weddingId)
    }

    func testGrantedCapabilitiesMatchSharedContract() throws {
        for role in AppRole.allCases {
            let expected = Set(try XCTUnwrap(contract.capabilities[role.roleId]))
            XCTAssertEqual(
                expected,
                Entitlements.capabilities(role),
                "Capabilities diverged for \(role.roleId)"
            )
        }
    }

    func testDeniedCapabilityAssertionsHold() throws {
        for role in AppRole.allCases {
            let denied = try XCTUnwrap(contract.deniedCapabilityAssertions[role.roleId])
            for capability in denied {
                XCTAssertFalse(
                    Entitlements.can(role, capability),
                    "\(role.roleId) must NOT hold capability \(capability)"
                )
            }
        }
    }

    func testEveryRoleCanReachEveryDestinationItsOwnContractDeclares() {
        for (role, navigation) in IANavigationContract.all {
            for destination in navigation.primary {
                let resolution = Entitlements.resolve(context(role), destinationId: destination.id)
                guard case .allowed = resolution else {
                    XCTFail("\(role.roleId) cannot reach its own destination \(destination.id)")
                    continue
                }
            }
        }
    }

    func testARoleCannotReachAnotherRolesDestinations() {
        let foreignDestinations: [AppRole: [String]] = [
            .guest: ["workspace", "clients", "daily_ops", "dashboard", "audit", "scan", "admissions"],
            .vendor: ["workspace", "clients", "guests", "scan", "audit", "plan"],
            .usher: ["plan", "workspace", "budget", "clients", "dashboard"],
            .coordinator: ["clients", "dashboard", "audit", "plan"],
            .couple: ["clients", "daily_ops", "dashboard", "audit", "scan"],
            .planner: ["dashboard", "audit", "cases", "accounts"],
            .admin: ["plan", "workspace", "scan", "pass"]
        ]
        for (role, destinations) in foreignDestinations {
            for destinationId in destinations {
                let resolution = Entitlements.resolve(context(role), destinationId: destinationId)
                guard case .denied = resolution else {
                    XCTFail("\(role.roleId) must not reach foreign destination \(destinationId)")
                    continue
                }
            }
        }
    }

    func testDeniedResolutionOffersSafeReturnAndLeaksNoDestinationData() throws {
        let resolution = Entitlements.resolve(context(.guest), destinationId: "workspace")
        guard case let .denied(reason, safeReturn) = resolution else {
            return XCTFail("Guest must be denied the planner workspace")
        }
        XCTAssertEqual(safeReturn, "home")
        XCTAssertFalse(reason.isEmpty)
        XCTAssertFalse(reason.contains("Charity"))
    }

    func testMissingActiveWeddingBlocksRepositoryBackedDestinations() {
        let broken = AuthorizedContexts.mutate(context(.couple), weddingId: "")
        let resolution = Entitlements.resolve(broken, destinationId: "plan")
        guard case .denied = resolution else {
            return XCTFail("A blank active wedding must not resolve to a repository-backed workspace")
        }
    }

    // MARK: - IA V2 §13.2 context preservation

    func testNavigatingBetweenDestinationsPreservesWeddingIdentity() {
        let ctx = context(.planner)
        for destinationId in ["clients", "workspace", "daily_ops", "wedding_day", "more"] {
            guard case let .allowed(_, resolved) = Entitlements.resolve(ctx, destinationId: destinationId) else {
                XCTFail("Planner should reach \(destinationId)")
                continue
            }
            XCTAssertEqual(
                ctx.activeWeddingId,
                resolved.activeWeddingId,
                "Wedding identity changed while navigating to \(destinationId)"
            )
        }
    }

    func testSwitchingWeddingKeepsNewIdentityAcrossWholeWorkspace() {
        let base = context(.planner)
        // A wedding switch invalidates the old assignment, so the new wedding must be re-authorized.
        let switched = AuthorizedContexts.mutate(
            base.withWedding(id: "wed_other_001", title: "Other Wedding"),
            assignment: .some(AuthorizedContexts.assignment(.planner, actorId: base.actorId, weddingId: "wed_other_001"))
        )
        for destination in IANavigationContract.forRole(.planner).primary {
            guard case let .allowed(_, resolved) = Entitlements.resolve(switched, destinationId: destination.id) else {
                XCTFail("Planner should reach \(destination.id)")
                continue
            }
            XCTAssertEqual("wed_other_001", resolved.activeWeddingId)
        }
    }

    func testRoleSwitchDropsScopesTheNewRoleDoesNotOwn() {
        let planner = NavigationContext(
            actorId: "actor_test",
            activeRole: .planner,
            activeWeddingId: AuthorizedContexts.wedding,
            activeWeddingTitle: "Charity & Kudzie",
            environment: .fixture,
            activeClientId: "client_1",
            activeEngagementId: "eng_1",
            activeGateId: "Gate A"
        )
        let asGuest = planner.withRole(.guest)
        XCTAssertNil(asGuest.activeClientId, "Guest must not inherit planner client scope")
        XCTAssertNil(asGuest.activeGateId, "Guest must not inherit gate scope")
        XCTAssertNil(asGuest.activeEngagementId, "Guest must not inherit vendor engagement scope")
        XCTAssertEqual(
            planner.activeWeddingId,
            asGuest.activeWeddingId,
            "Wedding identity must survive a role switch"
        )
    }

    func testGateRoleRetainsGateScopeAcrossRoleSwitchIntoGate() {
        let ctx = NavigationContext(
            actorId: "actor_test",
            activeRole: .coordinator,
            activeWeddingId: "cmqos70cb0004q6vxe9g9aiu5",
            activeWeddingTitle: "Charity & Kudzie",
            environment: .fixture,
            activeGateId: "Gate A"
        )
        XCTAssertEqual(ctx.withRole(.usher).activeGateId, "Gate A")
        // The previous role's assignment must not carry over as authorization.
        XCTAssertNil(ctx.withRole(.usher).assignment)
    }

    func testContextLabelNamesRoleAndActiveWedding() {
        let label = context(.planner).contextLabel
        XCTAssertTrue(label.contains("Professional Planner"))
        XCTAssertTrue(label.contains("Charity & Kudzie"))
    }
}
