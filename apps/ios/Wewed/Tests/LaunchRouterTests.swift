import XCTest
@testable import WewedKit

/// Launch routing.
///
/// These rules used to live in the ORDER of `else if` branches inside the root view: resolve a
/// link, then check authentication, then resolve a context. Nothing stated them, so the most
/// important one — that an invitation outranks a sign-in form — could be undone by moving a
/// branch. Routing is now a pure function, and each rule is a test.
///
/// The Android counterpart asserts the same rules in the same order.
final class LaunchRouterTests: XCTestCase {

    private func invitation(confirmed: Bool = false, declined: Bool = false) -> InvitationContext {
        InvitationContext(
            weddingSlug: "charity-and-kudzie",
            guestToken: "token-under-test",
            coupleNames: "Charity & Kudzie",
            guestName: "Invited Guest",
            partySize: 2,
            weddingDate: "2026-12-23T14:00:00",
            venueName: "Imba Manor",
            venueCity: "Harare, Zimbabwe",
            isConfirmed: confirmed,
            isDeclined: declined
        )
    }

    // MARK: - The rule that outranks everything else

    /// An invited guest must never be asked to create an account in order to RSVP. The invitation
    /// credential IS the guest-entry authorization.
    func testInvitationOutranksSignInForAnUnauthenticatedGuest() {
        let state = LaunchRouter.route(
            invitation: invitation(),
            hasValidSession: false,
            authorizedRoles: [],
            hasResolvedContext: false
        )
        guard case let .invitation(_, stage) = state else {
            return XCTFail("an invitation must not route to Welcome, got \(state)")
        }
        XCTAssertEqual(stage, .pending)
    }

    /// The same holds when a session exists: the link they opened is what they asked for.
    func testInvitationOutranksAnExistingSession() {
        let state = LaunchRouter.route(
            invitation: invitation(),
            hasValidSession: true,
            authorizedRoles: [.couple],
            hasResolvedContext: true
        )
        guard case .invitation = state else {
            return XCTFail("a session must not pre-empt an invitation, got \(state)")
        }
    }

    /// A guest who already accepted goes to their pass, not back through RSVP.
    func testConfirmedGuestSkipsRsvp() {
        let state = LaunchRouter.route(
            invitation: invitation(confirmed: true),
            hasValidSession: false,
            authorizedRoles: [],
            hasResolvedContext: false
        )
        guard case let .invitation(_, stage) = state else { return XCTFail("expected invitation") }
        XCTAssertEqual(stage, .confirmed)
    }

    /// A guest who declined is not asked the question again.
    func testDeclinedGuestSeesTheirResponseNotTheRsvpForm() {
        let state = LaunchRouter.route(
            invitation: invitation(declined: true),
            hasValidSession: false,
            authorizedRoles: [],
            hasResolvedContext: false
        )
        guard case let .invitation(_, stage) = state else { return XCTFail("expected invitation") }
        XCTAssertEqual(stage, .declined)
    }

    // MARK: - Ordinary launches

    func testFreshInstallWithNoInvitationShowsWelcome() {
        XCTAssertEqual(
            LaunchRouter.route(invitation: nil, hasValidSession: false,
                               authorizedRoles: [], hasResolvedContext: false),
            .welcome
        )
    }

    func testASingleAuthorizedRoleGoesStraightToItsWorkspace() {
        XCTAssertEqual(
            LaunchRouter.route(invitation: nil, hasValidSession: true,
                               authorizedRoles: [.couple], hasResolvedContext: true),
            .workspace(.couple)
        )
    }

    /// Asking someone to choose when there is only one answer is a step with no purpose.
    func testASingleAuthorizedRoleIsNeverOfferedAChooser() {
        let state = LaunchRouter.route(invitation: nil, hasValidSession: true,
                                       authorizedRoles: [.planner], hasResolvedContext: true)
        if case .roleSelection = state { XCTFail("a single role must not be offered a chooser") }
    }

    func testSeveralAuthorizedRolesOfferAChooserListingOnlyThoseRoles() {
        let roles: [AppRole] = [.planner, .coordinator]
        let state = LaunchRouter.route(invitation: nil, hasValidSession: true,
                                       authorizedRoles: roles, hasResolvedContext: true)
        guard case let .roleSelection(offered) = state else { return XCTFail("expected a chooser") }
        XCTAssertEqual(offered, roles)
        // The chooser lists authorizations, never the full role taxonomy.
        XCTAssertFalse(offered.contains(.admin))
    }

    func testAnUnresolvedWeddingContextAsksForOneRatherThanOpeningAnEmptyWorkspace() {
        XCTAssertEqual(
            LaunchRouter.route(invitation: nil, hasValidSession: true,
                               authorizedRoles: [.planner], hasResolvedContext: false),
            .contextSelection(.planner)
        )
    }

    /// An authenticated identity the server authorized for nothing is an explicit state, not a
    /// silent fallback into someone else's workspace.
    func testAnAuthenticatedIdentityWithNoAuthorizationIsAnHonestError() {
        let state = LaunchRouter.route(invitation: nil, hasValidSession: true,
                                       authorizedRoles: [], hasResolvedContext: false)
        guard case .error = state else { return XCTFail("expected an explicit error state") }
    }

    func testOnboardingRunsAfterAuthorizationNotBeforeIt() {
        XCTAssertEqual(
            LaunchRouter.route(invitation: nil, hasValidSession: true, authorizedRoles: [.couple],
                               hasResolvedContext: true, needsOnboarding: true),
            .onboarding(.couple)
        )
    }
}
