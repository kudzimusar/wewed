import XCTest
@testable import WewedKit

/// The native Admin authorization model must equal the web one.
///
/// `src/lib/wewed-admin-policy.ts` is what the Admin API enforces. If the native model drifts from
/// it, the app offers an administrator a control the server will refuse — which is worse than
/// offering nothing, because it fails at the moment someone relies on it.
///
/// `mobile/contracts/admin-policy.json` is generated from that module, and this test compares the
/// Swift tables to it element by element. The Android suite asserts the same contract, so the
/// three cannot diverge silently: a change on the web that is not mirrored fails a build.
final class AdminPolicyContractTests: XCTestCase {

    private struct Contract: Decodable {
        let contractVersion: String
        let roles: [String]
        let roleLabels: [String: String]
        let permissions: [String]
        let rolePermissions: [String: [String]]
        let accountLifecycleStatuses: [String]
        let accountTransitions: [String: [String]]
        let transitionPermissions: [String: String]
        let restrictiveStatuses: [String]
        let workspaceStatus: String
    }

    private static func loadContract() throws -> Contract {
        var dir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        while dir.path != "/" {
            let candidate = dir.appendingPathComponent("mobile/contracts/admin-policy.json")
            if FileManager.default.fileExists(atPath: candidate.path) {
                return try JSONDecoder().decode(Contract.self,
                                                from: try Data(contentsOf: candidate))
            }
            dir = dir.deletingLastPathComponent()
        }
        throw NSError(domain: "AdminPolicyContractTests", code: 1,
                      userInfo: [NSLocalizedDescriptionKey: "Shared Admin policy contract not found"])
    }

    private var contract: Contract!

    override func setUpWithError() throws {
        contract = try Self.loadContract()
    }

    func testContractVersionMatches() {
        XCTAssertEqual(AdminPolicy.contractVersion, contract.contractVersion)
    }

    func testRolesMatchTheWebPolicy() {
        XCTAssertEqual(WewedAdminRole.allCases.map(\.wire), contract.roles)
    }

    /// The labels appear in the UI; a mismatch would name a role differently on phone and web.
    func testRoleLabelsMatchTheWebPolicy() {
        for role in WewedAdminRole.allCases {
            XCTAssertEqual(role.label, contract.roleLabels[role.wire])
        }
    }

    func testPermissionsMatchTheWebPolicy() {
        XCTAssertEqual(AdminPolicy.allPermissions, contract.permissions)
    }

    /// The grant per role is the heart of it: this is what decides whether a Support Admin is
    /// offered a Suspend button.
    func testEachRoleGrantsExactlyTheWebPermissionSet() {
        for role in WewedAdminRole.allCases {
            let expected = Set(contract.rolePermissions[role.wire] ?? [])
            XCTAssertEqual(AdminPolicy.permissions(for: role), expected,
                           "permissions for \(role.label)")
        }
    }

    func testAccountLifecycleStatusesMatchTheWebPolicy() {
        XCTAssertEqual(AccountLifecycleStatus.allCases.map(\.wire),
                       contract.accountLifecycleStatuses)
    }

    func testAccountTransitionsMatchTheWebPolicy() {
        for status in AccountLifecycleStatus.allCases {
            XCTAssertEqual(AdminPolicy.transitions(from: status).map(\.wire),
                           contract.accountTransitions[status.wire],
                           "transitions from \(status.wire)")
        }
    }

    /// Reaching ACTIVE is approve or restore depending on where it came from — separate decisions.
    func testTransitionPermissionsMatchTheWebPolicy() {
        let actual = AdminPolicy.transitionPermissionMap()
        XCTAssertEqual(actual.count, contract.transitionPermissions.count)
        for (key, expected) in contract.transitionPermissions {
            XCTAssertEqual(actual[key], expected, "permission for \(key)")
        }
    }

    func testRestrictiveStatusesMatchTheWebPolicy() {
        let actual = Set(AccountLifecycleStatus.allCases.filter(\.isRestrictive).map(\.wire))
        XCTAssertEqual(actual, Set(contract.restrictiveStatuses))
    }

    func testOnlyAnActiveAccountOpensAWorkspace() {
        for status in AccountLifecycleStatus.allCases {
            XCTAssertEqual(status.allowsWorkspace, status.wire == contract.workspaceStatus)
        }
    }

    // MARK: - What the model is FOR: deciding which actions to offer

    /// A Support Admin may read an account and work a case. They may not suspend it.
    func testSupportAdminIsNotOfferedAccountLifecycleActions() {
        let support = AdminAuthorization.resolve(role: .supportAdmin)
        XCTAssertTrue(support.can("admin.accounts.read"))
        XCTAssertTrue(support.can("admin.support.manage"))
        XCTAssertFalse(support.can("admin.accounts.suspend"))
        XCTAssertTrue(support.availableTransitions(from: .active).isEmpty)
    }

    func testOperationsAdminIsOfferedTheAccountLifecycleActions() {
        let ops = AdminAuthorization.resolve(role: .operationsAdmin)
        XCTAssertEqual(Set(ops.availableTransitions(from: .active)),
                       Set([.suspended, .blocked, .cancelled, .archived]))
    }

    /// Approving a pending account and restoring a suspended one are different permissions.
    func testApproveAndRestoreAreDistinctPermissions() {
        XCTAssertEqual(
            AdminPolicy.permissionForTransition(from: .pendingReview, to: .active),
            "admin.accounts.approve"
        )
        XCTAssertEqual(
            AdminPolicy.permissionForTransition(from: .suspended, to: .active),
            "admin.accounts.restore"
        )
    }

    /// An invalid transition is refused whatever the role — Super Admin included.
    func testAnInvalidTransitionIsRefusedEvenForSuperAdmin() {
        let superAdmin = AdminAuthorization.resolve(role: .superAdmin)
        XCTAssertFalse(superAdmin.canTransition(from: .pendingReview, to: .suspended))
        XCTAssertFalse(superAdmin.canTransition(from: .active, to: .active))
    }

    /// An explicit grant may narrow a role. A client that could widen it would self-authorize.
    func testAnExplicitGrantCannotWidenARole() {
        let analyst = AdminAuthorization.resolve(
            role: .analyst,
            explicitPermissions: ["admin.accounts.read", "admin.accounts.suspend"]
        )
        XCTAssertTrue(analyst.can("admin.accounts.read"))
        XCTAssertFalse(analyst.can("admin.accounts.suspend"),
                       "an analyst must not gain suspend by asking for it")
    }

    /// No native permission may exist that the web policy does not declare.
    func testNativeInventsNoPermissionOfItsOwn() {
        let declared = Set(contract.permissions)
        for role in WewedAdminRole.allCases {
            XCTAssertTrue(AdminPolicy.permissions(for: role).subtracting(declared).isEmpty,
                          "\(role.label) grants undeclared permissions")
        }
    }
}
