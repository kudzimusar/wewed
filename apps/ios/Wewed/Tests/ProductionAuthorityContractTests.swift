import XCTest
@testable import WewedKit

/// WewedProductionAuthorityV1 on iOS (master plan Phase 2). The fixture is produced by the
/// server's own builder (backend branch, grants.test.ts), so this decodes exactly what the server
/// emits. The Android counterpart is ProductionAuthorityContractTest.
final class ProductionAuthorityContractTests: XCTestCase {

    private static func fixtureData() throws -> Data {
        var dir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        while dir.path != "/" {
            let candidate = dir.appendingPathComponent("mobile/fixtures/production-authority-v1/multi-axis-actor.json")
            if FileManager.default.fileExists(atPath: candidate.path) { return try Data(contentsOf: candidate) }
            dir = dir.deletingLastPathComponent()
        }
        throw XCTSkip("Shared authority fixture not found from \(#filePath)")
    }

    private var authority: ProductionAuthority!

    override func setUpWithError() throws {
        try super.setUpWithError()
        authority = try XCTUnwrap(ProductionAuthority.decode(try Self.fixtureData()))
    }

    /// The fixture with edits applied, for the negative cases.
    private func altered(_ edit: (inout [String: Any]) -> Void) throws -> ProductionAuthority {
        var root = try XCTUnwrap(JSONSerialization.jsonObject(with: try Self.fixtureData()) as? [String: Any])
        edit(&root)
        return try XCTUnwrap(ProductionAuthority.decode(try JSONSerialization.data(withJSONObject: root)))
    }

    private func editGrant(_ grantId: String, _ edit: @escaping (inout [String: Any]) -> Void) throws -> ProductionAuthority {
        try altered { root in
            var grants = root["workspaceGrants"] as! [[String: Any]]
            for index in grants.indices where grants[index]["grantId"] as? String == grantId {
                edit(&grants[index])
            }
            root["workspaceGrants"] = grants
        }
    }

    private func assigned(_ outcome: ProductionGrantMapper.Outcome, file: StaticString = #filePath, line: UInt = #line) -> ActorAssignment? {
        guard case let .assigned(assignment) = outcome else {
            XCTFail("expected an assignment, got \(outcome)", file: file, line: line)
            return nil
        }
        return assignment
    }

    private func isDenied(_ outcome: ProductionGrantMapper.Outcome) -> Bool {
        if case .denied = outcome { return true }
        return false
    }

    func testTheServerFixtureDecodesCompletely() {
        XCTAssertEqual(authority.contract, "WewedProductionAuthorityV1")
        XCTAssertEqual(authority.version, 1)
        XCTAssertEqual(authority.accountStatus, "authorized")
        XCTAssertEqual(authority.accessUserId, "user-1")
        XCTAssertEqual(authority.workspaceGrants.map(\.grantId), [
            "couple:wedding:A",
            "planner:portfolio:planning-1",
            "planner:wedding:B",
            "coordinator:wedding:C",
            "vendor:business:vendor-1",
            "vendor:wedding:vendor-1:vendor-row-F",
            "admin:system",
        ])
        XCTAssertEqual(authority.unsupportedAuthorities, ["guest", "usher_gate"])
        XCTAssertTrue(ProductionGrantMapper.isUsable(authority))
    }

    func testWeddingScopedGrantsBecomeAssignments() {
        XCTAssertEqual(assigned(ProductionGrantMapper.map(authority, grantId: "couple:wedding:A")),
                       ActorAssignment(actorId: "user-1", role: .couple, weddingId: "A"))
        XCTAssertEqual(assigned(ProductionGrantMapper.map(authority, grantId: "planner:wedding:B")),
                       ActorAssignment(actorId: "user-1", role: .planner, weddingId: "B"))
        XCTAssertEqual(assigned(ProductionGrantMapper.map(authority, grantId: "coordinator:wedding:C")),
                       ActorAssignment(actorId: "user-1", role: .coordinator, weddingId: "C"))
    }

    func testVendorWeddingGrantCarriesWeddingVendorAndOnlyARealEngagement() {
        let assignment = assigned(ProductionGrantMapper.map(authority, grantId: "vendor:wedding:vendor-1:vendor-row-F"))
        XCTAssertEqual(assignment?.role, .vendor)
        XCTAssertEqual(assignment?.weddingId, "F")
        XCTAssertEqual(assignment?.vendorId, "vendor-row-F")
        XCTAssertEqual(assignment?.engagementId, "se-1")
        XCTAssertEqual(assignment?.isShadowTestAccess, false)
        XCTAssertTrue(isDenied(ProductionGrantMapper.map(
            authority, grantId: "vendor:wedding:vendor-1:vendor-row-F", selectedEngagementId: "se-invented")))
    }

