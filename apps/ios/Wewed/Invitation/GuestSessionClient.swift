import Foundation

/// Who the server says this device's guest is, after a credential has been exchanged.
public struct GuestSessionIdentity: Equatable, Sendable {
    public let weddingSlug: String
    public let guestId: String
    public let guestName: String
}

/// Everything the invitation needs, as the wedding's own authority reports it.
public struct GuestInvitationSnapshot: Equatable, Sendable {
    public let weddingSlug: String
    public let title: String
    public let monogram: String?
    public let tagline: String?
    public let date: String?
    public let venue: String?
    public let venueMapUrl: String?
    public let venueCity: String?
    public let venueCountry: String?
    public let invitationCardStyle: String?
    public let invitationCardMessage: String?
    public let rsvpDeadline: String?
    public let childrenPolicy: String?
    public let guestId: String
    public let guestName: String
    public let email: String?
    public let tableNumber: Int?
    /// e.g. "Table 1 — Family". Server-projected; never another guest's record.
    public let tableName: String?
    public let attending: Bool?
    public let mealChoice: String?
    public let plusOne: Bool
    public let plusOneName: String?
    public let plusOneMeal: String?
    public let kidsAttending: Bool
    public let kidsCount: Int?
    public let dietaryNotes: String?
    public let message: String?
    public let checkedIn: Bool
    public let checkedInAt: String?
}

/// Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 9 — Digital Invitation + RSVP
/// convergence.
///
/// The full guest-editable RSVP field set, matching the server's shared `applyGuestRsvpUpdate`
/// operation exactly (`GUEST_RSVP_FIELDS` in the server's `guest-rsvp-mutation.ts`) — the SAME
/// fields the PWA's premium invitation RSVP dialog can already edit.
///
/// `nil` means "leave this field exactly as it is currently stored" — ``GuestSessionClient/saveRsvp(weddingSlug:originGuestId:update:)``
/// never sends a key for a `nil` property at all, so a partial edit (e.g. changing only the meal
/// choice) can never erase an already-saved answer for every other field. This is deliberately NOT
/// the same as "clear this field": to intentionally clear a free-text field (`mealChoice`/
/// `plusOneName`/`plusOneMeal`/`dietaryNotes`/`message`), send an empty string — the server already
/// trims an empty string to a stored `nil` for exactly this purpose. Booleans/`kidsCount` have no
/// "cleared" state on the wire; omitting them (leaving the property `nil` here) is the only way to
/// leave them untouched.
public struct GuestRsvpUpdate: Equatable, Sendable {
    public let attending: Bool?
    public let mealChoice: String?
    public let plusOne: Bool?
    public let plusOneName: String?
    public let plusOneMeal: String?
    public let kidsAttending: Bool?
    public let kidsCount: Int?
    public let dietaryNotes: String?
    public let message: String?

    public init(
        attending: Bool? = nil,
        mealChoice: String? = nil,
        plusOne: Bool? = nil,
        plusOneName: String? = nil,
        plusOneMeal: String? = nil,
        kidsAttending: Bool? = nil,
        kidsCount: Int? = nil,
        dietaryNotes: String? = nil,
        message: String? = nil
    ) {
        self.attending = attending
        self.mealChoice = mealChoice
        self.plusOne = plusOne
        self.plusOneName = plusOneName
        self.plusOneMeal = plusOneMeal
        self.kidsAttending = kidsAttending
        self.kidsCount = kidsCount
        self.dietaryNotes = dietaryNotes
        self.message = message
    }
}

/// The RSVP exactly as the server now stores it, returned from a successful
/// ``GuestSessionClient/saveRsvp(weddingSlug:originGuestId:update:)``.
public struct GuestRsvpRecord: Equatable, Sendable {
    public let attending: Bool?
    public let mealChoice: String?
    public let plusOne: Bool
    public let plusOneName: String?
    public let plusOneMeal: String?
    public let kidsAttending: Bool
    public let kidsCount: Int?
    public let dietaryNotes: String?
    public let message: String?

