import XCTest
import CryptoKit
@testable import WewedKit

/// LQR01 Workstream 4/6 — the live Guest Pass contract is preserved exactly (same Guest, WW2,
/// asymmetric verification, `qrPayload == token`), and a pass that is not issuable is reported as
/// a distinct availability state instead of a generic transport failure.
final class GuestWeddingPassAvailabilityTests: XCTestCase {

    private struct Reply {
        let status: Int
        var body: String = ""
    }

    private final class Stub: URLProtocol, @unchecked Sendable {
        nonisolated(unsafe) static var routes: [String: Reply] = [:]
        nonisolated(unsafe) static var seen: [String] = []

        static func reset() {
            routes = [:]
            seen = []
        }

        override class func canInit(with request: URLRequest) -> Bool { true }
        override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

        override func startLoading() {
            let key = "\(request.httpMethod ?? "GET") \(request.url?.path ?? "")"
            Stub.seen.append(key)
            let reply = Stub.routes[key] ?? Reply(status: 404)
            let response = HTTPURLResponse(url: request.url!, statusCode: reply.status,
                                           httpVersion: "HTTP/1.1",
                                           headerFields: ["Content-Type": "application/json"])!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: Data(reply.body.utf8))
            client?.urlProtocolDidFinishLoading(self)
        }

