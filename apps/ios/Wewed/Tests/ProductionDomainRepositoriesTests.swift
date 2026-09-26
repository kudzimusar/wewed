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
        final class CallbackRecorder: @unchecked Sendable {
            private let lock = NSLock()
            private var invalidCount = 0
            private var revokedGrantIds: [String] = []

            func recordInvalid() {
                lock.lock()
                invalidCount += 1
                lock.unlock()
            }

            func recordRevoked(_ grantId: String) {
                lock.lock()
                revokedGrantIds.append(grantId)
                lock.unlock()
            }

            func snapshot() -> (Int, [String]) {
                lock.lock()
                defer { lock.unlock() }
                return (invalidCount, revokedGrantIds)
            }
        }

        let recorder = CallbackRecorder()
        let grant = "planner:wedding:wed-1"

        func makeClient(status: Int, body: String) -> NativeDomainApiClient {
            Stub.reset()
            Stub.routes["api/native/wedding/tasks"] = Reply(status: status, body: body)
            let configuration = URLSessionConfiguration.ephemeral
            configuration.protocolClasses = [Stub.self]
            return NativeDomainApiClient(
                baseURL: URL(string: "https://wewed.pro")!,
                session: URLSession(configuration: configuration),
                onSessionInvalid: { recorder.recordInvalid() },
                onGrantRevoked: { recorder.recordRevoked($0) }
            )
        }

        let permission = await makeClient(
            status: 403,
            body: #"{"success":false,"code":"PERMISSION_DENIED"}"#
        ).tasks(sessionToken: token, grantId: grant)
        if case .forbidden = permission {} else { XCTFail("Permission denial must not revoke the grant") }
        XCTAssertTrue(recorder.snapshot().1.isEmpty)

        let missing = await makeClient(
            status: 404,
            body: #"{"success":false,"error":"Task not found"}"#
        ).tasks(sessionToken: token, grantId: grant)
        if case .transport(status: 404) = missing {} else { XCTFail("Resource-level 404 must not revoke the grant") }
        XCTAssertTrue(recorder.snapshot().1.isEmpty)

        let revokedFetch = await makeClient(
            status: 403,
            body: #"{"success":false,"code":"GRANT_REVOKED"}"#
        ).tasks(sessionToken: token, grantId: grant)
        if case .grantRevoked = revokedFetch {} else { XCTFail("Explicit grant revocation must be preserved") }
        XCTAssertEqual(recorder.snapshot().1, [grant])

        let invalid = await makeClient(
            status: 401,
            body: #"{"success":false,"code":"SESSION_INVALID"}"#
        ).tasks(sessionToken: token, grantId: grant)
        if case .sessionInvalid = invalid {} else { XCTFail("401 must remain a session-invalid signal") }
        XCTAssertEqual(recorder.snapshot().0, 1)
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

    func testDocumentsMapsRealRowsFromTheSameVaultCatalogThePWAUsesAndThrowsOnLiveFailure() async throws {
        Stub.routes["api/native/wedding/vault"] = Reply(status: 200, body: """
            {"success":true,"count":1,"data":[{"id":"doc-1","displayName":"Venue contract.pdf","category":"wedding_document","available":true}]}
            """)
        let repo = ProductionPlannerDashboardRepository(client: client(), sessionToken: token, grantId: grantId)
        let documents = try await repo.getDocuments()
        XCTAssertEqual(documents.count, 1)
        XCTAssertEqual(documents[0].title, "Venue contract.pdf")
        XCTAssertEqual(documents[0].kind, "wedding_document")
        XCTAssertNil(documents[0].statusLabel)

        Stub.reset()
        let failingRepo = ProductionPlannerDashboardRepository(client: client(), sessionToken: token, grantId: grantId)
        do {
            _ = try await failingRepo.getDocuments()
            XCTFail("Expected a live Documents/Vault failure to throw instead of returning an empty list")
        } catch is ProductionReadOnlyDomainError {
            // Expected — matches the same "live failure never masquerades as empty" rule as Budget/Contributions.
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
    }

    /// Master plan Phase 8 closure round 3 §2 — the exact 5-outcome matrix the moderator asked for,
    /// for BOTH Documents and Contributions: successful data (covered by the mapping test above),
    /// successful empty (an authoritative EMPTY, not a failure), transport failure, permission
    /// denial, and grant revocation (both of the latter two are still live-domain failures at this
    /// repository layer — the UI-level `ProductionLoadView`/`ProductionLoadState` in
    /// `RoleWorkspaceContent.swift` is what turns "the repository threw" into a distinct Unavailable
    /// render, so proving every one of these five HTTP outcomes maps to the correct success-vs-throw
    /// contract here is what makes that UI-level distinction trustworthy).
    func testDocuments_SuccessfulEmptyTransportFailurePermissionDenialAndGrantRevocationAreEachHandledCorrectly() async throws {
        func documentsFor(_ reply: Reply) async throws -> [PlannerDocumentRecord] {
            Stub.reset()
            Stub.routes["api/native/wedding/vault"] = reply
            return try await ProductionPlannerDashboardRepository(client: client(), sessionToken: token, grantId: grantId).getDocuments()
        }

        // Successful empty: a real 200 with a genuinely empty array is NOT a failure.
        let empty = try await documentsFor(Reply(status: 200, body: #"{"success":true,"count":0,"data":[]}"#))
        XCTAssertTrue(empty.isEmpty)

        let failureCases: [(String, Reply)] = [
            ("transport failure (5xx)", Reply(status: 503, body: #"{"success":false,"error":"Service unavailable"}"#)),
            ("permission denial (403 PERMISSION_DENIED)", Reply(status: 403, body: #"{"success":false,"code":"PERMISSION_DENIED","error":"Forbidden"}"#)),
            ("grant revocation (403 GRANT_REVOKED)", Reply(status: 403, body: #"{"success":false,"code":"GRANT_REVOKED","error":"revoked"}"#)),
        ]
        for (label, reply) in failureCases {
            do {
                _ = try await documentsFor(reply)
                XCTFail("Expected \(label) to throw instead of returning data or an empty list")
            } catch is ProductionReadOnlyDomainError {
                // Expected for all three — the UI layer, not this repository, is what shows a uniform
                // "unavailable" state for any of them; this repository must never let one masquerade
                // as the successful-empty case proven above.
            } catch {
                XCTFail("Unexpected error type for \(label): \(error)")
            }
        }
    }

    func testContributionsMapsRealRowsFromTheSameEngineThePWAUsesAndThrowsOnLiveFailure() async throws {
        Stub.routes["api/native/wedding/contributions"] = Reply(status: 200, body: """
            {"success":true,"count":1,"data":[{"id":"contrib-1","weddingId":"wed-1","type":"CASH_TO_COUPLE","amount":500.0,"commitmentState":"CONFIRMED","fulfillmentState":"RECEIVED","verificationState":"RECONCILED","allocatedAmount":250.0,"contributor":{"displayName":"Aunt Grace"}}],"summaryByCurrency":{},"counts":{}}
            """)
        let repo = ProductionPlannerDashboardRepository(client: client(), sessionToken: token, grantId: grantId)
        let contributions = try await repo.getContributions()
        XCTAssertEqual(contributions.count, 1)
        XCTAssertEqual(contributions[0].contributorLabel, "Aunt Grace")
        XCTAssertEqual(contributions[0].typeLabel, "Cash to couple")
        XCTAssertEqual(contributions[0].value, 500.0, accuracy: 0.001)
        XCTAssertTrue(contributions[0].verified)
        XCTAssertTrue(contributions[0].allocationLabel.contains("Allocated"))

        Stub.reset()
        let failingRepo = ProductionPlannerDashboardRepository(client: client(), sessionToken: token, grantId: grantId)
        do {
            _ = try await failingRepo.getContributions()
            XCTFail("Expected a live Contributions failure to throw instead of returning an empty list")
        } catch is ProductionReadOnlyDomainError {
            // Expected — matches the same "live failure never masquerades as empty" rule as Budget.
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
    }

    /// Master plan Phase 8 closure round 3 §2 — same 5-outcome matrix as Documents, for Contributions.
    func testContributions_SuccessfulEmptyTransportFailurePermissionDenialAndGrantRevocationAreEachHandledCorrectly() async throws {
        func contributionsFor(_ reply: Reply) async throws -> [PlannerContributionRecord] {
            Stub.reset()
            Stub.routes["api/native/wedding/contributions"] = reply
            return try await ProductionPlannerDashboardRepository(client: client(), sessionToken: token, grantId: grantId).getContributions()
        }

        let empty = try await contributionsFor(Reply(status: 200, body: #"{"success":true,"count":0,"data":[],"summaryByCurrency":{},"counts":{}}"#))
        XCTAssertTrue(empty.isEmpty)

        let failureCases: [(String, Reply)] = [
            ("transport failure (5xx)", Reply(status: 503, body: #"{"success":false,"error":"Service unavailable"}"#)),
            ("permission denial (403 PERMISSION_DENIED)", Reply(status: 403, body: #"{"success":false,"code":"PERMISSION_DENIED","error":"Forbidden"}"#)),
            ("grant revocation (403 GRANT_REVOKED)", Reply(status: 403, body: #"{"success":false,"code":"GRANT_REVOKED","error":"revoked"}"#)),
        ]
        for (label, reply) in failureCases {
            do {
                _ = try await contributionsFor(reply)
                XCTFail("Expected \(label) to throw instead of returning data or an empty list")
            } catch is ProductionReadOnlyDomainError {
                // Expected.
            } catch {
                XCTFail("Unexpected error type for \(label): \(error)")
            }
        }
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

    func testProductionAdminSystemRepositorySurfacesARealPendingOnboardingCount() async throws {
        Stub.routes["api/native/admin/overview"] = Reply(status: 200, body: """
            {"success":true,"scopeKind":"system","platformRoles":["wewed_super_admin"],"counts":{"pendingOnboarding":3}}
            """)
        let repo = ProductionAdminSystemRepository(client: client(), sessionToken: token, grantId: "admin:system")

        let snapshot = try await repo.snapshot()
        XCTAssertEqual(snapshot.pendingOnboardingCount, 3)
        XCTAssertFalse(snapshot.unsupportedStreams.isEmpty)
    }

    /// Master plan Phase 8 closure round 3 §2/§7, hardened round 4 §1 — the moderator explicitly
    /// distinguished "a bound repository's live call just failed" from "not yet bound"
    /// (`ProductionRepositoryUnbound`, `AppStateProductionAdminTests`). This replaces the old
    /// `testProductionAdminSystemRepositoryReportsNilNotZeroWhenTheCallFails`, whose premise (a
    /// nulled-out/empty snapshot on failure) is no longer true for the PRODUCTION adapter.
    func testProductionAdminSystemRepositoryThrowsOnALiveFailureNeverASilentlyNulledOutSnapshot() async {
        let repo = ProductionAdminSystemRepository(client: client(), sessionToken: token, grantId: "admin:system")
        do {
            _ = try await repo.snapshot()
            XCTFail("Expected a live Admin overview failure to throw instead of returning a nulled-out snapshot")
        } catch is ProductionReadOnlyDomainError {
            // Expected.
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
    }

    /// Master plan Phase 8 closure round 3 §2 — the same 5-outcome matrix as Documents/Contributions,
    /// for the Admin overview: successful data (covered by the mapping test below), successful empty,
    /// transport failure, permission denial, and grant revocation.
    func testAdminOverview_SuccessfulEmptyTransportFailurePermissionDenialAndGrantRevocationAreEachHandledCorrectly() async throws {
        func snapshotFor(_ reply: Reply) async throws -> AdminSystemSnapshot {
            Stub.reset()
            Stub.routes["api/native/admin/overview"] = reply
            return try await ProductionAdminSystemRepository(client: client(), sessionToken: token, grantId: "admin:system").snapshot()
        }

        let empty = try await snapshotFor(Reply(status: 200, body: """
            {"success":true,"scopeKind":"system","platformRoles":["wewed_support_admin"],"counts":{"pendingOnboarding":0},"summary":{"businessAccounts":0},"accounts":[],"supportCases":[],"incidents":[]}
            """))
        XCTAssertEqual(empty.pendingOnboardingCount, 0)
        XCTAssertEqual(empty.businessAccountsTotal, 0)
        XCTAssertTrue(empty.accounts.isEmpty)

        let failureCases: [(String, Reply)] = [
            ("transport failure (5xx)", Reply(status: 503, body: #"{"success":false,"error":"Service unavailable"}"#)),
            ("permission denial (403 PERMISSION_DENIED)", Reply(status: 403, body: #"{"success":false,"code":"PERMISSION_DENIED","error":"Forbidden"}"#)),
            ("grant revocation (403 GRANT_REVOKED)", Reply(status: 403, body: #"{"success":false,"code":"GRANT_REVOKED","error":"revoked"}"#)),
        ]
        for (label, reply) in failureCases {
            do {
                _ = try await snapshotFor(reply)
                XCTFail("Expected \(label) to throw instead of returning a nulled-out snapshot")
            } catch is ProductionReadOnlyDomainError {
                // Expected.
            } catch {
                XCTFail("Unexpected error type for \(label): \(error)")
            }
        }
    }

    func testProductionAdminSystemRepositoryMapsRealSummaryAccountsSupportCasesAndIncidentsFromTheSameLoadAdminOverviewThePWAUses() async throws {
        Stub.routes["api/native/admin/overview"] = Reply(status: 200, body: """
            {
              "success": true, "scopeKind": "system", "platformRoles": ["wewed_super_admin"],
              "counts": {"pendingOnboarding": 3},
              "summary": {"businessAccounts": 42, "activeAccounts": 30, "pendingReviewAccounts": 5, "openSupportCases": 2, "openIncidents": 1},
              "accounts": [{"id": "biz-1", "name": "Eleven Eleven", "type": "planning_company", "status": "active", "onboardingStatus": "complete", "riskFlags": ["billing_attention"]}],
              "supportCases": [{"id": "case-1", "title": "Cannot upload logo", "status": "open", "priority": "urgent", "businessAccountName": "Eleven Eleven"}],
              "incidents": [{"id": "incident-1", "title": "Elevated API latency", "status": "monitoring", "severity": "minor"}]
            }
            """)
        let repo = ProductionAdminSystemRepository(client: client(), sessionToken: token, grantId: "admin:system")
        let snapshot = try await repo.snapshot()

        XCTAssertEqual(snapshot.businessAccountsTotal, 42)
        XCTAssertEqual(snapshot.activeAccountsTotal, 30)
        XCTAssertEqual(snapshot.pendingReviewAccountsTotal, 5)
        XCTAssertEqual(snapshot.openSupportCasesTotal, 2)
        XCTAssertEqual(snapshot.openIncidentsTotal, 1)

        XCTAssertEqual(snapshot.accounts.count, 1)
        XCTAssertEqual(snapshot.accounts[0].name, "Eleven Eleven")
        XCTAssertEqual(snapshot.accounts[0].riskFlags, ["billing_attention"])

        XCTAssertEqual(snapshot.supportCases.count, 1)
        XCTAssertEqual(snapshot.supportCases[0].title, "Cannot upload logo")
        XCTAssertEqual(snapshot.supportCases[0].priority, "urgent")

        XCTAssertEqual(snapshot.incidents.count, 1)
        XCTAssertEqual(snapshot.incidents[0].title, "Elevated API latency")

        // The two now-connected streams no longer appear in the honest unsupported list.
        XCTAssertFalse(snapshot.unsupportedStreams.contains { $0.localizedCaseInsensitiveContains("Full overview") })
        XCTAssertFalse(snapshot.unsupportedStreams.contains { $0.localizedCaseInsensitiveContains("Client operations") })
        XCTAssertTrue(snapshot.unsupportedStreams.contains { $0.localizedCaseInsensitiveContains("Bookings") })
    }

    /// Master plan Phase 8 closure round 3 §3 — Contracts, reusing the mature engagement-list engine.
    func testProductionContractsRepositoryMapsRealEngagementAndContractRowsAndThrowsOnLiveFailure() async throws {
        Stub.routes["api/native/wedding/engagements"] = Reply(status: 200, body: """
            {"success":true,"count":1,"data":[{"id":"eng-1","serviceCategory":"photography","lifecycleStatus":"effective","agreedAmount":"2500.00","currency":"USD","vendor":{"name":"Shandy Events"},"contracts":[{"id":"con-1","contractNumber":"WW-0001","status":"ISSUED","currentVersionNumber":2}]}]}
            """)
        let repo = ProductionContractsRepository(client: client(), sessionToken: token, grantId: grantId)
        let engagements = try await repo.getServiceEngagements()
        XCTAssertEqual(engagements.count, 1)
        XCTAssertEqual(engagements[0].vendorName, "Shandy Events")
        XCTAssertEqual(engagements[0].agreedAmount, "2500.00")
        XCTAssertEqual(engagements[0].contracts.count, 1)
        XCTAssertEqual(engagements[0].contracts[0].contractNumber, "WW-0001")
        XCTAssertEqual(engagements[0].contracts[0].currentVersionNumber, 2)

        let failureCases: [(String, Reply)] = [
            ("transport failure", Reply(status: 503, body: #"{"success":false}"#)),
            ("permission denial", Reply(status: 403, body: #"{"success":false,"code":"PERMISSION_DENIED"}"#)),
            ("grant revocation", Reply(status: 403, body: #"{"success":false,"code":"GRANT_REVOKED"}"#)),
        ]
        for (label, reply) in failureCases {
            Stub.reset()
            Stub.routes["api/native/wedding/engagements"] = reply
            let failingRepo = ProductionContractsRepository(client: client(), sessionToken: token, grantId: grantId)
            do {
                _ = try await failingRepo.getServiceEngagements()
                XCTFail("Expected \(label) to throw instead of returning data or an empty list")
            } catch is ProductionReadOnlyDomainError {
                // Expected.
            } catch {
                XCTFail("Unexpected error type for \(label): \(error)")
            }
        }
    }

    /// Master plan Phase 8 closure round 3 §6 — the Vendor's own engagement, reusing the same Deal Room engine.
    func testProductionVendorEngagementRepositoryMapsTheVendorsOwnEngagementAndThrowsOnLiveFailure() async throws {
        Stub.routes["api/native/vendor/engagement"] = Reply(status: 200, body: """
            {"success":true,"engagementIds":["eng-1"],"data":{"id":"eng-1","weddingId":"wed-1","serviceCategory":"catering","lifecycleStatus":"effective","agreedAmount":"4200.00","currency":"USD","contracts":[{"id":"con-2","contractNumber":"WW-0002","status":"AWAITING_ACCEPTANCE","currentVersionNumber":1}]}}
            """)
        let repo = ProductionVendorEngagementRepository(client: client(), sessionToken: token, grantId: "vendor:wedding:biz-1:vendor-1")
        let engagement = try await repo.getMyEngagement()
        XCTAssertEqual(engagement.id, "eng-1")
        XCTAssertEqual(engagement.weddingId, "wed-1")
        XCTAssertEqual(engagement.serviceCategory, "catering")
        XCTAssertEqual(engagement.contracts.count, 1)
        XCTAssertEqual(engagement.contracts[0].status, "AWAITING_ACCEPTANCE")

        Stub.reset()
        let failingRepo = ProductionVendorEngagementRepository(client: client(), sessionToken: token, grantId: "vendor:wedding:biz-1:vendor-1")
        do {
            _ = try await failingRepo.getMyEngagement()
            XCTFail("Expected a live Vendor-engagement failure to throw instead of returning fabricated data")
        } catch is ProductionReadOnlyDomainError {
            // Expected.
        } catch {
            XCTFail("Unexpected error type: \(error)")
        }
    }

    /// Master plan Phase 8 closure round 4 §3 — the mature Deal Room, reachable from the native
    /// client for the first time this round. Reuses `getServiceEngagementDealRoom` verbatim
    /// server-side (`/api/native/wedding/engagements/{id}/deal-room`); this test proves the CLIENT
    /// side: opening engagement A loads exactly A's Deal Room (never fabricated, never another
    /// engagement's), and every non-success outcome (foreign engagement 404, permission denial,
    /// session-invalid, grant revocation) throws instead of returning an empty or
    /// partially-fabricated room.
    func testProductionContractsRepositoryGetDealRoomLoadsTheExactRequestedEngagementsDealRoomAndThrowsOnAnyLiveFailure() async throws {
        Stub.routes["api/native/wedding/engagements/eng-1/deal-room"] = Reply(status: 200, body: """
            {"success":true,"data":{
                "id":"eng-1","serviceCategory":"photography","serviceDescription":"Full day coverage",
                "agreedAmount":"2500.00","currency":"USD","serviceDate":"2026-11-14","serviceLocation":"Imba Manor",
                "lifecycleStatus":"effective",
                "vendor":{"id":"vendor-1","name":"Shandy Events","category":"photography","email":"hi@shandy.test","phone":null},
                "parties":[{"id":"party-1","partyRole":"vendor","displayName":"Shandy Events","email":"hi@shandy.test","phone":null,"requiredForReview":true}],
                "budgetItems":[{"id":"bi-1","description":"Deposit","estimatedCost":"1250.00","actualCost":"1250.00","paidAmount":"1250.00","currency":"USD"}],
                "payments":[{"id":"pay-1","amount":"1250.00","currency":"USD","paidAt":"2026-08-01T00:00:00.000Z","reference":"REF-1"}],
                "contracts":[{"id":"con-1","contractNumber":"WW-0001","status":"ISSUED","title":"Photography Agreement","currentVersionNumber":2,"issuedAt":"2026-08-01T00:00:00.000Z","versions":[{"id":"ver-1","versionNumber":2,"status":"ISSUED","issuedAt":"2026-08-01T00:00:00.000Z","createdAt":"2026-07-30T00:00:00.000Z"}]}],
                "documents":[{"id":"doc-1","displayName":"Signed contract","originalFilename":"contract.pdf","mimeType":"application/pdf","byteSize":1024,"storageState":"stored","scanState":"clean","createdAt":"2026-07-30T00:00:00.000Z"}]
            }}
            """)
        let repo = ProductionContractsRepository(client: client(), sessionToken: token, grantId: grantId)
        let dealRoom = try await repo.getDealRoom(engagementId: "eng-1")
        XCTAssertEqual(dealRoom.id, "eng-1")
        XCTAssertEqual(dealRoom.vendor.name, "Shandy Events")
        XCTAssertEqual(dealRoom.agreedAmount, "2500.00")
        XCTAssertEqual(dealRoom.parties.count, 1)
        XCTAssertTrue(dealRoom.parties[0].requiredForReview)
        XCTAssertEqual(dealRoom.contracts.count, 1)
        XCTAssertEqual(dealRoom.contracts[0].contractNumber, "WW-0001")
        XCTAssertEqual(dealRoom.contracts[0].versions.count, 1)
        XCTAssertEqual(dealRoom.budgetItems.count, 1)
        XCTAssertEqual(dealRoom.payments.count, 1)
        XCTAssertEqual(dealRoom.documents.count, 1)

        var expectedGrantIdQuery = URLComponents()
        expectedGrantIdQuery.queryItems = [URLQueryItem(name: "grantId", value: grantId)]
        let expectedQuery = expectedGrantIdQuery.percentEncodedQuery ?? "grantId=\(grantId)"
        let lastPath = try XCTUnwrap(Stub.requestedPaths.last)
        XCTAssertTrue(lastPath.contains("/api/native/wedding/engagements/eng-1/deal-room"))
        XCTAssertTrue(lastPath.contains(expectedQuery))

        let failureCases: [(String, Reply)] = [
            ("foreign engagement (404)", Reply(status: 404, body: #"{"success":false,"error":"Service engagement was not found."}"#)),
            ("permission denial", Reply(status: 403, body: #"{"success":false,"code":"PERMISSION_DENIED"}"#)),
            ("session invalid", Reply(status: 401, body: #"{"success":false}"#)),
            ("grant revocation", Reply(status: 403, body: #"{"success":false,"code":"GRANT_REVOKED"}"#)),
        ]
        for (label, reply) in failureCases {
            Stub.reset()
            Stub.routes["api/native/wedding/engagements/eng-1/deal-room"] = reply
            let failingRepo = ProductionContractsRepository(client: client(), sessionToken: token, grantId: grantId)
            do {
                _ = try await failingRepo.getDealRoom(engagementId: "eng-1")
                XCTFail("Expected \(label) to throw instead of returning data or a fabricated empty Deal Room")
            } catch is ProductionReadOnlyDomainError {
                // Expected.
            } catch {
                XCTFail("Unexpected error type for \(label): \(error)")
            }
        }
    }
}
