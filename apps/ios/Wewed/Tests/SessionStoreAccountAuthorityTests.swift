import XCTest
@testable import WewedKit

/// `SessionStore` real production sign-in/restore (master plan Phase 5). Uses a `URLProtocol` stub
/// rather than a real network, so every case is deterministic and offline — the same pattern
/// `GuestSessionClientTests` already established. The internal `signInWithServer`/`restoreFromServer`
/// are exercised directly (rather than the public, fire-and-forget `signIn`/`restoreSession`) so
/// assertions run only after the async work has actually completed. The Android counterpart is
/// `SessionAccountAuthorityTest`.
final class SessionStoreAccountAuthorityTests: XCTestCase {

    private struct Reply { let status: Int; var body: String = "" }

    private final class Stub: URLProtocol, @unchecked Sendable {
        nonisolated(unsafe) static var routes: [String: Reply] = [:]
        nonisolated(unsafe) static var lastAuthorizationHeader: String?

        static func reset() {
            // Authority-focused tests do not all configure workspace data. Treat an unspecified
            // workspace fetch as transient unavailability, not revocation; tests that need a
            // 403/404 denial override this route explicitly.
            routes = ["GET /api/native/account/workspace": Reply(status: 503, body: "Service Unavailable")]
            lastAuthorizationHeader = nil
        }

        override class func canInit(with request: URLRequest) -> Bool { true }
        override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

        override func startLoading() {
            let method = request.httpMethod ?? "GET"
            let path = request.url?.path ?? ""
            Stub.lastAuthorizationHeader = request.value(forHTTPHeaderField: "Authorization")
            let reply = Stub.routes["\(method) \(path)"] ?? Reply(status: 404)
            let response = HTTPURLResponse(
                url: request.url!, statusCode: reply.status, httpVersion: "HTTP/1.1",
                headerFields: ["Content-Type": "application/json"]
            )!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: Data(reply.body.utf8))
            client?.urlProtocolDidFinishLoading(self)
        }

