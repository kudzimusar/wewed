import XCTest
@testable import WewedKit

/// QRO05-PIQR01 — `ProductionWeddingRepository.loadPlannerInvitations` against a `URLProtocol` stub
/// (same pattern as `ProductionDomainRepositoriesTests`). Fixture links are synthetic placeholders,
/// never real invitation credentials.
final class PlannerInvitationsReaderTests: XCTestCase {

    private struct Reply { let status: Int; var body: String = "" }

    private final class Stub: URLProtocol, @unchecked Sendable {
        nonisolated(unsafe) static var routes: [String: Reply] = [:]
        nonisolated(unsafe) static var requests: [(method: String, url: String, auth: String?)] = []

        override class func canInit(with request: URLRequest) -> Bool { true }
        override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

        override func startLoading() {
            Stub.requests.append((request.httpMethod ?? "", request.url?.absoluteString ?? "",
                                  request.value(forHTTPHeaderField: "Authorization")))
            let path = String((request.url?.path ?? "").dropFirst())
            let reply = Stub.routes[path] ?? Reply(status: 503)
            let response = HTTPURLResponse(url: request.url!, statusCode: reply.status, httpVersion: "HTTP/1.1",
                                           headerFields: ["Content-Type": "application/json"])!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: Data(reply.body.utf8))
            client?.urlProtocolDidFinishLoading(self)
        }

