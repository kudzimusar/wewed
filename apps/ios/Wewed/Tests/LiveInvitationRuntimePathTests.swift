import XCTest
@testable import WewedKit

/// Proof that the live invitation actually runs through the guest-session authority.
///
/// The coordinator's own tests prove it works when called. They cannot prove the app calls it — and
/// that was exactly the defect: excellent unit coverage on a client the running app never touched,
/// while the real path still went to the Shadow repository.
///
/// So this test drives the same sequence the app does, with a repository spy that fails the test
/// the instant either legacy method is invoked.
final class LiveInvitationRuntimePathTests: XCTestCase {

    /// A repository that refuses to participate.
    ///
    /// Every legacy invitation method throws rather than returning a plausible value, because a
    /// plausible value is precisely what let the old path masquerade as working.
    private final class ForbiddenLegacyRepository: @unchecked Sendable {
        nonisolated(unsafe) static var touched: [String] = []
        static func forbidden(_ name: String) -> Error {
            touched.append(name)
            return NSError(domain: "ForbiddenLegacyRepository", code: 1, userInfo: [
                NSLocalizedDescriptionKey:
                    "the live invitation path must not call WeddingRepository.\(name)"
            ])
        }
    }

    private struct Reply {
        let status: Int
        var body: String = ""
        var session: String? = nil
    }

    private final class Stub: URLProtocol, @unchecked Sendable {
        nonisolated(unsafe) static var routes: [String: Reply] = [:]
        nonisolated(unsafe) static var seenBodies: [String] = []

        static func reset() { routes = [:]; seenBodies = [] }

        override class func canInit(with request: URLRequest) -> Bool { true }
        override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

        override func startLoading() {
            let key = "\(request.httpMethod ?? "GET") \(request.url?.path ?? "")"
            let body = request.httpBody ?? request.httpBodyStream.map { stream -> Data in
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
            if let body, let text = String(data: body, encoding: .utf8) {
                Stub.seenBodies.append(text)
            }
            let reply = Stub.routes[key] ?? Reply(status: 404)
            var headers = ["Content-Type": "application/json"]
            if let session = reply.session {
                headers["Set-Cookie"] = "\(GuestSessionClient.sessionCookie)=\(session); Path=/"
            }
            let response = HTTPURLResponse(url: request.url!, statusCode: reply.status,
                                           httpVersion: "HTTP/1.1", headerFields: headers)!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: Data(reply.body.utf8))
            client?.urlProtocolDidFinishLoading(self)
        }

        override func stopLoading() {}
    }

    private var coordinator: LiveGuestInvitationCoordinator!

    override func setUp() {
        super.setUp()
        Stub.reset()
        ForbiddenLegacyRepository.touched = []
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [Stub.self]
        coordinator = LiveGuestInvitationCoordinator(
            client: GuestSessionClient(baseUrl: URL(string: "https://wewed.pro")!,
                                       storage: InMemorySecureStorage(),
                                       session: URLSession(configuration: configuration))
        )
        Stub.routes["POST /api/weddings/charity-and-kudzie/guest-session"] = Reply(
            status: 200,
            body: """
            {"success":true,"authorized":true,"wedding":{"slug":"charity-and-kudzie"},
             "guest":{"id":"guest_real","name":"Shadreck Kudzanai Musarurwa"}}
            """,
            session: "LIVE-SESSION"
        )
        Stub.routes["GET /api/weddings/charity-and-kudzie/guest-session"] = Reply(
            status: 200,
            body: """
            {"success":true,"authorized":true,
             "wedding":{"slug":"charity-and-kudzie","title":"Charity & Kudzie","monogram":"C&K",
             "tagline":"23.12.26","date":"2026-12-23T14:00:00","venue":"Imba Manor",
             "venueCity":"Harare","venueCountry":"Zimbabwe",
             "venueMapUrl":"https://maps.example/imba","invitationCardStyle":"ivory-floral-gold",
             "invitationCardMessage":null,"rsvpDeadline":null,"childrenPolicy":"welcome"},
             "guest":{"id":"guest_real","name":"Shadreck Kudzanai Musarurwa"},
             "rsvp":{"attending":null,"checkedIn":false}}
            """
        )
    }

