import Foundation
import Combine

/// The account session.
///
/// It starts EMPTY: no identity, no role, no persona, no wedding. Every one of those is an answer
/// that has to come from somewhere — a Shadow persona in a development environment today, the
/// production grant contract later (master plan Phases 2 and 5). It used to start as the Couple on
/// a real production wedding id, so anything that read the session before authority resolved saw a
/// real couple's workspace (master plan §8.2).
///
/// `environment` decides whether Shadow personas may be applied at all. It defaults to
/// `.production`, so a session built without thinking about it is the fail-closed one.
public final class SessionStore: ObservableObject, @unchecked Sendable {
    @Published public var isAuthenticated: Bool = false
    @Published public var currentUserRole: String? = nil
    /// The workspace role in use, or nil when no authority has been resolved. Never a default.
    @Published public private(set) var currentRole: AppRole? = nil
    @Published public var currentUserName: String? = nil
    @Published public private(set) var weddingId: String? = nil
    @Published public private(set) var weddingTitle: String? = nil
    @Published public private(set) var activePersona: DevelopmentPersona? = nil
    @Published public var passToken: String? = nil
    @Published public var showingPersonaPicker: Bool = false

    /// Roles this identity is authorized to open, as resolved after authentication.
    ///
    /// Empty until an identity is established. Authorization is an ANSWER, never an argument: the
    /// old `login(email:role:)` let its caller state the role, which is how three chips on a
    /// sign-in form became the authorization mechanism.
    @Published public private(set) var authorizedRoles: [AppRole] = []

    /// True once a stored session has been read and either validated or discarded.
    @Published public var sessionRestored: Bool = false

    private let storage: SecureStorageProtocol
    private let environment: NativeDataEnvironment
    private let tokenKey = "wewed_session_token"

    /// Whether this session may apply Shadow qualification personas.
    public var allowsDevelopmentPersonas: Bool { environment.allowsDevelopmentPersonaSwitching }

    public init(
        storage: SecureStorageProtocol = InMemorySecureStorage(),
        environment: NativeDataEnvironment = .production
    ) {
        self.storage = storage
        self.environment = environment
        restoreSession()
    }

    /// Reads the stored session.
    ///
    /// A stored token is NOT authority. Production must validate it with the server before any
    /// role is trusted, because authorization can be revoked between launches; that validation is
    /// master plan Phase 5 and is not wired. Until it is, a restored token grants nothing: no role,
    /// no wedding, not authenticated. It used to grant whatever `currentRole` held — which
    /// defaulted to Couple — to anyone holding any token (master plan §8.8).
    public func restoreSession() {
        self.sessionRestored = true
    }

    /// Signs in with an identity and a secret. No role parameter, by design.
    ///
    /// Production wiring is NOT yet in place (master plan Phase 5); until it is, this throws rather
    /// than minting a token, because a sign-in that always succeeds is worse than one that is
    /// honestly unavailable — it teaches everyone the app is authenticated when it is not.
    public func signIn(email: String, password: String) throws {
        guard !email.isEmpty else { throw SessionError.message("Enter your email address.") }
        guard !password.isEmpty else { throw SessionError.message("Enter your password.") }
        throw SessionError.message(
            "Wewed account sign-in is not connected in this build. Use an invitation link, or "
                + "continue in the current Shadow environment."
        )
    }

    /// Enters the current Shadow/UAT environment as its default qualification actor.
    ///
    /// Offered only where persona switching is permitted, and it carries no credential: it opens
    /// the qualification environment, not an account. Refused — returning false and changing
    /// nothing — in any other environment.
    @discardableResult
    public func enterShadowSession() -> Bool {
        guard allowsDevelopmentPersonas else { return false }
        storage.save(key: tokenKey, value: "shadow_session_\(UUID().uuidString)")
        return switchPersona(DevelopmentPersona.defaultShadowPersona)
    }

    /// Applies a Shadow qualification persona.
    ///
    /// Development and Shadow environments only. In production or production-read-verify this
    /// returns false and leaves the session untouched: a persona hands an actor an arbitrary role,
    /// and production roles come from real authorization, never from a picker (P0-16).
    @discardableResult
    public func switchPersona(_ persona: DevelopmentPersona) -> Bool {
        guard allowsDevelopmentPersonas else { return false }
        self.authorizedRoles = [persona.role]
        self.activePersona = persona
        self.currentRole = persona.role
        self.currentUserRole = persona.role.roleId
        self.currentUserName = persona.name
        self.weddingId = persona.weddingId
        self.weddingTitle = persona.weddingTitle
        self.isAuthenticated = true
        self.sessionRestored = true
        return true
    }

    /// Signs out.
    ///
    /// Clears the stored credential AND every resolved answer — role, persona, wedding. Dropping
    /// only the token would leave a role and a wedding context behind, so the next reader could see
    /// a shell the person is no longer entitled to.
    ///
    /// The protected Shadow/UAT snapshot is app-private data governed by the environment security
    /// rules, not session state, and is deliberately left alone.
    public func signOut() {
        storage.delete(key: tokenKey)
        self.isAuthenticated = false
        self.currentUserRole = nil
        self.currentRole = nil
        self.currentUserName = nil
        self.weddingId = nil
        self.weddingTitle = nil
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
