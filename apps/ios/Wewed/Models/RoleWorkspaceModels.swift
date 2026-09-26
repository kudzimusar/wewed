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

    /// Parses a NATIVE workspace identifier — exactly one of the raw values above — and nothing
    /// else. Unknown input is nil, never a default workspace.
    ///
    /// This is not a server authority mapper. Wewed authority has several axes (account class,
    /// BusinessAccountMember, WeddingMembership, operational assignment), and a single server role
    /// string cannot choose a workspace: `owner`, `viewer`, `business_owner`, `couple_owner`,
    /// `vendor_manager` and `venue_manager` have no workspace here at all, and `planner` or
    /// `coordinator` mean different things on different axes. The production grant contract is
    /// master-plan Phase 2; until it exists, nothing server-supplied reaches a workspace. The old
    /// `?? .couple` fallback turned any unrecognised string into the Couple workspace (§8.1).
    public static func from(roleId: String) -> AppRole? {
        AppRole(rawValue: roleId)
    }
}

/// A Shadow/fixture qualification actor. Development and Shadow environments only.
///
/// Personas are test actors, not accounts: they are applied only where
/// `NativeDataEnvironment.allowsDevelopmentPersonaSwitching` holds, and `SessionStore` refuses
/// them anywhere else. Production identity starts unknown and is never seeded from this list.
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

    /// The actor a Shadow session opens as when no specific persona was requested.
    public static let defaultShadowPersonaId = "couple_owner"

    public static var defaultShadowPersona: DevelopmentPersona {
        allPersonas.first { $0.id == defaultShadowPersonaId }!
    }

    public static let allPersonas: [DevelopmentPersona] = [
        DevelopmentPersona(
            id: "couple_owner",
            name: "Charity & Kudzie",
            subtitle: "Couple Owner • Imba Manor",
            role: .couple,
            weddingId: "cmqos70cb0004q6vxe9g9aiu5",
            weddingTitle: "Charity & Kudzie"
        ),
        DevelopmentPersona(
            id: "pro_planner",
            name: "Eleven Eleven Testing",
            subtitle: "Lead Planner • Accepted Interest",
            role: .planner,
            weddingId: "cmqos70cb0004q6vxe9g9aiu5",
            weddingTitle: "Charity & Kudzie"
        ),
        DevelopmentPersona(
            id: "day_coordinator",
            name: "Shadow Coordinator Test Role",
            subtitle: "SHADOW TEST-ONLY • Day-of Coordinator",
            role: .coordinator,
            weddingId: "cmqos70cb0004q6vxe9g9aiu5",
            weddingTitle: "Charity & Kudzie"
        ),
        DevelopmentPersona(
            id: "vendor_owner",
            name: "FAUME MEDIA",
            subtitle: "Lead Cinematographer & Media",
            role: .vendor,
            weddingId: "cmqos70cb0004q6vxe9g9aiu5",
            weddingTitle: "Charity & Kudzie"
        ),
        DevelopmentPersona(
            id: "vendor_staff",
            name: "MC Aloe The Avangelist",
            subtitle: "Master of Ceremonies & Sound",
            role: .vendor,
            weddingId: "cmqos70cb0004q6vxe9g9aiu5",
            weddingTitle: "Charity & Kudzie"
        ),
        DevelopmentPersona(
            id: "gate_usher",
            name: "Shadow Usher Test Role",
            subtitle: "SHADOW TEST-ONLY • Gate Scanner",
            role: .usher,
            weddingId: "cmqos70cb0004q6vxe9g9aiu5",
            weddingTitle: "Charity & Kudzie"
        ),
        DevelopmentPersona(
            id: "attending_guest",
            name: "Shadow Guest Test Role",
            subtitle: "SHADOW TEST-ONLY • Attending Guest",
            role: .guest,
            weddingId: "cmqos70cb0004q6vxe9g9aiu5",
            weddingTitle: "Charity & Kudzie"
        ),
        DevelopmentPersona(
            id: "attending_guest_party4",
            name: "Shadow Guest Test Role (party of four)",
            subtitle: "SHADOW TEST-ONLY • Second attending guest",
            role: .guest,
            weddingId: "cmqos70cb0004q6vxe9g9aiu5",
            weddingTitle: "Charity & Kudzie"
        ),
        DevelopmentPersona(
            id: "administrator",
            name: "Shadow Admin Test Role",
            subtitle: "SHADOW TEST-ONLY • Platform Admin",
            role: .admin,
            weddingId: "cmqos70cb0004q6vxe9g9aiu5",
            weddingTitle: "Charity & Kudzie"
        )
    ]
}
