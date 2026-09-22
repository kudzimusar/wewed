import Foundation
import Combine

/// The account session.
///
/// It starts EMPTY: no identity, no role, no persona, no wedding. Every one of those is an answer
/// that has to come from somewhere — a Shadow persona in a development environment, or (master
/// plan Phase 5) the real, server-resolved `WewedProductionAuthorityV1` for a signed-in account.
/// It used to start as the Couple on a real production wedding id, so anything that read the
/// session before authority resolved saw a real couple's workspace (master plan §8.2).
///
/// A stored identity credential is never itself authority (master plan §8, §8.8): every restore
/// re-fetches and re-resolves the account's grants from the server. Nothing here ever calls
/// `AppRole(rawValue:)` on server data or invents a wedding for a Planner-portfolio/Vendor-business
/// grant with none selected — that is `ProductionGrantMapper`'s job, unchanged from Phase 2.
///
/// Guest Session v2 is a completely separate identity path (its own Keychain service, its own
/// client) and is never touched from here.
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

    /// The full, freshly-resolved `WewedProductionAuthorityV1` for a signed-in production account.
    /// Nil in every Shadow/Fixture path and whenever no successful authority fetch has completed.
    @Published public private(set) var productionAuthority: ProductionAuthority? = nil

    /// Grant ids the person has explicitly chosen, for workspace kinds where more than one grant
    /// exists. Persisted only as a preference (master plan §9): it is revalidated against every
    /// fresh `productionAuthority` fetch, and a grant id that no longer exists there has no effect.
    @Published public private(set) var selectedGrantIds: Set<String> = []

    @Published public private(set) var isSigningIn: Bool = false
    @Published public private(set) var authenticationError: String? = nil

    private let storage: SecureStorageProtocol
    private let environment: NativeDataEnvironment
    private let authorityClient: ProductionAuthorityClient?
    private let tokenKey = "wewed_session_token"
    private let accountSessionKey = "wewed.account.session"
    private let selectedGrantsKey = "wewed.account.selected-grants"

    /// Whether this session may apply Shadow qualification personas.
    public var allowsDevelopmentPersonas: Bool { environment.allowsDevelopmentPersonaSwitching }

    /// - Parameter authorityClient: the Phase-5 native identity + authority client. Nil means
    ///   production sign-in/restore is not connected in this build (e.g. Fixture/Shadow), matching
    ///   the previous always-throws behaviour exactly.
    public init(
        storage: SecureStorageProtocol = InMemorySecureStorage(),
        environment: NativeDataEnvironment = .production,
        authorityClient: ProductionAuthorityClient? = nil
    ) {
        self.storage = storage
        self.environment = environment
        self.authorityClient = authorityClient
        restoreSession()
    }

    /// Reads the stored identity session.
    ///
    /// A stored token is NOT authority. It only re-identifies the account; production validates it
    /// with the server on every restore, because authorization can be revoked between launches. No
    /// role, wedding or grant is ever trusted from local storage alone (master plan §8, §8.8) — it
    /// used to grant whatever `currentRole` held, which defaulted to Couple, to anyone holding any
    /// token.
    ///
    /// With no stored session, or no `authorityClient` configured for this build, this resolves
    /// synchronously to "nothing to restore" — exactly the previous behaviour. With a stored
    /// session and a client, it launches the real server round trip and only then marks the
    /// session restored, so an observer of `sessionRestored` never sees a false "signed out" flash
    /// before the server has actually been asked.
    public func restoreSession() {
        guard let storedToken = storage.get(key: accountSessionKey), let client = authorityClient else {
            self.sessionRestored = true
            return
        }
        Task { @MainActor in
            await self.restoreFromServer(client: client, storedToken: storedToken)
            self.sessionRestored = true
        }
    }

    @MainActor
    func restoreFromServer(client: ProductionAuthorityClient, storedToken: String) async {
        switch await client.fetchAuthority(sessionToken: storedToken) {
        case let .success(authority):
            applyAuthority(authority, revalidateSelection: true)
        case .sessionInvalid:
            clearAccountSession()
        case .transport:
            // A transient failure proves nothing either way. Do not open a workspace from an
            // unreachable server, and do not throw away a possibly-good credential over a network
            // blip. Neither authenticated-with-a-workspace nor signed-out; the caller may call
            // restoreSession() again once connectivity returns.
            break
        }
    }

    /// Signs in with an identity and a secret. No role parameter, by design.
    ///
    /// With no `authorityClient` configured for this build (Fixture/Shadow), this still refuses
    /// exactly as before: a sign-in that always succeeds is worse than one that is honestly
    /// unavailable. With a client, it verifies the credential against Supabase server-side, stores
    /// only the resulting opaque identity session, then immediately resolves real authority for
    /// it — never a role chosen by the caller.
    public func signIn(email: String, password: String) throws {
        guard !email.isEmpty else { throw SessionError.message("Enter your email address.") }
        guard !password.isEmpty else { throw SessionError.message("Enter your password.") }
        guard let client = authorityClient else {
            throw SessionError.message(
                "Wewed account sign-in is not connected in this build. Use an invitation link, or "
                    + "continue in the current Shadow environment."
            )
        }
        Task { @MainActor in
            await self.signInWithServer(client: client, email: email, password: password)
        }
    }

    @MainActor
    func signInWithServer(client: ProductionAuthorityClient, email: String, password: String) async {
        isSigningIn = true
        authenticationError = nil
        switch await client.signIn(email: email, password: password) {
        case let .success(sessionToken):
            storage.save(key: accountSessionKey, value: sessionToken)
            switch await client.fetchAuthority(sessionToken: sessionToken) {
            case let .success(authority):
                applyAuthority(authority, revalidateSelection: false)
            case .sessionInvalid:
                clearAccountSession()
            case .transport:
                authenticationError = "Signed in, but Wewed could not be reached. Please try again."
            }
        case .invalidCredentials:
            authenticationError = "Invalid email or password."
        case .transport:
            authenticationError = "Wewed could not be reached. Please try again."
        }
        isSigningIn = false
    }

    /// Applies a freshly-fetched, server-verified authority document.
    ///
    /// `accountStatus != "authorized"` (unknown/inactive/unverified/banned/any future status) keeps
    /// the identity session (it may recover — a transient ban lift, a completed verification) but
    /// grants nothing: empty roles, no current role, no wedding, no selection. This is the one
    /// place that decides what "authenticated" means for a workspace, and it is never widened to
    /// "a session token exists".
    @MainActor
    private func applyAuthority(_ authority: ProductionAuthority, revalidateSelection: Bool) {
        productionAuthority = authority
        isAuthenticated = true

        guard ProductionGrantMapper.isUsable(authority) else {
            authorizedRoles = []
            currentRole = nil
            currentUserRole = nil
            activePersona = nil
            weddingId = nil
            weddingTitle = nil
            selectedGrantIds = []
            storage.delete(key: selectedGrantsKey)
            return
        }

        let storedSelection = revalidateSelection ? readSelectedGrantIds() : selectedGrantIds
        // Revalidated against the FRESH authority: a grant id that no longer exists there is
        // silently dropped, never carried forward as if it still held (master plan §9).
        let liveSelection = Set(storedSelection.filter { id in authority.workspaceGrants.contains { $0.grantId == id } })
        selectedGrantIds = liveSelection
        persistSelectedGrantIds(liveSelection)

        let assignments: [ActorAssignment] = authority.workspaceGrants.compactMap { grant in
            let requiresSelection = authority.contextSelection
                .first { $0.workspaceKind == grant.workspaceKindWire }?
                .selectionRequired == true
            if requiresSelection && !liveSelection.contains(grant.grantId) { return nil }
            if case let .assigned(assignment) = ProductionGrantMapper.map(authority, grantId: grant.grantId) {
                return assignment
            }
            return nil
        }

        var seenRoles: [AppRole] = []
        for assignment in assignments where !seenRoles.contains(assignment.role) { seenRoles.append(assignment.role) }
        authorizedRoles = seenRoles

        let nextAssignment = assignments.first { $0.role == currentRole } ?? assignments.first
        currentRole = nextAssignment?.role
        currentUserRole = nextAssignment?.role.roleId
        weddingId = nextAssignment?.weddingId
        weddingTitle = nextAssignment?.weddingId
            .flatMap { id in authority.workspaceGrants.first { $0.weddingId == id }?.weddingTitle }
    }

    /// Records the account's explicit choice among several grants of one workspace kind (master
    /// plan §9). Ignored for a grant id the current authority does not actually hold.
    @MainActor
    public func selectGrant(_ grantId: String) {
        guard let authority = productionAuthority else { return }
        guard authority.workspaceGrants.contains(where: { $0.grantId == grantId }) else { return }
        let next = selectedGrantIds.union([grantId])
        selectedGrantIds = next
        persistSelectedGrantIds(next)
        applyAuthority(authority, revalidateSelection: false)
    }

    private func readSelectedGrantIds() -> Set<String> {
        guard let stored = storage.get(key: selectedGrantsKey) else { return [] }
        return Set(stored.split(separator: ",").map(String.init).filter { !$0.isEmpty })
    }

    private func persistSelectedGrantIds(_ ids: Set<String>) {
        if ids.isEmpty {
            storage.delete(key: selectedGrantsKey)
        } else {
            storage.save(key: selectedGrantsKey, value: ids.joined(separator: ","))
        }
    }

    /// The identity session itself is no longer valid server-side: a full, unambiguous sign-out.
    @MainActor
    private func clearAccountSession() {
        storage.delete(key: accountSessionKey)
        storage.delete(key: selectedGrantsKey)
        isAuthenticated = false
        productionAuthority = nil
        authorizedRoles = []
        currentRole = nil
        currentUserRole = nil
        activePersona = nil
        weddingId = nil
        weddingTitle = nil
        selectedGrantIds = []
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
    /// Clears every stored credential (Shadow placeholder AND the real account session) and every
    /// resolved answer — role, persona, wedding, authority, selection. Dropping only one token
    /// would leave a role and a wedding context behind, so the next reader could see a shell the
    /// person is no longer entitled to.
    ///
    /// The protected Shadow/UAT snapshot is app-private data governed by the environment security
    /// rules, not session state, and is deliberately left alone. Guest Session v2's own Keychain
    /// storage is a separate identity path and is never touched here.
    public func signOut() {
        storage.delete(key: tokenKey)
        storage.delete(key: accountSessionKey)
        storage.delete(key: selectedGrantsKey)
        self.isAuthenticated = false
        self.currentUserRole = nil
        self.currentRole = nil
        self.currentUserName = nil
        self.weddingId = nil
        self.weddingTitle = nil
        self.activePersona = nil
        self.authorizedRoles = []
        self.productionAuthority = nil
        self.selectedGrantIds = []
        self.authenticationError = nil
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
