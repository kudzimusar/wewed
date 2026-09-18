import Foundation

public enum TaskStatus: String, Codable, CaseIterable, Sendable {
    case todo = "todo"
    case inProgress = "in_progress"
    case blocked = "blocked"
    case done = "done"

    public var title: String {
        switch self {
        case .todo: return "To Do"
        case .inProgress: return "In Progress"
        case .blocked: return "Blocked"
        case .done: return "Done"
        }
    }
}

public enum TaskPriority: String, Codable, CaseIterable, Sendable {
    case low = "low"
    case medium = "medium"
    case high = "high"
    case urgent = "urgent"

    public var title: String {
        switch self {
        case .low: return "Low"
        case .medium: return "Medium"
        case .high: return "High"
        case .urgent: return "Urgent"
        }
    }
}

public struct PlannerTask: Identifiable, Codable, Equatable, Sendable {
    public let id: String
    public var title: String
    public var status: TaskStatus
    public var priority: TaskPriority
    public var category: String
    public var dueDate: String?

    public init(
        id: String,
        title: String,
        status: TaskStatus,
        priority: TaskPriority,
        category: String,
        dueDate: String? = nil
    ) {
        self.id = id
        self.title = title
        self.status = status
        self.priority = priority
        self.category = category
        self.dueDate = dueDate
    }
}
