import XCTest
@testable import WewedKit

/// The live invitation journey, end to end against a stub of the real guest-session API.
///
/// These tests exist because of a specific failure mode: the parser recognised handoffs and the
/// parser tests passed, while the running app acknowledged them and never redeemed them. Testing
/// the parser proves nothing about whether the app completes the journey. The coordinator is the
/// thing that has to complete it, so it is what is tested here.
final class LiveGuestInvitationCoordinatorTests: XCTestCase {

    private struct Reply {
        let status: Int
        var body: String = ""
        var session: String? = nil
        var location: String? = nil
    }

    private final class Stub: URLProtocol, @unchecked Sendable {
        nonisolated(unsafe) static var routes: [String: Reply] = [:]
        nonisolated(unsafe) static var seenPaths: [String] = []
        nonisolated(unsafe) static var seenBodies: [String] = []

        static func reset() { routes = [:]; seenPaths = []; seenBodies = [] }

        override class func canInit(with request: URLRequest) -> Bool { true }
        override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

        override func startLoading() {
            let method = request.httpMethod ?? "GET"
            let path = request.url?.path ?? ""
            Stub.seenPaths.append("\(method) \(path)")
            // URLSession replaces `httpBody` with a stream, so reading only the former records
            // nothing and an assertion about what was sent silently passes on an empty string.
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
            let reply = Stub.routes["\(method) \(path)"] ?? Reply(status: 404)
            var headers = ["Content-Type": "application/json"]
            if let session = reply.session {
                headers["Set-Cookie"] = "\(GuestSessionClient.sessionCookie)=\(session); Path=/"
            }
            if let location = reply.location { headers["Location"] = location }
            let response = HTTPURLResponse(url: request.url!, statusCode: reply.status,
                                           httpVersion: "HTTP/1.1", headerFields: headers)!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: Data(reply.body.utf8))
            client?.urlProtocolDidFinishLoading(self)
        }

