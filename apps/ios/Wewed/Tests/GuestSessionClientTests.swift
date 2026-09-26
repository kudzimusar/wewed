import XCTest
@testable import WewedKit

/// The native client of the guest-session authority, held to the protocol's security rules.
///
/// These are behavioural, not cosmetic. Each one corresponds to a way the invitation protocol can
/// be quietly broken while still appearing to work:
///
///  - storing the raw RSVP credential turns a door key into a permanent identity;
///  - clearing the session before validating a new link lets an invalid Guest B link log Guest A out;
///  - sending Guest A's session on an exchange invites the server to keep Guest A;
///  - ignoring `STALE_GUEST_CONTEXT` writes Guest A's answer onto Guest B.
final class GuestSessionClientTests: XCTestCase {

    private struct Reply {
        let status: Int
        var body: String = ""
        var session: String? = nil
        var location: String? = nil
    }

    /// A stub that records exactly what reached the wire, because that is what these tests assert.
    private final class Stub: URLProtocol, @unchecked Sendable {
        nonisolated(unsafe) static var routes: [String: Reply] = [:]
        nonisolated(unsafe) static var seenCookies: [String] = []
        nonisolated(unsafe) static var seenBodies: [String] = []
        /// Marks a request that presented no session, so absence is assertable.
        static let noCookie = "(none)"

        static func reset() {
            routes = [:]
            seenCookies = []
            seenBodies = []
        }

        override class func canInit(with request: URLRequest) -> Bool { true }
        override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

