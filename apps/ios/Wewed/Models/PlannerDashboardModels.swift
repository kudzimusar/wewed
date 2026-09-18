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
    public let readinessScore: Int
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
        readinessScore: Int,
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
        self.attentionItems = attentionItems
        self.modules = modules
        self.recentActivity = recentActivity
        self.sourceLabel = sourceLabel
    }
}
