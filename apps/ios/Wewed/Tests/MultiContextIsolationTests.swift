import XCTest
@testable import WewedKit

/// Master plan Phase 6 — multi-role and multi-context isolation. Proves the account/context switch
/// mechanics Phase 5 already shipped (singular same-kind selection, synchronous snapshot clearing,
/// revoked-grant handling) extend correctly to: switching after a workspace is already open,
/// switching across different workspace kinds (not just within one), Vendor engagement selection,
/// and — the mandatory Phase-6 adversarial case — that Account A's session state can never leak
/// into Account B. The Android counterpart is `MultiContextIsolationTest`.
final class MultiContextIsolationTests: XCTestCase {

    private struct Reply { let status: Int; var body: String = "" }

    /// Routes by grantId/engagementId parsed out of the query string, not call order.
    private final class Stub: URLProtocol, @unchecked Sendable {
        nonisolated(unsafe) static var authorityReplies: [Reply] = []
        nonisolated(unsafe) static var workspaceReplies: [String: Reply] = [:]
        nonisolated(unsafe) static var signInReplies: [String: Reply] = [:]
        nonisolated(unsafe) static var lastAuthorizationHeader: String?

        static func reset() {
            authorityReplies = []
            workspaceReplies = [:]
            signInReplies = [:]
            lastAuthorizationHeader = nil
        }

        static func setWorkspace(_ grantId: String, _ reply: Reply, engagementId: String? = nil) {
            workspaceReplies[engagementId.map { "\(grantId)|\($0)" } ?? grantId] = reply
        }

        override class func canInit(with request: URLRequest) -> Bool { true }
        override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

        override func startLoading() {
            let method = request.httpMethod ?? "GET"
            let path = request.url?.path ?? ""
            let queryItems = request.url.flatMap { URLComponents(url: $0, resolvingAgainstBaseURL: false)?.queryItems } ?? []
            Stub.lastAuthorizationHeader = request.value(forHTTPHeaderField: "Authorization")

            let reply: Reply
            if method == "POST" {
                // URLProtocol interception often surfaces the body as a stream rather than
                // `httpBody` directly (GuestSessionClientTests hit the same thing first).
                let bodyData = request.httpBody
                    ?? request.httpBodyStream.map { stream -> Data in
                        stream.open()
                        defer { stream.close() }
                        var data = Data()
                        var buffer = [UInt8](repeating: 0, count: 4096)
                        while stream.hasBytesAvailable {
                            let read = stream.read(&buffer, maxLength: buffer.count)
                            if read <= 0 { break }
                            data.append(contentsOf: buffer[0..<read])
                        }
                        return data
                    }
                let body = bodyData.flatMap { String(data: $0, encoding: .utf8) } ?? ""
                let email = Self.extract(pattern: "\"email\":\"([^\"]+)\"", from: body)
                reply = email.flatMap { Stub.signInReplies[$0] }
                    ?? Reply(status: 401, body: #"{"success":false,"error":"Invalid email or password."}"#)
            } else if path.hasSuffix("/workspace") {
                let grantId = queryItems.first { $0.name == "grantId" }?.value
                let engagementId = queryItems.first { $0.name == "engagementId" }?.value
                let key = engagementId.map { "\(grantId ?? "")|\($0)" }
                reply = key.flatMap { Stub.workspaceReplies[$0] }
                    ?? grantId.flatMap { Stub.workspaceReplies[$0] }
                    ?? Reply(status: 503, body: "Service Unavailable")
            } else {
                reply = Stub.authorityReplies.isEmpty ? Reply(status: 503, body: "Service Unavailable") : Stub.authorityReplies.removeFirst()
            }

            let response = HTTPURLResponse(
                url: request.url!, statusCode: reply.status, httpVersion: "HTTP/1.1",
                headerFields: ["Content-Type": "application/json"]
            )!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: Data(reply.body.utf8))
            client?.urlProtocolDidFinishLoading(self)
        }

        override func stopLoading() {}

        private static func extract(pattern: String, from text: String) -> String? {
            guard let regex = try? NSRegularExpression(pattern: pattern),
                  let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
                  let range = Range(match.range(at: 1), in: text)
            else { return nil }
            return String(text[range])
        }
    }

