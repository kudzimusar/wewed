import Foundation

/// Wewed Native Information Architecture V2 — Level-1 / Level-2 navigation contract.
///
/// Authority: docs/native-mobile/WEWED_NATIVE_INFORMATION_ARCHITECTURE_V2.md
/// Cross-platform source of truth: mobile/contracts/ia-v2-navigation.json
///
/// This is the ONLY place iOS declares role navigation topology. Role shells render from it, and
/// `IANavigationContractTests` asserts it equals the shared JSON contract that Android asserts
/// against too — which is what makes Android/iOS parity a machine-checked fact rather than a
/// visual comparison.

/// A Level-1 bottom-navigation destination. Destinations are workspaces, never actions.
public struct PrimaryDestination: Equatable, Identifiable, Sendable {
    public let id: String
    public let label: String
    /// Documented Level-2 workspace taxonomy. Empty = single-view workspace.
    public let sections: [String]

    public init(id: String, label: String, sections: [String] = []) {
        self.id = id
        self.label = label
        self.sections = sections
    }
}

/// Optional context dimensions a role operates within, beyond the always-present wedding.
public enum ContextScope: String, Equatable, Sendable {
    case wedding
    case client
    case engagement
    case gate
}

public struct RoleNavigation: Equatable, Sendable {
    public let role: AppRole
    public let displayName: String
    public let contextScopes: [ContextScope]
    public let primary: [PrimaryDestination]

    /// Level-1 labels in order — the bottom-navigation contract.
    public var labels: [String] { primary.map(\.label) }

    public func destination(_ id: String) -> PrimaryDestination? {
        primary.first { $0.id == id }
    }

    public func sections(_ destinationId: String) -> [String] {
        destination(destinationId)?.sections ?? []
    }
}

public enum IANavigationContract {

    public static let contractId = "WW-NATIVE-IA-V2-NAV-2026-09-20-02"

    private static let couple = RoleNavigation(
        role: .couple,
        displayName: "Couple",
        contextScopes: [.wedding],
        primary: [
            PrimaryDestination(id: "home", label: "Home"),
            PrimaryDestination(
                id: "plan", label: "Plan",
                sections: ["Overview", "Tasks", "Budget", "Contributions", "Vendors", "Seating", "Timeline", "Documents"]
            ),
            PrimaryDestination(
                id: "guests", label: "Guests",
                sections: ["Guest List", "RSVP", "Invitations", "Groups / Households", "Seating", "Messages", "Passes / QR"]
            ),
            PrimaryDestination(
                id: "wedding_day", label: "Wedding Day",
                sections: ["My Pass", "Programme", "Venue & Maps", "Key Contacts", "Vendor Status", "Announcements", "Wedding-day Checklist"]
            ),
            PrimaryDestination(
                id: "more", label: "More",
                sections: ["Wedding Profile", "Our Story", "Gallery", "Honeymoon", "Documents", "Settings", "Help & Support", "Account"]
            )
        ]
    )

    private static let planner = RoleNavigation(
        role: .planner,
        displayName: "Professional Planner",
        contextScopes: [.wedding, .client],
        primary: [
            PrimaryDestination(
                id: "workspace", label: "Workspace",
                sections: ["Overview", "Tasks", "Budget", "Guests", "Vendors", "Contributions", "Seating", "Timeline", "Documents"]
            ),
            PrimaryDestination(
                id: "clients", label: "Clients",
                sections: ["Active Weddings", "Upcoming Weddings", "Enquiries", "Archived Weddings", "Client Profiles", "Team Assignment"]
            ),
            PrimaryDestination(
                id: "daily_ops", label: "Daily Ops",
                sections: ["Today", "Overdue", "Approvals", "Messages", "Upcoming Deadlines", "Vendor Follow-ups", "Guest Issues", "Payments Requiring Attention", "Team Activity"]
            ),
            PrimaryDestination(
                id: "wedding_day", label: "Wedding Day",
                sections: ["Run Sheet", "Programme", "Gate / Admissions", "Vendor Arrivals", "Coordinator Tasks", "Guest Issues", "Incidents", "Live Notes", "Emergency Contacts", "Offline Status"]
            ),
            PrimaryDestination(
                id: "more", label: "More",
                sections: ["Team Hub", "Client Profile", "Invitations & QR", "Intelligence", "Files / Documents", "Planner Actions", "Account", "Settings", "Help & Support"]
            )
        ]
    )

