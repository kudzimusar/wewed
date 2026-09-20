import XCTest
@testable import WewedKit

/// IA V2 §14 — a deep link must never bypass entitlement checks. Mirrors the Android suite.
final class DeepLinkRouterTests: XCTestCase {

    private func context(_ role: AppRole, weddingId: String = AuthorizedContexts.wedding) -> NavigationContext {
        AuthorizedContexts.authorized(role, weddingId: weddingId)
    }

    func testCanonicalWorkspaceDeepLinksParseToDocumentedDestination() throws {
        guard case let .workspace(plan) = try XCTUnwrap(NativeDeepLinkParser.parse("wewed://wedding/wed_1/plan/tasks")) else {
            return XCTFail("expected workspace link")
        }
        XCTAssertEqual(plan.destinationId, "plan")
        XCTAssertEqual(plan.section, "tasks")

        guard case let .workspace(day) = try XCTUnwrap(NativeDeepLinkParser.parse("wewed://wedding/wed_1/day/programme")) else {
            return XCTFail("expected workspace link")
        }
        XCTAssertEqual(day.destinationId, "wedding_day")

        guard case let .workspace(guests) = try XCTUnwrap(NativeDeepLinkParser.parse("wewed://wedding/wed_1/guests")) else {
            return XCTFail("expected workspace link")
        }
        XCTAssertEqual(guests.destinationId, "guests")

        guard case let .workspace(clients) = try XCTUnwrap(NativeDeepLinkParser.parse("wewed://planner/clients/wed_1")) else {
            return XCTFail("expected workspace link")
        }
        XCTAssertEqual(clients.destinationId, "clients")

        guard case let .workspace(jobs) = try XCTUnwrap(NativeDeepLinkParser.parse("wewed://vendor/jobs/eng_1")) else {
            return XCTFail("expected workspace link")
        }
        XCTAssertEqual(jobs.destinationId, "jobs")
        XCTAssertEqual(jobs.entityId, "eng_1")

        guard case let .workspace(scan) = try XCTUnwrap(NativeDeepLinkParser.parse("wewed://gate/gate_a/scan")) else {
            return XCTFail("expected workspace link")
        }
        XCTAssertEqual(scan.destinationId, "scan")

        guard case let .workspace(cases) = try XCTUnwrap(NativeDeepLinkParser.parse("wewed://admin/cases/case_1")) else {
            return XCTFail("expected workspace link")
        }
        XCTAssertEqual(cases.destinationId, "cases")
    }

    func testInvitationDeepLinkStillResolvesRSVPContinuityRoute() throws {
        // RSVP -> Pass continuity must survive the IA V2 upgrade.
        guard case let .invitation(legacy) = try XCTUnwrap(
            NativeDeepLinkParser.parse("https://wewed.pro/invite/charity-kudzie?rsvp=token123")
        ) else { return XCTFail("expected invitation link") }
        XCTAssertEqual(legacy.rsvpToken, "token123")

        guard case let .invitation(canonical) = try XCTUnwrap(
            NativeDeepLinkParser.parse("wewed://wedding/wed_1/invitation/token456")
        ) else { return XCTFail("expected invitation link") }
        XCTAssertEqual(canonical.rsvpToken, "token456")
    }

    func testPassLinkLandsInWorkspaceThatOwnsThePassForEachRole() {
        XCTAssertEqual(DeepLinkRouter.destinationFor(.pass, role: .guest), "pass")
        XCTAssertEqual(DeepLinkRouter.destinationFor(.pass, role: .couple), "wedding_day")
        XCTAssertEqual(DeepLinkRouter.destinationFor(.pass, role: .usher), "scan")
        XCTAssertNil(DeepLinkRouter.destinationFor(.pass, role: .admin))
    }

    func testUnauthorizedDeepLinkIsDeniedWithSafeReturn() {
        let link = NativeDeepLink.workspace(WorkspaceDeepLink(weddingId: AuthorizedContexts.wedding, destinationId: "workspace"))
        guard case let .denied(_, safeReturn) = DeepLinkRouter.resolve(link, context: context(.guest)) else {
            return XCTFail("Guest must not reach the planner workspace via a link")
        }
        XCTAssertEqual(safeReturn, "home")
        XCTAssertNil(DeepLinkRouter.allowedDestination(link, context: context(.guest)))
    }

    func testAdminDeepLinkIsDeniedToEveryNonAdminRole() {
        let link = NativeDeepLink.workspace(WorkspaceDeepLink(weddingId: nil, destinationId: "audit"))
        for role in [AppRole.couple, .planner, .guest, .vendor, .usher, .coordinator] {
            guard case .denied = DeepLinkRouter.resolve(link, context: context(role)) else {
                XCTFail("\(role.roleId) must not open an admin audit link")
                continue
            }
        }
        XCTAssertEqual(DeepLinkRouter.allowedDestination(link, context: context(.admin)), "audit")
    }

    func testLinkNamingDifferentWeddingNeverRebindsActiveContext() {
        let foreign = NativeDeepLink.workspace(WorkspaceDeepLink(weddingId: "wed_OTHER", destinationId: "plan"))
        guard case let .denied(reason, _) = DeepLinkRouter.resolve(foreign, context: context(.couple)) else {
            return XCTFail("A link for another wedding must be denied")
        }
        XCTAssertTrue(reason.contains("different wedding"))
    }

    func testAuthorizedDeepLinkResolvesWithoutChangingActiveWedding() {
        let link = NativeDeepLink.workspace(WorkspaceDeepLink(weddingId: AuthorizedContexts.wedding, destinationId: "plan"))
        guard case let .allowed(destination, resolved) = DeepLinkRouter.resolve(link, context: context(.couple)) else {
            return XCTFail("Couple should reach their own plan workspace")
        }
        XCTAssertEqual(destination.id, "plan")
        XCTAssertEqual(resolved.activeWeddingId, AuthorizedContexts.wedding)
    }
}
