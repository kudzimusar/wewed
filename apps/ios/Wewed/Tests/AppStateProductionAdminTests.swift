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

    func testProductionDefaultsToTheBoundaryAdminRepositoryNeverShadow() {
        let appState = productionAppState()
        XCTAssertTrue(appState.adminRepository is ProductionBoundaryAdminSystemRepository)
        XCTAssertFalse(appState.adminRepository is ShadowAdminSystemRepository)
    }

    func testNonProductionKeepsTheExistingShadowAdminRepository() {
        let appState = AppState(dataEnvironment: .shadow)
        XCTAssertTrue(appState.adminRepository is ShadowAdminSystemRepository)
    }

    func testBindingARealAdminRepositoryInProductionReplacesTheBoundaryDefault() async {
        let appState = productionAppState()
        Stub.status = 200
        Stub.body = #"{"success":true,"scopeKind":"system","platformRoles":["wewed_super_admin"],"counts":{"pendingOnboarding":2}}"#
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [Stub.self]
        let client = NativeDomainApiClient(baseURL: URL(string: "https://example.test")!, session: URLSession(configuration: configuration))

        appState.bindProductionAdminRepository(grantId: "admin:system", ProductionAdminSystemRepository(client: client, sessionToken: "token", grantId: "admin:system"))

        XCTAssertTrue(appState.adminRepository is ProductionAdminSystemRepository)
        XCTAssertEqual(appState.boundAdminGrantId, "admin:system")
        let snapshot = await appState.adminRepository.snapshot()
        XCTAssertEqual(snapshot.pendingOnboardingCount, 2)
    }

    func testAnUnboundProductionBoundaryAdminRepositoryIsHonestlyNilNeverAFabricatedZero() async {
        let appState = productionAppState()
        let snapshot = await appState.adminRepository.snapshot()
        XCTAssertNil(snapshot.pendingOnboardingCount)
    }
}
