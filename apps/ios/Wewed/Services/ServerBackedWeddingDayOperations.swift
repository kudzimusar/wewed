import Foundation

/// Server-backed operations for Wedding Day APIs on iOS.
/// Connects to real Next.js API routes when operating in isolatedWeddingDay or production modes.
public actor ServerBackedWeddingDayOperations: Sendable {
    private let baseURL: URL
    private let bearerToken: String
    private let weddingId: String
    private let session: URLSession
    private let decoder = JSONDecoder()

    public init(
        baseURL: URL,
        bearerToken: String,
        weddingId: String,
        session: URLSession = .shared
    ) {
        self.baseURL = baseURL
        self.bearerToken = bearerToken
        self.weddingId = weddingId
        self.session = session
    }

    /// Fetches the guest's Wedding Pass from the server-backed endpoint.
    public func getWeddingPass(token: String) async throws -> WeddingPass? {
        let url = baseURL.appendingPathComponent("api/wedding-day/pass")
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if !bearerToken.isEmpty {
            request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        }
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            return nil
        }

        struct PassEnvelope: Codable {
            let success: Bool
            let data: PassPayload
        }
        struct PassPayload: Codable {
            let id: String
            let weddingId: String
            let guestId: String
            let passSerial: String
            let token: String
        }

        guard let envelope = try? decoder.decode(PassEnvelope.self, from: data), envelope.success else {
            return nil
        }

        return WeddingPass(
            token: envelope.data.token,
            weddingId: envelope.data.weddingId,
            coupleNames: "Wedding Couple",
            weddingDate: ISO8601DateFormatter().string(from: Date()),
            venueName: "Ceremony Venue",
            venueAddress: "Harare, Zimbabwe",
            guestName: "Valued Guest",
            householdName: nil,
            partySize: 1,
            tableNumber: nil,
            tableName: nil,
            seatNumber: nil,
            currentStage: .attending,
            qrPayload: envelope.data.token
        )
    }

    /// Fetches active announcements from the server.
    public func getAnnouncements() async throws -> [WeddingAnnouncement] {
        let url = baseURL.appendingPathComponent("api/wedding-day/announcements")
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if !bearerToken.isEmpty {
            request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        }
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            return []
        }

        struct AnnouncementEnvelope: Codable {
            let success: Bool
            let data: [AnnouncementPayload]
        }
        struct AnnouncementPayload: Codable {
            let id: String?
            let title: String?
            let body: String
            let urgency: String?
            let createdAt: String?
        }

        guard let envelope = try? decoder.decode(AnnouncementEnvelope.self, from: data), envelope.success else {
            return []
        }

        return envelope.data.map { item in
            WeddingAnnouncement(
                id: item.id ?? UUID().uuidString,
                title: item.title ?? "Announcement",
                message: item.body,
                urgency: item.urgency == "high" ? .alert : .info,
                timestamp: Date()
            )
        }
    }

    /// Publishes a wedding day announcement.
    public func postAnnouncement(
        title: String,
        message: String,
        urgency: AnnouncementUrgency
    ) async throws -> WeddingAnnouncement? {
        let url = baseURL.appendingPathComponent("api/wedding-day/announcements")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let payload: [String: Any] = [
            "title": title,
            "body": message,
            "audience": "all"
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            return nil
        }

        struct CreateEnvelope: Codable {
            let success: Bool
            let data: CreatedItem
        }
        struct CreatedItem: Codable {
            let id: String
            let title: String?
            let body: String
        }

        guard let envelope = try? decoder.decode(CreateEnvelope.self, from: data), envelope.success else {
            return nil
        }

        return WeddingAnnouncement(
            id: envelope.data.id,
            title: envelope.data.title ?? title,
            message: envelope.data.body,
            urgency: urgency,
            timestamp: Date()
        )
    }

    /// Transitions vendor presence on site.
    public func updateVendorState(
        serviceEngagementId: String,
        state: VendorPresenceState
    ) async throws -> VendorPresence? {
        let url = baseURL.appendingPathComponent("api/wedding-day/vendors/presence")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let stateString: String
        switch state {
        case .scheduled: stateString = "CONFIRMED"
        case .enRoute: stateString = "EN_ROUTE"
        case .arrived: stateString = "ARRIVED_ON_SITE"
        case .serviceActive: stateString = "SERVICE_ACTIVE"
        case .completed: stateString = "COMPLETED"
        }

        let payload: [String: Any] = [
            "serviceEngagementId": serviceEngagementId,
            "state": stateString
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            return nil
        }

        struct PresenceEnvelope: Codable {
            let success: Bool
        }
        guard let envelope = try? decoder.decode(PresenceEnvelope.self, from: data), envelope.success else {
            return nil
        }

        return VendorPresence(
            id: serviceEngagementId,
            vendorName: "Vendor Service",
            serviceCategory: "Service Provider",
            serviceArea: "Main Venue",
            state: state,
            expectedTime: "On Site",
            lastUpdated: Date()
        )
    }
}
