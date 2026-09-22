import XCTest
@testable import WewedKit

/// `ProductionActorAssignmentSource` (master plan Phase 5). The shared fixture
/// (`ProductionAuthorityContractTests`) has one grant per kind, so this file builds its own JSON to
/// exercise the multi-grant selection path directly. The Android counterpart is
/// `ProductionActorAssignmentSourceTest`.
final class ProductionActorAssignmentSourceTests: XCTestCase {

    private func authority(
        accountStatus: String = "authorized",
        accessUserId: String? = "user-1",
        grants: String,
        contextSelection: String = "[]"
    ) throws -> ProductionAuthority {
        let identity = accessUserId.map { "{\"accessUserId\": \"\($0)\", \"dashboardClass\": \"planner\"}" } ?? "null"
        let json = """
        {
          "contract": "WewedProductionAuthorityV1",
          "version": 1,
          "accountStatus": "\(accountStatus)",
          "identity": \(identity),
          "workspaceGrants": \(grants),
          "contextSelection": \(contextSelection),
          "unsupported": [],
          "platform": {"effectiveRole": null}
        }
        """
        return try XCTUnwrap(ProductionAuthority.decode(Data(json.utf8)))
    }

    private func grant(
        _ grantId: String,
        workspaceKind: String,
        scopeKind: String,
        weddingId: String? = nil,
        weddingTitle: String? = nil,
        businessAccountId: String? = nil
    ) -> String {
        """
        {
          "grantId": "\(grantId)",
          "workspaceKind": "\(workspaceKind)",
          "scopeKind": "\(scopeKind)",
          "weddingId": \(weddingId.map { "\"\($0)\"" } ?? "null"),
          "weddingTitle": \(weddingTitle.map { "\"\($0)\"" } ?? "null"),
          "coupleId": null,
          "businessAccountId": \(businessAccountId.map { "\"\($0)\"" } ?? "null"),
          "vendorId": null,
          "serviceEngagementIds": [],
          "permissions": [],
          "platformRoles": []
        }
        """
    }

    func testASingleGrantOfItsKindIsAssignedWithoutAnySelection() async throws {
        let authority = try authority(grants: "[\(grant("couple:wedding:A", workspaceKind: "couple", scopeKind: "wedding", weddingId: "A"))]")
        let source = ProductionActorAssignmentSource(authority: authority)
        let assignments = await source.assignments(actorId: "user-1")
        XCTAssertEqual(assignments, [ActorAssignment(actorId: "user-1", role: .couple, weddingId: "A")])
    }

    func testMultipleGrantsOfOneKindYieldNothingUntilExplicitlySelected() async throws {
        let authority = try authority(
            grants: "[\(grant("planner:wedding:A", workspaceKind: "planner", scopeKind: "wedding", weddingId: "A", weddingTitle: "Wedding A")),"
                + "\(grant("planner:wedding:B", workspaceKind: "planner", scopeKind: "wedding", weddingId: "B", weddingTitle: "Wedding B"))]",
            contextSelection: """
            [{"workspaceKind":"planner","grantIds":["planner:wedding:A","planner:wedding:B"],"selectionRequired":true}]
            """
        )
        let none = await ProductionActorAssignmentSource(authority: authority).assignments(actorId: "user-1")
        XCTAssertTrue(none.isEmpty)

        let withSelection = ProductionActorAssignmentSource(authority: authority, selectedGrantIds: ["planner:wedding:B"])
        let assignments = await withSelection.assignments(actorId: "user-1")
        XCTAssertEqual(assignments, [ActorAssignment(actorId: "user-1", role: .planner, weddingId: "B")])
    }

    func testTwoSelectedGrantsOfTheSameKindFailClosed() async throws {
        let authority = try authority(
            grants: "[\(grant("planner:wedding:A", workspaceKind: "planner", scopeKind: "wedding", weddingId: "A")),"
                + "\(grant("planner:wedding:B", workspaceKind: "planner", scopeKind: "wedding", weddingId: "B"))]",
            contextSelection: """
            [{"workspaceKind":"planner","grantIds":["planner:wedding:A","planner:wedding:B"],"selectionRequired":true}]
            """
        )
        let source = ProductionActorAssignmentSource(
            authority: authority,
            selectedGrantIds: ["planner:wedding:A", "planner:wedding:B"]
        )
        XCTAssertTrue(await source.assignments(actorId: "user-1").isEmpty)
    }

    func testASelectedGrantThatNoLongerExistsHasNoEffect() async throws {
        // Only grant A remains in this fresh authority; the previously-selected B has been revoked
        // (or never existed). The source must never invent an assignment for it.
        let authority = try authority(
            grants: "[\(grant("planner:wedding:A", workspaceKind: "planner", scopeKind: "wedding", weddingId: "A"))]",
            contextSelection: """
            [{"workspaceKind":"planner","grantIds":["planner:wedding:A"],"selectionRequired":false}]
            """
        )
        let source = ProductionActorAssignmentSource(authority: authority, selectedGrantIds: ["planner:wedding:B"])
        let assignments = await source.assignments(actorId: "user-1")
        XCTAssertEqual(assignments, [ActorAssignment(actorId: "user-1", role: .planner, weddingId: "A")])
    }

    func testPortfolioAndBusinessGrantsNeverBecomeAFakeWeddingAssignment() async throws {
        let authority = try authority(
            grants: "[\(grant("planner:portfolio:biz-1", workspaceKind: "planner", scopeKind: "portfolio", businessAccountId: "biz-1"))]"
        )
        let empty = await ProductionActorAssignmentSource(authority: authority).assignments(actorId: "user-1")
        XCTAssertTrue(empty.isEmpty)
        // Even if a caller (incorrectly) "selects" the portfolio grant id, it still never becomes an
        // ActorAssignment: ProductionGrantMapper reports .requiresWeddingSelection, not .assigned.
        let withSelection = ProductionActorAssignmentSource(authority: authority, selectedGrantIds: ["planner:portfolio:biz-1"])
        let stillEmpty = await withSelection.assignments(actorId: "user-1")
        XCTAssertTrue(stillEmpty.isEmpty)
    }

    func testAnUnusableAuthorityYieldsNothing() async throws {
        let banned = try authority(accountStatus: "banned_identity", grants: "[]")
        let assignments = await ProductionActorAssignmentSource(authority: banned).assignments(actorId: "user-1")
        XCTAssertTrue(assignments.isEmpty)
    }

    func testAMismatchedActorIdYieldsNothing() async throws {
        let authority = try authority(grants: "[\(grant("couple:wedding:A", workspaceKind: "couple", scopeKind: "wedding", weddingId: "A"))]")
        let assignments = await ProductionActorAssignmentSource(authority: authority).assignments(actorId: "someone-else")
        XCTAssertTrue(assignments.isEmpty)
    }
}
