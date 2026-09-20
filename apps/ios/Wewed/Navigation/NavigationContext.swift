import Foundation

/// IA V2 §13.1 — the active context envelope every repository-backed screen resolves from.
///
/// Navigation transitions carry this value forward unchanged, which is what stops a route change
/// from silently switching the wedding graph underneath a workspace (IA V2 §13.2).
public struct NavigationContext: Equatable, Sendable {
    public let actorId: String
    public let activeRole: AppRole
    public let activeWeddingId: String
    public let activeWeddingTitle: String
    public let environment: NativeDataEnvironment
    public let activeClientId: String?
    public let activeEngagementId: String?
    public let activeGateId: String?

    public init(
        actorId: String,
        activeRole: AppRole,
        activeWeddingId: String,
        activeWeddingTitle: String,
        environment: NativeDataEnvironment,
        activeClientId: String? = nil,
        activeEngagementId: String? = nil,
        activeGateId: String? = nil
    ) {
        self.actorId = actorId
        self.activeRole = activeRole
        self.activeWeddingId = activeWeddingId
        self.activeWeddingTitle = activeWeddingTitle
        self.environment = environment
        self.activeClientId = activeClientId
        self.activeEngagementId = activeEngagementId
        self.activeGateId = activeGateId
    }

    /// True when the role's declared context scopes are all satisfied.
    public var isComplete: Bool {
        IANavigationContract.forRole(activeRole).contextScopes.allSatisfy { scope in
            switch scope {
            case .wedding:
                return !activeWeddingId.isEmpty
            // Client/engagement/gate are resolved on entry to their workspace; an empty value is
            // an unselected state, not an invalid envelope.
            case .client, .engagement, .gate:
                return true
            }
        }
    }

    /// Role switch must never silently inherit a scope the new role does not own.
    /// Wedding identity is preserved; role-specific scopes are dropped.
    public func withRole(_ role: AppRole) -> NavigationContext {
        let scopes = IANavigationContract.forRole(role).contextScopes
        return NavigationContext(
            actorId: actorId,
            activeRole: role,
            activeWeddingId: activeWeddingId,
            activeWeddingTitle: activeWeddingTitle,
            environment: environment,
            activeClientId: scopes.contains(.client) ? activeClientId : nil,
            activeEngagementId: scopes.contains(.engagement) ? activeEngagementId : nil,
            activeGateId: scopes.contains(.gate) ? activeGateId : nil
        )
    }

    public func withWedding(id: String, title: String) -> NavigationContext {
        NavigationContext(
            actorId: actorId,
            activeRole: activeRole,
            activeWeddingId: id,
            activeWeddingTitle: title,
            environment: environment,
            activeClientId: activeClientId,
            activeEngagementId: activeEngagementId,
            activeGateId: activeGateId
        )
    }

    /// Human-readable Level-0 context line (IA V2 §1.2).
    public var contextLabel: String {
        var parts = [IANavigationContract.forRole(activeRole).displayName]
        if !activeWeddingTitle.isEmpty { parts.append(activeWeddingTitle) }
        if let gate = activeGateId, !gate.isEmpty { parts.append(gate) }
        return parts.joined(separator: " • ")
    }
}
