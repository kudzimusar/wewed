import XCTest
@testable import WewedKit

/// Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 closure §B/§12/§13.
///
/// `AppState.adminRepository` must never be `ShadowAdminSystemRepository` in production, and must
/// become the real `ProductionAdminSystemRepository` once bound — this is exactly the defect the
/// moderator flagged in `AdminShellView` (it used to construct `ShadowAdminSystemRepository`
/// unconditionally). Non-production keeps its existing Shadow-over-wedding-graph default. The
/// Android sibling is `AppViewModelProductionAdminTest`.
///
/// `bindProductionAdminRepository`'s outside-production guard uses `precondition`, matching the
/// existing convention already established by `bindProductionRepositories` in this same type — like
/// that method, it has no XCTest coverage of the trap itself, since a Swift `precondition` aborts the
/// process rather than throwing a catchable error.
final class AppStateProductionAdminTests: XCTestCase {

    private final class Stub: URLProtocol, @unchecked Sendable {
        nonisolated(unsafe) static var body = ""
        nonisolated(unsafe) static var status = 200

        override class func canInit(with request: URLRequest) -> Bool { true }
        override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

        override func startLoading() {
            let response = HTTPURLResponse(
                url: request.url!, statusCode: Stub.status, httpVersion: "HTTP/1.1",
                headerFields: ["Content-Type": "application/json"]
            )!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: Data(Stub.body.utf8))
            client?.urlProtocolDidFinishLoading(self)
        }

        override func stopLoading() {}
    }

    private func productionAppState() -> AppState {
        AppState(dataEnvironment: .production, dataBaseURL: URL(string: "https://example.test"))
    }

    /// Master plan Phase 8 closure round 4 §1 — the central regression: an unbound PRODUCTION
    /// `AppState` must expose NO mature Admin repository at all, not even a same-typed always-
    /// throwing placeholder. Reading `adminRepository` before any bind now throws
    /// `ProductionRepositoryUnbound` — there is no `is ProductionBoundaryAdminSystemRepository`
    /// assertion possible any more because that type no longer exists.
    func testProductionFailsClosedWithProductionRepositoryUnboundBeforeAnyBindNeverShadowNeverAFabricatedRepository() {
        let appState = productionAppState()
        XCTAssertThrowsError(try appState.adminRepository) { error in
            XCTAssertTrue(error is ProductionRepositoryUnbound)
        }
    }

    func testNonProductionKeepsTheExistingShadowAdminRepository() throws {
        let appState = AppState(dataEnvironment: .shadow)
        XCTAssertTrue(try appState.adminRepository is ShadowAdminSystemRepository)
    }

    func testBindingARealAdminRepositoryInProductionReplacesTheBoundaryDefault() async throws {
        let appState = productionAppState()
        Stub.status = 200
        Stub.body = #"{"success":true,"scopeKind":"system","platformRoles":["wewed_super_admin"],"counts":{"pendingOnboarding":2}}"#
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [Stub.self]
        let client = NativeDomainApiClient(baseURL: URL(string: "https://example.test")!, session: URLSession(configuration: configuration))

        appState.bindProductionAdminRepository(accessUserId: "user-a", grantId: "admin:system", ProductionAdminSystemRepository(client: client, sessionToken: "token", grantId: "admin:system"))

        XCTAssertTrue(try appState.adminRepository is ProductionAdminSystemRepository)
        guard case let .bound(accessUserId, grantId, _, _) = appState.productionAdminBinding else {
            return XCTFail("Expected .bound after bindProductionAdminRepository")
        }
        XCTAssertEqual(accessUserId, "user-a")
        XCTAssertEqual(grantId, "admin:system")
        let snapshot = try await appState.adminRepository.snapshot()
        XCTAssertEqual(snapshot.pendingOnboardingCount, 2)
    }

    /// Master plan Phase 8 closure round 4 §1 — `ProductionRepositoryUnbound` means "never bound at
    /// all yet", a different, intentional fact from "a bound repository's live call just failed",
    /// which is what `ProductionAdminSystemRepository` throws `ProductionReadOnlyDomainError` on
    /// instead (`ProductionDomainRepositoriesTests`).
    func testAnUnboundProductionAdminDomainExposesNoMatureRepositoryToReadFromAtAll() async {
        let appState = productionAppState()
        do {
            _ = try await appState.adminRepository.snapshot()
            XCTFail("Expected ProductionRepositoryUnbound: there is no repository, real or placeholder, to call snapshot() on")
        } catch is ProductionRepositoryUnbound {
            // Expected.
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
    }

    /// Master plan Phase 8 closure §1/round 3 §4 (NativeRepositoryFactory.PRODUCTION closure).
    /// `RootView`'s render gate for `.admin` now waits for the confirmed `(accessUserId, grantId)`
    /// binding before composing `AdminShellView`, specifically so a shell that "appears functional"
    /// can never be backed by the always-throwing boundary repository during the async window between
    /// a workspace snapshot resolving and this bind actually executing. This test proves the binding
    /// itself is an honest, order-correct signal: `.unbound` before any bind, and only ever the exact
    /// account+grant of a completed bind afterward.
    func testProductionAdminBindingIsUnboundUntilBoundAndThenReflectsTheBoundAccountAndGrantExactly() {
        let appState = productionAppState()
        guard case .unbound = appState.productionAdminBinding else {
            return XCTFail("Expected .unbound before any bind")
        }

        Stub.status = 200
        Stub.body = #"{"success":true,"scopeKind":"system","platformRoles":["wewed_super_admin"],"counts":{"pendingOnboarding":0}}"#
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [Stub.self]
        let client = NativeDomainApiClient(baseURL: URL(string: "https://example.test")!, session: URLSession(configuration: configuration))
        appState.bindProductionAdminRepository(
            accessUserId: "user-9", grantId: "admin:system:acct-9",
            ProductionAdminSystemRepository(client: client, sessionToken: "token", grantId: "admin:system:acct-9")
        )

        guard case let .bound(accessUserId, grantId, _, _) = appState.productionAdminBinding else {
            return XCTFail("Expected .bound after bindProductionAdminRepository")
        }
        XCTAssertEqual(accessUserId, "user-9")
        XCTAssertEqual(grantId, "admin:system:acct-9")
    }
}
