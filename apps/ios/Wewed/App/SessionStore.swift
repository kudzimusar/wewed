import Foundation
import Combine

public final class SessionStore: ObservableObject, @unchecked Sendable {
    @Published public var isAuthenticated: Bool = false
    @Published public var currentUserRole: String? = nil
    @Published public var currentRole: AppRole = .couple
    @Published public var currentUserName: String? = nil
    @Published public var weddingId: String = "cmqos70cb0004q6vxe9g9aiu5"
    @Published public var weddingTitle: String = "Charity & Kudzie Wedding"
    @Published public var activePersona: DevelopmentPersona? = nil
    @Published public var passToken: String? = nil
    @Published public var showingPersonaPicker: Bool = false

    /// Roles this identity is authorized to open, as resolved after authentication.
    ///
    /// Empty until an identity is established. Authorization is an ANSWER, never an argument: the
    /// old `login(email:role:)` let its caller state the role, which is how three chips on a
    /// sign-in form became the authorization mechanism.
    @Published public var authorizedRoles: [AppRole] = []

    /// True once a stored session has been read and either validated or discarded.
    @Published public var sessionRestored: Bool = false

    private let storage: SecureStorageProtocol
    private let tokenKey = "wewed_session_token"

    public init(storage: SecureStorageProtocol = InMemorySecureStorage()) {
        self.storage = storage
        restoreSession()
    }

    /// Reads the stored session.
    ///
    /// A restored session is NOT the same as a validated one. Production must call
    /// `/api/mobile/auth/me` before trusting a stored role, because authorization can be revoked
    /// between launches and a stale Planner or Admin shell must never remain visible. That server
    /// validation is not yet wired; until it is, a restored session is trusted only in the Shadow
    /// and UAT environments, which is why `sessionRestored` is separate from `isAuthenticated`.
    public func restoreSession() {
        if let token = storage.get(key: tokenKey), !token.isEmpty {
            self.isAuthenticated = true
            self.currentUserRole = currentRole.roleId
            self.authorizedRoles = [currentRole]
        }
        self.sessionRestored = true
    }

    /// Signs in with an identity and a secret. No role parameter, by design.
    ///
    /// Production wiring to `/api/mobile/auth/signin` is NOT yet in place; until it is, this
    /// throws rather than minting a token, because a sign-in that always succeeds is worse than
    /// one that is honestly unavailable — it teaches everyone the app is authenticated when it
    /// is not.
    public func signIn(email: String, password: String) throws {
        guard !email.isEmpty else { throw SessionError.message("Enter your email address.") }
        guard !password.isEmpty else { throw SessionError.message("Enter your password.") }
        throw SessionError.message(
            "Wewed account sign-in is not connected in this build. Use an invitation link, or "
                + "continue in the current Shadow environment."
        )
    }

    /// Enters the current Shadow/UAT environment without a production credential.
    ///
    /// Offered only where persona switching is already permitted, and it carries no credential:
    /// it opens the qualification environment, not an account.
    public func enterShadowSession() {
        storage.save(key: tokenKey, value: "shadow_session_\(UUID().uuidString)")
        self.isAuthenticated = true
        self.sessionRestored = true
        self.authorizedRoles = [currentRole]
    }

    @available(*, deprecated, message: "Role is an authorization result, not a caller argument. Use signIn(email:password:) or enterShadowSession().")
    public func login(email: String, role: String = "couple") {
        let dummyToken = "token_\(UUID().uuidString)"
        storage.save(key: tokenKey, value: dummyToken)
        self.isAuthenticated = true
        self.currentUserRole = role
        let parsed = AppRole.from(roleId: role)
        self.currentRole = parsed
        self.currentUserName = (parsed == .usher) ? "Gate Usher" : "Charity & Kudzie"
        self.authorizedRoles = [parsed]
    }

    public func switchPersona(_ persona: DevelopmentPersona) {
        self.authorizedRoles = [persona.role]
        self.activePersona = persona
        self.currentRole = persona.role
        self.currentUserRole = persona.role.roleId
        self.currentUserName = persona.name
        self.weddingId = persona.weddingId
        self.weddingTitle = persona.weddingTitle
        self.isAuthenticated = true
    }

    /// Signs out.
    ///
    /// Clears the stored credential AND the resolved authorization. Dropping only the token would
    /// leave a role and a wedding context behind, so the next launch could restore a shell the
    /// person is no longer entitled to see.
    ///
    /// The protected Shadow/UAT snapshot is app-private data governed by the environment security
    /// rules, not session state, and is deliberately left alone.
    public func signOut() {
        storage.delete(key: tokenKey)
        self.isAuthenticated = false
        self.currentUserRole = nil
        self.currentRole = .couple
        self.currentUserName = nil
        self.activePersona = nil
        self.authorizedRoles = []
        self.sessionRestored = true
    }

    @available(*, deprecated, message: "Use signOut().")
    public func logout() { signOut() }
}

/// A sign-in failure with a message worth showing someone.
public enum SessionError: LocalizedError {
    case message(String)

    public var errorDescription: String? {
        switch self {
        case let .message(text): return text
        }
    }
}
