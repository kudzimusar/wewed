import XCTest
@testable import WewedKit

/// P0-2 — authorization is actor + role + wedding + sub-scope + relationship.
///
/// Every case here holds a legitimate *role* and is still denied, because the relationship does not
/// hold. A role-only model would have allowed all of them. Mirrors the Android suite.
final class RelationshipAuthorizationTests: XCTestCase {

    @discardableResult
    private func denied(_ context: NavigationContext, _ destinationId: String) -> String {
        let resolution = Entitlements.resolve(context, destinationId: destinationId)
        guard case let .denied(reason, _) = resolution else {
            XCTFail("Expected denial for \(context.activeRole.roleId)/\(destinationId)")
            return ""
        }
        return reason
    }

    func testPlannerWithoutAssignmentIsDenied() {
        let context = AuthorizedContexts.unassigned(.planner)
        denied(context, "workspace")
        XCTAssertFalse(Entitlements.relationshipHolds(context))
    }

    func testPlannerAssignedToDifferentWeddingIsDenied() {
        let context = AuthorizedContexts.mutate(
            AuthorizedContexts.authorized(.planner),
            assignment: .some(AuthorizedContexts.assignment(.planner, weddingId: AuthorizedContexts.otherWedding))
        )
        let reason = denied(context, "workspace")
        XCTAssertTrue(reason.lowercased().contains("not assigned"))
    }

    func testVendorWithWrongVendorIdentityIsDenied() {
        let context = AuthorizedContexts.mutate(
            AuthorizedContexts.authorized(.vendor),
            vendorId: .some(AuthorizedContexts.otherVendor)
        )
        denied(context, "jobs")
    }

    func testVendorWithNoVendorIdentityIsDeniedRatherThanDefaulted() {
        let context = AuthorizedContexts.mutate(
            AuthorizedContexts.authorized(.vendor),
            vendorId: .some(nil)
        )
        let reason = denied(context, "jobs")
        XCTAssertTrue(reason.lowercased().contains("vendor"))
    }

    func testGuestBoundToDifferentGuestRecordIsDenied() {
        let context = AuthorizedContexts.mutate(
            AuthorizedContexts.authorized(.guest),
            guestId: .some(AuthorizedContexts.otherGuest)
        )
        denied(context, "invitation")
    }

    func testGuestWithNoIdentityBindingIsDenied() {
        let context = AuthorizedContexts.mutate(
            AuthorizedContexts.authorized(.guest),
            guestId: .some(nil)
        )
        let reason = denied(context, "pass")
        XCTAssertTrue(reason.lowercased().contains("invitation"))
    }

    func testUsherWithWrongGateIsDenied() {
        let context = AuthorizedContexts.mutate(
            AuthorizedContexts.authorized(.usher),
            gateId: .some(AuthorizedContexts.otherGate)
        )
        denied(context, "scan")
    }

    func testUsherWithNoGateIsDenied() {
        let context = AuthorizedContexts.mutate(
            AuthorizedContexts.authorized(.usher),
            gateId: .some(nil)
        )
        let reason = denied(context, "scan")
        XCTAssertTrue(reason.lowercased().contains("gate"))
    }

    func testCoordinatorNotAssignedIsDenied() {
        let context = AuthorizedContexts.mutate(
            AuthorizedContexts.authorized(.coordinator),
            assignment: .some(AuthorizedContexts.assignment(.coordinator, weddingId: AuthorizedContexts.otherWedding))
        )
        denied(context, "today")
    }

    func testAssignmentForAnotherActorDoesNotAuthorize() {
        let context = AuthorizedContexts.mutate(
            AuthorizedContexts.authorized(.planner),
            assignment: .some(AuthorizedContexts.assignment(.planner, actorId: "someone_else"))
        )
        denied(context, "workspace")
    }

    func testAssignmentForAnotherRoleDoesNotAuthorize() {
        let context = AuthorizedContexts.mutate(
            AuthorizedContexts.authorized(.coordinator),
            assignment: .some(AuthorizedContexts.assignment(.planner))
        )
        denied(context, "today")
    }

    func testFullyAssignedActorIsAllowed() {
        for role in AppRole.allCases {
            let context = AuthorizedContexts.authorized(role)
            let first = IANavigationContract.forRole(role).primary[0].id
            guard case .allowed = Entitlements.resolve(context, destinationId: first) else {
                XCTFail("\(role.roleId) should be authorized for its own workspace")
                continue
            }
        }
    }

    // MARK: - P0-3: the assignment source must not invent scopes

