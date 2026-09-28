import Foundation

public enum RSVPStatus: String, Codable, CaseIterable, Sendable {
    case attending = "attending"
    case declined = "declined"
    case pending = "pending"

    public var title: String {
        switch self {
        case .attending: return "Attending"
        case .declined: return "Declined"
        case .pending: return "Pending"
        }
    }
}

public struct Guest: Identifiable, Codable, Equatable, Sendable {
    public let id: String
    public var name: String
    public var householdName: String?
    public var partySize: Int
    public var side: String?
    public var rsvpStatus: RSVPStatus
    public var tableNumber: Int?
    public var tableName: String?
    public var checkedIn: Bool
    public var checkedInCount: Int
    public var passSerial: String?

    public init(
        id: String,
        name: String,
        householdName: String? = nil,
        partySize: Int = 1,
        side: String? = nil,
        rsvpStatus: RSVPStatus = .pending,
        tableNumber: Int? = nil,
        tableName: String? = nil,
        checkedIn: Bool = false,
        checkedInCount: Int = 0,
        passSerial: String? = nil
    ) {
        self.id = id
        self.name = name
        self.householdName = householdName
        self.partySize = partySize
        self.side = side
        self.rsvpStatus = rsvpStatus
        self.tableNumber = tableNumber
        self.tableName = tableName
        self.checkedIn = checkedIn
        self.checkedInCount = checkedInCount
        self.passSerial = passSerial
    }
}
