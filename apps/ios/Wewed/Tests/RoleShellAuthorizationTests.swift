import XCTest
@testable import WewedKit

/// Phase 1 independent review — the role shell renders content only for a destination that
/// `Entitlements.resolve` allowed for a context that holds a verified assignment.
///
/// The Android counterpart (`RoleShellAuthorizationTest`) asserts the same rules.
final class RoleShellAuthorizationTests: XCTestCase {

    private func firstDestination(_ role: AppRole) -> String {
        IANavigationContract.forRole(role).primary[0].id
    }

    private func copy(_ c: NavigationContext, actorId: String) -> NavigationContext {
        NavigationContext(
            actorId: actorId, activeRole: c.activeRole, activeWeddingId: c.activeWeddingId,
            activeWeddingTitle: c.activeWeddingTitle, environment: c.environment,
            activeClientId: c.activeClientId, activeVendorId: c.activeVendorId,
            activeEngagementId: c.activeEngagementId, activeGateId: c.activeGateId,
            activeGuestId: c.activeGuestId, activePassToken: c.activePassToken,
            assignment: c.assignment
        )
    }

    func testARoleWithNoAssignmentOpensNoWorkspaceAndRendersNothing() {
        for role in AppRole.allCases {
            let context = AuthorizedContexts.unassigned(role)
            XCTAssertFalse(RoleShellAuthorization.admitsWorkspace(context), "\(role) without an assignment")
            let shell = RoleShellAuthorization.initial(context)
            XCTAssertNil(shell.visibleDestinationId, "\(role) renders no destination")
            XCTAssertFalse(shell.canDismissDenial)
        }
    }

    /// A system-scoped Admin may have no wedding, but never no assignment.
    func testASystemAdminNeedsARealSystemScopeAssignment() {
        let admin = AuthorizedContexts.authorized(.admin)
        XCTAssertNil(admin.assignment?.weddingId)
        XCTAssertTrue(RoleShellAuthorization.admitsWorkspace(admin))
        XCTAssertFalse(RoleShellAuthorization.admitsWorkspace(AuthorizedContexts.unassigned(.admin)))
    }

    func testAnAssignmentMissingARequiredScopeRendersNoDestination() {
        let contexts = [
            AuthorizedContexts.mutate(AuthorizedContexts.authorized(.guest), guestId: .some(nil)),
            AuthorizedContexts.mutate(AuthorizedContexts.authorized(.usher), gateId: .some(nil)),
            AuthorizedContexts.mutate(AuthorizedContexts.authorized(.vendor), vendorId: .some(nil)),
            AuthorizedContexts.mutate(AuthorizedContexts.authorized(.couple), weddingId: "")
        ]
        for context in contexts {
            XCTAssertFalse(context.isComplete)
            XCTAssertFalse(RoleShellAuthorization.admitsWorkspace(context))
            XCTAssertNil(RoleShellAuthorization.initial(context).visibleDestinationId)
        }
    }

    func testAnAssignmentHeldByAnotherActorIsDenied() {
        let context = copy(AuthorizedContexts.authorized(.planner), actorId: "someone_else")
        XCTAssertTrue(context.isComplete, "scopes are present")
        XCTAssertFalse(RoleShellAuthorization.admitsWorkspace(context))
        XCTAssertNil(RoleShellAuthorization.initial(context).visibleDestinationId)
    }

    func testAnAssignmentForAnotherWeddingIsDenied() {
        let context = AuthorizedContexts.mutate(
            AuthorizedContexts.authorized(.couple), weddingId: AuthorizedContexts.otherWedding)
        XCTAssertTrue(context.isComplete)
        XCTAssertFalse(RoleShellAuthorization.admitsWorkspace(context))
        XCTAssertNil(RoleShellAuthorization.initial(context).visibleDestinationId)
    }

    func testAValidCompleteAssignmentAuthorizesTheInitialDestination() {
        for role in AppRole.allCases {
            let context = AuthorizedContexts.authorized(role)
            XCTAssertTrue(RoleShellAuthorization.admitsWorkspace(context), "\(role)")
            XCTAssertEqual(RoleShellAuthorization.initial(context).visibleDestinationId, firstDestination(role))
            XCTAssertEqual(
                Entitlements.resolve(context, destinationId: firstDestination(role)),
                .allowed(destination: IANavigationContract.forRole(role).primary[0], context: context),
                "the initial destination is exactly what Entitlements.resolve allows"
            )
        }
    }

    /// The bypass this closes: a denial used to move the selection to its safe return, so "Go back"
    /// showed that destination without it ever having been resolved.
    func testDismissingADeniedDeepLinkCannotRevealSafeReturnContentWithoutAuthorization() {
        let unauthorized = AuthorizedContexts.unassigned(.planner)
        let denied = Entitlements.resolve(unauthorized, destinationId: "clients")
        guard case .denied = denied else { return XCTFail("expected a denial") }

        let shell = RoleShellAuthorization.initial(unauthorized).applying(denied)
        XCTAssertNil(shell.visibleDestinationId)
        XCTAssertFalse(shell.canDismissDenial, "there is nowhere authorized to go back to")
        let dismissed = shell.dismissingDenial()
        XCTAssertNil(dismissed.visibleDestinationId, "dismissal must not reveal the safe return")
        XCTAssertEqual(shell, dismissed)
    }

    /// With a valid context, dismissal returns to the last AUTHORIZED destination, not the safe return.
    func testDismissalReturnsOnlyToTheLastAuthorizedDestination() {
        let context = AuthorizedContexts.authorized(.planner)
        let onClients = RoleShellAuthorization.initial(context).selecting(context, destinationId: "clients")
        XCTAssertEqual(onClients.visibleDestinationId, "clients")

        let denied = onClients.applying(
            .denied(reason: "Not part of this workspace.", safeReturnDestinationId: "workspace"))
        XCTAssertNil(denied.visibleDestinationId, "a denial renders the boundary, not content")
        XCTAssertEqual(denied.authorizedDestinationId, "clients")
        XCTAssertEqual(denied.dismissingDenial().visibleDestinationId, "clients")
    }

    func testATabTapIsResolvedLikeADeepLink() {
        let context = AuthorizedContexts.authorized(.guest)
        let shell = RoleShellAuthorization.initial(context)
            .selecting(context, destinationId: "not_a_guest_destination")
        XCTAssertNil(shell.visibleDestinationId)
        XCTAssertEqual(shell.authorizedDestinationId, firstDestination(.guest))
    }
}