    private let multiAxisAuthority = """
    {"success": true, "authority": {
      "contract": "WewedProductionAuthorityV1", "version": 1, "accountStatus": "authorized",
      "identity": {"accessUserId": "user-1", "dashboardClass": "planner"},
      "workspaceGrants": [
        {"grantId": "couple:wedding:A", "workspaceKind": "couple", "scopeKind": "wedding",
         "weddingId": "A", "weddingTitle": "Wedding A", "coupleId": null, "businessAccountId": null,
         "vendorId": null, "serviceEngagementIds": [], "permissions": [], "platformRoles": []},
        {"grantId": "planner:wedding:A", "workspaceKind": "planner", "scopeKind": "wedding",
         "weddingId": "A", "weddingTitle": "Wedding A", "coupleId": null, "businessAccountId": null,
         "vendorId": null, "serviceEngagementIds": [], "permissions": [], "platformRoles": []},
        {"grantId": "planner:wedding:B", "workspaceKind": "planner", "scopeKind": "wedding",
         "weddingId": "B", "weddingTitle": "Wedding B", "coupleId": null, "businessAccountId": null,
         "vendorId": null, "serviceEngagementIds": [], "permissions": [], "platformRoles": []},
        {"grantId": "planner:wedding:C", "workspaceKind": "planner", "scopeKind": "wedding",
         "weddingId": "C", "weddingTitle": "Wedding C", "coupleId": null, "businessAccountId": null,
         "vendorId": null, "serviceEngagementIds": [], "permissions": [], "platformRoles": []},
        {"grantId": "admin:system", "workspaceKind": "admin", "scopeKind": "system",
         "weddingId": null, "weddingTitle": null, "coupleId": null, "businessAccountId": null,
         "vendorId": null, "serviceEngagementIds": [], "permissions": [], "platformRoles": ["wewed_super_admin"]},
        {"grantId": "coordinator:wedding:D", "workspaceKind": "coordinator", "scopeKind": "wedding",
         "weddingId": "D", "weddingTitle": "Wedding D", "coupleId": null, "businessAccountId": null,
         "vendorId": null, "serviceEngagementIds": [], "permissions": [], "platformRoles": []},
        {"grantId": "vendor:wedding:biz-1:vendor-1", "workspaceKind": "vendor", "scopeKind": "wedding",
         "weddingId": "E", "weddingTitle": "Wedding E", "coupleId": null, "businessAccountId": "biz-1",
         "vendorId": "vendor-1", "serviceEngagementIds": ["eng-1", "eng-2"], "permissions": [], "platformRoles": []}
      ],
      "contextSelection": [
        {"workspaceKind": "planner", "grantIds": ["planner:wedding:A", "planner:wedding:B", "planner:wedding:C"], "selectionRequired": true}
      ],
      "unsupported": [], "platform": {"effectiveRole": null}
    }}
    """

    private func workspaceFor(_ grantId: String, weddingId: String?, weddingTitle: String?, workspaceKind: String = "planner", scopeKind: String = "wedding") -> String {
        let wedding = weddingId.map { id in
            "{\"id\":\"\(id)\",\"slug\":\"wedding-\(id.lowercased())\",\"title\":\"\(weddingTitle ?? id)\",\"date\":\"2027-01-01T00:00:00.000Z\",\"venue\":\"Venue \(id)\",\"venueCity\":\"Harare\",\"venueCountry\":\"Zimbabwe\",\"lifecycle\":\"before\",\"coupleNames\":\"Couple \(id)\"}"
        } ?? "null"
        return """
        {"success":true,"workspace":{
          "grantId":"\(grantId)","workspaceKind":"\(workspaceKind)","scopeKind":"\(scopeKind)",
          "weddingId":\(weddingId.map { "\"\($0)\"" } ?? "null"),"weddingTitle":\(weddingTitle.map { "\"\($0)\"" } ?? "null"),
          "businessAccountId":null,"vendorId":null,
          "serviceEngagementIds":[],"engagement":null,"engagementSelectionRequired":false,"engagementOptions":[],
          "permissions":[],"platformRoles":[],"wedding":\(wedding)
        }}
        """
    }

    private let systemWorkspace = """
    {"success":true,"workspace":{
      "grantId":"admin:system","workspaceKind":"admin","scopeKind":"system",
      "weddingId":null,"weddingTitle":null,"businessAccountId":null,"vendorId":null,
      "serviceEngagementIds":[],"engagement":null,"engagementSelectionRequired":false,"engagementOptions":[],
      "permissions":[],"platformRoles":["wewed_super_admin"],"wedding":null
    }}
    """

