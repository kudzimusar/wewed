import Foundation

/// IA V2 §13.1 — the active context envelope every repository-backed screen resolves from.
///
/// Every scoped id here must have come from a verified `ActorAssignment`. Nothing in this type may
/// be invented by the root or a view (P0-3).
public struct NavigationContext: Equatable, Sendable {
    public let actorId: String
    public let activeRole: AppRole
    public let activeWeddingId: String
    public let activeWeddingTitle: String
    public let environment: NativeDataEnvironment
    public let activeClientId: String?
    /// The vendor company in scope. Distinct from the service engagement (P0-9).
    public let activeVendorId: String?
    public let activeEngagementId: String?
    public let activeGateId: String?
    /// Which guest record this actor is, for guest-scoped roles (P0-4).
    public let activeGuestId: String?
    /// The credential authorising this actor's pass (P0-5).
    public let activePassToken: String?
    /// The verified relationship this context was resolved from; nil means unauthorised.
    public let assignment: ActorAssignment?

    public init(
        actorId: String,
        activeRole: AppRole,
        activeWeddingId: String,
        activeWeddingTitle: String,
        environment: NativeDataEnvironment,
        activeClientId: String? = nil,
        activeVendorId: String? = nil,
        activeEngagementId: String? = nil,
        activeGateId: String? = nil,
        activeGuestId: String? = nil,
        activePassToken: String? = nil,
        assignment: ActorAssignment? = nil
    ) {
        self.actorId = actorId
        self.activeRole = activeRole
        self.activeWeddingId = activeWeddingId
        self.activeWeddingTitle = activeWeddingTitle
        self.environment = environment
        self.activeClientId = activeClientId
        self.activeVendorId = activeVendorId
        self.activeEngagementId = activeEngagementId
        self.activeGateId = activeGateId
        self.activeGuestId = activeGuestId
        self.activePassToken = activePassToken
        self.assignment = assignment
    }

    private var navigation: RoleNavigation { IANavigationContract.forRole(activeRole) }

    /// The value currently held for a scope, or nil when unresolved.
    public func value(for scope: ContextScope) -> String? {
        switch scope {
        case .wedding: return activeWeddingId.isEmpty ? nil : activeWeddingId
        case .client: return activeClientId
        case .vendor: return activeVendorId
        case .engagement: return activeEngagementId
        case .gate: return activeGateId
        case .guest: return activeGuestId
        // System scope is satisfied by holding a system-scope assignment, not by an id.
        case .system: return (assignment?.isSystemScope == true) ? actorId : nil
        }
    }

    /// Scopes this role requires that are still unresolved.
    public var missingRequiredScopes: [ContextScope] {
        navigation.requiredScopes.filter { value(for: $0) == nil }
    }

    /// True only when every REQUIRED scope is resolved.
    ///
    /// Unlike the previous model, an absent engagement/gate/guest is NOT treated as complete —
    /// that was how a vendor with no engagement and an usher with no gate both looked authorised.
    public var isComplete: Bool { missingRequiredScopes.isEmpty }

    /// Role switch must never silently inherit a scope the new role does not own, and must drop the
    /// previous role's assignment so the new role re-resolves its own (P0-7).
    public func withRole(_ role: AppRole) -> NavigationContext {
        let scopes = IANavigationContract.forRole(role).contextScopes
        return NavigationContext(
            actorId: actorId,
            activeRole: role,
            activeWeddingId: activeWeddingId,
            activeWeddingTitle: activeWeddingTitle,
            environment: environment,
            activeClientId: scopes.contains(.client) ? activeClientId : nil,
            activeVendorId: scopes.contains(.vendor) ? activeVendorId : nil,
            activeEngagementId: scopes.contains(.engagement) ? activeEngagementId : nil,
            activeGateId: scopes.contains(.gate) ? activeGateId : nil,
            activeGuestId: scopes.contains(.guest) ? activeGuestId : nil,
            activePassToken: scopes.contains(.guest) ? activePassToken : nil,
            assignment: nil
        )
    }

    /// Changing wedding invalidates every wedding-dependent scope (P0-7).
    ///
    /// Client, engagement, gate, guest identity and pass token all belong to the previous wedding,
    /// so they are cleared and must be re-resolved from an assignment for the new wedding.
    public func withWedding(id: String, title: String) -> NavigationContext {
        guard id != activeWeddingId else {
            return NavigationContext(
                actorId: actorId, activeRole: activeRole, activeWeddingId: activeWeddingId,
                activeWeddingTitle: title, environment: environment,
                activeClientId: activeClientId, activeVendorId: activeVendorId,
                activeEngagementId: activeEngagementId,
                activeGateId: activeGateId, activeGuestId: activeGuestId,
                activePassToken: activePassToken, assignment: assignment
            )
        }
        return NavigationContext(
            actorId: actorId,
            activeRole: activeRole,
            activeWeddingId: id,
            activeWeddingTitle: title,
            environment: environment,
            activeClientId: nil,
            activeVendorId: nil,
            activeEngagementId: nil,
            activeGateId: nil,
            activeGuestId: nil,
            activePassToken: nil,
            assignment: nil
        )
    }

    /// Human-readable Level-0 context line (IA V2 §1.2).
    public var contextLabel: String {
        var parts = [navigation.displayName]
        if navigation.isSystemScoped && activeWeddingId.isEmpty {
            parts.append("All weddings")
        } else if !activeWeddingTitle.isEmpty {
            parts.append(activeWeddingTitle)
        }
        if let gate = activeGateId, !gate.isEmpty { parts.append(gate) }
        if assignment?.isShadowTestAccess == true { parts.append("Test access only") }
        return parts.joined(separator: " • ")
    }
}