    func testShadowSourceResolvesVendorEngagementFromRepository() async throws {
        let repository = ShadowReferenceWeddingRepository()
        let source = ShadowActorAssignmentSource(repository: repository, environment: .sanitizedShadow)
        let vendorAssignments = await source.assignments(actorId: "vendor_owner")
        let vendor = try XCTUnwrap(vendorAssignments.first)
        let scoped = try await repository.forOnlyWedding()
        // The assignment must name a real VENDOR on the wedding; the engagement is a separate
        // entity and may legitimately be nil when the vendor holds several or none.
        let vendorIds = try await scoped.getVendors().map(\.id)
        let vendorId = try XCTUnwrap(vendor.vendorId)
        XCTAssertTrue(vendorIds.contains(vendorId))
    }

    func testShadowSourceNeverSetsClientIdToWeddingId() async throws {
        let source = ShadowActorAssignmentSource(repository: ShadowReferenceWeddingRepository(), environment: .sanitizedShadow)
        let plannerAssignments = await source.assignments(actorId: "pro_planner")
        let planner = try XCTUnwrap(plannerAssignments.first)
        XCTAssertNil(planner.clientId, "Client id must not be fabricated from the wedding id")
        XCTAssertTrue(planner.isShadowTestAccess)
    }

    func testShadowSourceResolvesGuestIdentityFromCredential() async throws {
        let source = ShadowActorAssignmentSource(repository: ShadowReferenceWeddingRepository(), environment: .sanitizedShadow)
        let guestAssignments = await source.assignments(actorId: "attending_guest")
        let guest = try XCTUnwrap(guestAssignments.first)
        XCTAssertEqual(guest.guestId, "shadow_guest_011")
        XCTAssertEqual(guest.passToken, "shadow-attending-guest")
    }

    func testTwoShadowGuestsResolveToDifferentIdentities() async throws {
        // P0-4: with two guests declared, an identity bug cannot pass by collection order.
        let source = ShadowActorAssignmentSource(repository: ShadowReferenceWeddingRepository(), environment: .sanitizedShadow)
        let firstAssignments = await source.assignments(actorId: "attending_guest")
        let secondAssignments = await source.assignments(actorId: "attending_guest_party4")
        let first = try XCTUnwrap(firstAssignments.first)
        let second = try XCTUnwrap(secondAssignments.first)
        XCTAssertEqual(first.guestId, "shadow_guest_011")
        XCTAssertEqual(second.guestId, "shadow_guest_007")
        XCTAssertNotEqual(first.guestId, second.guestId)
        XCTAssertNotEqual(first.passToken, second.passToken)
    }

    func testUnknownActorGetsNoAssignment() async {
        let source = ShadowActorAssignmentSource(repository: ShadowReferenceWeddingRepository(), environment: .sanitizedShadow)
        let result = await source.assignments(actorId: "not_a_real_actor")
        XCTAssertTrue(result.isEmpty)
    }

    func testGateAssignmentComesFromDeclaredTable() async throws {
        let source = ShadowActorAssignmentSource(repository: ShadowReferenceWeddingRepository(), environment: .sanitizedShadow)
        let usherAssignments = await source.assignments(actorId: "gate_usher")
        let usher = try XCTUnwrap(usherAssignments.first)
        XCTAssertEqual(usher.gateId, "gate_main_entrance")

        // An actor absent from the gate table has no gate and therefore no Gate workspace.
        let noGate = ShadowActorAssignmentSource(
            repository: ShadowReferenceWeddingRepository(),
            environment: .sanitizedShadow,
            gateAssignments: [:]
        )
        let empty = await noGate.assignments(actorId: "gate_usher")
        XCTAssertTrue(empty.isEmpty)
    }

    func testAdminAssignmentIsSystemScoped() async throws {
        let source = ShadowActorAssignmentSource(repository: ShadowReferenceWeddingRepository(), environment: .sanitizedShadow)
        let adminAssignments = await source.assignments(actorId: "administrator")
        let admin = try XCTUnwrap(adminAssignments.first)
        XCTAssertNil(admin.weddingId)
        XCTAssertTrue(admin.isSystemScope)

        // P0-15: the Admin console opens without any wedding context.
        let context = AuthorizedContexts.authorized(.admin)
        XCTAssertEqual(context.activeWeddingId, "")
        XCTAssertTrue(context.isComplete)
        guard case .allowed = Entitlements.resolve(context, destinationId: "dashboard") else {
            return XCTFail("Admin dashboard must open without a wedding")
        }
    }
}
