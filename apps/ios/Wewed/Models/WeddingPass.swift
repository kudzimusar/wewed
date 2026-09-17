import Foundation

public enum PassStage: String, Codable, Sendable {
    case invitation = "INVITATION"
    case attending = "ATTENDING"
    case preWedding = "PRE_WEDDING"
    case morning = "MORNING"
    case checkedIn = "CHECKED_IN"
    case after = "AFTER"

    public var title: String {
        switch self {
        case .invitation: return "Invitation"
        case .attending: return "Confirmed Guest"
        case .preWedding: return "Upcoming"
        case .morning: return "Today"
        case .checkedIn: return "Admitted"
        case .after: return "Memories"
        }
    }
}

public struct WeddingPass: Identifiable, Codable, Equatable, Sendable {
    public var id: String { token }
    public let token: String
    public let weddingId: String
    public let coupleNames: String
    public let weddingDate: String
    public let venueName: String
    public let venueAddress: String
    public let guestName: String
    public let householdName: String?
    public let partySize: Int
    public let tableNumber: Int?
    public let tableName: String?
    public let seatNumber: String?
    public let currentStage: PassStage
    public let qrPayload: String

    public init(
        token: String,
        weddingId: String,
        coupleNames: String,
        weddingDate: String,
        venueName: String,
        venueAddress: String,
        guestName: String,
        householdName: String? = nil,
        partySize: Int,
        tableNumber: Int? = nil,
        tableName: String? = nil,
        seatNumber: String? = nil,
        currentStage: PassStage = .attending,
        qrPayload: String
    ) {
        self.token = token
        self.weddingId = weddingId
        self.coupleNames = coupleNames
        self.weddingDate = weddingDate
        self.venueName = venueName
        self.venueAddress = venueAddress
        self.guestName = guestName
        self.householdName = householdName
        self.partySize = partySize
        self.tableNumber = tableNumber
        self.tableName = tableName
        self.seatNumber = seatNumber
        self.currentStage = currentStage
        self.qrPayload = qrPayload
    }
}

public struct CheckInAuditRecord: Identifiable, Codable, Equatable, Sendable {
    public let id: String
    public let passSerial: String
    public let guestName: String
    public let countAdmitted: Int
    public let gateName: String
    public let usherId: String
    public let scannedAt: Date
    public var isSynced: Bool

    public init(
        id: String = UUID().uuidString,
        passSerial: String,
        guestName: String,
        countAdmitted: Int,
        gateName: String = "Gate A — Main Entrance",
        usherId: String,
        scannedAt: Date = Date(),
        isSynced: Bool = false
    ) {
        self.id = id
        self.passSerial = passSerial
        self.guestName = guestName
        self.countAdmitted = countAdmitted
        self.gateName = gateName
        self.usherId = usherId
        self.scannedAt = scannedAt
        self.isSynced = isSynced
    }
}

public struct CheckInVerificationResult: Codable, Equatable, Sendable {
    public enum Status: String, Codable, Sendable {
        case validPass = "VALID_PASS"
        case partialCheckedIn = "PARTIAL_CHECKED_IN"
        case alreadyCheckedIn = "ALREADY_CHECKED_IN"
        case invalidPass = "INVALID_PASS"
        case capacityExceeded = "CAPACITY_EXCEEDED"
    }

    public let status: Status
    public let guestName: String
    public let householdName: String?
    public let partySize: Int
    public let alreadyCheckedInCount: Int
    public let remainingCount: Int
    public let tableNumber: Int?
    public let tableName: String?
    public let gateMessage: String

    public var checkedInCount: Int { alreadyCheckedInCount }
    public var message: String { gateMessage }

    public init(
        status: Status,
        guestName: String,
        householdName: String? = nil,
        partySize: Int,
        alreadyCheckedInCount: Int,
        remainingCount: Int,
        tableNumber: Int? = nil,
        tableName: String? = nil,
        gateMessage: String
    ) {
        self.status = status
        self.guestName = guestName
        self.householdName = householdName
        self.partySize = partySize
        self.alreadyCheckedInCount = alreadyCheckedInCount
        self.remainingCount = remainingCount
        self.tableNumber = tableNumber
        self.tableName = tableName
        self.gateMessage = gateMessage
    }

    public init(
        status: Status,
        guestName: String,
        householdName: String? = nil,
        partySize: Int,
        checkedInCount: Int,
        tableNumber: Int? = nil,
        tableName: String? = nil,
        message: String
    ) {
        self.status = status
        self.guestName = guestName
        self.householdName = householdName
        self.partySize = partySize
        self.alreadyCheckedInCount = checkedInCount
        self.remainingCount = max(0, partySize - checkedInCount)
        self.tableNumber = tableNumber
        self.tableName = tableName
        self.gateMessage = message
    }
}