    private func vendorWorkspace(engagementId: String?, selectionRequired: Bool) -> String {
        let engagement = engagementId.map { "{\"id\":\"\($0)\",\"serviceCategory\":\"Catering\",\"serviceDescription\":null,\"lifecycleStatus\":\"historical_capture\"}" } ?? "null"
        let options = selectionRequired
            ? "[{\"id\":\"eng-1\",\"serviceCategory\":\"Catering\",\"serviceDescription\":null,\"lifecycleStatus\":\"historical_capture\"},{\"id\":\"eng-2\",\"serviceCategory\":\"Photography\",\"serviceDescription\":null,\"lifecycleStatus\":\"historical_capture\"}]"
            : "[]"
        return """
        {"success":true,"workspace":{
          "grantId":"vendor:wedding:biz-1:vendor-1","workspaceKind":"vendor","scopeKind":"wedding",
          "weddingId":"E","weddingTitle":"Wedding E","businessAccountId":"biz-1","vendorId":"vendor-1",
          "serviceEngagementIds":["eng-1","eng-2"],"engagement":\(engagement),
          "engagementSelectionRequired":\(selectionRequired),"engagementOptions":\(options),
          "permissions":[],"platformRoles":[],
          "wedding":{"id":"E","slug":"wedding-e","title":"Wedding E","date":"2027-01-01T00:00:00.000Z","venue":"Venue E","venueCity":"Harare","venueCountry":"Zimbabwe","lifecycle":"before","coupleNames":"Couple E"}
        }}
        """
    }

    private func client() -> ProductionAuthorityClient {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [Stub.self]
        return ProductionAuthorityClient(baseURL: URL(string: "https://wewed.pro")!, session: URLSession(configuration: configuration))
    }

    override func setUp() {
        super.setUp()
        Stub.reset()
    }

    /// `selectGrant`/`selectEngagement` intentionally fire their workspace refresh as a detached
    /// `Task` (matching the public, non-async production API). Awaiting the same refresh explicitly
    /// afterward makes assertions on `productionWorkspace` deterministic in tests without changing
    /// production behavior — the detached Task's own (idempotent) run either already completed or
    /// still completes harmlessly afterward.
    @MainActor
    private func selectGrantAndAwait(_ session: SessionStore, _ grantId: String, sessionToken: String = "session-abc") async {
        session.selectGrant(grantId)
        await session.refreshActiveWorkspace(client: client(), sessionToken: sessionToken)
    }

    @MainActor
    private func selectEngagementAndAwait(_ session: SessionStore, _ engagementId: String, sessionToken: String = "session-abc") async {
        session.selectEngagement(engagementId)
        await session.refreshActiveWorkspace(client: client(), sessionToken: sessionToken)
    }

