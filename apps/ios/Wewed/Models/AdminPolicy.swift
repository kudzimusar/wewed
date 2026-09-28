import Foundation

/// The Wewed Admin authorization model, mirrored from the web policy module.
///
/// Native Admin previously reduced authorization to `role == admin`, which is not the product's
/// model at all. The real one names five corporate roles, twenty-five permissions, and a governed
/// account lifecycle whose transitions each require a specific permission. A Support Admin can
/// read an account and manage a support case; they cannot suspend, block or cancel anything.
///
/// An app that offers an action the server will refuse is worse than an app that offers none: it
/// teaches an administrator that a control exists, then fails at the moment they rely on it. So
/// these values are DERIVED from `src/lib/wewed-admin-policy.ts` — the same module the Admin API
/// enforces — through `mobile/contracts/admin-policy.json`, and a unit test asserts equality.
/// A change on the web that is not mirrored here fails the build rather than reaching a device.
///
/// Authorization is still resolved by the server. This model decides only what to OFFER.
public enum WewedAdminRole: String, CaseIterable, Sendable {
    case superAdmin = "wewed_super_admin"
    case operationsAdmin = "wewed_operations_admin"
    case billingAdmin = "wewed_billing_admin"
    case supportAdmin = "wewed_support_admin"
    case analyst = "wewed_analyst"

    public var wire: String { rawValue }

    public var label: String {
        switch self {
        case .superAdmin: return "Super Admin"
        case .operationsAdmin: return "Operations Admin"
        case .billingAdmin: return "Billing Admin"
        case .supportAdmin: return "Support Admin"
        case .analyst: return "Analyst / Viewer"
        }
    }

    public static func fromWire(_ value: String?) -> WewedAdminRole? {
        guard let value else { return nil }
        return WewedAdminRole(rawValue: value)
    }
}

/// An account's governed lifecycle state.
public enum AccountLifecycleStatus: String, CaseIterable, Sendable {
    case pendingReview = "pending_review"
    case active
    case rejected
    case suspended
    case blocked
    case cancelled
    case archived

    public var wire: String { rawValue }

    /// An account that cannot currently be used, as distinct from one awaiting a decision.
    public var isRestrictive: Bool {
        [.rejected, .suspended, .blocked, .cancelled, .archived].contains(self)
    }

    /// Only an active account opens a workspace.
    public var allowsWorkspace: Bool { self == .active }

    public static func fromWire(_ value: String?) -> AccountLifecycleStatus {
        guard let value else { return .pendingReview }
        if let match = AccountLifecycleStatus(rawValue: value) { return match }
        return value == "trial" ? .active : .pendingReview
    }
}

/// What an authenticated administrator may do.
///
/// Built from the role the SERVER returned plus any explicit grants it bounded. Nothing here is
/// chosen by the app or by the person using it.
public struct AdminAuthorization: Sendable, Equatable {
    public let role: WewedAdminRole
    public let permissions: Set<String>
    /// Account ids this administrator is scoped to; empty means platform-wide.
    public let accountScope: [String]
    public let provenance: DataProvenance

    public init(role: WewedAdminRole, permissions: Set<String>, accountScope: [String] = [],
                provenance: DataProvenance = .productionDerived) {
        self.role = role
        self.permissions = permissions
        self.accountScope = accountScope
        self.provenance = provenance
    }

    public func can(_ permission: String) -> Bool { permissions.contains(permission) }

    public var isPlatformWide: Bool { accountScope.isEmpty }

    /// Whether this administrator may move an account from one state to another.
    public func canTransition(from: AccountLifecycleStatus, to: AccountLifecycleStatus) -> Bool {
        guard AdminPolicy.isValidTransition(from: from, to: to) else { return false }
        return can(AdminPolicy.permissionForTransition(from: from, to: to))
    }

    /// The transitions to OFFER for an account: valid for its state and permitted for this role.
    public func availableTransitions(from: AccountLifecycleStatus) -> [AccountLifecycleStatus] {
        AdminPolicy.transitions(from: from).filter { canTransition(from: from, to: $0) }
    }

    /// Resolves from a server-reported role, bounded by that role's permission set.
    public static func resolve(
        role: WewedAdminRole,
        explicitPermissions: [String]? = nil,
        accountScope: [String] = []
    ) -> AdminAuthorization {
        let defaults = AdminPolicy.permissions(for: role)
        // An explicit grant may narrow a role but never widen it: the server bounds the set, and a
        // client that could widen it would be granting itself authority.
        let effective = explicitPermissions.map { Set($0.filter(defaults.contains)) } ?? defaults
        return AdminAuthorization(role: role, permissions: effective, accountScope: accountScope)
    }
}

