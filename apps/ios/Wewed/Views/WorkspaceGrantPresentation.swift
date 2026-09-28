import Foundation

/// Human-readable labels for a production workspace grant, used by the workspace selector and the
/// context switcher (QRO04-UI01).
///
/// A grant carries internal identifiers (`grantId`, `businessAccountId`, `vendorId`, wedding and
/// access-user IDs). None of them is ever shown. The title prefers the wedding title, then the
/// authorized vendor or business presentation name, then a safe role name ("Planner Portfolio",
/// "Vendor Business", …). Presentation only: it neither widens authority nor invents a grant.
public struct WorkspaceGrantPresentation: Equatable, Sendable {
    public let title: String
    public let roleLabel: String
    public let scopeLabel: String

    public init(
        grant: ProductionWorkspaceGrant,
        vendorNamesById: [String: String] = [:],
        businessNamesById: [String: String] = [:]
    ) {
        let identifiers = Set([grant.grantId, grant.businessAccountId, grant.vendorId, grant.weddingId, grant.coupleId].compactMap { $0 })
        func usable(_ candidate: String?) -> String? {
            guard let value = candidate?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty,
                  !identifiers.contains(value), !Self.looksLikeIdentifier(value)
            else { return nil }
            return value
        }
        let kind = grant.workspaceKind
        let scope = grant.scopeKind
        roleLabel = Self.roleLabel(kind: kind, scope: scope)
        scopeLabel = Self.scopeLabel(scope)
        if scope == .system || kind == .admin {
            title = "Wewed Administration"
        } else {
            title = usable(grant.weddingTitle)
                ?? usable(grant.vendorId.flatMap { vendorNamesById[$0] })
                ?? usable(grant.businessAccountId.flatMap { businessNamesById[$0] })
                ?? Self.fallbackTitle(kind: kind, scope: scope)
        }
    }

    private init(title: String, roleLabel: String, scopeLabel: String) {
        self.title = title
        self.roleLabel = roleLabel
        self.scopeLabel = scopeLabel
    }

    /// Operational Gate assignment: gate and wedding names only, never the assignment/grant ID.
    public static func gate(gateName: String, weddingTitle: String) -> WorkspaceGrantPresentation {
        WorkspaceGrantPresentation(title: weddingTitle, roleLabel: "Gate Usher", scopeLabel: gateName)
    }

    /// Safe role name shown when no human name is authorized for the grant.
    static func fallbackTitle(kind: GrantWorkspaceKind, scope: GrantScopeKind) -> String {
        switch kind {
        case .planner: return "Planner Portfolio"
        case .vendor: return "Vendor Business"
        case .coordinator: return "Coordinator Workspace"
        case .couple: return "Our Wedding"
        case .admin: return "Wewed Administration"
        case .unknown: return scope == .system ? "Wewed Administration" : "Wewed Workspace"
        }
    }

    static func roleLabel(kind: GrantWorkspaceKind, scope: GrantScopeKind) -> String {
        switch kind {
        case .couple: return "Couple"
        case .planner: return "Professional Planner"
        case .coordinator: return "Day-of Coordinator"
        case .vendor: return "Vendor & Staff"
        case .admin: return "Wewed Administration"
        case .unknown: return scope == .system ? "Wewed Administration" : "Workspace"
        }
    }

    static func scopeLabel(_ scope: GrantScopeKind) -> String {
        switch scope {
        case .wedding: return "Wedding workspace"
        case .portfolio: return "All weddings in your portfolio"
        case .business: return "Business workspace"
        case .system: return "Platform administration"
        case .unknown: return "Workspace"
        }
    }

    /// True for strings shaped like internal identifiers: UUIDs, CUIDs, `kind-<uuid>` / `kind:<id>`
    /// grant keys. A human name never matches.
    static func looksLikeIdentifier(_ value: String) -> Bool {
        let patterns = [
            #"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"#,
            #"^c[a-z0-9]{20,}$"#,
            #"^(planner|couple|coordinator|vendor|admin|usher|grant|business)[-:_][A-Za-z0-9:_-]+$"#,
        ]
        return patterns.contains { value.range(of: $0, options: .regularExpression) != nil }
    }
}
