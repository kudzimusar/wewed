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
        case .planner: return "Professional Planner"
        case .coordinator: return "Day-of Coordinator"
        case .vendor: return "Vendor & Staff"
        case .usher: return "Gate Usher"
        case .guest: return "Attending Guest"
        case .admin: return "Administrator"
        }
    }

    public static func from(roleId: String) -> AppRole {
        AppRole(rawValue: roleId.lowercased()) ?? .couple
    }
}

public struct DevelopmentPersona: Identifiable, Sendable {
    public let id: String
    public let name: String
    public let subtitle: String
    public let role: AppRole
    public let weddingId: String
    public let weddingTitle: String

    public init(id: String, name: String, subtitle: String, role: AppRole, weddingId: String, weddingTitle: String) {
        self.id = id
        self.name = name
        self.subtitle = subtitle
        self.role = role
        self.weddingId = weddingId
        self.weddingTitle = weddingTitle
    }

    public static let allPersonas: [DevelopmentPersona] = [
        DevelopmentPersona(
            id: "couple_owner",
            name: "Charity & Kudzie",
            subtitle: "Couple Owner • Imba Manor",
            role: .couple,
            weddingId: "cmqos70cb0004q6vxe9g9aiu5",
            weddingTitle: "Charity & Kudzie Wedding"
        ),
        DevelopmentPersona(
            id: "pro_planner",
            name: "Eleven Eleven Testing",
            subtitle: "Lead Planner • Tony The Planner",
            role: .planner,
            weddingId: "cmqos70cb0004q6vxe9g9aiu5",
            weddingTitle: "Charity & Kudzie Wedding"
        ),
        DevelopmentPersona(
            id: "day_coordinator",
            name: "Chiedza Nyoni",
            subtitle: "Day-of Coordinator",
            role: .coordinator,
            weddingId: "cmqos70cb0004q6vxe9g9aiu5",
            weddingTitle: "Charity & Kudzie Wedding"
        ),
        DevelopmentPersona(
            id: "vendor_owner",
            name: "FAUME MEDIA",
            subtitle: "Lead Cinematographer & Media",
            role: .vendor,
            weddingId: "cmqos70cb0004q6vxe9g9aiu5",
            weddingTitle: "Charity & Kudzie Wedding"
        ),
        DevelopmentPersona(
            id: "vendor_staff",
            name: "MC Aloe The Avangelist",
            subtitle: "Master of Ceremonies & Sound",
            role: .vendor,
            weddingId: "cmqos70cb0004q6vxe9g9aiu5",
            weddingTitle: "Charity & Kudzie Wedding"
        ),
        DevelopmentPersona(
            id: "gate_usher",
            name: "Gate Usher",
            subtitle: "Stationed at Imba Manor Main Gate",
            role: .usher,
            weddingId: "cmqos70cb0004q6vxe9g9aiu5",
            weddingTitle: "Charity & Kudzie Wedding"
        ),
        DevelopmentPersona(
            id: "attending_guest",
            name: "Test Guest",
            subtitle: "Party of 4 • Attending",
            role: .guest,
            weddingId: "cmqos70cb0004q6vxe9g9aiu5",
            weddingTitle: "Charity & Kudzie Wedding"
        ),
        DevelopmentPersona(
            id: "administrator",
            name: "Global Ops Admin",
            subtitle: "Platform Security & Health",
            role: .admin,
            weddingId: "cmqos70cb0004q6vxe9g9aiu5",
            weddingTitle: "Global Wewed Ecosystem"
        )
    ]
}