    public init(
        attending: Bool?,
        mealChoice: String?,
        plusOne: Bool,
        plusOneName: String?,
        plusOneMeal: String?,
        kidsAttending: Bool,
        kidsCount: Int?,
        dietaryNotes: String?,
        message: String?
    ) {
        self.attending = attending
        self.mealChoice = mealChoice
        self.plusOne = plusOne
        self.plusOneName = plusOneName
        self.plusOneMeal = plusOneMeal
        self.kidsAttending = kidsAttending
        self.kidsCount = kidsCount
        self.dietaryNotes = dietaryNotes
        self.message = message
    }
}

/// What happened when a guest answered.
public enum RsvpSaveResult: Equatable, Sendable {
    /// Master plan Phase 9 — carries the full record the server actually stored, not just
    /// `attending`.
    case saved(rsvp: GuestRsvpRecord)
    /// The session moved on while the form was open — Guest B became authoritative, or the session
    /// expired. The server refuses rather than writing the answer to whoever is active now.
    case staleGuestContext
    case childrenNotAllowed
    case notAuthorized
    case failed(status: Int)
}

public enum GuestSessionError: Error, Equatable, Sendable {
    case unauthorized
    case transport(status: Int)
}

/// The native client of Wewed's existing guest-session authority.
///
/// There is one guest identity system, and it lives on the server. This type is a first-class
/// client of it — it exchanges the private credential for a session over JSON and holds the session
/// the server issues — rather than a second auth model or a browser whose cookie jar we read.
///
/// Three rules shape the whole type:
///
/// 1. The **raw RSVP credential is never persisted**. It is a key for the door, not a name badge.
///    Only the server-issued session credential is stored, in the Keychain.
/// 2. **Nothing is logged.** Invitation URLs and credentials never reach the console, analytics or
///    a crash report, so there is deliberately no logging in this file at all.
/// 3. **Replacement is atomic.** A new credential replaces the active guest only after the server
///    has validated it. An invalid Guest B link leaves Guest A exactly as they were.
public actor GuestSessionClient {

    /// Mirrors `WEDDING_GUEST_SESSION_COOKIE` on the server.
    public static let sessionCookie = "wewed_wedding_guest"
    private static let storedSession = "wewed.guest.session"
    private static let storedSlug = "wewed.guest.session.slug"

    private var entryGeneration = 0
    private let baseUrl: URL
    private let storage: SecureStorageProtocol
    private let session: URLSession

    public init(baseUrl: URL, storage: SecureStorageProtocol, session: URLSession? = nil) {
        self.baseUrl = baseUrl
        self.storage = storage
        if let session {
            self.session = session
        } else {
            let configuration = URLSessionConfiguration.ephemeral
            // The app manages the guest credential itself, in the Keychain. Letting URLSession keep
            // its own cookie jar would create a second, invisible copy of the session.
            configuration.httpCookieAcceptPolicy = .never
            configuration.httpShouldSetCookies = false
            self.session = URLSession(configuration: configuration)
        }
    }

    public func activeSessionSlug() -> String? { storage.get(key: Self.storedSlug) }
    public func hasActiveSession() -> Bool { storage.get(key: Self.storedSession) != nil }

    /// Ends the guest session on this device. Used by Sign Out, never by a failed exchange.
    public func clearSession() {
        entryGeneration += 1
        storage.delete(key: Self.storedSession)
        storage.delete(key: Self.storedSlug)
    }

    /// Exchanges the guest's private invitation credential for a session.
    ///
    /// `POST /api/weddings/{slug}/guest-session` is the server's own native-shaped entry point: it
    /// takes the token as JSON and answers with the guest's identity. The credential is used here
    /// and then dropped.
    public func exchangePrivateInvitation(
        weddingSlug: String,
        rsvpToken: String
    ) async throws -> GuestSessionIdentity {
        entryGeneration += 1
        let generation = entryGeneration
        let body = try JSONSerialization.data(withJSONObject: ["token": rsvpToken])
        // The exchange must not present an existing session: this call is how a *different* guest
        // takes over, and sending Guest A's cookie invites the server to keep them.
        let response = try await perform(
            method: "POST",
            path: "/api/weddings/\(encode(weddingSlug))/guest-session",
            body: body,
            withSession: false
        )
        guard response.status == 200,
              let payload = response.body,
              let json = try? JSONSerialization.jsonObject(with: payload) as? [String: Any],
              json["success"] as? Bool == true
        else {
            throw response.status == 401
                ? GuestSessionError.unauthorized
                : GuestSessionError.transport(status: response.status)
        }
        // Only now — after the server has accepted Guest B — is Guest A replaced.
        guard let issued = response.issuedSession else {
            throw GuestSessionError.transport(status: response.status)
        }
        let slug = (json["wedding"] as? [String: Any])?["slug"] as? String ?? weddingSlug
        guard entryGeneration == generation else { throw GuestSessionError.unauthorized }
        storage.save(key: Self.storedSession, value: issued)
        storage.save(key: Self.storedSlug, value: slug)

        let guest = json["guest"] as? [String: Any]
        return GuestSessionIdentity(
            weddingSlug: slug,
            guestId: guest?["id"] as? String ?? "",
            guestName: guest?["name"] as? String ?? ""
        )
    }

    /// Redeems a one-time install handoff.
    ///
    /// `/invite/resume` answers with a redirect and a session cookie. The redirect is not followed —
    /// the destination is a web page this app has no use for. What matters is the credential on the
    /// response, and the fact that the server has just decided who the guest is.
    public func redeemHandoff(_ secret: String) async throws -> GuestSessionIdentity {
        entryGeneration += 1
        let generation = entryGeneration
        guard InvitationEntryParser.isValidHandoff(secret) else {
            throw GuestSessionError.unauthorized
        }
        let response = try await perform(
            method: "GET",
            path: "/invite/resume?h=\(encode(secret))",
            body: nil,
            withSession: false,
            followRedirects: false
        )
        // A rejected handoff redirects to the recovery page without issuing a session. The active
        // guest is intentionally left alone.
        guard let issued = response.issuedSession else {
            throw (300...399).contains(response.status)
                ? GuestSessionError.unauthorized
                : GuestSessionError.transport(status: response.status)
        }

        // The redirect names the wedding: `/w/<slug>?invitation=1&…`. Reading it is what makes a
        // deferred install work at all — a freshly installed app holds no previous session, so
        // asking storage which wedding this is would fail for exactly the guest this path exists
        // to serve.
        guard let slug = Self.weddingSlugFromResume(response.location) else {
            throw GuestSessionError.unauthorized
        }

        // Persisted only once everything has validated. Writing the session earlier would let a
        // half-successful redemption overwrite the guest who was already here.
        guard entryGeneration == generation else { throw GuestSessionError.unauthorized }
        storage.save(key: Self.storedSession, value: issued)
        storage.save(key: Self.storedSlug, value: slug)

        let snapshot = try await loadInvitation(weddingSlug: slug)
        return GuestSessionIdentity(weddingSlug: snapshot.weddingSlug,
                                    guestId: snapshot.guestId,
                                    guestName: snapshot.guestName)
    }

    /// Reads the current guest's invitation from the wedding's own authority.
    public func loadInvitation(weddingSlug: String? = nil) async throws -> GuestInvitationSnapshot {
        guard let target = weddingSlug ?? storage.get(key: Self.storedSlug) else {
            throw GuestSessionError.unauthorized
        }
        let response = try await perform(
            method: "GET",
            path: "/api/weddings/\(encode(target))/guest-session",
            body: nil,
            withSession: true
        )
        if response.status == 401 { throw GuestSessionError.unauthorized }
        guard response.status == 200, let payload = response.body,
              let json = try? JSONSerialization.jsonObject(with: payload) as? [String: Any]
        else { throw GuestSessionError.transport(status: response.status) }

        let wedding = json["wedding"] as? [String: Any] ?? [:]
        let guest = json["guest"] as? [String: Any] ?? [:]
        let rsvp = json["rsvp"] as? [String: Any] ?? [:]
        func text(_ source: [String: Any], _ key: String) -> String? {
            guard let value = source[key] as? String, !value.isEmpty, value != "null" else { return nil }
            return value
        }
        return GuestInvitationSnapshot(
            weddingSlug: text(wedding, "slug") ?? target,
            title: text(wedding, "title") ?? "",
            monogram: text(wedding, "monogram"),
            tagline: text(wedding, "tagline"),
            date: text(wedding, "date"),
            venue: text(wedding, "venue"),
            venueMapUrl: text(wedding, "venueMapUrl"),
            venueCity: text(wedding, "venueCity"),
            venueCountry: text(wedding, "venueCountry"),
            invitationCardStyle: text(wedding, "invitationCardStyle"),
            invitationCardMessage: text(wedding, "invitationCardMessage"),
            rsvpDeadline: text(wedding, "rsvpDeadline"),
            childrenPolicy: text(wedding, "childrenPolicy"),
            guestId: text(guest, "id") ?? "",
            guestName: text(guest, "name") ?? "",
            email: text(guest, "email"),
            tableNumber: guest["tableNumber"] as? Int,
            tableName: text(guest, "tableName"),
            attending: rsvp["attending"] as? Bool,
            mealChoice: text(rsvp, "mealChoice"),
            plusOne: rsvp["plusOne"] as? Bool ?? false,
            plusOneName: text(rsvp, "plusOneName"),
            plusOneMeal: text(rsvp, "plusOneMeal"),
            kidsAttending: rsvp["kidsAttending"] as? Bool ?? false,
            kidsCount: rsvp["kidsCount"] as? Int,
            dietaryNotes: text(rsvp, "dietaryNotes"),
            message: text(rsvp, "message"),
            checkedIn: rsvp["checkedIn"] as? Bool ?? false,
            checkedInAt: text(rsvp, "checkedInAt")
        )
    }

    /// Saves the guest's answer.
    ///
    /// `originGuestId` is the binding the server checks. It is what turns "save this answer" into
    /// "save this answer *for the guest whose card is open*", so an answer typed as Guest A can
    /// never land on Guest B after a switch.
    ///
    /// Master plan Phase 9 — `update` carries the full converged RSVP field set; only the
    /// properties a caller actually set are sent, so a partial edit (e.g. changing only
    /// ``GuestRsvpUpdate/mealChoice``) can never overwrite an unrelated already-saved answer. The
    /// exact PATCH/PUT semantics follow the server's own shared `applyGuestRsvpUpdate` operation —
    /// this method never re-implements them.
    public func saveRsvp(
        weddingSlug: String,
        originGuestId: String,
        update: GuestRsvpUpdate
    ) async throws -> RsvpSaveResult {
        var payload: [String: Any] = ["originGuestId": originGuestId]
        if let attending = update.attending { payload["attending"] = attending }
        if let mealChoice = update.mealChoice { payload["mealChoice"] = mealChoice }
        if let plusOne = update.plusOne { payload["plusOne"] = plusOne }
        if let plusOneName = update.plusOneName { payload["plusOneName"] = plusOneName }
        if let plusOneMeal = update.plusOneMeal { payload["plusOneMeal"] = plusOneMeal }
        if let kidsAttending = update.kidsAttending { payload["kidsAttending"] = kidsAttending }
        if let kidsCount = update.kidsCount { payload["kidsCount"] = kidsCount }
        if let dietaryNotes = update.dietaryNotes { payload["dietaryNotes"] = dietaryNotes }
        if let message = update.message { payload["message"] = message }
        let response = try await perform(
            method: "PUT",
            path: "/api/weddings/\(encode(weddingSlug))/guest-session",
            body: try JSONSerialization.data(withJSONObject: payload),
            withSession: true
        )
        switch response.status {
        case 200:
            let json = response.body.flatMap {
                try? JSONSerialization.jsonObject(with: $0) as? [String: Any]
            }
            let rsvp = json?["rsvp"] as? [String: Any] ?? [:]
            return .saved(rsvp: GuestRsvpRecord(fromResponse: rsvp))
        case 401:
            return .notAuthorized
        case 409:
            return .staleGuestContext
        case 400:
            let json = response.body.flatMap {
                try? JSONSerialization.jsonObject(with: $0) as? [String: Any]
            }
            return json?["code"] as? String == "CHILDREN_NOT_ALLOWED"
                ? .childrenNotAllowed
                : .failed(status: 400)
        default:
            return .failed(status: response.status)
        }
    }

    public func publishedStory(slug: String) async throws -> String {
        let response = try await perform(method: "GET", path: "/api/wedding-content?slug=\(encode(slug))", body: nil, withSession: true)
        guard response.status == 200, let body = response.body,
              let json = try JSONSerialization.jsonObject(with: body) as? [String: Any],
              let data = json["data"] as? [String: Any] else { throw GuestSessionError.transport(status: response.status) }
        let story = (data["content"] as? [String: Any])?["story"] as? [String: String] ?? [:]
        return ["heading", "title", "subtitle", "body", "introduction"].compactMap { story[$0] }.filter { !$0.isEmpty }.joined(separator: "\n\n")
    }

    public func loadWeddingDay(originGuestId: String) async throws -> GuestWeddingDay {
        let response = try await perform(method: "GET", path: "/api/wedding-day/guest", body: nil, withSession: true)
        guard response.status == 200, let body = response.body else { throw GuestSessionError.transport(status: response.status) }
        let value = try JSONDecoder().decode(GuestWeddingDayEnvelope.self, from: body).data
        guard value.guest.id == originGuestId else { throw GuestSessionError.unauthorized }
        return value
    }

    public func loadWeddingPass(originGuestId: String) async throws -> WeddingPass {
        let snapshot = try await loadInvitation()
        guard snapshot.guestId == originGuestId, snapshot.attending == true else { throw GuestSessionError.unauthorized }
        let response = try await perform(method: "GET", path: "/api/wedding-day/pass", body: nil, withSession: true)
        guard response.status == 200, let body = response.body,
              let json = try JSONSerialization.jsonObject(with: body) as? [String: Any],
              let data = json["data"] as? [String: Any],
              data["guestId"] as? String == originGuestId,
              let weddingId = data["weddingId"] as? String,
              let token = data["token"] as? String, token.hasPrefix("WW2."),
              let key = data["publicKeyDerBase64"] as? String,
              case .success = TokenVerifier.verifyAsymmetric(token: token, publicKeyDerBase64: key)
        else { throw GuestSessionError.transport(status: response.status) }
        return WeddingPass(token: token, weddingId: weddingId, coupleNames: snapshot.title,
            weddingDate: snapshot.date ?? "", venueName: snapshot.venue ?? "",
            venueAddress: [snapshot.venueCity, snapshot.venueCountry].compactMap { $0 }.joined(separator: ", "),
            guestName: snapshot.guestName,
            partySize: 1 + (snapshot.plusOne ? 1 : 0) + (snapshot.kidsAttending ? snapshot.kidsCount ?? 0 : 0),
            tableNumber: snapshot.tableNumber, tableName: snapshot.tableName, qrPayload: token)
    }

    private struct Response {
        let status: Int
        let body: Data?
        let issuedSession: String?
        /// Where a redirect pointed. The resume route names the wedding here.
        let location: String?
    }

    private func perform(
        method: String,
        path: String,
        body: Data?,
        withSession: Bool,
        followRedirects: Bool = true
    ) async throws -> Response {
        guard let url = URL(string: baseUrl.absoluteString.trimmingTrailingSlash() + path) else {
            throw GuestSessionError.transport(status: -1)
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("native", forHTTPHeaderField: "x-wewed-client")
        let sentSession = withSession ? storage.get(key: Self.storedSession) : nil
        if let stored = sentSession {
            request.setValue("\(Self.sessionCookie)=\(stored)", forHTTPHeaderField: "Cookie")
        }
        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        let delegate = followRedirects ? nil : RedirectBlocker()
        let (data, raw) = try await session.data(for: request, delegate: delegate)
        guard let http = raw as? HTTPURLResponse else {
            throw GuestSessionError.transport(status: -1)
        }
        let refreshed = Self.issuedSessionCookie(http)
        if withSession {
            // Actor reentrancy: a delayed A response cannot replace, clear or render over B.
            guard storage.get(key: Self.storedSession) == sentSession else {
                throw GuestSessionError.unauthorized
            }
            if http.statusCode == 401 { clearSession() }
            else if (200...299).contains(http.statusCode), let refreshed {
                storage.save(key: Self.storedSession, value: refreshed)
            }
        }
        return Response(status: http.statusCode, body: data,
                        issuedSession: refreshed,
                        location: http.value(forHTTPHeaderField: "Location"))
    }

    /// The wedding a successful resume redirected to.
    ///
    /// Only a canonical Wewed wedding destination counts. The recovery page a rejected handoff
    /// redirects to (`/guest-access-help`) deliberately yields nil, and so does anything pointing
    /// off-origin — a redirect is attacker-influenceable in general, so it is read as a claim to be
    /// validated rather than as an instruction.
    static func weddingSlugFromResume(_ location: String?) -> String? {
        guard let raw = location?.trimmingCharacters(in: .whitespaces), !raw.isEmpty else {
            return nil
        }
        let path: String
        if raw.hasPrefix("/") {
            path = raw
        } else {
            guard let components = URLComponents(string: raw) else { return nil }
            if let host = components.host?.lowercased(),
               host != "wewed.pro", host != "www.wewed.pro" { return nil }
            path = components.path
        }
        let segments = path.split(separator: "?")[0]
            .split(separator: "/")
            .map(String.init)
            .filter { !$0.isEmpty }
        guard segments.count >= 2, segments[0].lowercased() == "w" else { return nil }
        let slug = segments[1].removingPercentEncoding ?? segments[1]
        return slug.isEmpty ? nil : slug
    }

    /// Extracts the session the server issued, without touching any other cookie it sets.
    static func issuedSessionCookie(_ response: HTTPURLResponse) -> String? {
        let header = response.value(forHTTPHeaderField: "Set-Cookie")
            ?? (response.allHeaderFields.first {
                ($0.key as? String)?.lowercased() == "set-cookie"
            }?.value as? String)
        guard let header else { return nil }
        // Several cookies can share one header. Only the guest session is of interest.
        for candidate in header.split(separator: ",") {
            let first = candidate.split(separator: ";").first.map(String.init) ?? ""
            let parts = first.split(separator: "=", maxSplits: 1).map(String.init)
            guard parts.count == 2 else { continue }
            if parts[0].trimmingCharacters(in: .whitespaces).lowercased()
                == sessionCookie.lowercased() {
                let value = parts[1].trimmingCharacters(in: .whitespaces)
                if !value.isEmpty { return value }
            }
        }
        return nil
    }

    private func encode(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? value
    }
}

/// Refuses to follow redirects so the caller can read the response the server actually returned.
private final class RedirectBlocker: NSObject, URLSessionTaskDelegate, Sendable {
    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest
    ) async -> URLRequest? {
        nil
    }
}

