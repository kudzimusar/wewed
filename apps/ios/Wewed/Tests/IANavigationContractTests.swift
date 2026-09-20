import XCTest
@testable import WewedKit

/// Locks the iOS IA V2 navigation declaration to the shared cross-platform contract.
///
/// The Android target runs the equivalent assertions against the same file, so if these tests pass
/// on both platforms the bottom-navigation labels, order and Level-2 taxonomy are provably identical.
final class IANavigationContractTests: XCTestCase {

    private struct SharedContract: Decodable {
        struct Destination: Decodable {
            let id: String
            let label: String
            let sections: [String]
        }
        struct Role: Decodable {
            let displayName: String
            let contextScopes: [String: String]
            let primary: [Destination]
        }
        let contractId: String
        let roles: [String: Role]
        let capabilities: [String: [String]]
        let deniedCapabilityAssertions: [String: [String]]
    }

    private static func loadSharedContract() throws -> SharedContract {
        var dir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        while dir.path != "/" {
            let candidate = dir.appendingPathComponent("mobile/contracts/ia-v2-navigation.json")
            if FileManager.default.fileExists(atPath: candidate.path) {
                let data = try Data(contentsOf: candidate)
                return try JSONDecoder().decode(SharedContract.self, from: data)
            }
            dir = dir.deletingLastPathComponent()
        }
        throw XCTSkip("Shared IA V2 contract not found from \(#filePath)")
    }

    private var contract: SharedContract!

    override func setUpWithError() throws {
        try super.setUpWithError()
        contract = try Self.loadSharedContract()
    }

    func testContractIdMatchesSharedContract() {
        XCTAssertEqual(contract.contractId, IANavigationContract.contractId)
    }

    func testEveryRoleInSharedContractIsDeclaredOnIOS() {
        let jsonRoles = Set(contract.roles.keys)
        let swiftRoles = Set(IANavigationContract.all.keys.map(\.roleId))
        XCTAssertEqual(jsonRoles, swiftRoles)
    }

    func testLevel1LabelsAndOrderMatchSharedContract() throws {
        for (role, navigation) in IANavigationContract.all {
            let expected = try XCTUnwrap(contract.roles[role.roleId])
            XCTAssertEqual(
                expected.primary.map(\.label),
                navigation.labels,
                "Level-1 labels diverged for \(role.roleId)"
            )
        }
    }

    func testLevel1DestinationIdsMatchSharedContract() throws {
        for (role, navigation) in IANavigationContract.all {
            let expected = try XCTUnwrap(contract.roles[role.roleId])
            XCTAssertEqual(
                expected.primary.map(\.id),
                navigation.primary.map(\.id),
                "Level-1 destination ids diverged for \(role.roleId)"
            )
        }
    }

    func testLevel2SectionTaxonomyMatchesSharedContractExactly() throws {
        for (role, navigation) in IANavigationContract.all {
            let expected = try XCTUnwrap(contract.roles[role.roleId])
            for destination in expected.primary {
                XCTAssertEqual(
                    destination.sections,
                    navigation.sections(destination.id),
                    "Level-2 sections diverged for \(role.roleId)/\(destination.id)"
                )
            }
        }
    }

    func testContextScopesAndRequirementsMatchSharedContract() throws {
        for (role, navigation) in IANavigationContract.all {
            let expected = try XCTUnwrap(contract.roles[role.roleId])
            XCTAssertEqual(
                Set(expected.contextScopes.keys),
                Set(navigation.contextScopes.map(\.rawValue)),
                "Context scopes diverged for \(role.roleId)"
            )
            for (scopeKey, requirementKey) in expected.contextScopes {
                let scope = try XCTUnwrap(ContextScope(rawValue: scopeKey))
                XCTAssertEqual(
                    ScopeRequirement.fromKey(requirementKey),
                    navigation.requirement(scope),
                    "Scope requirement diverged for \(role.roleId)/\(scopeKey)"
                )
            }
        }
    }

    // MARK: - IA V2 structural rules (§1.1, §1.4, §1.5)

    func testEveryRoleExposesFourOrFivePrimaryDestinations() {
        for (role, navigation) in IANavigationContract.all {
            let count = navigation.primary.count
            XCTAssertTrue(
                (4...5).contains(count),
                "\(role.roleId) exposes \(count) primary destinations; IA V2 allows 4-5"
            )
        }
    }

    func testLastPrimaryDestinationIsAlwaysMore() {
        for (role, navigation) in IANavigationContract.all {
            XCTAssertEqual(navigation.primary.last?.label, "More", "\(role.roleId) must end with More")
        }
    }

    func testNoActionVerbOccupiesAPrimaryNavigationSlot() {
        // IA V2 §1.4 — "Scan" is the documented Gate Team primary workspace, so it is exempt by name.
        let actionWords = ["add", "import", "export", "print", "send", "create", "check in", "assign", "refresh"]
        for (role, navigation) in IANavigationContract.all {
            for destination in navigation.primary {
                let label = destination.label.lowercased()
                for action in actionWords {
                    XCTAssertFalse(
                        label.contains(action),
                        "\(role.roleId) exposes action '\(destination.label)' as primary navigation"
                    )
                }
            }
        }
    }

    func testMoreIsNotAJunkDrawerOfCoreProductDomains() {
        let coreDomainsThatMayNotHideInMore: [AppRole: [String]] = [
            .couple: ["Tasks", "Budget", "Guest List", "RSVP"],
            .planner: ["Tasks", "Budget", "Guests", "Run Sheet"],
            .guest: ["RSVP", "Wedding Pass"],
            .vendor: ["Deliverables", "Calendar"],
            .usher: ["Checked In", "Manual Admission"],
            .coordinator: ["Assignments", "Incidents"],
            .admin: ["Access Events", "Role Memberships"]
        ]
        for (role, domains) in coreDomainsThatMayNotHideInMore {
            let moreSections = IANavigationContract.forRole(role).sections("more")
            for domain in domains {
                XCTAssertFalse(
                    moreSections.contains(domain),
                    "\(role.roleId) hides core domain '\(domain)' inside More"
                )
            }
        }
    }

    func testEveryWeddingScopedRoleRequiresAWeddingAndAdminDoesNot() {
        // P0-15: Admin is a system-scope console. Requiring a wedding to open Admin Dashboard was
        // exactly what forced a fabricated Charity & Kudzie context.
        for (role, navigation) in IANavigationContract.all {
            if role == .admin {
                XCTAssertTrue(navigation.isSystemScoped, "Admin must be system-scoped")
                XCTAssertFalse(
                    navigation.requiredScopes.contains(.wedding),
                    "Admin must not require a wedding"
                )
            } else {
                XCTAssertTrue(
                    navigation.requiredScopes.contains(.wedding),
                    "\(role.roleId) must require a wedding context"
                )
            }
        }
    }

    func testRolesWithASubScopeDeclareItRequired() {
        // A vendor without an engagement, an usher without a gate and a guest without an identity
        // must not be treated as authorized (P0-3).
        XCTAssertTrue(IANavigationContract.forRole(.vendor).requiredScopes.contains(.engagement))
        XCTAssertTrue(IANavigationContract.forRole(.usher).requiredScopes.contains(.gate))
        XCTAssertTrue(IANavigationContract.forRole(.guest).requiredScopes.contains(.guest))
    }
}