        override func stopLoading() {}
    }

    private let singleCoupleGrantAuthority = """
    {"success": true, "authority": {
      "contract": "WewedProductionAuthorityV1", "version": 1, "accountStatus": "authorized",
      "identity": {"accessUserId": "user-1", "dashboardClass": "couple"},
      "workspaceGrants": [{
        "grantId": "couple:wedding:A", "workspaceKind": "couple", "scopeKind": "wedding",
        "weddingId": "A", "weddingTitle": "Wedding A", "coupleId": null, "businessAccountId": null,
        "vendorId": null, "serviceEngagementIds": [], "permissions": [], "platformRoles": []
      }],
      "contextSelection": [], "unsupported": [], "platform": {"effectiveRole": null}
    }}
    """

    private let coupleWorkspace = """
    {"success":true,"workspace":{
      "grantId":"couple:wedding:A","workspaceKind":"couple","scopeKind":"wedding",
      "weddingId":"A","weddingTitle":"Wedding A","businessAccountId":null,"vendorId":null,
      "serviceEngagementIds":[],"permissions":[],"platformRoles":[],
      "wedding":{"id":"A","slug":"wedding-a","title":"Wedding A","date":"2027-01-01T00:00:00.000Z",
      "venue":"Real Venue","venueCity":"Harare","venueCountry":"Zimbabwe","lifecycle":"before",
      "coupleNames":"A & B"}
    }}
    """

    private let multiPlannerAuthority = """
    {"success": true, "authority": {
      "contract":"WewedProductionAuthorityV1","version":1,"accountStatus":"authorized",
      "identity":{"accessUserId":"planner-1","dashboardClass":"planner"},
      "workspaceGrants":[
        {"grantId":"planner:wedding:A","workspaceKind":"planner","scopeKind":"wedding",
         "weddingId":"A","weddingTitle":"Wedding A","coupleId":null,"businessAccountId":null,
         "vendorId":null,"serviceEngagementIds":[],"permissions":[],"platformRoles":[]},
        {"grantId":"planner:wedding:B","workspaceKind":"planner","scopeKind":"wedding",
         "weddingId":"B","weddingTitle":"Wedding B","coupleId":null,"businessAccountId":null,
         "vendorId":null,"serviceEngagementIds":[],"permissions":[],"platformRoles":[]}
      ],
      "contextSelection":[{"workspaceKind":"planner","grantIds":["planner:wedding:A","planner:wedding:B"],"selectionRequired":true}],
      "unsupported":[],"platform":{"effectiveRole":null}
    }}
    """

    private let plannerPortfolioAuthority = """
    {"success": true, "authority": {
      "contract":"WewedProductionAuthorityV1","version":1,"accountStatus":"authorized",
      "identity":{"accessUserId":"planner-1","dashboardClass":"planner"},
      "workspaceGrants":[{
        "grantId":"planner:portfolio:business-1","workspaceKind":"planner","scopeKind":"portfolio",
        "weddingId":null,"weddingTitle":null,"coupleId":null,"businessAccountId":"business-1",
        "vendorId":null,"serviceEngagementIds":[],"permissions":[],"platformRoles":[]
      }],
      "contextSelection":[{"workspaceKind":"planner","grantIds":["planner:portfolio:business-1"],"selectionRequired":false}],
      "unsupported":[],"platform":{"effectiveRole":null}
    }}
    """

    private let bannedAuthority = """
    {"success": true, "authority": {
      "contract": "WewedProductionAuthorityV1", "version": 1, "accountStatus": "banned_identity",
      "identity": null, "workspaceGrants": [], "contextSelection": [], "unsupported": [],
      "platform": {"effectiveRole": null}
    }}
    """

    private func client() -> ProductionAuthorityClient {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [Stub.self]
        return ProductionAuthorityClient(baseURL: URL(string: "https://wewed.pro")!, session: URLSession(configuration: configuration))
    }

    override func setUp() {
        super.setUp()
        Stub.reset()
    }

    @MainActor
    func testSignInResolvesRealAuthorityAndOpensExactlyOneGrantedWedding() async {
        Stub.routes["POST /api/native/account/signin"] = Reply(status: 200, body: #"{"success": true, "sessionToken": "session-abc"}"#)
        Stub.routes["GET /api/native/account/authority"] = Reply(status: 200, body: singleCoupleGrantAuthority)
        let session = SessionStore(storage: InMemorySecureStorage(), environment: .production, authorityClient: client())

        await session.signInWithServer(client: client(), email: "couple@example.com", password: "correct horse battery staple")

        XCTAssertTrue(session.isAuthenticated)
        XCTAssertEqual(session.currentRole, .couple)
        XCTAssertEqual(session.weddingId, "A")
        XCTAssertEqual(session.authorizedRoles, [.couple])
        XCTAssertNil(session.authenticationError)
        XCTAssertEqual(Stub.lastAuthorizationHeader, "Bearer session-abc")
    }

    @MainActor
    func testInvalidCredentialsNeverAuthenticate() async {
        Stub.routes["POST /api/native/account/signin"] = Reply(status: 401, body: #"{"success": false, "error": "Invalid email or password."}"#)
        let session = SessionStore(storage: InMemorySecureStorage(), environment: .production, authorityClient: client())

        await session.signInWithServer(client: client(), email: "nobody@example.com", password: "wrong")

        XCTAssertFalse(session.isAuthenticated)
        XCTAssertNil(session.currentRole)
        XCTAssertEqual(session.authenticationError, "Invalid email or password.")
    }

    @MainActor
    func testABannedOrInactiveAccountKeepsNoWorkspaceEvenThoughTheIdentitySessionIsValid() async {
        Stub.routes["POST /api/native/account/signin"] = Reply(status: 200, body: #"{"success": true, "sessionToken": "session-abc"}"#)
        Stub.routes["GET /api/native/account/authority"] = Reply(status: 200, body: bannedAuthority)
        let session = SessionStore(storage: InMemorySecureStorage(), environment: .production, authorityClient: client())

        await session.signInWithServer(client: client(), email: "couple@example.com", password: "correct horse battery staple")

        // The identity session itself was proven valid by the server (200, not 401): the person is
        // not bounced back to a login form. But no role, wedding or authorized-roles entry exists.
        XCTAssertTrue(session.isAuthenticated)
        XCTAssertNil(session.currentRole)
        XCTAssertTrue(session.authorizedRoles.isEmpty)
    }

    @MainActor
    func testRestoreSessionWithNoStoredCredentialNeverCallsTheServer() {
        let session = SessionStore(storage: InMemorySecureStorage(), environment: .production, authorityClient: client())
        XCTAssertTrue(session.sessionRestored)
        XCTAssertFalse(session.isAuthenticated)
        XCTAssertNil(Stub.lastAuthorizationHeader)
    }

    @MainActor
    func testRestoreSessionRevalidatesAStoredCredentialAgainstTheServerBeforeGrantingAnything() async {
        Stub.routes["GET /api/native/account/authority"] = Reply(status: 200, body: singleCoupleGrantAuthority)
        let storage = InMemorySecureStorage()
        storage.save(key: "wewed.account.session", value: "session-from-a-previous-launch")
        let session = SessionStore(storage: storage, environment: .production, authorityClient: nil)

        await session.restoreFromServer(client: client(), storedToken: "session-from-a-previous-launch")

        XCTAssertTrue(session.isAuthenticated)
        XCTAssertEqual(session.currentRole, .couple)
        XCTAssertEqual(Stub.lastAuthorizationHeader, "Bearer session-from-a-previous-launch")
    }

    @MainActor
    func testAServerRejectedSessionIsFullyClearedNotJustDeniedAWorkspace() async {
        Stub.routes["GET /api/native/account/authority"] = Reply(status: 401, body: #"{"success": false, "error": "invalid"}"#)
        let storage = InMemorySecureStorage()
        storage.save(key: "wewed.account.session", value: "revoked-session")
        storage.save(key: "wewed.account.selected-grants", value: "planner:wedding:B")
        let session = SessionStore(storage: storage, environment: .production, authorityClient: nil)

        await session.restoreFromServer(client: client(), storedToken: "revoked-session")

        XCTAssertFalse(session.isAuthenticated)
        XCTAssertNil(session.currentRole)
        XCTAssertNil(storage.get(key: "wewed.account.session"))
        XCTAssertNil(storage.get(key: "wewed.account.selected-grants"))
    }

    @MainActor
    func testATransientNetworkFailureOnRestoreNeitherSignsInNorDestroysTheStoredCredential() async {
        Stub.routes["GET /api/native/account/authority"] = Reply(status: 503, body: "Service Unavailable")
        let storage = InMemorySecureStorage()
        storage.save(key: "wewed.account.session", value: "still-possibly-good")
        let session = SessionStore(storage: storage, environment: .production, authorityClient: nil)

        await session.restoreFromServer(client: client(), storedToken: "still-possibly-good")

        XCTAssertFalse(session.isAuthenticated)
        XCTAssertEqual(storage.get(key: "wewed.account.session"), "still-possibly-good")
    }

    @MainActor
    func testSelectingAGrantThatDoesNotExistInTheCurrentAuthorityIsIgnored() async {
        Stub.routes["POST /api/native/account/signin"] = Reply(status: 200, body: #"{"success": true, "sessionToken": "session-abc"}"#)
        Stub.routes["GET /api/native/account/authority"] = Reply(status: 200, body: singleCoupleGrantAuthority)
        let session = SessionStore(storage: InMemorySecureStorage(), environment: .production, authorityClient: client())
        await session.signInWithServer(client: client(), email: "couple@example.com", password: "correct horse battery staple")

        session.selectGrant("planner:wedding:does-not-exist")

        XCTAssertTrue(session.selectedGrantIds.isEmpty)
        XCTAssertEqual(session.currentRole, .couple)
    }

    @MainActor
    func testSignInLoadsARevalidatedReadOnlyWorkspaceSnapshot() async {
        Stub.routes["POST /api/native/account/signin"] = Reply(status: 200, body: #"{"success":true,"sessionToken":"session-abc"}"#)
        Stub.routes["GET /api/native/account/authority"] = Reply(status: 200, body: singleCoupleGrantAuthority)
        Stub.routes["GET /api/native/account/workspace"] = Reply(status: 200, body: coupleWorkspace)
        let api = client()
        let session = SessionStore(storage: InMemorySecureStorage(), environment: .production, authorityClient: api)

        await session.signInWithServer(client: api, email: "couple@example.com", password: "correct")

        XCTAssertEqual(session.activeGrantId, "couple:wedding:A")
        XCTAssertEqual(session.productionWorkspace?.wedding?.title, "Wedding A")
        XCTAssertEqual(session.productionWorkspace?.wedding?.venue, "Real Venue")
    }

    @MainActor
    func testSelectingASecondPlannerWeddingReplacesTheFirstSameKindSelection() async {
        Stub.routes["POST /api/native/account/signin"] = Reply(status: 200, body: #"{"success":true,"sessionToken":"session-abc"}"#)
        Stub.routes["GET /api/native/account/authority"] = Reply(status: 200, body: multiPlannerAuthority)
        let api = client()
        let session = SessionStore(storage: InMemorySecureStorage(), environment: .production, authorityClient: api)
        await session.signInWithServer(client: api, email: "planner@example.com", password: "correct")

        XCTAssertNil(session.currentRole)
        XCTAssertNil(session.activeGrantId)

        session.selectGrant("planner:wedding:A")
        XCTAssertEqual(session.selectedGrantIds, ["planner:wedding:A"])
        XCTAssertEqual(session.weddingId, "A")

        session.selectGrant("planner:wedding:B")
        XCTAssertEqual(session.selectedGrantIds, ["planner:wedding:B"])
        XCTAssertEqual(session.activeGrantId, "planner:wedding:B")
        XCTAssertEqual(session.weddingId, "B")
    }

    @MainActor
    func testSolePlannerPortfolioIsRealAuthorityWithoutAFakeWeddingAssignment() async {
        Stub.routes["POST /api/native/account/signin"] = Reply(status: 200, body: #"{"success":true,"sessionToken":"session-abc"}"#)
        Stub.routes["GET /api/native/account/authority"] = Reply(status: 200, body: plannerPortfolioAuthority)
        let api = client()
        let session = SessionStore(storage: InMemorySecureStorage(), environment: .production, authorityClient: api)
        await session.signInWithServer(client: api, email: "planner@example.com", password: "correct")

        XCTAssertTrue(session.isAuthenticated)
        XCTAssertNil(session.currentRole)
        XCTAssertNil(session.weddingId)
        XCTAssertEqual(session.activeGrantId, "planner:portfolio:business-1")
    }

    func testSignInWithNoAuthorityClientConfiguredStillThrowsExactlyAsBefore() {
        let session = SessionStore(environment: .production)
        XCTAssertThrowsError(try session.signIn(email: "someone@example.com", password: "a-password")) { error in
            guard case let SessionError.message(text) = error else { return XCTFail("wrong error type") }
            XCTAssertTrue(text.contains("not connected"))
        }
        XCTAssertFalse(session.isAuthenticated)
    }

    @MainActor
    func testProductionWithAResolvedAuthorityFeedsARealAssignmentSourceIntoActorAssignmentSources() async {
        Stub.routes["POST /api/native/account/signin"] = Reply(status: 200, body: #"{"success": true, "sessionToken": "session-abc"}"#)
        Stub.routes["GET /api/native/account/authority"] = Reply(status: 200, body: singleCoupleGrantAuthority)
        let session = SessionStore(storage: InMemorySecureStorage(), environment: .production, authorityClient: client())
        await session.signInWithServer(client: client(), email: "couple@example.com", password: "correct horse battery staple")

        let source = ActorAssignmentSources.forEnvironment(
            .production,
            repository: ShadowReferenceWeddingRepository(),
            productionAuthority: session.productionAuthority,
            selectedGrantIds: session.selectedGrantIds
        )
        let assignments = await source.assignments(actorId: "user-1")
        XCTAssertEqual(assignments.first?.weddingId, "A")
    }
}