private extension String {
    func trimmingTrailingSlash() -> String {
        hasSuffix("/") ? String(dropLast()) : self
    }
}

extension GuestRsvpRecord {
    /// Maps a `{ "rsvp": {...} }` response payload's `rsvp` object into ``GuestRsvpRecord``.
    init(fromResponse json: [String: Any]) {
        func text(_ key: String) -> String? {
            guard let value = json[key] as? String, !value.isEmpty, value != "null" else { return nil }
            return value
        }
        self.init(
            attending: json["attending"] as? Bool,
            mealChoice: text("mealChoice"),
            plusOne: json["plusOne"] as? Bool ?? false,
            plusOneName: text("plusOneName"),
            plusOneMeal: text("plusOneMeal"),
            kidsAttending: json["kidsAttending"] as? Bool ?? false,
            kidsCount: json["kidsCount"] as? Int,
            dietaryNotes: text("dietaryNotes"),
            message: text("message")
        )
    }
}

public struct GuestWeddingDay: Decodable, Sendable {
    public struct Guest: Decodable, Sendable {
        public let id: String
        public let tableNumber: Int?
        public let tableName: String?
        public let checkedIn: Bool
        public let household: [Member]
    }
    public struct Member: Decodable, Sendable { public let attendeeKey: String; public let attendeeName: String }
    public struct Programme: Decodable, Sendable { public let id: String; public let time: String; public let title: String; public let description: String?; public let location: String? }
    public struct Announcement: Decodable, Sendable { public let id: String; public let title: String?; public let body: String }
    public let guest: Guest
    public let programme: [Programme]
    public let announcements: [Announcement]
}
private struct GuestWeddingDayEnvelope: Decodable { let data: GuestWeddingDay }
