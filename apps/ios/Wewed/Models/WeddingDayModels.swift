import Foundation

/// Represents real-time operational vendor presence on the wedding day.
public enum VendorPresenceState: String, Codable, Sendable, CaseIterable {
    case notRecorded = "NOT_RECORDED"
    case scheduled = "SCHEDULED"
    case enRoute = "EN_ROUTE"
    case arrived = "ARRIVED"
    case serviceActive = "SERVICE_ACTIVE"
    case completed = "COMPLETED"

    public var title: String {
        switch self {
        case .notRecorded: return "Not recorded"
        case .scheduled: return "Scheduled"
        case .enRoute: return "En Route"
        case .arrived: return "Arrived on Site"
        case .serviceActive: return "Service Active"
        case .completed: return "Completed"
        }
    }
}

public struct VendorPresence: Codable, Identifiable, Equatable, Sendable {
    public let id: String
    public let vendorName: String
    public let serviceCategory: String
    public let serviceArea: String
    public var state: VendorPresenceState
    public let expectedTime: String
    public var lastUpdated: Date

    public init(
        id: String,
        vendorName: String,
        serviceCategory: String,
        serviceArea: String,
        state: VendorPresenceState = .notRecorded,
        expectedTime: String,
        lastUpdated: Date = Date()
    ) {
        self.id = id
        self.vendorName = vendorName
        self.serviceCategory = serviceCategory
        self.serviceArea = serviceArea
        self.state = state
        self.expectedTime = expectedTime
        self.lastUpdated = lastUpdated
    }
}

/// Day-of announcement broadcast to guests, bridal party, or vendors.
public enum AnnouncementUrgency: String, Codable, Sendable {
    case info = "INFO"
    case action = "ACTION"
    case alert = "ALERT"
}

public struct WeddingAnnouncement: Codable, Identifiable, Equatable, Sendable {
    public let id: String
    public let title: String
    public let message: String
    public let urgency: AnnouncementUrgency
    public let timestamp: Date

    public init(
        id: String = UUID().uuidString,
        title: String,
        message: String,
        urgency: AnnouncementUrgency = .info,
        timestamp: Date = Date()
    ) {
        self.id = id
        self.title = title
        self.message = message
        self.urgency = urgency
        self.timestamp = timestamp
    }
}

/// Resolved invitation context for deep-link restoration and Ivory presentation.
public struct InvitationContext: Codable, Identifiable, Equatable, Sendable {
    public var id: String { guestToken }
    public let weddingSlug: String
    public let guestToken: String
    public let coupleNames: String
    public let guestName: String
    public let householdName: String?
    public let partySize: Int
    public let weddingDate: String
    public let venueName: String
    public let venueCity: String
    public let cardStyle: String
    public var isConfirmed: Bool
    /// Stable guest record id; keeps a guest session bound to the same person after RSVP.
    public let guestId: String?
    public let venue: VenueLocation?

    public init(
        weddingSlug: String,
        guestToken: String,
        coupleNames: String,
        guestName: String,
        householdName: String? = nil,
        partySize: Int,
        weddingDate: String,
        venueName: String,
        venueCity: String,
        cardStyle: String = "ivory-floral-gold",
        isConfirmed: Bool = false,
        guestId: String? = nil,
        venue: VenueLocation? = nil
    ) {
        self.guestId = guestId
        self.venue = venue
        self.weddingSlug = weddingSlug
        self.guestToken = guestToken
        self.coupleNames = coupleNames
        self.guestName = guestName
        self.householdName = householdName
        self.partySize = partySize
        self.weddingDate = weddingDate
        self.venueName = venueName
        self.venueCity = venueCity
        self.cardStyle = cardStyle
        self.isConfirmed = isConfirmed
    }
}