        override func stopLoading() {}
    }

    private let invitationsPath = "api/native/wedding/invitations"
    private let physicalPath = "api/native/wedding/invitations/physical"

    private func repository() -> ProductionWeddingRepository {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [Stub.self]
        let client = NativeDomainApiClient(baseURL: URL(string: "https://wewed.pro")!, session: URLSession(configuration: configuration))
        return ProductionWeddingRepository(client: client, sessionToken: "test-session-token",
                                           grantId: "planner:wedding:wed-1", weddingId: "wed-1")
    }

    override func setUp() {
        super.setUp()
        Stub.routes = [:]
        Stub.requests = []
    }

    private let invitationsBody = """
    {"success":true,"count":4,"missingTokens":1,
     "wedding":{"slug":"fixture","title":"Fixture Wedding","invitationCardStyle":"ivory-floral-gold",
                "invitationCardMessage":"Join us","rsvpDeadline":"2026-11-01T00:00:00.000Z","childrenPolicy":"adults_only"},
     "data":[
      {"id":"g-attending","name":"Ada","tableNumber":4,"status":"attending","checkedIn":false,
       "invitationUrl":"https://fixture.invalid/one","qrValue":"https://fixture.invalid/one","shareMessage":"Hi Ada https://fixture.invalid/one"},
      {"id":"g-declined","name":"Ben","tableNumber":null,"status":"declined","checkedIn":false,
       "invitationUrl":"https://fixture.invalid/two","qrValue":"https://fixture.invalid/two","shareMessage":"Hi Ben https://fixture.invalid/two"},
      {"id":"g-pending","name":"Cy","tableNumber":3,"status":"pending","checkedIn":false,
       "invitationUrl":"https://fixture.invalid/three","qrValue":"https://fixture.invalid/three","shareMessage":"Hi Cy https://fixture.invalid/three"},
      {"id":"g-missing","name":"Di","tableNumber":null,"status":"pending","checkedIn":false,
       "invitationUrl":null,"qrValue":null,"shareMessage":null}
     ]}
    """

    private let configuredPhysical = """
    {"success":true,"configured":true,"code":"ABCD-EFGH-23","rawCode":"ABCDEFGH23",
     "accessUrl":"https://fixture.invalid/i/printed","scanCount":7,"invitedCount":4,"createdAt":null,
     "wedding":{"slug":"fixture","title":"Fixture Wedding"}}
    """

    private let unconfiguredPhysical = """
    {"success":true,"configured":false,"code":null,"rawCode":null,"accessUrl":null,"scanCount":0,"invitedCount":4,
     "createdAt":null,"wedding":{"slug":"fixture","title":"Fixture Wedding"}}
    """

    private func loaded(_ load: PlannerInvitationsLoad, file: StaticString = #filePath, line: UInt = #line) throws -> PlannerInvitationsSnapshot {
        guard case let .loaded(snapshot) = load else {
            XCTFail("expected loaded, got \(load)", file: file, line: line)
            throw XCTSkip("not loaded")
        }
        return snapshot
    }

    func testConfiguredSnapshotMapsDesignStatusesAndMissingLinks() async throws {
        Stub.routes[invitationsPath] = Reply(status: 200, body: invitationsBody)
        Stub.routes[physicalPath] = Reply(status: 200, body: configuredPhysical)

        let snapshot = try loaded(await repository().loadPlannerInvitations())

        XCTAssertEqual(snapshot.design.styleId, "ivory-floral-gold")
        XCTAssertEqual(snapshot.design.styleLabel, "Ivory Floral Gold")
        XCTAssertEqual(snapshot.design.message, "Join us")
        XCTAssertEqual(snapshot.design.childrenPolicyLabel, "Adults only")
        XCTAssertEqual(snapshot.guests.map(\.status), [.attending, .declined, .pending, .pending])
        XCTAssertEqual(snapshot.guests.map(\.tableLabel), ["Table 4", "No table", "Table 3", "No table"])
        XCTAssertEqual(snapshot.missingLinks, 1)
        XCTAssertFalse(snapshot.guests[3].hasInvitationLink)
        XCTAssertNil(snapshot.guests[3].shareMessage)
        XCTAssertEqual(snapshot.guests[0].qrValue, "https://fixture.invalid/one")
        XCTAssertTrue(snapshot.physical.configured)
        XCTAssertEqual(snapshot.physical.code, "ABCD-EFGH-23")
        XCTAssertEqual(snapshot.physical.accessUrl, "https://fixture.invalid/i/printed")
        XCTAssertEqual(snapshot.physical.scanCount, 7)
        XCTAssertEqual(snapshot.physical.invitedCount, 4)
    }

    func testUnconfiguredPrintedInvitationHasNoQrPayload() async throws {
        Stub.routes[invitationsPath] = Reply(status: 200, body: invitationsBody)
        Stub.routes[physicalPath] = Reply(status: 200, body: unconfiguredPhysical)

        let snapshot = try loaded(await repository().loadPlannerInvitations())
        XCTAssertFalse(snapshot.physical.configured)
        XCTAssertNil(snapshot.physical.accessUrl)
        XCTAssertEqual(snapshot.physical.invitedCount, 4)
    }

    func testReadsAreGetOnlyWithBearerAndGrant() async throws {
        Stub.routes[invitationsPath] = Reply(status: 200, body: invitationsBody)
        Stub.routes[physicalPath] = Reply(status: 200, body: configuredPhysical)
        _ = await repository().loadPlannerInvitations()

        XCTAssertEqual(Stub.requests.count, 2)
        for request in Stub.requests {
            XCTAssertEqual(request.method, "GET")
            XCTAssertEqual(request.auth, "Bearer test-session-token")
            XCTAssertTrue(request.url.contains("grantId=planner:wedding:wed-1") || request.url.contains("grantId=planner%3Awedding%3Awed-1"))
        }
        XCTAssertEqual(Set(Stub.requests.map { URL(string: $0.url)!.path }),
                       ["/api/native/wedding/invitations", "/api/native/wedding/invitations/physical"])
    }

    func testRefusalsAndTransportFailuresAreUnavailableNeverEmptyData() async {
        for (status, body) in [(401, "{}"), (403, #"{"code":"GRANT_REVOKED"}"#), (403, #"{"code":"FORBIDDEN"}"#), (503, "")] {
            Stub.routes[invitationsPath] = Reply(status: status, body: body)
            Stub.routes[physicalPath] = Reply(status: 200, body: configuredPhysical)
            guard case .unavailable = await repository().loadPlannerInvitations() else {
                return XCTFail("status \(status) must be unavailable")
            }
        }
    }

    func testMalformedPayloadsAreUnavailable() async {
        let malformed = [#"{"success":true}"#, #"{"success":false,"data":[]}"#, "not json",
                         #"{"success":true,"wedding":{"title":"x"},"data":[]}"#]
        for body in malformed {
            Stub.routes[invitationsPath] = Reply(status: 200, body: body)
            Stub.routes[physicalPath] = Reply(status: 200, body: configuredPhysical)
            guard case .unavailable = await repository().loadPlannerInvitations() else {
                return XCTFail("malformed invitations body must be unavailable")
            }
        }
        Stub.routes[invitationsPath] = Reply(status: 200, body: invitationsBody)
        Stub.routes[physicalPath] = Reply(status: 200, body: #"{"success":true}"#)
        guard case .unavailable = await repository().loadPlannerInvitations() else {
            return XCTFail("malformed physical body must be unavailable")
        }
    }

    func testDescriptionsRedactCredentialBearingValues() async throws {
        Stub.routes[invitationsPath] = Reply(status: 200, body: invitationsBody)
        Stub.routes[physicalPath] = Reply(status: 200, body: configuredPhysical)
        let snapshot = try loaded(await repository().loadPlannerInvitations())
        let dumped = "\(snapshot.guests) \(snapshot.physical) \(String(reflecting: snapshot.guests[0]))"
        XCTAssertFalse(dumped.contains("fixture.invalid"), "a printed/dumped model must never carry a link")
    }

    func testStyleNamesMirrorTheWebCatalogue() {
        XCTAssertEqual(PlannerInvitationDesign.styleName(for: "botanical"), "Garden Romance")
        XCTAssertEqual(PlannerInvitationDesign.styleName(for: "midnight"), "Midnight Gold")
        XCTAssertEqual(PlannerInvitationDesign.styleName(for: "new-future-style"), "New Future Style")
        XCTAssertEqual(PlannerInvitationDesign.styleNames.count, 12)
    }
}