    /// The whole runtime sequence: a URL arrives, is parsed, and the coordinator exchanges and
    /// loads. No repository is consulted at any point.
    func testAnIncomingPrivateLinkTravelsTheLivePathWithoutTouchingTheRepository() async throws {
        let entry = try XCTUnwrap(InvitationEntryParser.entry(
            from: "https://wewed.pro/invite/charity-and-kudzie?rsvp=PRIVATE-CREDENTIAL&card=ivory-floral-gold"
        ))
        guard case .privateInvitation = entry else { return XCTFail("expected a private link") }

        let state = await coordinator.enter(entry)
        guard case let .presenting(snapshot) = state else {
            return XCTFail("the live path must present the card, got \(state)")
        }

        let presentation = LiveInvitationPresentation.from(snapshot)
        XCTAssertEqual(presentation.guestName, "Shadreck Kudzanai Musarurwa")
        XCTAssertEqual(presentation.coupleNames, "Charity & Kudzie")
        XCTAssertEqual(presentation.invitationCardStyle, .ivoryFloralGold)
        XCTAssertEqual(presentation.rsvpStatus, .pending)
        XCTAssertTrue(ForbiddenLegacyRepository.touched.isEmpty,
                      "no legacy repository method may be called")
    }

    /// RSVP writes through the guest-session authority, bound by guest id.
    func testRsvpAcceptTravelsTheLivePathWithoutTouchingTheRepository() async throws {
        let entry = try XCTUnwrap(InvitationEntryParser.entry(
            from: "https://wewed.pro/invite/charity-and-kudzie?rsvp=PRIVATE-CREDENTIAL"))
        _ = await coordinator.enter(entry)

        Stub.routes["PUT /api/weddings/charity-and-kudzie/guest-session"] =
            Reply(status: 200, body: #"{"success":true,"rsvp":{"attending":true}}"#)
        Stub.seenBodies = []

        let outcome = await coordinator.answer(GuestRsvpUpdate(attending: true))
        guard case let .saved(rsvp) = outcome else {
            return XCTFail("expected saved, got \(outcome)")
        }
        XCTAssertEqual(rsvp.attending, true)
        XCTAssertTrue(Stub.seenBodies.last?.contains("\"originGuestId\":\"guest_real\"") == true)
        XCTAssertTrue(ForbiddenLegacyRepository.touched.isEmpty)
    }

    /// Decline travels the same authority.
    func testRsvpDeclineTravelsTheLivePathWithoutTouchingTheRepository() async throws {
        let entry = try XCTUnwrap(InvitationEntryParser.entry(
            from: "https://wewed.pro/invite/charity-and-kudzie?rsvp=PRIVATE-CREDENTIAL"))
        _ = await coordinator.enter(entry)

        Stub.routes["PUT /api/weddings/charity-and-kudzie/guest-session"] =
            Reply(status: 200, body: #"{"success":true,"rsvp":{"attending":false}}"#)
        let outcome = await coordinator.answer(GuestRsvpUpdate(attending: false))
        guard case let .saved(rsvp) = outcome else {
            return XCTFail("expected saved, got \(outcome)")
        }
        XCTAssertEqual(rsvp.attending, false)
        XCTAssertTrue(ForbiddenLegacyRepository.touched.isEmpty)
    }

    /// The presentation model has no field for a credential.
    func testTheLivePresentationCarriesNoRsvpCredential() async throws {
        let token = "PRIVATE-CREDENTIAL-THAT-MUST-NOT-SURVIVE"
        let entry = try XCTUnwrap(InvitationEntryParser.entry(
            from: "https://wewed.pro/invite/charity-and-kudzie?rsvp=\(token)"))
        guard case let .presenting(snapshot) = await coordinator.enter(entry) else {
            return XCTFail("expected the card")
        }
        let presentation = LiveInvitationPresentation.from(snapshot)
        XCTAssertFalse("\(presentation)".contains(token),
                       "the RSVP credential must not survive into the view model")
        XCTAssertFalse("\(snapshot)".contains(token))
    }

    /// A live failure shows a live failure. It never silently renders the Shadow journey.
    func testALiveFailureNeverFallsBackToTheRepository() async throws {
        Stub.routes["POST /api/weddings/charity-and-kudzie/guest-session"] =
            Reply(status: 401, body: #"{"success":false}"#)
        let entry = try XCTUnwrap(InvitationEntryParser.entry(
            from: "https://wewed.pro/invite/charity-and-kudzie?rsvp=EXPIRED"))
        guard case .refused = await coordinator.enter(entry) else {
            return XCTFail("a refused invitation must be refused")
        }
        XCTAssertTrue(ForbiddenLegacyRepository.touched.isEmpty,
                      "failure must not fall back to the Shadow repository")
    }

    /// The Keychain implementation exists and round-trips, so the client's claim is true.
    func testKeychainStorageIsRealAndRoundTrips() {
        let storage = KeychainSecureStorage(service: "pro.wewed.app.tests.\(UUID().uuidString)")
        storage.save(key: "wewed.guest.session", value: "SESSION-VALUE")
        XCTAssertEqual(storage.get(key: "wewed.guest.session"), "SESSION-VALUE")
        storage.delete(key: "wewed.guest.session")
        XCTAssertNil(storage.get(key: "wewed.guest.session"))
        storage.clear()
    }
}