        override func startLoading() {
            let method = request.httpMethod ?? "GET"
            let path = request.url?.path ?? ""
            Stub.seenCookies.append(request.value(forHTTPHeaderField: "Cookie") ?? Stub.noCookie)
            let body = request.httpBody
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
            Stub.seenBodies.append(body.flatMap { String(data: $0, encoding: .utf8) } ?? "")

            let reply = Stub.routes["\(method) \(path)"] ?? Reply(status: 404)
            var headers = ["Content-Type": "application/json"]
            if let session = reply.session {
                headers["Set-Cookie"] =
                    "\(GuestSessionClient.sessionCookie)=\(session); Path=/; HttpOnly; SameSite=Lax"
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

    private var storage: InMemorySecureStorage!
    private var client: GuestSessionClient!

    private let guestASession = "GUEST-A-SESSION-TOKEN"
    private let guestBSession = "GUEST-B-SESSION-TOKEN"
    private let rawToken = "RAW-PRIVATE-RSVP-CREDENTIAL"

    override func setUp() {
        super.setUp()
        Stub.reset()
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [Stub.self]
        configuration.httpCookieAcceptPolicy = .never
        configuration.httpShouldSetCookies = false
        storage = InMemorySecureStorage()
        client = GuestSessionClient(baseUrl: URL(string: "https://wewed.pro")!,
                                    storage: storage,
                                    session: URLSession(configuration: configuration))
    }

    private func exchangeSucceeds(slug: String, guestId: String, name: String, session: String) {
        Stub.routes["POST /api/weddings/\(slug)/guest-session"] = Reply(
            status: 200,
            body: """
            {"success":true,"authorized":true,"wedding":{"slug":"\(slug)"},
             "guest":{"id":"\(guestId)","name":"\(name)"}}
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
             "tagline":"23.12.26","date":"2026-12-23T14:00:00","venue":"Imba Manor",
             "venueCity":"Harare","venueCountry":"Zimbabwe",
             "invitationCardStyle":"ivory-floral-gold","invitationCardMessage":null,
             "rsvpDeadline":null,"childrenPolicy":"welcome"},
             "guest":{"id":"\(guestId)","name":"\(name)"},
             "rsvp":{"attending":\(attending),"checkedIn":false}}
            """
        )
    }

    func testRefreshedCredentialsPersistAndRevocationClearsStorage() async throws {
        exchangeSucceeds(slug: "synthetic", guestId: "a", name: "Synthetic", session: "v1-session")
        _ = try await client.exchangePrivateInvitation(weddingSlug: "synthetic", rsvpToken: "private-fixture")
        invitationReads(slug: "synthetic", guestId: "a", name: "Synthetic", attending: "null")
        let get = "GET /api/weddings/synthetic/guest-session"
        Stub.routes[get] = Reply(status: 200, body: Stub.routes[get]!.body, session: "v2-session")
        _ = try await client.loadInvitation()
        XCTAssertEqual(storage.get(key: "wewed.guest.session"), "v2-session")
        Stub.routes["PUT /api/weddings/synthetic/guest-session"] = Reply(status: 200, body: #"{"success":true,"rsvp":{"attending":true}}"#, session: "v2-refreshed")
        _ = try await client.saveRsvp(weddingSlug: "synthetic", originGuestId: "a",
                                      update: GuestRsvpUpdate(attending: true))
        XCTAssertEqual(storage.get(key: "wewed.guest.session"), "v2-refreshed")
        Stub.routes[get] = Reply(status: 401)
        do { _ = try await client.loadInvitation(); XCTFail("revoked session accepted") } catch { }
        let active = await client.hasActiveSession()
        XCTAssertFalse(active)
    }

    // MARK: - The credential rules

    /// The raw credential opens the door once. It must never become stored identity.
    func testRawInvitationCredentialIsNeverPersisted() async throws {
        exchangeSucceeds(slug: "charity-and-kudzie", guestId: "guest_a",
                         name: "Guest A", session: guestASession)
        _ = try await client.exchangePrivateInvitation(weddingSlug: "charity-and-kudzie",
                                                       rsvpToken: rawToken)

        // Exercise the real GuestSessionClient: the credential is allowed only in the
        // one-shot exchange body and must be replaced by the server-issued session in storage.
        XCTAssertEqual(Stub.seenBodies.count, 1)
        XCTAssertTrue(Stub.seenBodies[0].contains(rawToken))

        let stored = ["wewed.guest.session", "wewed.guest.session.slug"]
            .compactMap { storage.get(key: $0) }
        XCTAssertEqual(stored, [guestASession, "charity-and-kudzie"])
        for value in stored {
            XCTAssertNotEqual(value, rawToken, "the raw RSVP credential must not be stored")
            XCTAssertFalse(value.contains(rawToken))
        }
    }

    /// Only what the server issued is kept, and it is what later calls present.
    func testTheServerIssuedSessionIsWhatSubsequentCallsPresent() async throws {
        exchangeSucceeds(slug: "charity-and-kudzie", guestId: "guest_a",
                         name: "Guest A", session: guestASession)
        invitationReads(slug: "charity-and-kudzie", guestId: "guest_a",
                        name: "Guest A", attending: "null")
        _ = try await client.exchangePrivateInvitation(weddingSlug: "charity-and-kudzie",
                                                       rsvpToken: rawToken)
        Stub.seenCookies = []
        _ = try await client.loadInvitation(weddingSlug: "charity-and-kudzie")
        XCTAssertEqual(Stub.seenCookies,
                       ["\(GuestSessionClient.sessionCookie)=\(guestASession)"])
    }

    /// The exchange is how a *different* guest takes over. Presenting the current session invites
    /// the server to keep the current guest, which is how Guest B silently became Guest A.
    func testTheExchangeDoesNotPresentTheExistingSession() async throws {
        exchangeSucceeds(slug: "charity-and-kudzie", guestId: "guest_a",
                         name: "Guest A", session: guestASession)
        _ = try await client.exchangePrivateInvitation(weddingSlug: "charity-and-kudzie",
                                                       rsvpToken: rawToken)
        Stub.seenCookies = []
        exchangeSucceeds(slug: "charity-and-kudzie", guestId: "guest_b",
                         name: "Guest B", session: guestBSession)
        _ = try await client.exchangePrivateInvitation(weddingSlug: "charity-and-kudzie",
                                                       rsvpToken: rawToken)
        XCTAssertEqual(Stub.seenCookies, [Stub.noCookie], "the exchange must be unauthenticated")
    }

    // MARK: - Atomic replacement

    /// Guest B replaces Guest A only after the server has accepted Guest B.
    func testAValidSecondInvitationReplacesTheFirst() async throws {
        exchangeSucceeds(slug: "charity-and-kudzie", guestId: "guest_a",
                         name: "Guest A", session: guestASession)
        let first = try await client.exchangePrivateInvitation(weddingSlug: "charity-and-kudzie",
                                                               rsvpToken: rawToken)
        XCTAssertEqual(first.guestId, "guest_a")

        exchangeSucceeds(slug: "charity-and-kudzie", guestId: "guest_b",
                         name: "Guest B", session: guestBSession)
        let second = try await client.exchangePrivateInvitation(weddingSlug: "charity-and-kudzie",
                                                                rsvpToken: rawToken)
        XCTAssertEqual(second.guestId, "guest_b")

        invitationReads(slug: "charity-and-kudzie", guestId: "guest_b",
                        name: "Guest B", attending: "null")
        Stub.seenCookies = []
        _ = try await client.loadInvitation(weddingSlug: "charity-and-kudzie")
        XCTAssertEqual(Stub.seenCookies,
                       ["\(GuestSessionClient.sessionCookie)=\(guestBSession)"])
    }

    /// The failure this protects against: an invalid or expired second link must not log the
    /// current guest out. Only a redeemed credential may replace an active one.
    func testAnInvalidSecondInvitationLeavesTheActiveGuestUntouched() async throws {
        exchangeSucceeds(slug: "charity-and-kudzie", guestId: "guest_a",
                         name: "Guest A", session: guestASession)
        _ = try await client.exchangePrivateInvitation(weddingSlug: "charity-and-kudzie",
                                                       rsvpToken: rawToken)

        Stub.routes["POST /api/weddings/charity-and-kudzie/guest-session"] =
            Reply(status: 401, body: #"{"success":false,"error":"invalid"}"#)
        do {
            _ = try await client.exchangePrivateInvitation(weddingSlug: "charity-and-kudzie",
                                                           rsvpToken: "EXPIRED")
            XCTFail("an invalid invitation must not succeed")
        } catch {}

        invitationReads(slug: "charity-and-kudzie", guestId: "guest_a",
                        name: "Guest A", attending: "null")
        Stub.seenCookies = []
        let snapshot = try await client.loadInvitation(weddingSlug: "charity-and-kudzie")
        XCTAssertEqual(snapshot.guestId, "guest_a")
        XCTAssertEqual(Stub.seenCookies,
                       ["\(GuestSessionClient.sessionCookie)=\(guestASession)"])
    }

    /// A rejected handoff behaves the same way: redirect without a session, active guest kept.
    func testARejectedHandoffLeavesTheActiveGuestUntouched() async throws {
        exchangeSucceeds(slug: "charity-and-kudzie", guestId: "guest_a",
                         name: "Guest A", session: guestASession)
        _ = try await client.exchangePrivateInvitation(weddingSlug: "charity-and-kudzie",
                                                       rsvpToken: rawToken)
        Stub.routes["GET /invite/resume"] =
            Reply(status: 303, location: "/guest-access-help?reason=invitation-resume")
        do {
            _ = try await client.redeemHandoff(String(repeating: "B", count: 43))
            XCTFail("a rejected handoff must not succeed")
        } catch {}
        let active = await client.hasActiveSession()
        let slug = await client.activeSessionSlug()
        XCTAssertTrue(active, "the active session must survive")
        XCTAssertEqual(slug, "charity-and-kudzie")
    }

    /// A handoff that is not the server's shape never reaches the network at all.
    func testAMalformedHandoffIsRefusedLocally() async {
        do {
            _ = try await client.redeemHandoff("too-short")
            XCTFail("a malformed handoff must not succeed")
        } catch {}
        XCTAssertTrue(Stub.seenBodies.isEmpty, "no request should have been made")
    }

    /// A deferred install: no previous session, no stored wedding, nothing but the handoff.
    ///
    /// This is the case the whole handoff path exists for, and it used to fail. The client asked
    /// storage which wedding it was, which on a fresh install answers nothing. An earlier version
    /// of this test pre-seeded the slug immediately before redeeming, which made the bug invisible.
    /// Nothing is seeded here.
    func testAFreshInstallRedeemsAHandoffWithNothingStored() async throws {
        XCTAssertNil(storage.get(key: "wewed.guest.session"),
                     "the test must start with empty storage")
        XCTAssertNil(storage.get(key: "wewed.guest.session.slug"))

        Stub.routes["GET /invite/resume"] = Reply(
            status: 303,
            session: guestBSession,
            location: "/w/charity-and-kudzie?invitation=1&card=ivory-floral-gold&source=android-app"
        )
        invitationReads(slug: "charity-and-kudzie", guestId: "guest_b",
                        name: "Guest B", attending: "null")

        let identity = try await client.redeemHandoff(String(repeating: "B", count: 43))
        XCTAssertEqual(identity.guestId, "guest_b")
        XCTAssertEqual(identity.guestName, "Guest B")
        // The wedding came from the redirect, which is the only place it could have come from.
        XCTAssertEqual(identity.weddingSlug, "charity-and-kudzie")
        let slug = await client.activeSessionSlug()
        XCTAssertEqual(slug, "charity-and-kudzie")
    }

    /// A valid second handoff replaces the guest who was already here.
    func testAValidHandoffReplacesTheActiveGuest() async throws {
        exchangeSucceeds(slug: "charity-and-kudzie", guestId: "guest_a",
                         name: "Guest A", session: guestASession)
        _ = try await client.exchangePrivateInvitation(weddingSlug: "charity-and-kudzie",
                                                       rsvpToken: rawToken)

        Stub.routes["GET /invite/resume"] = Reply(
            status: 303, session: guestBSession, location: "/w/charity-and-kudzie?invitation=1")
        invitationReads(slug: "charity-and-kudzie", guestId: "guest_b",
                        name: "Guest B", attending: "null")

        let identity = try await client.redeemHandoff(String(repeating: "B", count: 43))
        XCTAssertEqual(identity.guestId, "guest_b")
        Stub.seenCookies = []
        _ = try await client.loadInvitation(weddingSlug: "charity-and-kudzie")
        XCTAssertEqual(Stub.seenCookies,
                       ["\(GuestSessionClient.sessionCookie)=\(guestBSession)"])
    }

    /// A redirect that does not name a wedding is not a successful redemption.
    ///
    /// The recovery page is exactly this shape, and treating it as success would establish a
    /// session pointing at nothing.
    func testAResumeWithoutAWeddingDestinationIsRefused() async {
        Stub.routes["GET /invite/resume"] = Reply(
            status: 303, session: guestBSession,
            location: "/guest-access-help?reason=invitation-resume")
        do {
            _ = try await client.redeemHandoff(String(repeating: "B", count: 43))
            XCTFail("a resume without a wedding must not succeed")
        } catch {}
        let active = await client.hasActiveSession()
        XCTAssertFalse(active, "nothing may be persisted")
    }

    /// A redirect pointing off-origin is a claim, not an instruction.
    func testAResumeRedirectingOffOriginIsRefused() async {
        Stub.routes["GET /invite/resume"] = Reply(
            status: 303, session: guestBSession,
            location: "https://evil.example/w/charity-and-kudzie")
        do {
            _ = try await client.redeemHandoff(String(repeating: "B", count: 43))
            XCTFail("an off-origin redirect must not succeed")
        } catch {}
        let active = await client.hasActiveSession()
        XCTAssertFalse(active)
    }
    // MARK: - RSVP

    /// Accept and decline are both real answers that reach the server.
    func testBothAcceptAndDeclineAreSaved() async throws {
        exchangeSucceeds(slug: "charity-and-kudzie", guestId: "guest_a",
                         name: "Guest A", session: guestASession)
        _ = try await client.exchangePrivateInvitation(weddingSlug: "charity-and-kudzie",
                                                       rsvpToken: rawToken)

        Stub.routes["PUT /api/weddings/charity-and-kudzie/guest-session"] =
            Reply(status: 200, body: #"{"success":true,"rsvp":{"attending":true}}"#)
        let accepted = try await client.saveRsvp(weddingSlug: "charity-and-kudzie",
                                                 originGuestId: "guest_a",
                                                 update: GuestRsvpUpdate(attending: true))
        guard case let .saved(acceptedRsvp) = accepted else {
            return XCTFail("expected saved, got \(accepted)")
        }
        XCTAssertEqual(acceptedRsvp.attending, true)
        XCTAssertTrue(Stub.seenBodies.last?.contains("\"attending\":true") == true)
        XCTAssertTrue(Stub.seenBodies.last?.contains("\"originGuestId\":\"guest_a\"") == true)

        Stub.routes["PUT /api/weddings/charity-and-kudzie/guest-session"] =
            Reply(status: 200, body: #"{"success":true,"rsvp":{"attending":false}}"#)
        let declined = try await client.saveRsvp(weddingSlug: "charity-and-kudzie",
                                                 originGuestId: "guest_a",
                                                 update: GuestRsvpUpdate(attending: false))
        guard case let .saved(declinedRsvp) = declined else {
            return XCTFail("expected saved, got \(declined)")
        }
        XCTAssertEqual(declinedRsvp.attending, false)
        XCTAssertTrue(Stub.seenBodies.last?.contains("\"attending\":false") == true)
    }

    /// Master plan Phase 9 — the full converged field set reaches the server in one request.
    func testTheFullRsvpFieldSetIsSentAndParsedBack() async throws {
        exchangeSucceeds(slug: "charity-and-kudzie", guestId: "guest_a",
                         name: "Guest A", session: guestASession)
        _ = try await client.exchangePrivateInvitation(weddingSlug: "charity-and-kudzie",
                                                       rsvpToken: rawToken)

        Stub.routes["PUT /api/weddings/charity-and-kudzie/guest-session"] = Reply(
            status: 200,
            body: #"{"success":true,"rsvp":{"attending":true,"mealChoice":"vegetarian","plusOne":true,"plusOneName":"Plus One","plusOneMeal":"chicken","kidsAttending":true,"kidsCount":2,"dietaryNotes":"No nuts","message":"So excited"}}"#
        )
        let result = try await client.saveRsvp(
            weddingSlug: "charity-and-kudzie",
            originGuestId: "guest_a",
            update: GuestRsvpUpdate(
                attending: true,
                mealChoice: "vegetarian",
                plusOne: true,
                plusOneName: "Plus One",
                plusOneMeal: "chicken",
                kidsAttending: true,
                kidsCount: 2,
                dietaryNotes: "No nuts",
                message: "So excited"
            )
        )
        XCTAssertEqual(result, .saved(rsvp: GuestRsvpRecord(
            attending: true, mealChoice: "vegetarian", plusOne: true, plusOneName: "Plus One",
            plusOneMeal: "chicken", kidsAttending: true, kidsCount: 2, dietaryNotes: "No nuts",
            message: "So excited"
        )))
        let body = Stub.seenBodies.last ?? ""
        XCTAssertTrue(body.contains("\"mealChoice\":\"vegetarian\""))
        XCTAssertTrue(body.contains("\"plusOne\":true"))
        XCTAssertTrue(body.contains("\"plusOneName\":\"Plus One\""))
        XCTAssertTrue(body.contains("\"plusOneMeal\":\"chicken\""))
        XCTAssertTrue(body.contains("\"kidsAttending\":true"))
        XCTAssertTrue(body.contains("\"kidsCount\":2"))
        XCTAssertTrue(body.contains("\"dietaryNotes\":\"No nuts\""))
        XCTAssertTrue(body.contains("\"message\":\"So excited\""))
    }

    /// A field the caller never set must never appear in the request body at all.
    func testAFieldLeftNullIsNeverSentSoItCanNeverOverwriteAnUnrelatedAnswer() async throws {
        exchangeSucceeds(slug: "charity-and-kudzie", guestId: "guest_a",
                         name: "Guest A", session: guestASession)
        _ = try await client.exchangePrivateInvitation(weddingSlug: "charity-and-kudzie",
                                                       rsvpToken: rawToken)

        Stub.routes["PUT /api/weddings/charity-and-kudzie/guest-session"] =
            Reply(status: 200, body: #"{"success":true,"rsvp":{"mealChoice":"vegan"}}"#)
        _ = try await client.saveRsvp(weddingSlug: "charity-and-kudzie", originGuestId: "guest_a",
                                      update: GuestRsvpUpdate(mealChoice: "vegan"))
        let body = Stub.seenBodies.last ?? ""
        XCTAssertTrue(body.contains("\"mealChoice\":\"vegan\""))
        XCTAssertFalse(body.contains("\"attending\""))
        XCTAssertFalse(body.contains("\"plusOne\""))
        XCTAssertFalse(body.contains("\"kidsAttending\""))
        XCTAssertFalse(body.contains("\"dietaryNotes\""))
        XCTAssertFalse(body.contains("\"message\""))
    }

    /// A stale binding is surfaced, not swallowed: the answer belonged to a different card.
    func testAStaleGuestBindingIsSurfaced() async throws {
        exchangeSucceeds(slug: "charity-and-kudzie", guestId: "guest_b",
                         name: "Guest B", session: guestBSession)
        _ = try await client.exchangePrivateInvitation(weddingSlug: "charity-and-kudzie",
                                                       rsvpToken: rawToken)
        Stub.routes["PUT /api/weddings/charity-and-kudzie/guest-session"] =
            Reply(status: 409, body: #"{"success":false,"code":"STALE_GUEST_CONTEXT"}"#)
        let result = try await client.saveRsvp(weddingSlug: "charity-and-kudzie",
                                               originGuestId: "guest_a",
                                               update: GuestRsvpUpdate(attending: true))
        XCTAssertEqual(result, .staleGuestContext)
    }

    func testAnAdultsOnlyRefusalIsSurfaced() async throws {
        exchangeSucceeds(slug: "charity-and-kudzie", guestId: "guest_a",
                         name: "Guest A", session: guestASession)
        _ = try await client.exchangePrivateInvitation(weddingSlug: "charity-and-kudzie",
                                                       rsvpToken: rawToken)
        Stub.routes["PUT /api/weddings/charity-and-kudzie/guest-session"] =
            Reply(status: 400, body: #"{"success":false,"code":"CHILDREN_NOT_ALLOWED"}"#)
        let result = try await client.saveRsvp(
            weddingSlug: "charity-and-kudzie", originGuestId: "guest_a",
            update: GuestRsvpUpdate(attending: true, kidsAttending: true))
        XCTAssertEqual(result, .childrenNotAllowed)
    }

    // MARK: - The card's content comes from the server

    /// The invitation is populated from the wedding's own authority, not from a fixture.
    func testTheInvitationIsPopulatedFromTheServer() async throws {
        exchangeSucceeds(slug: "charity-and-kudzie", guestId: "guest_a",
                         name: "Gladmore Musarurwa", session: guestASession)
        invitationReads(slug: "charity-and-kudzie", guestId: "guest_a",
                        name: "Gladmore Musarurwa", attending: "true")
        _ = try await client.exchangePrivateInvitation(weddingSlug: "charity-and-kudzie",
                                                       rsvpToken: rawToken)

        let snapshot = try await client.loadInvitation(weddingSlug: "charity-and-kudzie")
        XCTAssertEqual(snapshot.title, "Charity & Kudzie")
        XCTAssertEqual(snapshot.guestName, "Gladmore Musarurwa")
        XCTAssertEqual(snapshot.monogram, "C&K")
        XCTAssertEqual(snapshot.tagline, "23.12.26")
        XCTAssertEqual(snapshot.venue, "Imba Manor")
        XCTAssertEqual(snapshot.invitationCardStyle, "ivory-floral-gold")
        XCTAssertEqual(snapshot.attending, true)
        // A JSON null must read as "not answered", never as the string "null".
        XCTAssertNil(snapshot.invitationCardMessage)
        XCTAssertNil(snapshot.rsvpDeadline)
    }
}
