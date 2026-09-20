import Foundation

/// IA V2 §13.4 — the entitlement gate.
///
///   requested route -> authenticated actor -> active role -> active context
///   -> capability check -> repository request -> UI state
///
/// Hidden navigation is never the authorization mechanism (IA V2 §13.4); every route resolves
/// through `resolve` before a repository is touched.
public enum Entitlements {

    private static let capabilitiesByRole: [AppRole: Set<String>] = [
        .couple: [
            "plan.read", "plan.write", "tasks.read", "tasks.write", "budget.read", "budget.write",
            "contributions.read", "vendors.read", "seating.read", "seating.write", "timeline.read",
            "documents.read", "guests.roster.read", "guests.roster.write", "invitations.send",
            "weddingday.read", "pass.self", "messages.read", "messages.write", "account.self"
        ],
        .planner: [
            "plan.read", "plan.write", "tasks.read", "tasks.write", "budget.read", "budget.write",
            "contributions.read", "contributions.write", "vendors.read", "vendors.write",
            "seating.read", "seating.write", "timeline.read", "timeline.write", "documents.read",
            "documents.write", "guests.roster.read", "guests.roster.write", "invitations.send",
            "weddingday.read", "weddingday.operate", "gate.admissions.read", "incidents.read",
            "incidents.write", "clients.read", "clients.write", "dailyops.read", "messages.read",
            "messages.write", "pass.issue", "account.self"
        ],
        .guest: [
            "invitation.self", "rsvp.self", "pass.self", "weddingday.read", "messages.write", "account.self"
        ],
        .vendor: [
            "vendor.jobs.own", "vendor.schedule.own", "vendor.contract.own", "vendor.payment.own",
            "vendor.files.own", "messages.read", "messages.write", "account.self"
        ],
        .usher: [
            "gate.scan", "gate.admissions.read", "gate.admissions.write", "guests.operational.read",
            "incidents.read", "incidents.write", "weddingday.read", "account.self"
        ],
        .coordinator: [
            "weddingday.read", "weddingday.operate", "timeline.read", "timeline.write", "tasks.read",
            "tasks.write", "vendors.read", "gate.admissions.read", "incidents.read", "incidents.write",
            "team.read", "team.write", "documents.read", "messages.read", "messages.write", "account.self"
        ],
        .admin: [
            "admin.dashboard", "admin.cases.read", "admin.cases.write", "admin.accounts.read",
            "admin.accounts.write", "admin.audit.read", "admin.system.read", "admin.config.write",
            "account.self"
        ]
    ]

    /// Capability required to open each Level-1 destination, keyed by "<roleId>/<destinationId>".
    /// A destination with no entry requires only that the role owns it in the contract.
    private static let destinationCapability: [String: String] = [
        "couple/plan": "plan.read",
        "couple/guests": "guests.roster.read",
        "couple/wedding_day": "weddingday.read",
        "planner/workspace": "plan.read",
        "planner/clients": "clients.read",
        "planner/daily_ops": "dailyops.read",
        "planner/wedding_day": "weddingday.operate",
        "guest/invitation": "invitation.self",
        "guest/pass": "pass.self",
        "guest/wedding_day": "weddingday.read",
        "vendor/jobs": "vendor.jobs.own",
        "vendor/schedule": "vendor.schedule.own",
        "vendor/messages": "messages.read",
        "usher/scan": "gate.scan",
        "usher/admissions": "gate.admissions.read",
        "usher/guests": "guests.operational.read",
        "usher/incidents": "incidents.read",
        "coordinator/today": "weddingday.read",
        "coordinator/run_sheet": "timeline.read",
        "coordinator/team": "team.read",
        "coordinator/wedding_day": "weddingday.operate",
        "admin/dashboard": "admin.dashboard",
        "admin/cases": "admin.cases.read",
        "admin/accounts": "admin.accounts.read",
        "admin/audit": "admin.audit.read"
    ]

    public static func capabilities(_ role: AppRole) -> Set<String> {
        capabilitiesByRole[role] ?? []
    }