    private static let guest = RoleNavigation(
        role: .guest,
        displayName: "Attending Guest",
        contextScopes: [.wedding],
        primary: [
            PrimaryDestination(id: "home", label: "Home"),
            PrimaryDestination(
                id: "invitation", label: "Invitation",
                sections: ["Invitation", "RSVP", "Party Members", "Dietary / Accessibility", "Message to Couple", "Contribution / Memory"]
            ),
            PrimaryDestination(
                id: "pass", label: "Pass",
                sections: ["Wedding Pass", "QR", "Party Size", "Table", "Admission State", "Open in Maps"]
            ),
            PrimaryDestination(
                id: "wedding_day", label: "Wedding Day",
                sections: ["Programme", "Venue", "Maps", "Table", "Announcements", "Contacts", "Gallery / Live Wall"]
            ),
            PrimaryDestination(
                id: "more", label: "More",
                sections: ["Our Story", "Gallery", "Contribution / Gift Info", "Help", "Account", "Privacy"]
            )
        ]
    )

    private static let vendor = RoleNavigation(
        role: .vendor,
        displayName: "Vendor & Staff",
        contextScopes: [.wedding, .engagement],
        primary: [
            PrimaryDestination(id: "home", label: "Home"),
            PrimaryDestination(
                id: "jobs", label: "Jobs",
                sections: ["Service Details", "Deliverables", "Tasks", "Client / Planner Contacts", "Venue", "Contract", "Payment", "Files", "Notes"]
            ),
            PrimaryDestination(
                id: "schedule", label: "Schedule",
                sections: ["Calendar", "Arrival Time", "Setup", "Service Window", "Breakdown", "Dependencies"]
            ),
            PrimaryDestination(id: "messages", label: "Messages"),
            PrimaryDestination(
                id: "more", label: "More",
                sections: ["Company Profile", "Services", "Contracts", "Payments", "Files", "Settings", "Support", "Account"]
            )
        ]
    )

    private static let usher = RoleNavigation(
        role: .usher,
        displayName: "Gate Team",
        contextScopes: [.wedding, .gate],
        primary: [
            PrimaryDestination(id: "scan", label: "Scan"),
            PrimaryDestination(
                id: "admissions", label: "Admissions",
                sections: ["Checked In", "Not Arrived", "Partial Parties", "Duplicate Scans", "Exceptions", "Manual Admission"]
            ),
            PrimaryDestination(id: "guests", label: "Guests"),
            PrimaryDestination(
                id: "incidents", label: "Incidents",
                sections: ["Admission Exception", "Lost Pass", "Guest Dispute", "Accessibility Assistance", "Security Note", "Coordinator Escalation"]
            ),
            PrimaryDestination(
                id: "more", label: "More",
                sections: ["Gate Assignment", "Offline Status", "Sync Status", "Venue Map", "Help", "Account"]
            )
        ]
    )

    private static let coordinator = RoleNavigation(
        role: .coordinator,
        displayName: "Day-of Coordinator",
        contextScopes: [.wedding],
        primary: [
            PrimaryDestination(id: "today", label: "Today"),
            PrimaryDestination(id: "run_sheet", label: "Run Sheet"),
            PrimaryDestination(
                id: "team", label: "Team",
                sections: ["Tasks", "Vendors", "Ushers", "Staff", "Assignments", "Contacts"]
            ),
            PrimaryDestination(
                id: "wedding_day", label: "Wedding Day",
                sections: ["Gate", "Admissions", "Vendor Arrivals", "Venue Zones", "Incidents", "Announcements", "Programme Status"]
            ),
            PrimaryDestination(
                id: "more", label: "More",
                sections: ["Documents", "Notes", "Maps", "Offline", "Support", "Account"]
            )
        ]
    )

    private static let admin = RoleNavigation(
        role: .admin,
        displayName: "Support / Admin",
        contextScopes: [.wedding, .client],
        primary: [
            PrimaryDestination(id: "dashboard", label: "Dashboard"),
            PrimaryDestination(id: "cases", label: "Cases"),
            PrimaryDestination(
                id: "accounts", label: "Accounts",
                sections: ["Couples", "Planners", "Vendors", "Guests", "Access", "Role Memberships"]
            ),
            PrimaryDestination(
                id: "audit", label: "Audit",
                sections: ["Data Changes", "Access Events", "Payments", "Contracts", "Check-ins", "Admin Actions"]
            ),
            PrimaryDestination(
                id: "more", label: "More",
                sections: ["System Health", "Integrations", "Templates", "Configuration", "Announcements", "Help", "Admin Profile"]
            )
        ]
    )

    public static let all: [AppRole: RoleNavigation] = [
        .couple: couple,
        .planner: planner,
        .guest: guest,
        .vendor: vendor,
        .usher: usher,
        .coordinator: coordinator,
        .admin: admin
    ]

    public static func forRole(_ role: AppRole) -> RoleNavigation {
        guard let navigation = all[role] else {
            preconditionFailure("IA V2 contract missing navigation for role \(role.roleId)")
        }
        return navigation
    }
}