        override func stopLoading() {}
    }

    private var coordinator: LiveGuestInvitationCoordinator!
    private var client: GuestSessionClient!

    override func setUp() {
        super.setUp()
        Stub.reset()
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [Stub.self]
        client = GuestSessionClient(baseUrl: URL(string: "https://wewed.pro")!,
                                    storage: InMemorySecureStorage(),
                                    session: URLSession(configuration: configuration))
        coordinator = LiveGuestInvitationCoordinator(client: client)
    }

    private func exchangeSucceeds(slug: String, guestId: String, session: String) {
        Stub.routes["POST /api/weddings/\(slug)/guest-session"] = Reply(
            status: 200,
            body: """
            {"success":true,"authorized":true,"wedding":{"slug":"\(slug)"},
             "guest":{"id":"\(guestId)","name":"Live Guest"}}
            """,
            session: session
        )
    }

    private func invitationReads(slug: String, guestId: String, name: String, attending: String) {
        Stub.routes["GET /api/weddings/\(slug)/guest-session"] = Reply(
            status: 200,
            body: """
            {"success":true,"authorized":true,
             "wedding":{"slug":"\(slug)","title":"Charity & Kudzie","monogram":"C&K",
             "date":"2026-12-23T14:00:00","venue":"Imba Manor","venueCity":"Harare",
             "venueCountry":"Zimbabwe","invitationCardStyle":"ivory-floral-gold",
             "childrenPolicy":"welcome"},
             "guest":{"id":"\(guestId)","name":"\(name)"},
             "rsvp":{"attending":\(attending),"checkedIn":false}}
            """
        )
    }

    /// A private link completes: exchange, then read the card from the wedding's own authority.
    func testAPrivateInvitationReachesThePresentedCard() async {
        exchangeSucceeds(slug: "charity-and-kudzie", guestId: "guest_live", session: "SESSION-1")
        invitationReads(slug: "charity-and-kudzie", guestId: "guest_live",
                        name: "Live Guest", attending: "null")

        let state = await coordinator.enter(
            .privateInvitation(weddingSlug: "charity-and-kudzie", rsvpToken: "PRIVATE-CREDENTIAL")
        )
        guard case let .presenting(snapshot) = state else {
            return XCTFail("the card must be presented, got \(state)")
        }
        XCTAssertEqual(snapshot.guestName, "Live Guest")
        XCTAssertEqual(snapshot.title, "Charity & Kudzie")
        XCTAssertEqual(snapshot.invitationCardStyle, "ivory-floral-gold")
    }

    /// The regression this class exists for: a handoff used to be recognised and then dropped.
    func testAHandoffIsActuallyRedeemedRatherThanAcknowledged() async {
        // The redirect names the wedding, exactly as production's `/invite/resume` does. Nothing
        // is seeded: a deferred install has no previous session to read a slug out of.
        Stub.routes["GET /invite/resume"] = Reply(
            status: 303, session: "SESSION-2",
            location: "/w/charity-and-kudzie?invitation=1&card=ivory-floral-gold")
        invitationReads(slug: "charity-and-kudzie", guestId: "guest_live",
                        name: "Live Guest", attending: "null")

        let state = await coordinator.enter(.handoff(secret: String(repeating: "A", count: 43)))
        XCTAssertTrue(Stub.seenPaths.contains { $0.hasPrefix("GET /invite/resume") },
                      "the handoff must reach the server")
        guard case let .presenting(snapshot) = state else {
            return XCTFail("a redeemed handoff must end in a presented card, got \(state)")
        }
        XCTAssertEqual(snapshot.guestName, "Live Guest")
        XCTAssertEqual(snapshot.weddingSlug, "charity-and-kudzie")
    }

    /// A refused entry fails closed, and never reads a card belonging to anyone else.
    func testARefusedEntryNeverPresentsACard() async {
        let state = await coordinator.enter(.rejected(.resumeCarriedRawCredential))
        XCTAssertEqual(state, .refused(.resumeCarriedRawCredential))
        XCTAssertFalse(Stub.seenPaths.contains { $0.contains("guest-session") })
    }

    /// A credential the server declines is a refusal, not an unavailable server.
    func testADeclinedCredentialIsARefusal() async {
        Stub.routes["POST /api/weddings/charity-and-kudzie/guest-session"] =
            Reply(status: 401, body: #"{"success":false}"#)
        let state = await coordinator.enter(
            .privateInvitation(weddingSlug: "charity-and-kudzie", rsvpToken: "EXPIRED"))
        guard case .refused = state else { return XCTFail("expected refusal, got \(state)") }
    }

    private func presentGuestA() async {
        exchangeSucceeds(slug: "wedding-a", guestId: "guest_a", session: "SESSION-A")
        invitationReads(slug: "wedding-a", guestId: "guest_a", name: "Guest A", attending: "true")
        let first = await coordinator.enter(
            .privateInvitation(weddingSlug: "wedding-a", rsvpToken: "CREDENTIAL-A"))
        guard case let .presenting(snapshot) = first else { return XCTFail("expected Guest A, got \(first)") }
        XCTAssertEqual(snapshot.guestName, "Guest A")
    }

    /// Nothing may act as Guest A while a replacement is refused or unreachable (master plan §6.5).
    private func assertGuestAIsNotActionable() async {
        Stub.seenPaths = []
        let outcome = await coordinator.answer(GuestRsvpUpdate(attending: false))
        XCTAssertEqual(outcome, .reopenRequired, "answering must not target the previously presented Guest")
        XCTAssertFalse(Stub.seenPaths.contains { $0.hasPrefix("PUT ") }, "no RSVP write for Guest A")

        let refreshed = await coordinator.refresh()
        guard case .idle = refreshed else {
            return XCTFail("refresh must not re-present the previously presented Guest; got \(refreshed)")
        }
        XCTAssertTrue(Stub.seenPaths.isEmpty, "no request at all — in particular no read of Guest A")
    }

    /// Guest replacement (master plan §6.5). With Guest A presented, an invalid Guest B is
    /// refused; from that moment nothing answers or refreshes as A. A's SECURE session is not
    /// destroyed, so an explicit restore can still bring A back.
    func testAnInvalidSecondGuestIsRefusedAndNeverAnswersWithTheFirstGuestsCard() async {
        await presentGuestA()

        Stub.routes["POST /api/weddings/wedding-b/guest-session"] =
            Reply(status: 401, body: #"{"success":false}"#)
        let second = await coordinator.enter(
            .privateInvitation(weddingSlug: "wedding-b", rsvpToken: "INVALID-B"))
        guard case .refused = second else { return XCTFail("an invalid Guest B must be refused; got \(second)") }

        await assertGuestAIsNotActionable()

        // Presentation binding != remembered session: A's stored session survived the refusal.
        let storedSlug = await client.activeSessionSlug()
        XCTAssertEqual(storedSlug, "wedding-a")
        let restored = await coordinator.restoreRememberedGuest()
        guard case let .presenting(snapshot) = restored else {
            return XCTFail("an explicit restore may bring back the still-valid Guest A; got \(restored)")
        }
        XCTAssertEqual(snapshot.guestName, "Guest A")
    }

    /// An unreachable Wewed during B's entry leaves A exactly as unactionable as a refusal does.
    func testATransportFailedSecondGuestLeavesTheFirstGuestUnactionable() async {
        await presentGuestA()

        Stub.routes["POST /api/weddings/wedding-b/guest-session"] = Reply(status: 503)
        let second = await coordinator.enter(
            .privateInvitation(weddingSlug: "wedding-b", rsvpToken: "CREDENTIAL-B"))
        guard case .unavailable = second else { return XCTFail("expected unavailable; got \(second)") }

        await assertGuestAIsNotActionable()
        let storedSlug = await client.activeSessionSlug()
        XCTAssertEqual(storedSlug, "wedding-a")
    }

    /// A rejected entry (malformed link) ends the presentation too, without any request.
    func testARejectedSecondEntryAlsoEndsTheFirstGuestsPresentation() async {
        await presentGuestA()
        let second = await coordinator.enter(.rejected(.resumeCarriedRawCredential))
        guard case .refused = second else { return XCTFail("expected refusal; got \(second)") }
        await assertGuestAIsNotActionable()
    }

    /// An unreachable Wewed is distinguishable from a refused invitation.
    func testAnUnreachableServerIsNotARefusal() async {
        Stub.routes["POST /api/weddings/charity-and-kudzie/guest-session"] = Reply(status: 503)
        let state = await coordinator.enter(
            .privateInvitation(weddingSlug: "charity-and-kudzie", rsvpToken: "TOKEN"))
        guard case .unavailable = state else {
            return XCTFail("503 must not read as 'this link is not yours', got \(state)")
        }
    }

    /// The answer is bound to the guest whose card is open, by id, on the live route.
    func testTheAnswerIsBoundToThePresentedGuest() async {
        exchangeSucceeds(slug: "charity-and-kudzie", guestId: "guest_live", session: "SESSION-1")
        invitationReads(slug: "charity-and-kudzie", guestId: "guest_live",
                        name: "Live Guest", attending: "null")
        _ = await coordinator.enter(
            .privateInvitation(weddingSlug: "charity-and-kudzie", rsvpToken: "TOKEN"))

        Stub.routes["PUT /api/weddings/charity-and-kudzie/guest-session"] =
            Reply(status: 200, body: #"{"success":true,"rsvp":{"attending":true}}"#)
        Stub.seenBodies = []
        let outcome = await coordinator.answer(GuestRsvpUpdate(attending: true))

        guard case let .saved(rsvp) = outcome else {
            return XCTFail("expected saved, got \(outcome)")
        }
        XCTAssertEqual(rsvp.attending, true)
        XCTAssertTrue(Stub.seenBodies.last?.contains("\"originGuestId\":\"guest_live\"") == true)
    }

    /// Decline is a real answer on the live route, not a local UI state.
    func testDeclineIsSavedThroughTheSameAuthority() async {
        exchangeSucceeds(slug: "charity-and-kudzie", guestId: "guest_live", session: "SESSION-1")
        invitationReads(slug: "charity-and-kudzie", guestId: "guest_live",
                        name: "Live Guest", attending: "null")
        _ = await coordinator.enter(
            .privateInvitation(weddingSlug: "charity-and-kudzie", rsvpToken: "TOKEN"))

        Stub.routes["PUT /api/weddings/charity-and-kudzie/guest-session"] =
            Reply(status: 200, body: #"{"success":true,"rsvp":{"attending":false}}"#)
        Stub.seenBodies = []
        let declined = await coordinator.answer(GuestRsvpUpdate(attending: false))
        guard case let .saved(rsvp) = declined else {
            return XCTFail("expected saved, got \(declined)")
        }
        XCTAssertEqual(rsvp.attending, false)
        XCTAssertTrue(Stub.seenBodies.last?.contains("\"attending\":false") == true)
    }

    /// A stale card must not write onto whoever is active now.
    func testAStaleCardIsToldToReopenRatherThanWritingToTheWrongGuest() async {
        exchangeSucceeds(slug: "charity-and-kudzie", guestId: "guest_a", session: "SESSION-A")
        invitationReads(slug: "charity-and-kudzie", guestId: "guest_a",
                        name: "Guest A", attending: "null")
        _ = await coordinator.enter(
            .privateInvitation(weddingSlug: "charity-and-kudzie", rsvpToken: "TOKEN-A"))

        Stub.routes["PUT /api/weddings/charity-and-kudzie/guest-session"] =
            Reply(status: 409, body: #"{"success":false,"code":"STALE_GUEST_CONTEXT"}"#)
        let stale = await coordinator.answer(GuestRsvpUpdate(attending: true))
        XCTAssertEqual(stale, .reopenRequired)
    }

    /// Answering before a card exists cannot guess a guest.
    func testAnsweringWithoutAPresentedCardIsRefused() async {
        let outcome = await coordinator.answer(GuestRsvpUpdate(attending: true))
        XCTAssertEqual(outcome, .reopenRequired)
        XCTAssertFalse(Stub.seenPaths.contains { $0.hasPrefix("PUT") })
    }

    /// After answering, the card is re-read so what is shown is what the server stored.
    func testRefreshReadsBackWhatTheServerStored() async {
        exchangeSucceeds(slug: "charity-and-kudzie", guestId: "guest_live", session: "SESSION-1")
        invitationReads(slug: "charity-and-kudzie", guestId: "guest_live",
                        name: "Live Guest", attending: "null")
        _ = await coordinator.enter(
            .privateInvitation(weddingSlug: "charity-and-kudzie", rsvpToken: "TOKEN"))

        invitationReads(slug: "charity-and-kudzie", guestId: "guest_live",
                        name: "Live Guest", attending: "true")
        guard case let .presenting(snapshot) = await coordinator.refresh() else {
            return XCTFail("refresh must present the stored state")
        }
        XCTAssertEqual(snapshot.attending, true)
    }
}
