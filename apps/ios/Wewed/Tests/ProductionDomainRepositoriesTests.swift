import XCTest
@testable import WewedKit

/// Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8.
///
/// `ProductionWeddingRepository`/`ProductionPlannerDashboardRepository`/
/// `ProductionAdminSystemRepository` against a `URLProtocol` stub, mirroring the established pattern
/// in `SessionStoreAccountAuthorityTests` (the Android sibling is `ProductionDomainRepositoriesTest`).
/// Deterministic and offline: proves the repositories call the right `/api/native/...` paths with the
/// right `grantId`/bearer header, map real JSON into the existing native models without fabrication,
/// and fail closed (never fixture data) on a 401/403/5xx.
final class ProductionDomainRepositoriesTests: XCTestCase {

    private struct Reply { let status: Int; var body: String = "" }

    private final class Stub: URLProtocol, @unchecked Sendable {
        nonisolated(unsafe) static var routes: [String: Reply] = [:]
        nonisolated(unsafe) static var requestedPaths: [String] = []
        nonisolated(unsafe) static var requestedAuthorizationHeaders: [String?] = []
        nonisolated(unsafe) static var lastPatchBody: String?
        nonisolated(unsafe) static var defaultStatus = 503

        static func reset() {
            routes = [:]
            requestedPaths = []
            requestedAuthorizationHeaders = []
            lastPatchBody = nil
            defaultStatus = 503
        }

        override class func canInit(with request: URLRequest) -> Bool { true }
        override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

        override func startLoading() {
            let path = request.url?.path ?? ""
            Stub.requestedPaths.append("\(request.url?.absoluteString ?? "")")
            Stub.requestedAuthorizationHeaders.append(request.value(forHTTPHeaderField: "Authorization"))
            if request.httpMethod == "PATCH", let bodyData = request.httpBody ?? readBodyStream() {
                Stub.lastPatchBody = String(data: bodyData, encoding: .utf8)
            }
            let key = path.hasPrefix("/") ? String(path.dropFirst()) : path
            let reply = Stub.routes[key] ?? Reply(status: Stub.defaultStatus)
            let response = HTTPURLResponse(
                url: request.url!, statusCode: reply.status, httpVersion: "HTTP/1.1",
                headerFields: ["Content-Type": "application/json"]
            )!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: Data(reply.body.utf8))
            client?.urlProtocolDidFinishLoading(self)
        }

        override func stopLoading() {}