    func testVendorWithSeveralEngagementsLeavesTheChoiceOpen() throws {
        let many = try editGrant("vendor:wedding:vendor-1:vendor-row-F") { $0["serviceEngagementIds"] = ["se-1", "se-2"] }
        XCTAssertNil(assigned(ProductionGrantMapper.map(many, grantId: "vendor:wedding:vendor-1:vendor-row-F"))?.engagementId)
        XCTAssertEqual(assigned(ProductionGrantMapper.map(
            many, grantId: "vendor:wedding:vendor-1:vendor-row-F", selectedEngagementId: "se-2"))?.engagementId, "se-2")
    }

    func testAdminSystemGrantIsSystemScopedWithNoWedding() {
        let assignment = assigned(ProductionGrantMapper.map(authority, grantId: "admin:system"))
        XCTAssertEqual(assignment?.role, .admin)
        XCTAssertNil(assignment?.weddingId)
        XCTAssertEqual(assignment?.isSystemScope, true)
        XCTAssertEqual(authority.workspaceGrants.last?.platformRoles, ["wewed_operations_admin"])
    }

    /// The Planner portfolio stays a portfolio grant. It is never forced into an assignment or a fake wedding.
    func testPlannerPortfolioIsNotYetAnAssignment() {
        guard case let .requiresWeddingSelection(grant) = ProductionGrantMapper.map(authority, grantId: "planner:portfolio:planning-1") else {
            return XCTFail("a portfolio grant must not become an assignment")
        }
        XCTAssertNil(grant.weddingId)
        XCTAssertEqual(grant.businessAccountId, "planning-1")
    }

    func testVendorBusinessIsNotYetAnAssignment() {
        guard case .requiresWeddingSelection = ProductionGrantMapper.map(authority, grantId: "vendor:business:vendor-1") else {
            return XCTFail("a business grant must not become an assignment")
        }
    }

    func testViewerHasNoWorkspace() {
        XCTAssertFalse(authority.workspaceGrants.contains { $0.weddingId == "D" })
        XCTAssertTrue(isDenied(ProductionGrantMapper.map(authority, grantId: "viewer:wedding:D")))
    }

    func testUnknownGuestAndUsherGrantKindsAreDenied() throws {
        for kind in ["guest", "usher", "gate", "support", ""] {
            let changed = try editGrant("couple:wedding:A") { $0["workspaceKind"] = kind }
            XCTAssertEqual(changed.workspaceGrants.first { $0.grantId == "couple:wedding:A" }?.workspaceKind, .unknown)
            XCTAssertTrue(isDenied(ProductionGrantMapper.map(changed, grantId: "couple:wedding:A")), "'\(kind)' must be denied")
        }
    }

    func testAnUnknownScopeOrAMismatchedScopeIsDenied() throws {
        XCTAssertTrue(isDenied(ProductionGrantMapper.map(
            try editGrant("couple:wedding:A") { $0["scopeKind"] = "galaxy" }, grantId: "couple:wedding:A")))
        XCTAssertTrue(isDenied(ProductionGrantMapper.map(
            try editGrant("couple:wedding:A") { $0["scopeKind"] = "system" }, grantId: "couple:wedding:A")))
        XCTAssertTrue(isDenied(ProductionGrantMapper.map(
            try editGrant("planner:wedding:B") { $0["weddingId"] = NSNull() }, grantId: "planner:wedding:B")))
    }

    func testAnUnauthorizedAccountOrAnotherContractVersionIsRefusedEntirely() throws {
        let edits: [(inout [String: Any]) -> Void] = [
            { $0["accountStatus"] = "inactive_identity" },
            { $0["accountStatus"] = "banned_identity" },
            { $0["version"] = 2 },
            { $0["contract"] = "SomethingElse" },
        ]
        for edit in edits {
            let changed = try altered(edit)
            XCTAssertFalse(ProductionGrantMapper.isUsable(changed))
            XCTAssertTrue(isDenied(ProductionGrantMapper.map(changed, grantId: "couple:wedding:A")))
        }
    }

    func testMalformedPayloadsDecodeToNothing() throws {
        XCTAssertNil(ProductionAuthority.decode(Data("not json".utf8)))
        XCTAssertNil(ProductionAuthority.decode(Data("{}".utf8)))
        XCTAssertNotNil(ProductionAuthority.decode(try Self.fixtureData()))
    }
}
