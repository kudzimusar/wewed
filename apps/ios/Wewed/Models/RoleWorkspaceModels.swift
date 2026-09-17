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
            name: "Tariro & Shadreck",
            subtitle: "Couple Owner • Imba Manor Estate",
            role: .couple,
            weddingId: "wed_tariro_shadreck_2026",
            weddingTitle: "Tariro & Shadreck Wedding"
        ),
        DevelopmentPersona(
            id: "pro_planner",
            name: "Kudzi Musarurwa",
            subtitle: "Lead Architect • 3 Active Weddings",
            role: .planner,
            weddingId: "wed_tariro_shadreck_2026",
            weddingTitle: "Tariro & Shadreck Wedding"
        ),
        DevelopmentPersona(
            id: "day_coordinator",
            name: "Chiedza Nyoni",
            subtitle: "Ground Operations Lead",
            role: .coordinator,
            weddingId: "wed_tariro_shadreck_2026",
            weddingTitle: "Tariro & Shadreck Wedding"
        ),
        DevelopmentPersona(
            id: "vendor_owner",
            name: "Kudzi Visuals",
            subtitle: "Lead Cinematographer & Drone",
            role: .vendor,
            weddingId: "wed_tariro_shadreck_2026",
            weddingTitle: "Tariro & Shadreck Wedding"
        ),
        DevelopmentPersona(
            id: "vendor_staff",
            name: "Crown Sound Crew",
            subtitle: "Audio & Acoustics Engineer",
            role: .vendor,
            weddingId: "wed_tariro_shadreck_2026",
            weddingTitle: "Tariro & Shadreck Wedding"
        ),
        DevelopmentPersona(
            id: "gate_usher",
            name: "Gate A Usher",
            subtitle: "Stationed at Main Entrance",
            role: .usher,
            weddingId: "wed_tariro_shadreck_2026",
            weddingTitle: "Tariro & Shadreck Wedding"
        ),
        DevelopmentPersona(
            id: "attending_guest",
            name: "Jane Doe",
            subtitle: "Party of 2 • Table 8",
            role: .guest,
            weddingId: "wed_tariro_shadreck_2026",
            weddingTitle: "Tariro & Shadreck Wedding"
        ),
        DevelopmentPersona(
            id: "administrator",
            name: "Global Ops Admin",
            subtitle: "Platform Security & Health",
            role: .admin,
            weddingId: "wed_tariro_shadreck_2026",
            weddingTitle: "Global Wewed Ecosystem"
        )
    ]
}