        private func readBodyStream() -> Data? {
            guard let stream = request.httpBodyStream else { return nil }
            stream.open()
            defer { stream.close() }
            var data = Data()
            let bufferSize = 4096
            var buffer = [UInt8](repeating: 0, count: bufferSize)
            while stream.hasBytesAvailable {
                let read = stream.read(&buffer, maxLength: bufferSize)
                if read <= 0 { break }
                data.append(buffer, count: read)
            }
            return data
        }
    }

    private let grantId = "planner:wedding:wed-1"
    private let token = "test-session-token"

    private func client() -> NativeDomainApiClient {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [Stub.self]
        return NativeDomainApiClient(baseURL: URL(string: "https://wewed.pro")!, session: URLSession(configuration: configuration))
    }

    override func setUp() {
        super.setUp()
        Stub.reset()
    }

    func testGetWeddingAndGetTasksCallTheRealEndpointsWithGrantIdAndBearerHeader() async throws {
        Stub.routes["api/native/wedding/overview"] = Reply(status: 200, body: """
            {"success":true,"scopeKind":"wedding","wedding":{"id":"wed-1","slug":"w","title":"T","date":"2027-01-01T00:00:00.000Z","venue":"V","lifecycle":"before","coupleNames":"A & B"},"counts":{}}
            """)
        Stub.routes["api/native/wedding/timeline"] = Reply(status: 200, body: #"{"success":true,"count":0,"data":[]}"#)
        Stub.routes["api/native/wedding/tasks"] = Reply(status: 200, body: """
            {"success":true,"count":1,"data":[{"id":"task-1","title":"Book venue","description":null,"category":"venue","status":"todo","priority":"high","dueDate":null,"assignee":null,"assigneeUserId":null,"order":0,"weddingId":"wed-1"}]}
            """)
        let repo = ProductionWeddingRepository(client: client(), sessionToken: token, grantId: grantId, weddingId: "wed-1")

        let wedding = try await repo.getWedding(weddingId: "wed-1")
        XCTAssertEqual(wedding.coupleNames, "A & B")

        let tasks = try await repo.getTasks(weddingId: "wed-1")
        XCTAssertEqual(tasks.count, 1)
        XCTAssertEqual(tasks[0].title, "Book venue")
        XCTAssertEqual(tasks[0].status, .todo)
        XCTAssertEqual(tasks[0].priority, .high)

        var expectedGrantIdQuery = URLComponents()
        expectedGrantIdQuery.queryItems = [URLQueryItem(name: "grantId", value: grantId)]
        let expectedQuery = expectedGrantIdQuery.percentEncodedQuery ?? "grantId=\(grantId)"
        XCTAssertTrue(Stub.requestedPaths.allSatisfy { $0.contains(expectedQuery) })
        XCTAssertTrue(Stub.requestedAuthorizationHeaders.allSatisfy { $0 == "Bearer \(token)" })
    }

    func testToggleTaskFlipsDoneToTodoAndTodoToDoneViaPatch() async throws {
        Stub.routes["api/native/wedding/tasks"] = Reply(status: 200, body: """
            {"success":true,"count":1,"data":[{"id":"task-1","title":"Book venue","description":null,"category":"venue","status":"todo","priority":"high","dueDate":null,"assignee":null,"assigneeUserId":null,"order":0,"weddingId":"wed-1"}]}
            """)
        Stub.routes["api/native/wedding/tasks/task-1"] = Reply(status: 200, body: """
            {"success":true,"data":{"id":"task-1","title":"Book venue","description":null,"category":"venue","status":"done","priority":"high","dueDate":null,"assignee":null,"assigneeUserId":null,"order":0,"weddingId":"wed-1"}}
            """)
        let repo = ProductionWeddingRepository(client: client(), sessionToken: token, grantId: grantId, weddingId: "wed-1")

        let updated = try await repo.toggleTask(weddingId: "wed-1", taskId: "task-1")
        XCTAssertEqual(updated.status, .done)
        XCTAssertTrue(Stub.lastPatchBody?.contains("\"status\":\"done\"") == true)
    }

    func testWeddingDayOperationalMethodsRemainFailClosedOnTheProductionAdapter() async {
        let repo = ProductionWeddingRepository(client: client(), sessionToken: token, grantId: grantId, weddingId: "wed-1")
        do {
            _ = try await repo.checkInGuest(weddingId: "wed-1", qrPayload: "qr", count: 1, usherId: "usher-1")
            XCTFail("checkInGuest must remain fail-closed")
        } catch is ProductionReadOnlyDomainError {
            // Expected.
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }

        // Wedding-Day vendor presence / announcements / audit are honest-empty, not thrown, so the
        // shared WeddingGraphState loader (rememberWeddingGraph equivalent) never crashes for a
        // wedding this phase DID wire (Tasks/Budget/Guests) just because these unrelated fields are
        // unavailable.
        let vendors = try? await repo.getVendors(weddingId: "wed-1")
        let announcements = try? await repo.getAnnouncements(weddingId: "wed-1")
        let auditRecords = try? await repo.getAuditRecords(weddingId: "wed-1")
        XCTAssertEqual(vendors, [])
        XCTAssertEqual(announcements, [])
        XCTAssertEqual(auditRecords, [])
    }

    func testA401FromAnyEndpointNeverReturnsFixtureShapedData() async {
        Stub.routes["api/native/wedding/tasks"] = Reply(status: 401, body: #"{"success":false}"#)
        let repo = ProductionWeddingRepository(client: client(), sessionToken: token, grantId: grantId, weddingId: "wed-1")
        do {
            _ = try await repo.getTasks(weddingId: "wed-1")
            XCTFail("Expected getTasks to throw on 401, never return data")
        } catch is ProductionReadOnlyDomainError {
            // Expected.
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
    }

    func testDomainClientDistinguishesPermissionMissingRevocationAndInvalidSession() async {
        var sessionInvalid = 0
        var revoked: [String] = []
        let grant = "planner:wedding:wed-1"

        func makeClient(status: Int, body: String) -> NativeDomainApiClient {
            Stub.reset()
            Stub.routes["api/native/wedding/tasks"] = Reply(status: status, body: body)
            let configuration = URLSessionConfiguration.ephemeral
            configuration.protocolClasses = [Stub.self]
            return NativeDomainApiClient(
                baseURL: URL(string: "https://wewed.pro")!,
                session: URLSession(configuration: configuration),
                onSessionInvalid: { sessionInvalid += 1 },
                onGrantRevoked: { revoked.append($0) }
            )
        }

        let permission = await makeClient(
            status: 403,
            body: #"{"success":false,"code":"PERMISSION_DENIED"}"#
        ).tasks(sessionToken: token, grantId: grant)
        if case .forbidden = permission {} else { XCTFail("Permission denial must not revoke the grant") }
        XCTAssertTrue(revoked.isEmpty)

        let missing = await makeClient(
            status: 404,
            body: #"{"success":false,"error":"Task not found"}"#
        ).tasks(sessionToken: token, grantId: grant)
        if case .transport(status: 404) = missing {} else { XCTFail("Resource-level 404 must not revoke the grant") }
        XCTAssertTrue(revoked.isEmpty)

        let revokedFetch = await makeClient(
            status: 403,
            body: #"{"success":false,"code":"GRANT_REVOKED"}"#
        ).tasks(sessionToken: token, grantId: grant)
        if case .grantRevoked = revokedFetch {} else { XCTFail("Explicit grant revocation must be preserved") }
        XCTAssertEqual(revoked, [grant])

        let invalid = await makeClient(
            status: 401,
            body: #"{"success":false,"code":"SESSION_INVALID"}"#
        ).tasks(sessionToken: token, grantId: grant)
        if case .sessionInvalid = invalid {} else { XCTFail("401 must remain a session-invalid signal") }
        XCTAssertEqual(sessionInvalid, 1)
    }

    func testLivePlannerDomainFailureThrowsInsteadOfMasqueradingAsEmptyData() async {
        Stub.routes["api/native/wedding/budget"] = Reply(status: 503, body: #"{"success":false}"#)
        let repo = ProductionPlannerDashboardRepository(client: client(), sessionToken: token, grantId: grantId)
        do {
            _ = try await repo.getBudgetLines()
            XCTFail("Expected live budget failure to throw instead of returning an empty list")
        } catch is ProductionReadOnlyDomainError {
            // Expected.
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
    }

    func testGetBudgetLinesAndGetSeatingTablesAndGetTimelineEntriesAndGetVendorEngagementsMapRealRows() async throws {
        Stub.routes["api/native/wedding/budget"] = Reply(status: 200, body: """
            {"success":true,"count":1,"data":[{"id":"b1","category":"venue","description":"Venue","estimatedCost":1000.0,"actualCost":1000.0,"paidAmount":200.0,"currency":"USD","vendorId":null,"vendorName":null,"notes":null,"dueDate":null,"serviceEngagementId":null,"weddingId":"wed-1"}],"totals":{"currency":"USD","totalEstimated":1000.0,"totalActual":1000.0,"totalPaid":200.0,"categories":[{"category":"venue","estimated":1000.0,"actual":1000.0,"paid":200.0,"count":1}]}}
            """)
        Stub.routes["api/native/wedding/seating"] = Reply(status: 200, body: """
            {"success":true,"count":1,"data":[{"id":"t1","name":"Table 1","capacity":10,"assigned":8,"guests":[]}]}
            """)
        Stub.routes["api/native/wedding/timeline"] = Reply(status: 200, body: """
            {"success":true,"count":1,"data":[{"id":"p1","time":"14:00","title":"Ceremony","description":null,"location":"Chapel","order":0}]}
            """)
        Stub.routes["api/native/wedding/vendors"] = Reply(status: 200, body: """
            {"success":true,"count":1,"data":[{"id":"v1","name":"Shandy Events","category":"decor","contractStatus":"signed","paymentStatus":"paid","notes":null}]}
            """)
        let repo = ProductionPlannerDashboardRepository(client: client(), sessionToken: token, grantId: grantId)

        let budgetLines = try await repo.getBudgetLines()
        XCTAssertEqual(budgetLines.count, 1)
        XCTAssertEqual(budgetLines[0].category, "venue")
        XCTAssertEqual(budgetLines[0].estimated, 1000.0, accuracy: 0.001)

        let seating = try await repo.getSeatingTables()
        XCTAssertEqual(seating.count, 1)
        XCTAssertEqual(seating[0].assigned, 8)
        XCTAssertEqual(seating[0].attentionLabel, "2 seats free")

        let timeline = try await repo.getTimelineEntries()
        XCTAssertEqual(timeline[0].title, "Ceremony")

        let vendors = try await repo.getVendorEngagements()
        XCTAssertEqual(vendors[0].vendorName, "Shandy Events")
        XCTAssertEqual(vendors[0].contractStatus, "signed")
    }

    func testContributionsAndDocumentsAreHonestEmptyNeverFabricated() async throws {
        let repo = ProductionPlannerDashboardRepository(client: client(), sessionToken: token, grantId: grantId)
        let contributions = try await repo.getContributions()
        let documents = try await repo.getDocuments()
        XCTAssertTrue(contributions.isEmpty)
        XCTAssertTrue(documents.isEmpty)
    }

    func testGetDashboardNeverFabricatesAWeddingForAPortfolioGrant() async throws {
        Stub.routes["api/native/wedding/overview"] = Reply(status: 200, body: """
            {"success":true,"scopeKind":"portfolio","businessAccountId":"biz-1","businessName":"Eleven Eleven","wedding":null,"counts":null}
            """)
        let repo = ProductionPlannerDashboardRepository(client: client(), sessionToken: token, grantId: "planner:portfolio:biz-1")

        let dashboard = try await repo.getDashboard()
        XCTAssertEqual(dashboard.weddingId, "biz-1")
        XCTAssertEqual(dashboard.coupleNames, "Eleven Eleven")
        XCTAssertFalse(dashboard.sourceLabel.lowercased().contains("shadow"))
        XCTAssertFalse(dashboard.sourceLabel.lowercased().contains("fixture"))
    }

    func testProductionAdminSystemRepositorySurfacesARealPendingOnboardingCount() async {
        Stub.routes["api/native/admin/overview"] = Reply(status: 200, body: """
            {"success":true,"scopeKind":"system","platformRoles":["wewed_super_admin"],"counts":{"pendingOnboarding":3}}
            """)
        let repo = ProductionAdminSystemRepository(client: client(), sessionToken: token, grantId: "admin:system")

        let snapshot = await repo.snapshot()
        XCTAssertEqual(snapshot.pendingOnboardingCount, 3)
        XCTAssertFalse(snapshot.unsupportedStreams.isEmpty)
    }

    func testProductionAdminSystemRepositoryReportsNilNotZeroWhenTheCallFails() async {
        let repo = ProductionAdminSystemRepository(client: client(), sessionToken: token, grantId: "admin:system")
        let snapshot = await repo.snapshot()
        XCTAssertNil(snapshot.pendingOnboardingCount)
    }
}