        override func stopLoading() {}
    }

    private let slug = "charity-and-kudzie"
    private let passPath = "GET /api/wedding-day/pass"
    private var storage: InMemorySecureStorage!
    private var client: GuestSessionClient!
    private var key: P256.Signing.PrivateKey!
    private var token: String!

    override func setUp() async throws {
        try await super.setUp()
        Stub.reset()
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [Stub.self]
        configuration.httpCookieAcceptPolicy = .never
        configuration.httpShouldSetCookies = false
        storage = InMemorySecureStorage()
        storage.save(key: "wewed.guest.session", value: "GUEST-A-SESSION")
        storage.save(key: "wewed.guest.session.slug", value: slug)
        client = GuestSessionClient(baseUrl: URL(string: "https://wewed.pro")!,
                                    storage: storage,
                                    session: URLSession(configuration: configuration))
        key = P256.Signing.PrivateKey()
        token = try WW2TestSigner.token(key: key, shortId: "wedts26", serial: "WWJD0824", nonce: "66f001ab")
    }

    private func invitation(guestId: String = "guest_a", attending: String = "true") {
        Stub.routes["GET /api/weddings/\(slug)/guest-session"] = Reply(
            status: 200,
            body: """
            {"success":true,"authorized":true,
             "wedding":{"slug":"\(slug)","title":"Charity & Kudzie","date":"2026-12-23T14:00:00",
             "venue":"Imba Manor","venueCity":"Harare","venueCountry":"Zimbabwe"},
             "guest":{"id":"\(guestId)","name":"Guest A"},
             "rsvp":{"attending":\(attending),"checkedIn":false}}
            """
        )
    }

    private func activePassBody(guestId: String = "guest_a") -> String {
        """
        {"success":true,"availability":{"state":"active","code":null},
         "data":{"id":"pass-1","weddingId":"wedding-1","guestId":"\(guestId)","passSerial":"WWJD0824",
         "tokenVersion":"WW2","token":"\(token!)",
         "publicKeyDerBase64":"\(WW2TestSigner.publicKeyDerBase64(key))"}}
        """
    }

    private func unavailable(_ status: Int, state: String, code: String, opensAt: String? = nil) -> Reply {
        let opens = opensAt.map { "\"\($0)\"" } ?? "null"
        return Reply(status: status, body: """
            {"success":false,"code":"\(code)","error":"\(code)",
             "availability":{"state":"\(state)","code":"\(code)","opensAt":\(opens),
             "cutoffAt":null,"expiresAt":null}}
            """)
    }

    private func passError() async -> Error? {
        do {
            _ = try await client.loadWeddingPass(originGuestId: "guest_a")
            return nil
        } catch {
            return error
        }
    }

    // MARK: - Preserved live contract

    func testActivePassKeepsTheExactSignedTokenAsTheQrPayload() async throws {
        invitation()
        Stub.routes[passPath] = Reply(status: 200, body: activePassBody())

        let pass = try await client.loadWeddingPass(originGuestId: "guest_a")
        XCTAssertEqual(Data(pass.qrPayload.utf8), Data(token.utf8), "qrPayload must be the token byte-for-byte")
        XCTAssertEqual(pass.token, token)
        XCTAssertEqual(pass.weddingId, "wedding-1")
    }

    func testAPassForAnotherGuestOrWithABadSignatureIsNeverReturned() async {
        invitation()
        Stub.routes[passPath] = Reply(status: 200, body: activePassBody(guestId: "guest_b"))
        let otherGuest = await passError()
        XCTAssertEqual(otherGuest as? GuestSessionError, .transport(status: 200))

        let tampered = token.replacingOccurrences(of: "WWJD0824", with: "WWJD0825")
        Stub.routes[passPath] = Reply(status: 200, body: activePassBody().replacingOccurrences(of: token, with: tampered))
        let badSignature = await passError()
        XCTAssertEqual(badSignature as? GuestSessionError, .transport(status: 200))
    }

    // MARK: - Availability states

    func testEachNonActiveAvailabilityMapsToItsState() async {
        invitation()
        let cases: [(Reply, WeddingPassAvailability.State, String)] = [
            (unavailable(403, state: "rsvp_required", code: "ATTENDANCE_REQUIRED"), .rsvpRequired, "ATTENDANCE_REQUIRED"),
            (unavailable(403, state: "declined", code: "ATTENDANCE_DECLINED"), .declined, "ATTENDANCE_DECLINED"),
            (unavailable(409, state: "not_yet_issuable", code: "PASS_NOT_YET_ISSUABLE",
                         opensAt: "2026-12-20T14:00:00.000Z"), .notYetIssuable, "PASS_NOT_YET_ISSUABLE"),
            (unavailable(410, state: "issuance_closed", code: "PASS_ISSUANCE_CLOSED"), .issuanceClosed, "PASS_ISSUANCE_CLOSED"),
            (unavailable(410, state: "revoked", code: "PASS_REVOKED"), .revoked, "PASS_REVOKED"),
        ]
        for (reply, state, code) in cases {
            Stub.routes[passPath] = reply
            guard case let .passUnavailable(availability)? = await passError() as? GuestSessionError else {
                XCTFail("\(state) must surface as passUnavailable")
                continue
            }
            XCTAssertEqual(availability.state, state)
            XCTAssertEqual(availability.code, code)
            if state == .notYetIssuable {
                XCTAssertEqual(availability.opensAt, "2026-12-20T14:00:00.000Z")
                XCTAssertNotNil(availability.opensAtDate)
            }
        }
    }

    func testARevokedResponseNeverYieldsAWeddingPass() async {
        invitation()
        // Even if a revoked response also carried a verifiable token, it is never a Wedding Pass.
        let body = """
        {"success":false,"code":"PASS_REVOKED","error":"PASS_REVOKED",
         "availability":{"state":"revoked","code":"PASS_REVOKED"},
         "data":{"id":"pass-1","weddingId":"wedding-1","guestId":"guest_a","token":"\(token!)",
         "publicKeyDerBase64":"\(WW2TestSigner.publicKeyDerBase64(key))"}}
        """
        for status in [410, 200] {
            Stub.routes[passPath] = Reply(status: status, body: body)
            let error = await passError()
            guard case let .passUnavailable(availability)? = error as? GuestSessionError else {
                return XCTFail("HTTP \(status) revoked must not yield a Wedding Pass; got \(String(describing: error))")
            }
            XCTAssertEqual(availability.state, .revoked)
        }
    }

    func testUnrecognisedOrAbsentAvailabilityKeepsTheTransportError() async {
        invitation()
        Stub.routes[passPath] = Reply(status: 503, body: #"{"success":false,"code":"WEDDING_DAY_DISABLED"}"#)
        let disabled = await passError()
        XCTAssertEqual(disabled as? GuestSessionError, .transport(status: 503))

        Stub.routes[passPath] = unavailable(409, state: "something_new", code: "SOMETHING_NEW")
        let unknown = await passError()
        XCTAssertEqual(unknown as? GuestSessionError, .transport(status: 409))

        Stub.routes[passPath] = Reply(status: 500, body: #"{"success":false,"code":"PASS_UNAVAILABLE"}"#)
        let failed = await passError()
        XCTAssertEqual(failed as? GuestSessionError, .transport(status: 500))
    }

    func testTheAttendancePreCheckReportsAvailabilityWithoutRequestingAPass() async {
        invitation(attending: "false")
        let declined = await passError()
        guard case let .passUnavailable(declinedAvailability)? = declined as? GuestSessionError else {
            return XCTFail("declined must surface as passUnavailable, got \(String(describing: declined))")
        }
        XCTAssertEqual(declinedAvailability.state, .declined)

        invitation(attending: "null")
        let pending = await passError()
        guard case let .passUnavailable(pendingAvailability)? = pending as? GuestSessionError else {
            return XCTFail("unanswered must surface as passUnavailable, got \(String(describing: pending))")
        }
        XCTAssertEqual(pendingAvailability.state, .rsvpRequired)

        // A different Guest is an authority failure, never an availability state.
        invitation(guestId: "guest_b", attending: "true")
        let otherGuest = await passError()
        XCTAssertEqual(otherGuest as? GuestSessionError, .unauthorized)

        XCTAssertFalse(Stub.seen.contains(passPath), "no pass may be requested before the pre-check passes")
    }

    func testTheCoordinatorSurfacesTheAvailabilityUnchanged() async {
        invitation()
        Stub.routes[passPath] = unavailable(410, state: "issuance_closed", code: "PASS_ISSUANCE_CLOSED")
        let coordinator = LiveGuestInvitationCoordinator(client: client)
        do {
            _ = try await coordinator.weddingPass(guestId: "guest_a")
            XCTFail("a closed issuance must not produce a Wedding Pass")
        } catch let GuestSessionError.passUnavailable(availability) {
            XCTAssertEqual(availability.state, .issuanceClosed)
        } catch {
            XCTFail("unexpected \(error)")
        }
    }

    // MARK: - Pass tab copy

    func testPassTabCopyIsDistinctPerState() {
        func copy(_ state: WeddingPassAvailability.State) -> String? {
            LiveGuestShellView.passAvailabilityCopy(WeddingPassAvailability(state: state))
        }
        XCTAssertEqual(copy(.notYetIssuable), "Your Wedding Pass will be available closer to the wedding.")
        XCTAssertEqual(copy(.issuanceClosed), "Wedding Pass issuance has closed for this wedding.")
        XCTAssertEqual(copy(.revoked), "This Wedding Pass is no longer valid. Please contact the couple or the wedding team.")
        XCTAssertEqual(copy(.declined), "You declined this invitation, so no Wedding Pass is issued.")
        XCTAssertEqual(copy(.rsvpRequired), "Confirm your attendance to receive your Wedding Pass.")
        XCTAssertNil(copy(.active), "anything else keeps the existing generic unavailable text")

        let all = WeddingPassAvailability.State.allCases.compactMap(copy)
        XCTAssertEqual(Set(all).count, all.count, "each state must read differently")
        for text in all {
            XCTAssertFalse(text.contains("Printed Invitation"))
            XCTAssertFalse(text.contains("Open Invitation"))
        }
        XCTAssertEqual(
            WeddingPassAvailability.State.allCases.map(\.rawValue),
            ["rsvp_required", "declined", "not_yet_issuable", "active", "issuance_closed", "revoked"]
        )
    }

    func testAvailableFromLabelOnlyWhenOpensAtParses() {
        let opening = WeddingPassAvailability(state: .notYetIssuable, code: "PASS_NOT_YET_ISSUABLE",
                                              opensAt: "2026-12-20T14:00:00.000Z")
        let label = LiveGuestShellView.passAvailableFromLabel(opening)
        XCTAssertNotNil(label)
        XCTAssertTrue(label?.hasPrefix("Available from ") == true)

        XCTAssertNil(LiveGuestShellView.passAvailableFromLabel(
            WeddingPassAvailability(state: .notYetIssuable, opensAt: "soon")))
        XCTAssertNil(LiveGuestShellView.passAvailableFromLabel(
            WeddingPassAvailability(state: .issuanceClosed, opensAt: "2026-12-20T14:00:00.000Z")))
    }
}