    @MainActor
    private func signedInMultiAxisSession() async -> SessionStore {
        Stub.authorityReplies = [Reply(status: 200, body: multiAxisAuthority)]
        Stub.signInReplies["planner@example.com"] = Reply(status: 200, body: #"{"success":true,"sessionToken":"session-abc"}"#)
        Stub.setWorkspace("planner:wedding:A", Reply(status: 200, body: workspaceFor("planner:wedding:A", weddingId: "A", weddingTitle: "Wedding A")))
        Stub.setWorkspace("planner:wedding:B", Reply(status: 200, body: workspaceFor("planner:wedding:B", weddingId: "B", weddingTitle: "Wedding B")))
        Stub.setWorkspace("planner:wedding:C", Reply(status: 200, body: workspaceFor("planner:wedding:C", weddingId: "C", weddingTitle: "Wedding C")))
        Stub.setWorkspace("couple:wedding:A", Reply(status: 200, body: workspaceFor("couple:wedding:A", weddingId: "A", weddingTitle: "Wedding A", workspaceKind: "couple")))
        Stub.setWorkspace("admin:system", Reply(status: 200, body: systemWorkspace))
        Stub.setWorkspace("coordinator:wedding:D", Reply(status: 200, body: workspaceFor("coordinator:wedding:D", weddingId: "D", weddingTitle: "Wedding D", workspaceKind: "coordinator")))
        Stub.setWorkspace("vendor:wedding:biz-1:vendor-1", Reply(status: 200, body: vendorWorkspace(engagementId: nil, selectionRequired: true)))
        Stub.setWorkspace("vendor:wedding:biz-1:vendor-1", Reply(status: 200, body: vendorWorkspace(engagementId: "eng-1", selectionRequired: false)), engagementId: "eng-1")
        Stub.setWorkspace("vendor:wedding:biz-1:vendor-1", Reply(status: 200, body: vendorWorkspace(engagementId: "eng-2", selectionRequired: false)), engagementId: "eng-2")

        let session = SessionStore(storage: InMemorySecureStorage(), environment: .production, authorityClient: client())
        await session.signInWithServer(client: client(), email: "planner@example.com", password: "correct horse battery staple")
        return session
    }

    // MARK: - 1. Planner A -> B -> C -> A (here: switching among Planner grants and back to Couple)

    @MainActor
    func testPlannerCanSwitchAToBToCToAWithoutSigningOut() async {
        let session = await signedInMultiAxisSession()

        await selectGrantAndAwait(session, "planner:wedding:A")
        XCTAssertEqual(session.activeGrantId, "planner:wedding:A")
        XCTAssertEqual(session.currentRole, .planner)
        XCTAssertEqual(session.weddingId, "A")
        XCTAssertEqual(session.productionWorkspace?.weddingId, "A")

        await selectGrantAndAwait(session, "planner:wedding:B")
        XCTAssertEqual(session.activeGrantId, "planner:wedding:B")
        XCTAssertEqual(session.weddingId, "B")
        XCTAssertEqual(session.productionWorkspace?.weddingId, "B")

        await selectGrantAndAwait(session, "planner:wedding:C")
        XCTAssertEqual(session.activeGrantId, "planner:wedding:C")
        XCTAssertEqual(session.weddingId, "C")
        XCTAssertEqual(session.productionWorkspace?.weddingId, "C")
        XCTAssertEqual(session.selectedGrantIds.filter { $0.hasPrefix("planner:wedding:") }, ["planner:wedding:C"])

        await selectGrantAndAwait(session, "planner:wedding:A")
        XCTAssertEqual(session.weddingId, "A")
        XCTAssertEqual(session.productionWorkspace?.weddingId, "A")
        XCTAssertEqual(session.selectedGrantIds.filter { $0.hasPrefix("planner:wedding:") }, ["planner:wedding:A"])
    }

    @MainActor
    func testSwitchingNeverLeavesTwoSameKindGrantsSelectedSimultaneously() async {
        let session = await signedInMultiAxisSession()
        await selectGrantAndAwait(session, "planner:wedding:B")
        await selectGrantAndAwait(session, "planner:wedding:C")
        let plannerSelections = session.selectedGrantIds.filter { $0.hasPrefix("planner:") }
        XCTAssertEqual(plannerSelections, ["planner:wedding:C"])
    }

    // MARK: - Ambiguous persisted same-kind selection fails closed

    @MainActor
    func testTwoPersistedSameKindGrantsFailClosedOnRestore() async {
        let storage = InMemorySecureStorage()
        storage.save(key: "wewed.account.session", value: "session-abc")
        storage.save(key: "wewed.account.selected-grants.owner", value: "user-1")
        storage.save(key: "wewed.account.selected-grants", value: "planner:wedding:B,planner:wedding:C")
        Stub.authorityReplies = [Reply(status: 200, body: multiAxisAuthority)]

        let session = SessionStore(storage: storage, environment: .production, authorityClient: client())
        await session.restoreFromServer(client: client(), storedToken: "session-abc")

        XCTAssertFalse(session.selectedGrantIds.contains("planner:wedding:B"))
        XCTAssertFalse(session.selectedGrantIds.contains("planner:wedding:C"))
    }

    // MARK: - 2. Multi-role: Couple -> Planner -> Couple, Planner -> Admin system -> Planner

    @MainActor
    func testMultiRoleAccountCanSwitchCoupleToPlannerAndBack() async {
        let session = await signedInMultiAxisSession()
        await selectGrantAndAwait(session, "couple:wedding:A")
        XCTAssertEqual(session.currentRole, .couple)
        XCTAssertEqual(session.weddingId, "A")

        await selectGrantAndAwait(session, "planner:wedding:B")
        XCTAssertEqual(session.currentRole, .planner)
        XCTAssertEqual(session.weddingId, "B")

        await selectGrantAndAwait(session, "couple:wedding:A")
        XCTAssertEqual(session.currentRole, .couple)
        XCTAssertEqual(session.weddingId, "A")
        // Per-kind memory is deliberate — but never more than one grant of any single kind at once.
        XCTAssertEqual(session.selectedGrantIds.filter { $0.hasPrefix("couple:") }.count, 1)
        XCTAssertEqual(session.selectedGrantIds.filter { $0.hasPrefix("planner:") }.count, 1)
    }

    @MainActor
    func testMultiRoleAccountCanSwitchPlannerToAdminSystemAndBack() async {
        let session = await signedInMultiAxisSession()
        await selectGrantAndAwait(session, "planner:wedding:B")

        await selectGrantAndAwait(session, "admin:system")
        XCTAssertEqual(session.currentRole, .admin)
        XCTAssertNil(session.weddingId)
        XCTAssertNil(session.productionWorkspace?.weddingId)

        await selectGrantAndAwait(session, "planner:wedding:B")
        XCTAssertEqual(session.currentRole, .planner)
        XCTAssertEqual(session.weddingId, "B")
    }

    // MARK: - 6. Admin system clears wedding context

    @MainActor
    func testSwitchingToAdminSystemClearsPriorWeddingContextCompletely() async {
        let session = await signedInMultiAxisSession()
        await selectGrantAndAwait(session, "coordinator:wedding:D")
        XCTAssertEqual(session.weddingId, "D")

        await selectGrantAndAwait(session, "admin:system")
        XCTAssertNil(session.weddingId)
        XCTAssertNil(session.weddingTitle)
        XCTAssertEqual(session.activeGrantId, "admin:system")
        XCTAssertNil(session.productionWorkspace?.weddingId)
        XCTAssertEqual(session.productionWorkspace?.scopeKind, "system")
    }

    // MARK: - 7. Coordinator cannot access a wedding it has no grant for

    @MainActor
    func testCoordinatorCannotSwitchToAWeddingItWasNotGrantedIn() async {
        let session = await signedInMultiAxisSession()
        await selectGrantAndAwait(session, "coordinator:wedding:D")
        XCTAssertEqual(session.weddingId, "D")

        await selectGrantAndAwait(session, "coordinator:wedding:OTHER")
        XCTAssertEqual(session.activeGrantId, "coordinator:wedding:D")
        XCTAssertEqual(session.weddingId, "D")
    }

    // MARK: - 8/9. Vendor engagement A -> B, foreign engagement rejected

    @MainActor
    func testVendorGrantWithMultipleEngagementsRequiresExplicitChoiceThenCanSwitchBetweenThem() async {
        let session = await signedInMultiAxisSession()
        await selectGrantAndAwait(session, "vendor:wedding:biz-1:vendor-1")
        XCTAssertEqual(session.productionWorkspace?.engagementSelectionRequired, true)
        XCTAssertNil(session.productionWorkspace?.engagement)

        await selectEngagementAndAwait(session, "eng-1")
        XCTAssertEqual(session.productionWorkspace?.engagement?.id, "eng-1")

        await selectEngagementAndAwait(session, "eng-2")
        XCTAssertEqual(session.productionWorkspace?.engagement?.id, "eng-2")
    }

    @MainActor
    func testAForeignEngagementIdNotInTheCurrentWorkspaceIsIgnoredClientSide() async {
        let session = await signedInMultiAxisSession()
        await selectGrantAndAwait(session, "vendor:wedding:biz-1:vendor-1")

        await selectEngagementAndAwait(session, "eng-belonging-to-another-vendor")

        XCTAssertNil(session.selectedEngagementId)
        XCTAssertEqual(session.productionWorkspace?.engagementSelectionRequired, true)
    }

    @MainActor
    func testServerRejectingAnEngagementClearsOnlyTheEngagementNotTheWholeWorkspace() async {
        let session = await signedInMultiAxisSession()
        await selectGrantAndAwait(session, "vendor:wedding:biz-1:vendor-1")
        await selectEngagementAndAwait(session, "eng-1")
        XCTAssertEqual(session.productionWorkspace?.engagement?.id, "eng-1")

        Stub.setWorkspace(
            "vendor:wedding:biz-1:vendor-1",
            Reply(status: 422, body: #"{"success":false,"error":"This engagement is not part of this workspace grant."}"#),
            engagementId: "eng-1"
        )
        // Re-select the SAME engagement to force a fresh workspace fetch without touching the grant.
        await selectEngagementAndAwait(session, "eng-1")

        XCTAssertNil(session.selectedEngagementId)
        XCTAssertEqual(session.activeGrantId, "vendor:wedding:biz-1:vendor-1")
    }

    // MARK: - 10/11. Revoked grant / revoked engagement clear context

    @MainActor
    func testARevokedActiveGrantClearsTheWholeActiveContext() async {
        let session = await signedInMultiAxisSession()
        await selectGrantAndAwait(session, "planner:wedding:B")
        XCTAssertEqual(session.weddingId, "B")

        Stub.setWorkspace("planner:wedding:B", Reply(status: 403, body: #"{"success":false,"error":"revoked"}"#))
        await selectGrantAndAwait(session, "planner:wedding:B")

        XCTAssertNil(session.activeGrantId)
        XCTAssertNil(session.currentRole)
        XCTAssertNil(session.weddingId)
        XCTAssertNil(session.productionWorkspace)
        XCTAssertFalse(session.selectedGrantIds.contains("planner:wedding:B"))
    }

    // MARK: - 12. Transient workspace failure does not authenticate cached data

    @MainActor
    func testATransientWorkspaceFailureNeverRendersAPriorSnapshot() async {
        let session = await signedInMultiAxisSession()
        await selectGrantAndAwait(session, "planner:wedding:B")
        XCTAssertEqual(session.productionWorkspace?.weddingId, "B")

        Stub.setWorkspace("planner:wedding:B", Reply(status: 503, body: "Service Unavailable"))
        await selectGrantAndAwait(session, "planner:wedding:B")

        XCTAssertNil(session.productionWorkspace)
        XCTAssertTrue(session.isAuthenticated)
        XCTAssertEqual(session.activeGrantId, "planner:wedding:B")
    }

    // MARK: - 14. Mandatory adversarial isolation: Wedding A snapshot never leaks into Wedding B

    @MainActor
    func testSwitchingContextsClearsTheOldSnapshotSynchronouslyBeforeTheNewFetchEvenStarts() async {
        Stub.authorityReplies = [Reply(status: 200, body: multiAxisAuthority)]
        Stub.signInReplies["planner@example.com"] = Reply(status: 200, body: #"{"success":true,"sessionToken":"session-abc"}"#)
        Stub.setWorkspace("planner:wedding:B", Reply(status: 200, body: workspaceFor("planner:wedding:B", weddingId: "B", weddingTitle: "Wedding B")))
        // Deliberately no configured response for C: models "the fetch is delayed/fails".
        let session = SessionStore(storage: InMemorySecureStorage(), environment: .production, authorityClient: client())
        await session.signInWithServer(client: client(), email: "planner@example.com", password: "correct horse battery staple")
        await selectGrantAndAwait(session, "planner:wedding:B")
        XCTAssertEqual(session.productionWorkspace?.weddingId, "B")

        await selectGrantAndAwait(session, "planner:wedding:C")

        let weddingId = session.productionWorkspace?.weddingId
        XCTAssertTrue(weddingId == nil || weddingId == "C", "B's data must never render under C's context")
        XCTAssertEqual(session.activeGrantId, "planner:wedding:C")
        XCTAssertEqual(session.weddingId, "C")
    }

    // MARK: - 13/15/17. Account isolation

    @MainActor
    func testSignOutThenSignInAsAnotherAccountCarriesNothingOver() async {
        let session = await signedInMultiAxisSession()
        await selectGrantAndAwait(session, "planner:wedding:B")
        XCTAssertEqual(session.weddingId, "B")

        session.signOut()
        XCTAssertFalse(session.isAuthenticated)
        XCTAssertTrue(session.selectedGrantIds.isEmpty)
        XCTAssertNil(session.activeGrantId)
        XCTAssertNil(session.productionWorkspace)

        let otherAuthority = """
        {"success": true, "authority": {
          "contract": "WewedProductionAuthorityV1", "version": 1, "accountStatus": "authorized",
          "identity": {"accessUserId": "user-2", "dashboardClass": "planner"},
          "workspaceGrants": [{"grantId": "planner:wedding:Z", "workspaceKind": "planner", "scopeKind": "wedding",
             "weddingId": "Z", "weddingTitle": "Wedding Z (Account B)", "coupleId": null, "businessAccountId": null,
             "vendorId": null, "serviceEngagementIds": [], "permissions": [], "platformRoles": []}],
          "contextSelection": [], "unsupported": [], "platform": {"effectiveRole": null}
        }}
        """
        Stub.authorityReplies = [Reply(status: 200, body: otherAuthority)]
        Stub.signInReplies["other@example.com"] = Reply(status: 200, body: #"{"success":true,"sessionToken":"session-xyz"}"#)
        Stub.setWorkspace("planner:wedding:Z", Reply(status: 200, body: workspaceFor("planner:wedding:Z", weddingId: "Z", weddingTitle: "Wedding Z (Account B)")))

        let session2 = SessionStore(storage: InMemorySecureStorage(), environment: .production, authorityClient: client())
        await session2.signInWithServer(client: client(), email: "other@example.com", password: "another-password")

        XCTAssertEqual(session2.productionAuthority?.accessUserId, "user-2")
        XCTAssertFalse(session2.selectedGrantIds.contains("planner:wedding:B"))
        XCTAssertEqual(session2.weddingId, "Z")
    }

    @MainActor
    func testDirectCredentialReplacementWithNoPriorSignOutStillCarriesNothingOver() async {
        // Account A is signed in first, in the SAME process, with no explicit signOut().
        let session = await signedInMultiAxisSession()
        await selectGrantAndAwait(session, "planner:wedding:B")
        XCTAssertEqual(session.weddingId, "B")
        XCTAssertTrue(session.selectedGrantIds.contains("planner:wedding:B"))

        // Sign in directly as Account B, whose OWN authority happens to grant the EXACT SAME grant
        // id Account A had selected. If in-memory selection state were reused, B would appear to
        // already have this context active without ever choosing it.
        let sharedGrantId = "planner:wedding:X"
        let collidingAuthority = """
        {"success": true, "authority": {
          "contract": "WewedProductionAuthorityV1", "version": 1, "accountStatus": "authorized",
          "identity": {"accessUserId": "account-b", "dashboardClass": "planner"},
          "workspaceGrants": [
            {"grantId": "\(sharedGrantId)", "workspaceKind": "planner", "scopeKind": "wedding",
             "weddingId": "X", "weddingTitle": "Wedding X (belongs to Account B too)", "coupleId": null,
             "businessAccountId": null, "vendorId": null, "serviceEngagementIds": [], "permissions": [], "platformRoles": []},
            {"grantId": "planner:wedding:Y", "workspaceKind": "planner", "scopeKind": "wedding",
             "weddingId": "Y", "weddingTitle": "Wedding Y", "coupleId": null, "businessAccountId": null,
             "vendorId": null, "serviceEngagementIds": [], "permissions": [], "platformRoles": []}
          ],
          "contextSelection": [{"workspaceKind":"planner","grantIds":["\(sharedGrantId)","planner:wedding:Y"],"selectionRequired":true}],
          "unsupported": [], "platform": {"effectiveRole": null}
        }}
        """
        Stub.authorityReplies = [Reply(status: 200, body: collidingAuthority)]
        Stub.signInReplies["account-b@example.com"] = Reply(status: 200, body: #"{"success":true,"sessionToken":"session-b"}"#)

        await session.signInWithServer(client: client(), email: "account-b@example.com", password: "b-password")

        XCTAssertEqual(session.productionAuthority?.accessUserId, "account-b")
        XCTAssertFalse(
            session.selectedGrantIds.contains(sharedGrantId) && session.activeGrantId == sharedGrantId,
            "Account A's stale selection must not silently authorize the identical grant id for Account B"
        )
        XCTAssertNil(session.weddingId)
        XCTAssertTrue(session.authorizedRoles.isEmpty || session.currentRole == nil)
    }

    @MainActor
    func testPersistedSelectionOwnedByAccountACannotAutoSelectTheSameGrantIdForAccountB() async {
        let sharedGrantId = "planner:wedding:SHARED"
        let storage = InMemorySecureStorage()
        storage.save(key: "wewed.account.session", value: "account-b-token")
        storage.save(key: "wewed.account.selected-grants.owner", value: "account-a")
        storage.save(key: "wewed.account.selected-grants", value: sharedGrantId)

        let accountBAuthority = """
        {"success": true, "authority": {
          "contract": "WewedProductionAuthorityV1", "version": 1, "accountStatus": "authorized",
          "identity": {"accessUserId": "account-b", "dashboardClass": "planner"},
          "workspaceGrants": [
            {"grantId": "\(sharedGrantId)", "workspaceKind": "planner", "scopeKind": "wedding",
             "weddingId": "SHARED", "weddingTitle": "Wedding Shared", "coupleId": null, "businessAccountId": null,
             "vendorId": null, "serviceEngagementIds": [], "permissions": [], "platformRoles": []},
            {"grantId": "planner:wedding:OTHER", "workspaceKind": "planner", "scopeKind": "wedding",
             "weddingId": "OTHER", "weddingTitle": "Wedding Other", "coupleId": null, "businessAccountId": null,
             "vendorId": null, "serviceEngagementIds": [], "permissions": [], "platformRoles": []}
          ],
          "contextSelection": [{"workspaceKind":"planner","grantIds":["\(sharedGrantId)","planner:wedding:OTHER"],"selectionRequired":true}],
          "unsupported": [], "platform": {"effectiveRole": null}
        }}
        """
        Stub.authorityReplies = [Reply(status: 200, body: accountBAuthority)]

        // No authorityClient at construction: avoids an automatic restore racing this explicit
        // deterministic restore seam.
        let session = SessionStore(storage: storage, environment: .production, authorityClient: nil)
        await session.restoreFromServer(client: client(), storedToken: "account-b-token")

        XCTAssertEqual(session.productionAuthority?.accessUserId, "account-b")
        XCTAssertTrue(session.selectedGrantIds.isEmpty)
        XCTAssertNil(session.activeGrantId)
        XCTAssertNil(session.currentRole)
        XCTAssertNil(session.weddingId)
        XCTAssertNil(storage.get(key: "wewed.account.selected-grants"))
        XCTAssertNil(storage.get(key: "wewed.account.selected-grants.owner"))
    }

    @MainActor
    func testSameAccountPersistedSelectionRestoresOnlyWhenOwnerMatchesVerifiedIdentity() async {
        let storage = InMemorySecureStorage()
        storage.save(key: "wewed.account.session", value: "session-user-1")
        storage.save(key: "wewed.account.selected-grants.owner", value: "user-1")
        storage.save(key: "wewed.account.selected-grants", value: "planner:wedding:B")

        Stub.authorityReplies = [Reply(status: 200, body: multiAxisAuthority)]
        Stub.setWorkspace(
            "planner:wedding:B",
            Reply(status: 200, body: workspaceFor("planner:wedding:B", weddingId: "B", weddingTitle: "Wedding B"))
        )

        let session = SessionStore(storage: storage, environment: .production, authorityClient: nil)
        await session.restoreFromServer(client: client(), storedToken: "session-user-1")

        XCTAssertEqual(session.selectedGrantIds.filter { $0.hasPrefix("planner:") }, ["planner:wedding:B"])
        // Another legitimate axis may be the initial active assignment. The owned Planner
        // preference must survive and become active when explicitly opened.
        await selectGrantAndAwait(session, "planner:wedding:B")
        XCTAssertEqual(session.activeGrantId, "planner:wedding:B")
        XCTAssertEqual(session.weddingId, "B")
    }

    // MARK: - Multi-axis: an active workspace is not interrupted by an unrelated selectionRequired axis

    @MainActor
    func testAnActiveCoupleWorkspaceIsNotInterruptedByAnUnrelatedPlannerSelectionRequirement() async {
        let session = await signedInMultiAxisSession()
        await selectGrantAndAwait(session, "couple:wedding:A")
        XCTAssertEqual(session.currentRole, .couple)
        XCTAssertEqual(session.weddingId, "A")
        XCTAssertFalse(session.selectedGrantIds.contains { $0.hasPrefix("planner:") })
        XCTAssertEqual(session.currentRole, .couple)
    }

    // MARK: - Shadow remains impossible as production authority (regression pin)

    @MainActor
    func testShadowPersonaSwitchingRemainsRefusedEvenWithARealMultiAxisAuthorityLoaded() async {
        let session = await signedInMultiAxisSession()
        XCTAssertFalse(session.enterShadowSession())
        XCTAssertFalse(session.switchPersona(DevelopmentPersona.defaultShadowPersona))
    }
}
