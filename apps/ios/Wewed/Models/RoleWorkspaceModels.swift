import Foundation

public enum AppRole: String, CaseIterable, Identifiable, Sendable {
    case couple = "couple"
    case planner = "planner"
    case coordinator = "coordinator"
    case vendor = "vendor"
    case usher = "usher"
    case guest = "guest"
    case admin = "admin"

    public var id: String { rawValue }

    public var roleId: String { rawValue }

    public var title: String {
        switch self {
        case .couple: return "Couple"
        case .planner: return "Planner"
        case .coordinator: return "Coordinator"
        case .vendor: return "Vendor"
        case .usher: return "Gate Team"
        case .guest: return "Guest"
        case .admin: return "Wewed Support"
        }
    }

    /// The plain words a person sees when choosing how to use the app.
    public var choiceLabel: String {
        switch self {
        case .couple: return "My Wedding"
        case .planner: return "Planner Workspace"
        case .coordinator: return "Wedding-Day Coordination"
        case .vendor: return "My Vendor Work"
        case .usher: return "Gate Check-In"
        case .guest: return "My Invitation"
        case .admin: return "Wewed Support"
        }
    }

    /// Unknown ids resolve to nil, never to a default role.
    public static func from(roleId: String) -> AppRole? {
        AppRole(rawValue: roleId.lowercased())
    }
}
