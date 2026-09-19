import Foundation

public enum PlannerAttentionSeverity: String, Codable, Sendable {
    case info
    case warning
    case urgent
}

public struct PlannerAttentionItem: Identifiable, Codable, Equatable, Sendable {
    public let id: String
    public let title: String
    public let detail: String
    public let severity: PlannerAttentionSeverity

    public init(id: String, title: String, detail: String, severity: PlannerAttentionSeverity) {
        self.id = id
        self.title = title
        self.detail = detail
        self.severity = severity
    }
}

public struct PlannerModuleSummary: Identifiable, Codable, Equatable, Sendable {
    public let id: String
    public let title: String
    public let value: String
    public let attention: String?
    public let systemImage: String

    public init(id: String, title: String, value: String, attention: String? = nil, systemImage: String) {
        self.id = id
        self.title = title
        self.value = value
        self.attention = attention
        self.systemImage = systemImage
    }
}

public struct PlannerActivityItem: Identifiable, Codable, Equatable, Sendable {
    public let id: String
    public let title: String
    public let detail: String
    public let relativeTime: String

    public init(id: String, title: String, detail: String, relativeTime: String) {
        self.id = id
        self.title = title
        self.detail = detail
        self.relativeTime = relativeTime
    }
}

public struct PlannerDashboardSnapshot: Codable, Equatable, Sendable {
    public let weddingId: String
    public let coupleNames: String
    public let weddingDateLabel: String
    public let lifecycle: String
    public let plannerContext: String
    public let readinessScore: Int?
    public let taskCompletionLabel: String
    public let attentionItems: [PlannerAttentionItem]
    public let modules: [PlannerModuleSummary]
    public let recentActivity: [PlannerActivityItem]
    public let sourceLabel: String

    public init(
        weddingId: String,
        coupleNames: String,
        weddingDateLabel: String,
        lifecycle: String,
        plannerContext: String,
        readinessScore: Int? = nil,
        taskCompletionLabel: String = "7 / 42",
        attentionItems: [PlannerAttentionItem],
        modules: [PlannerModuleSummary],
        recentActivity: [PlannerActivityItem],
        sourceLabel: String
    ) {
        self.weddingId = weddingId
        self.coupleNames = coupleNames
        self.weddingDateLabel = weddingDateLabel
        self.lifecycle = lifecycle
        self.plannerContext = plannerContext
        self.readinessScore = readinessScore
        self.taskCompletionLabel = taskCompletionLabel
        self.attentionItems = attentionItems
        self.modules = modules
        self.recentActivity = recentActivity
        self.sourceLabel = sourceLabel
    }
}


public struct PlannerBudgetLine: Identifiable, Codable, Equatable, Sendable {
    public let id: String
    public let category: String
    public let vendorName: String?
    public let estimated: Double
    public let actual: Double
    public let paid: Double
    public let dueDateLabel: String?
    public let fundingLabel: String
    public let statusLabel: String

    public init(id: String, category: String, vendorName: String?, estimated: Double, actual: Double, paid: Double, dueDateLabel: String?, fundingLabel: String, statusLabel: String) {
        self.id = id
        self.category = category
        self.vendorName = vendorName
        self.estimated = estimated
        self.actual = actual
        self.paid = paid
        self.dueDateLabel = dueDateLabel
        self.fundingLabel = fundingLabel
        self.statusLabel = statusLabel
    }
}

public enum ContributorResolution: String, Codable, Equatable, Sendable {
    /// Contributor resolved through GuestContribution.guestId -> Guest.id.
    case resolved
    /// The source row genuinely has no contributor relationship.
    case notRecorded
    /// Identity exists but this role or the contribution's privacy setting hides it.
    case hidden
}

public struct PlannerContributionRecord: Identifiable, Codable, Equatable, Sendable {
    public let id: String
    public let contributorLabel: String
    public let typeLabel: String
    public let value: Double
    public let statusLabel: String
    public let allocationLabel: String
    public let verified: Bool
    public let contributorGuestId: String?
    public let contributorResolution: ContributorResolution
    public let privacyLabel: String?
    public let wordCount: Int?
    public let submittedAtLabel: String?
    /// Nil when the source export does not carry the message body. Never invented.
    public let messageText: String?

    public init(
        id: String,
        contributorLabel: String,
        typeLabel: String,
        value: Double,
        statusLabel: String,
        allocationLabel: String,
        verified: Bool,
        contributorGuestId: String? = nil,
        contributorResolution: ContributorResolution = .resolved,
        privacyLabel: String? = nil,
        wordCount: Int? = nil,
        submittedAtLabel: String? = nil,
        messageText: String? = nil
    ) {
        self.contributorGuestId = contributorGuestId
        self.contributorResolution = contributorResolution
        self.privacyLabel = privacyLabel
        self.wordCount = wordCount
        self.submittedAtLabel = submittedAtLabel
        self.messageText = messageText
        self.id = id
        self.contributorLabel = contributorLabel
        self.typeLabel = typeLabel
        self.value = value
        self.statusLabel = statusLabel
        self.allocationLabel = allocationLabel
        self.verified = verified
    }
}

public struct PlannerVendorEngagement: Identifiable, Codable, Equatable, Sendable {
    public let id: String
    public let vendorName: String
    public let category: String
    public let bookingStatus: String
    public let contractStatus: String
    public let paymentStatus: String
    public let nextAction: String
    public let vendorId: String?

    public init(id: String, vendorName: String, category: String, bookingStatus: String, contractStatus: String, paymentStatus: String, nextAction: String, vendorId: String? = nil) {
        self.vendorId = vendorId
        self.id = id
        self.vendorName = vendorName
        self.category = category
        self.bookingStatus = bookingStatus
        self.contractStatus = contractStatus
        self.paymentStatus = paymentStatus
        self.nextAction = nextAction
    }
}

public struct PlannerSeatingTable: Identifiable, Codable, Equatable, Sendable {
    public let id: String
    public let name: String
    public let zone: String
    public let capacity: Int
    public let assigned: Int
    public let attentionLabel: String?

    public init(id: String, name: String, zone: String, capacity: Int, assigned: Int, attentionLabel: String?) {
        self.id = id
        self.name = name
        self.zone = zone
        self.capacity = capacity
        self.assigned = assigned
        self.attentionLabel = attentionLabel
    }
}

public struct PlannerTimelineEntry: Identifiable, Codable, Equatable, Sendable {
    public let id: String
    public let time: String
    public let title: String
    public let location: String
    public let statusLabel: String
    public let linkedVendor: String?

    public init(id: String, time: String, title: String, location: String, statusLabel: String, linkedVendor: String?) {
        self.id = id
        self.time = time
        self.title = title
        self.location = location
        self.statusLabel = statusLabel
        self.linkedVendor = linkedVendor
    }
}


public struct PlannerDocumentRecord: Identifiable, Codable, Equatable, Sendable {
    public let id: String
    public let title: String
    public let kind: String
    public let statusLabel: String?

    public init(id: String, title: String, kind: String, statusLabel: String?) {
        self.id = id
        self.title = title
        self.kind = kind
        self.statusLabel = statusLabel
    }
}