/// The policy tables themselves.
///
/// Kept as data rather than branching logic so the unit test can compare them to the shared
/// contract element by element.
public enum AdminPolicy {

    public static let contractVersion = "wewed-admin-policy/1"

    public static let allPermissions: [String] = [
        "admin.overview.read",
        "admin.analytics.read",
        "admin.accounts.read",
        "admin.accounts.create",
        "admin.accounts.approve",
        "admin.accounts.reject",
        "admin.accounts.suspend",
        "admin.accounts.block",
        "admin.accounts.cancel",
        "admin.accounts.archive",
        "admin.accounts.restore",
        "admin.departments.read",
        "admin.departments.manage",
        "admin.members.read",
        "admin.members.manage",
        "admin.platform_admins.read",
        "admin.platform_admins.manage",
        "admin.scopes.manage",
        "admin.billing.read",
        "admin.billing.manage",
        "admin.support.read",
        "admin.support.manage",
        "admin.incidents.read",
        "admin.incidents.manage",
        "admin.audit.read"
    ]

    private static let rolePermissions: [WewedAdminRole: Set<String>] = [
        // Super Admin holds every declared permission; the web module writes this as '*'.
        .superAdmin: Set(allPermissions),
        .operationsAdmin: [
            "admin.analytics.read", "admin.accounts.read", "admin.accounts.create",
            "admin.accounts.approve", "admin.accounts.reject", "admin.accounts.suspend",
            "admin.accounts.block", "admin.accounts.cancel", "admin.accounts.archive",
            "admin.accounts.restore", "admin.departments.read", "admin.departments.manage",
            "admin.support.read", "admin.support.manage", "admin.incidents.read",
            "admin.incidents.manage", "admin.audit.read"
        ],
        .billingAdmin: [
            "admin.analytics.read", "admin.accounts.read", "admin.departments.read",
            "admin.billing.read", "admin.billing.manage", "admin.audit.read"
        ],
        .supportAdmin: [
            "admin.accounts.read", "admin.departments.read", "admin.support.read",
            "admin.support.manage", "admin.incidents.read", "admin.audit.read"
        ],
        .analyst: [
            "admin.analytics.read", "admin.accounts.read", "admin.departments.read",
            "admin.billing.read", "admin.support.read", "admin.incidents.read", "admin.audit.read"
        ]
    ]

    private static let transitionTable: [AccountLifecycleStatus: [AccountLifecycleStatus]] = [
        .pendingReview: [.active, .rejected],
        .active: [.suspended, .blocked, .cancelled, .archived],
        .rejected: [.pendingReview, .archived],
        .suspended: [.active, .blocked, .cancelled, .archived],
        .blocked: [.active, .cancelled, .archived],
        .cancelled: [.active, .archived],
        .archived: [.pendingReview, .active]
    ]

    public static func permissions(for role: WewedAdminRole) -> Set<String> {
        rolePermissions[role] ?? []
    }

    public static func transitions(from status: AccountLifecycleStatus) -> [AccountLifecycleStatus] {
        transitionTable[status] ?? []
    }

    public static func isValidTransition(from: AccountLifecycleStatus,
                                         to: AccountLifecycleStatus) -> Bool {
        from != to && transitions(from: from).contains(to)
    }

    /// Which permission a transition requires.
    ///
    /// Reaching ACTIVE means two different things: approving something never yet approved, or
    /// restoring something that was restricted. They are separate permissions because they are
    /// separate decisions.
    public static func permissionForTransition(from: AccountLifecycleStatus,
                                               to: AccountLifecycleStatus) -> String {
        switch to {
        case .active: return from == .pendingReview ? "admin.accounts.approve"
                                                    : "admin.accounts.restore"
        case .rejected: return "admin.accounts.reject"
        case .suspended: return "admin.accounts.suspend"
        case .blocked: return "admin.accounts.block"
        case .cancelled: return "admin.accounts.cancel"
        case .archived: return "admin.accounts.archive"
        default: return "admin.accounts.restore"
        }
    }

    /// Every transition, keyed "from->to", for contract comparison.
    public static func transitionPermissionMap() -> [String: String] {
        var map: [String: String] = [:]
        for (from, targets) in transitionTable {
            for to in targets {
                map["\(from.wire)->\(to.wire)"] = permissionForTransition(from: from, to: to)
            }
        }
        return map
    }
}
