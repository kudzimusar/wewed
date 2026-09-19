import Foundation
import Combine

/// Holds who is signed in and which of their authorized roles is active.
/// A role can only become active if the session was granted it; there is no persona switcher.
/// Mirrors Android `SessionViewModel`.
public final class SessionStore: ObservableObject, @unchecked Sendable {
    @Published public private(set) var session: AuthorizedSession?
    /// Nil while signed out, or while a multi-role account has not yet chosen how to use the app.
    @Published public private(set) var activeGrant: RoleGrant?

    public init() {}

    public var isAuthenticated: Bool { session != nil }

    /// One role enters directly; several roles wait for the person to choose.
    public func establish(_ session: AuthorizedSession) {
        self.session = session
        self.activeGrant = session.grants.count == 1 ? session.grants[0] : nil
    }

    /// Returns false (and changes nothing) if the role is not one this session was granted.
    @discardableResult
    public func activate(_ role: AppRole) -> Bool {
        guard let grant = session?.grant(for: role) else { return false }
        activeGrant = grant
        return true
    }

    /// Back to the role chooser; only meaningful for multi-role sessions.
    public func clearActiveRole() {
        if session?.requiresRoleChoice == true { activeGrant = nil }
    }

    public func signOut() {
        session = nil
        activeGrant = nil
    }
}