    public static func can(_ role: AppRole, _ capability: String) -> Bool {
        capabilities(role).contains(capability)
    }

    /// Outcome of resolving a requested route against actor, role, context and relationship.
    public enum Resolution: Equatable {
        case allowed(destination: PrimaryDestination, context: NavigationContext)
        /// Unauthorized: explain the boundary, leak no destination data, offer a safe return (IA V2 §14).
        case denied(reason: String, safeReturnDestinationId: String)
    }

    /// P0-2 — authorization is actor + role + scope + relationship, never role alone.
    ///
    /// Static `capabilitiesByRole` is policy: it says what a planner *may* do. It cannot say that
    /// THIS actor is the planner for THIS wedding. That is what `ActorAssignment` decides, and both
    /// layers must agree before a destination opens.
    public static func relationshipHolds(_ context: NavigationContext) -> Bool {
        guard let assignment = context.assignment else { return false }
        guard assignment.actorId == context.actorId, assignment.role == context.activeRole else {
            return false
        }

        let navigation = IANavigationContract.forRole(context.activeRole)

        // System-scope roles are not bound to one wedding.
        if navigation.isSystemScoped {
            return assignment.isSystemScope || assignment.weddingId == context.activeWeddingId
        }

        // Every other role must be assigned to the wedding it is operating in.
        guard assignment.weddingId == context.activeWeddingId else { return false }

        // Required sub-scopes must match the assignment exactly, not merely be present.
        for declaration in navigation.scopes where declaration.requirement == .required {
            guard let held = context.value(for: declaration.scope) else { return false }
            let authorized: String?
            switch declaration.scope {
            case .wedding: authorized = assignment.weddingId
            case .client: authorized = assignment.clientId
            case .vendor: authorized = assignment.vendorId
            case .engagement: authorized = assignment.engagementId
            case .gate: authorized = assignment.gateId
            case .guest: authorized = assignment.guestId
            case .system: authorized = context.actorId
            }
            guard let authorized, held == authorized else { return false }
        }
        return true
    }

    /// IA V2 §13.4 / §14. Deep links and notifications resolve through this same path, so an
    /// unauthorized link cannot bypass the gate by arriving from outside the app.
    public static func resolve(_ context: NavigationContext, destinationId: String) -> Resolution {
        let navigation = IANavigationContract.forRole(context.activeRole)
        let safeReturn = navigation.primary[0].id

        guard let destination = navigation.destination(destinationId) else {
            return .denied(
                reason: "This area is not part of the \(navigation.displayName) workspace.",
                safeReturnDestinationId: safeReturn
            )
        }

        // 1. Required context must be resolved (P0-3): an absent engagement/gate/guest is not
        //    silently treated as satisfied.
        if let missing = context.missingRequiredScopes.first {
            return .denied(
                reason: missingScopeReason(navigation.displayName, missing),
                safeReturnDestinationId: safeReturn
            )
        }

        // 2. The actor must actually hold the relationship it is claiming (P0-2).
        guard relationshipHolds(context) else {
            return .denied(
                reason: "You are not assigned to this \(navigation.displayName.lowercased()) workspace.",
                safeReturnDestinationId: safeReturn
            )
        }

        // 3. Static role policy is the last gate, not the only one.
        if let required = destinationCapability["\(context.activeRole.roleId)/\(destinationId)"],
           !can(context.activeRole, required) {
            return .denied(
                reason: "Your \(navigation.displayName) role does not include access to \(destination.label).",
                safeReturnDestinationId: safeReturn
            )
        }

        return .allowed(destination: destination, context: context)
    }

    private static func missingScopeReason(_ roleName: String, _ scope: ContextScope) -> String {
        switch scope {
        case .wedding: return "No active wedding is selected for this workspace."
        case .client: return "No client is selected for this \(roleName) workspace."
        case .vendor: return "This account is not linked to a vendor on this wedding."
        case .engagement: return "You have no assigned engagement for this wedding."
        case .gate: return "You have no gate assignment for this wedding."
        case .guest: return "No guest invitation is bound to this session."
        case .system: return "This account does not hold administrative access."
        }
    }
}
