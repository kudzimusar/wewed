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

    private func invitationReadsFull(
        slug: String,
        guestId: String,
        name: String,
        attending: String,
        mealChoice: String? = nil,
        plusOne: Bool = false,
        plusOneName: String? = nil,
        plusOneMeal: String? = nil,
        kidsAttending: Bool = false,
        kidsCount: Int? = nil,
        dietaryNotes: String? = nil,
        message: String? = nil,
        childrenPolicy: String = "welcome"
    ) {
        var rsvp: [String: Any] = [
            "plusOne": plusOne,
            "kidsAttending": kidsAttending,
            "checkedIn": false
        ]
        if attending == "null" {
            rsvp["attending"] = NSNull()
        } else {
            rsvp["attending"] = (attending == "true")
        }
        if let mealChoice { rsvp["mealChoice"] = mealChoice } else { rsvp["mealChoice"] = NSNull() }
        if let plusOneName { rsvp["plusOneName"] = plusOneName } else { rsvp["plusOneName"] = NSNull() }
        if let plusOneMeal { rsvp["plusOneMeal"] = plusOneMeal } else { rsvp["plusOneMeal"] = NSNull() }
        if let kidsCount { rsvp["kidsCount"] = kidsCount } else { rsvp["kidsCount"] = NSNull() }
        if let dietaryNotes { rsvp["dietaryNotes"] = dietaryNotes } else { rsvp["dietaryNotes"] = NSNull() }
        if let message { rsvp["message"] = message } else { rsvp["message"] = NSNull() }

        let payload: [String: Any] = [
            "success": true,
            "authorized": true,
            "wedding": [
                "slug": slug,
                "title": "Charity & Kudzie",
                "monogram": "C&K",
                "date": "2026-12-23T14:00:00",
                "venue": "Imba Manor",
                "venueCity": "Harare",
                "venueCountry": "Zimbabwe",
                "invitationCardStyle": "ivory-floral-gold",
                "childrenPolicy": childrenPolicy
            ],
            "guest": ["id": guestId, "name": name],
            "rsvp": rsvp
        ]
        let data = try! JSONSerialization.data(withJSONObject: payload)
        Stub.routes["GET /api/weddings/\(slug)/guest-session"] = Reply(
            status: 200,
            body: String(data: data, encoding: .utf8)!
        )
    }

    private func answerSucceeds(
        slug: String,
        attending: Bool?,
        mealChoice: String? = nil,
        plusOne: Bool = false,
        plusOneName: String? = nil,
        plusOneMeal: String? = nil,
        kidsAttending: Bool = false,
        kidsCount: Int? = nil,
        dietaryNotes: String? = nil,
        message: String? = nil
    ) {
        var rsvp: [String: Any] = [
            "plusOne": plusOne,
            "kidsAttending": kidsAttending,
            "checkedIn": false
        ]
        if let attending { rsvp["attending"] = attending } else { rsvp["attending"] = NSNull() }
        if let mealChoice { rsvp["mealChoice"] = mealChoice } else { rsvp["mealChoice"] = NSNull() }
        if let plusOneName { rsvp["plusOneName"] = plusOneName } else { rsvp["plusOneName"] = NSNull() }
        if let plusOneMeal { rsvp["plusOneMeal"] = plusOneMeal } else { rsvp["plusOneMeal"] = NSNull() }
        if let kidsCount { rsvp["kidsCount"] = kidsCount } else { rsvp["kidsCount"] = NSNull() }
        if let dietaryNotes { rsvp["dietaryNotes"] = dietaryNotes } else { rsvp["dietaryNotes"] = NSNull() }
        if let message { rsvp["message"] = message } else { rsvp["message"] = NSNull() }

        let payload: [String: Any] = [
            "success": true,
            "rsvp": rsvp
        ]
        let data = try! JSONSerialization.data(withJSONObject: payload)
        Stub.routes["PUT /api/weddings/\(slug)/guest-session"] = Reply(
            status: 200,
            body: String(data: data, encoding: .utf8)!
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

    private func makeSnapshot(
        attending: Bool?,
        mealChoice: String? = nil,
        plusOne: Bool = false,
        plusOneName: String? = nil,
        plusOneMeal: String? = nil,
        kidsAttending: Bool = false,
        kidsCount: Int? = nil,
        dietaryNotes: String? = nil,
        message: String? = nil,
        childrenPolicy: String? = "welcome"
    ) -> GuestInvitationSnapshot {
        GuestInvitationSnapshot(
            weddingSlug: "charity-and-kudzie",
            title: "Charity & Kudzie",
            monogram: "C&K",
            tagline: nil,
            date: "2026-12-23T14:00:00",
            venue: "Imba Manor",
            venueMapUrl: nil,
            venueCity: "Harare",
            venueCountry: "Zimbabwe",
            invitationCardStyle: "ivory-floral-gold",
            invitationCardMessage: nil,
            rsvpDeadline: nil,
            childrenPolicy: childrenPolicy,
            guestId: "guest_live",
            guestName: "Live Guest",
            email: nil,
            tableNumber: nil,
            tableName: nil,
            attending: attending,
            mealChoice: mealChoice,
            plusOne: plusOne,
            plusOneName: plusOneName,
            plusOneMeal: plusOneMeal,
            kidsAttending: kidsAttending,
            kidsCount: kidsCount,
            dietaryNotes: dietaryNotes,
            message: message,
            checkedIn: false,
            checkedInAt: nil
        )
    }

    /// Regression test for independent moderator inspection finding:
    /// The RSVP interaction must remain accessible across PENDING, ACCEPTED, and DECLINED states.
    /// The card may show Accepted / Declined / Pending, but its RSVP action must remain usable.
    func testRsvpActionRemainsReachableAcrossAllStatuses() {
        // 1. Pending presentation: RSVP action exists, label is "RSVP"
        let pendingPres = LiveInvitationPresentation.from(makeSnapshot(attending: nil))
        XCTAssertEqual(pendingPres.rsvpStatus, .pending)
        var pendingPrompted = false
        let pendingActions = resolveLiveInvitationActions(presentation: pendingPres, onRsvpPrompt: { pendingPrompted = true })
        XCTAssertNotNil(pendingActions.onRsvp, "RSVP action must exist for pending presentation")
        pendingActions.onRsvp?()
        XCTAssertTrue(pendingPrompted)
        XCTAssertEqual("RSVP", ivoryRsvpActionLabel(rsvp: ivoryRsvpState(from: pendingPres.rsvpStatus)))

        // 2. Accepted presentation: RSVP action still exists, label is "Update RSVP"
        let acceptedPres = LiveInvitationPresentation.from(makeSnapshot(attending: true, mealChoice: "beef"))
        XCTAssertEqual(acceptedPres.rsvpStatus, .attending)
        var acceptedPrompted = false
        let acceptedActions = resolveLiveInvitationActions(presentation: acceptedPres, onRsvpPrompt: { acceptedPrompted = true })
        XCTAssertNotNil(acceptedActions.onRsvp, "RSVP action must still exist for accepted presentation")
        acceptedActions.onRsvp?()
        XCTAssertTrue(acceptedPrompted)
        XCTAssertEqual("Update RSVP", ivoryRsvpActionLabel(rsvp: ivoryRsvpState(from: acceptedPres.rsvpStatus)))

        // 3. Declined presentation: RSVP action still exists, label is "Update RSVP"
        let declinedPres = LiveInvitationPresentation.from(makeSnapshot(attending: false))
        XCTAssertEqual(declinedPres.rsvpStatus, .declined)
        var declinedPrompted = false
        let declinedActions = resolveLiveInvitationActions(presentation: declinedPres, onRsvpPrompt: { declinedPrompted = true })
        XCTAssertNotNil(declinedActions.onRsvp, "RSVP action must still exist for declined presentation")
        declinedActions.onRsvp?()
        XCTAssertTrue(declinedPrompted)
        XCTAssertEqual("Update RSVP", ivoryRsvpActionLabel(rsvp: ivoryRsvpState(from: declinedPres.rsvpStatus)))
    }

    /// Exercises the full mutation cycles through the existing Guest Session path:
    /// 1. pending -> accept -> refresh -> accepted presentation -> reopen -> change meal/message -> save -> same RSVP record updated
    /// 2. accepted -> reopen -> decline -> save -> refresh shows declined with dormant field preservation
    /// 3. declined -> reopen -> accept -> restore saved dormant details -> save -> refresh shows accepted
    func testExerciseMutationCyclesThroughExistingGuestSessionPath() async {
        // --- START: Pending presentation ---
        exchangeSucceeds(slug: "charity-and-kudzie", guestId: "guest_live", session: "SESSION-1")
        invitationReadsFull(slug: "charity-and-kudzie", guestId: "guest_live", name: "Live Guest", attending: "null")
        let state0 = await coordinator.enter(.privateInvitation(weddingSlug: "charity-and-kudzie", rsvpToken: "TOKEN"))
        guard case let .presenting(snap0) = state0 else {
            return XCTFail("expected presenting state")
        }
        let pres0 = LiveInvitationPresentation.from(snap0)
        XCTAssertEqual(pres0.rsvpStatus, .pending)
        XCTAssertNotNil(resolveLiveInvitationActions(presentation: pres0, onRsvpPrompt: {}).onRsvp)

        // --- CYCLE 1: pending -> accept -> refresh -> accepted presentation -> reopen -> change meal/message -> save ---
        answerSucceeds(slug: "charity-and-kudzie", attending: true, mealChoice: "beef", message: "Joyfully accept!")
        let saveOutcome1 = await coordinator.answer(GuestRsvpUpdate(attending: true, mealChoice: "beef", message: "Joyfully accept!"))
        guard case let .saved(rsvp1) = saveOutcome1 else {
            return XCTFail("expected saved outcome, got \(saveOutcome1)")
        }
        XCTAssertEqual(rsvp1.attending, true)
        XCTAssertEqual(rsvp1.mealChoice, "beef")
        XCTAssertEqual(rsvp1.message, "Joyfully accept!")

        invitationReadsFull(slug: "charity-and-kudzie", guestId: "guest_live", name: "Live Guest", attending: "true", mealChoice: "beef", message: "Joyfully accept!")
        guard case let .presenting(snap1) = await coordinator.refresh() else {
            return XCTFail("expected presenting state after refresh")
        }
        let pres1 = LiveInvitationPresentation.from(snap1)
        XCTAssertEqual(pres1.rsvpStatus, .attending)
        XCTAssertEqual(pres1.mealChoice, "beef")
        XCTAssertEqual(pres1.message, "Joyfully accept!")
        XCTAssertNotNil(resolveLiveInvitationActions(presentation: pres1, onRsvpPrompt: {}).onRsvp)

        // Reopen and edit details (change meal to chicken, update message)
        answerSucceeds(slug: "charity-and-kudzie", attending: true, mealChoice: "chicken", message: "Updated message: see you there!")
        let saveOutcome2 = await coordinator.answer(GuestRsvpUpdate(attending: true, mealChoice: "chicken", message: "Updated message: see you there!"))
        guard case let .saved(rsvp2) = saveOutcome2 else {
            return XCTFail("expected saved outcome, got \(saveOutcome2)")
        }
        XCTAssertEqual(rsvp2.attending, true)
        XCTAssertEqual(rsvp2.mealChoice, "chicken")
        XCTAssertEqual(rsvp2.message, "Updated message: see you there!")

        invitationReadsFull(slug: "charity-and-kudzie", guestId: "guest_live", name: "Live Guest", attending: "true", mealChoice: "chicken", message: "Updated message: see you there!")
        guard case let .presenting(snap2) = await coordinator.refresh() else {
            return XCTFail("expected presenting state after refresh")
        }
        let pres2 = LiveInvitationPresentation.from(snap2)
        XCTAssertEqual(pres2.mealChoice, "chicken")
        XCTAssertEqual(pres2.message, "Updated message: see you there!")
        // Verify same RSVP record updated: both saves carried originGuestId
        XCTAssertTrue(Stub.seenBodies.contains { $0.contains("\"originGuestId\":\"guest_live\"") && $0.contains("\"mealChoice\":\"beef\"") })
        XCTAssertTrue(Stub.seenBodies.contains { $0.contains("\"originGuestId\":\"guest_live\"") && $0.contains("\"mealChoice\":\"chicken\"") })

        // --- CYCLE 2: accepted -> reopen -> decline -> save -> refresh shows declined with dormant field preservation ---
        // When declining, form omits mealChoice (nil) and sets plusOne/kidsAttending false
        answerSucceeds(slug: "charity-and-kudzie", attending: false, mealChoice: "chicken", plusOne: false, kidsAttending: false, message: "Regretfully cannot attend")
        let saveOutcome3 = await coordinator.answer(GuestRsvpUpdate(attending: false, plusOne: false, kidsAttending: false, message: "Regretfully cannot attend"))
        guard case let .saved(rsvp3) = saveOutcome3 else {
            return XCTFail("expected saved outcome, got \(saveOutcome3)")
        }
        XCTAssertEqual(rsvp3.attending, false)
        // Dormant meal is preserved on server
        XCTAssertEqual(rsvp3.mealChoice, "chicken")

        invitationReadsFull(slug: "charity-and-kudzie", guestId: "guest_live", name: "Live Guest", attending: "false", mealChoice: "chicken", plusOne: false, message: "Regretfully cannot attend")
        guard case let .presenting(snap3) = await coordinator.refresh() else {
            return XCTFail("expected presenting state after refresh")
        }
        let pres3 = LiveInvitationPresentation.from(snap3)
        XCTAssertEqual(pres3.rsvpStatus, .declined)
        XCTAssertEqual(pres3.attending, false)
        XCTAssertEqual(pres3.mealChoice, "chicken") // Dormant value retained on server
        XCTAssertNotNil(resolveLiveInvitationActions(presentation: pres3, onRsvpPrompt: {}).onRsvp)

        // --- CYCLE 3: declined -> reopen -> accept -> restore saved dormant details where appropriate -> save -> refresh shows accepted ---
        // Reopen recovers dormant meal ("chicken"), guest adds plus-one
        answerSucceeds(slug: "charity-and-kudzie", attending: true, mealChoice: "chicken", plusOne: true, plusOneName: "Sarah", plusOneMeal: "vegan", message: "Excited to join after all!")
        let saveOutcome4 = await coordinator.answer(GuestRsvpUpdate(attending: true, mealChoice: "chicken", plusOne: true, plusOneName: "Sarah", plusOneMeal: "vegan", message: "Excited to join after all!"))
        guard case let .saved(rsvp4) = saveOutcome4 else {
            return XCTFail("expected saved outcome, got \(saveOutcome4)")
        }
        XCTAssertEqual(rsvp4.attending, true)
        XCTAssertEqual(rsvp4.mealChoice, "chicken")
        XCTAssertEqual(rsvp4.plusOne, true)
        XCTAssertEqual(rsvp4.plusOneName, "Sarah")
        XCTAssertEqual(rsvp4.plusOneMeal, "vegan")

        invitationReadsFull(slug: "charity-and-kudzie", guestId: "guest_live", name: "Live Guest", attending: "true", mealChoice: "chicken", plusOne: true, plusOneName: "Sarah", plusOneMeal: "vegan", message: "Excited to join after all!")
        guard case let .presenting(snap4) = await coordinator.refresh() else {
            return XCTFail("expected presenting state after refresh")
        }
        let pres4 = LiveInvitationPresentation.from(snap4)
        XCTAssertEqual(pres4.rsvpStatus, .attending)
        XCTAssertEqual(pres4.attending, true)
        XCTAssertEqual(pres4.mealChoice, "chicken")
        XCTAssertEqual(pres4.plusOne, true)
        XCTAssertEqual(pres4.plusOneName, "Sarah")
        XCTAssertEqual(pres4.plusOneMeal, "vegan")
        XCTAssertNotNil(resolveLiveInvitationActions(presentation: pres4, onRsvpPrompt: {}).onRsvp)
    }

    /// Blocker 1 Regression Test:
    /// Tapping RSVP/Update RSVP must refresh server truth BEFORE opening the editor.
    /// When guest details are updated on the PWA out-of-band, the native editor receives the fresh
    /// server snapshot.
    func testRsvpEditorReflectsExternalOutOfBandUpdate() async {
        // Initial state: accepted with meal choice "beef"
        exchangeSucceeds(slug: "charity-and-kudzie", guestId: "guest_live", session: "SESSION-1")
        invitationReadsFull(slug: "charity-and-kudzie", guestId: "guest_live", name: "Live Guest", attending: "true", mealChoice: "beef", message: "See you there")
        let state = await coordinator.enter(.privateInvitation(weddingSlug: "charity-and-kudzie", rsvpToken: "TOKEN"))
        guard case let .presenting(snap) = state else {
            return XCTFail("expected presenting state")
        }
        let pres = LiveInvitationPresentation.from(snap)
        XCTAssertEqual(pres.mealChoice, "beef")

        // PWA updates meal choice out-of-band to "vegan"
        invitationReadsFull(slug: "charity-and-kudzie", guestId: "guest_live", name: "Live Guest", attending: "true", mealChoice: "vegan", message: "Switched to vegan")

        // Guest taps Update RSVP on native -> prepareRsvpEditor is called (0 args)
        let prep = await coordinator.prepareRsvpEditor()
        guard case let .ready(snapshot) = prep else {
            return XCTFail("prepareRsvpEditor must be ready, got \(prep)")
        }
        XCTAssertEqual(snapshot.mealChoice, "vegan")
        XCTAssertEqual(snapshot.message, "Switched to vegan")
        let slug = await coordinator.testActiveWeddingSlug
        let guestId = await coordinator.testPresentedGuestId
        XCTAssertEqual(slug, "charity-and-kudzie")
        XCTAssertEqual(guestId, "guest_live")

        // Guest edits message and saves -> save keeps vegan mealChoice
        answerSucceeds(slug: "charity-and-kudzie", attending: true, mealChoice: "vegan", message: "Updated from native")
        let saveOutcome = await coordinator.answer(GuestRsvpUpdate(attending: true, mealChoice: "vegan", message: "Updated from native"))
        guard case let .saved(savedRsvp) = saveOutcome else {
            return XCTFail("expected saved outcome, got \(saveOutcome)")
        }
        XCTAssertEqual(savedRsvp.mealChoice, "vegan")
        XCTAssertEqual(savedRsvp.message, "Updated from native")
    }

    func testRsvpEditorFailsClosedOnSameWeddingGuestReplacement() async {
        exchangeSucceeds(slug: "charity-and-kudzie", guestId: "guest_live", session: "SESSION-1")
        invitationReadsFull(slug: "charity-and-kudzie", guestId: "guest_live", name: "Live Guest", attending: "true", mealChoice: "beef")
        _ = await coordinator.enter(.privateInvitation(weddingSlug: "charity-and-kudzie", rsvpToken: "TOKEN"))
        let initialGuestId = await coordinator.testPresentedGuestId
        XCTAssertEqual(initialGuestId, "guest_live")

        // Server session moves to a different guest within the same wedding
        invitationReadsFull(slug: "charity-and-kudzie", guestId: "guest_other", name: "Other Guest", attending: "true")
        let prep = await coordinator.prepareRsvpEditor()
        XCTAssertEqual(prep, .reopenRequired)
        let finalSlug = await coordinator.testActiveWeddingSlug
        let finalGuest = await coordinator.testPresentedGuestId
        XCTAssertNil(finalSlug)
        XCTAssertNil(finalGuest)
    }

    func testRsvpEditorFailsClosedOnDifferentWeddingReplacement() async {
        exchangeSucceeds(slug: "charity-and-kudzie", guestId: "guest_live", session: "SESSION-1")
        invitationReadsFull(slug: "charity-and-kudzie", guestId: "guest_live", name: "Live Guest", attending: "true")
        _ = await coordinator.enter(.privateInvitation(weddingSlug: "charity-and-kudzie", rsvpToken: "TOKEN"))

        // Server session responds with snapshot for a different wedding when queried
        Stub.routes["GET /api/weddings/charity-and-kudzie/guest-session"] = Reply(
            status: 200,
            body: """
            {"success":true,"authorized":true,\
            "wedding":{"slug":"different-wedding","title":"Other Wedding","monogram":"O&W",\
            "date":"2026-12-23T14:00:00","venue":"Other Venue","venueCity":"Harare",\
            "venueCountry":"Zimbabwe","invitationCardStyle":"ivory-floral-gold",\
            "childrenPolicy":"welcome"},\
            "guest":{"id":"guest_live","name":"Live Guest"},\
            "rsvp":{"attending":true,"checkedIn":false}}
            """
        )
        let prep = await coordinator.prepareRsvpEditor()
        XCTAssertEqual(prep, .reopenRequired)
        let finalSlug = await coordinator.testActiveWeddingSlug
        let finalGuest = await coordinator.testPresentedGuestId
        XCTAssertNil(finalSlug)
        XCTAssertNil(finalGuest)
    }

    func testRsvpEditorReturnsUnavailableOnTransportFailure() async {
        exchangeSucceeds(slug: "charity-and-kudzie", guestId: "guest_live", session: "SESSION-1")
        invitationReadsFull(slug: "charity-and-kudzie", guestId: "guest_live", name: "Live Guest", attending: "true")
        _ = await coordinator.enter(.privateInvitation(weddingSlug: "charity-and-kudzie", rsvpToken: "TOKEN"))

        Stub.routes["GET /api/weddings/charity-and-kudzie/guest-session"] = Reply(status: 503)
        let prep = await coordinator.prepareRsvpEditor()
        XCTAssertEqual(prep, .unavailable(status: 503))
        let finalSlug = await coordinator.testActiveWeddingSlug
        let finalGuest = await coordinator.testPresentedGuestId
        XCTAssertEqual(finalSlug, "charity-and-kudzie")
        XCTAssertEqual(finalGuest, "guest_live")
    }

    func testRsvpEditorHandlesAllStatuses() async {
        let testCases: [(wireAttending: String, expectedBool: Bool?, label: String)] = [
            ("null", nil, "PENDING"),
            ("true", true, "ACCEPTED"),
            ("false", false, "DECLINED")
        ]

        for testCase in testCases {
            exchangeSucceeds(slug: "charity-and-kudzie", guestId: "guest_\(testCase.label)", session: "SESSION-\(testCase.label)")
            invitationReadsFull(slug: "charity-and-kudzie", guestId: "guest_\(testCase.label)", name: "Guest \(testCase.label)", attending: testCase.wireAttending)
            _ = await coordinator.enter(.privateInvitation(weddingSlug: "charity-and-kudzie", rsvpToken: "TOKEN-\(testCase.label)"))

            let prep = await coordinator.prepareRsvpEditor()
            guard case let .ready(snapshot) = prep else {
                return XCTFail("Status \(testCase.label) must be ready, got \(prep)")
            }
            XCTAssertEqual(snapshot.attending, testCase.expectedBool, "Attending mismatch for \(testCase.label)")
            XCTAssertEqual(snapshot.guestId, "guest_\(testCase.label)")
        }
    }
}

