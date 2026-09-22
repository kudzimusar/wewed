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
    @Published public private(set) var activeGrantId: String? = nil
    @Published public private(set) var productionWorkspace: ProductionWorkspaceSnapshot? = nil

    /// The engagement the person explicitly chose for a Vendor wedding grant with more than one.
    /// Nil means "let the server auto-resolve a single engagement, or report that a choice is
    /// needed" — never a client-side guess. Reset whenever `activeGrantId` changes, since an
    /// engagement id is only ever meaningful for the grant it came from (master plan Phase 6 §5).
    @Published public private(set) var selectedEngagementId: String? = nil

    @Published public private(set) var isSigningIn: Bool = false
    @Published public private(set) var authenticationError: String? = nil

    private let storage: SecureStorageProtocol
    private let environment: NativeDataEnvironment
    private let authorityClient: ProductionAuthorityClient?
    private let tokenKey = "wewed_session_token"
    private let accountSessionKey = "wewed.account.session"
    private let selectedGrantsKey = "wewed.account.selected-grants"
    private let selectedGrantsOwnerKey = "wewed.account.selected-grants.owner"

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
            await refreshActiveWorkspace(client: client, sessionToken: storedToken)
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
                await refreshActiveWorkspace(client: client, sessionToken: sessionToken)
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
        // A different verified account than whatever this process last held, signing in directly
        // over it with no prior signOut(). Account A's selection/active grant must never leak into
        // Account B merely because a grant id happens to coincide, or because in-memory state from
        // A's session is still sitting in these fields (master plan Phase 6 §4). Ordinary restores
        // and refreshes of the SAME account never hit this: previousAccessUserId is nil on first
        // application, and unchanged on every subsequent one.
        let previousAccessUserId = productionAuthority?.accessUserId
        if let previousAccessUserId, previousAccessUserId != authority.accessUserId {
            selectedGrantIds = []
            storage.delete(key: selectedGrantsKey)
            storage.delete(key: selectedGrantsOwnerKey)
            activeGrantId = nil
            currentRole = nil
            currentUserRole = nil
            weddingId = nil
            weddingTitle = nil
            selectedEngagementId = nil
        }

        productionAuthority = authority
        productionWorkspace = nil
        isAuthenticated = true

        guard ProductionGrantMapper.isUsable(authority) else {
            authorizedRoles = []
            currentRole = nil
            currentUserRole = nil
            activePersona = nil
            weddingId = nil
            weddingTitle = nil
            activeGrantId = nil
            selectedGrantIds = []
            selectedEngagementId = nil
            storage.delete(key: selectedGrantsKey)
            storage.delete(key: selectedGrantsOwnerKey)
            return
        }

        let storedSelection = revalidateSelection ? readSelectedGrantIds(for: authority.accessUserId) : selectedGrantIds
        let liveGrants = storedSelection.compactMap { id in authority.workspaceGrants.first { $0.grantId == id } }
        let grouped = Dictionary(grouping: liveGrants) { $0.workspaceKindWire }
        let liveSelection = Set(grouped.values.compactMap { grants in grants.count == 1 ? grants[0].grantId : nil })
        selectedGrantIds = liveSelection
        persistSelectedGrantIds(liveSelection)

        let assignmentPairs: [(ProductionWorkspaceGrant, ActorAssignment)] = authority.workspaceGrants.compactMap { grant in
            let requiresSelection = authority.contextSelection
                .first { $0.workspaceKind == grant.workspaceKindWire }?
                .selectionRequired == true
            if requiresSelection && !liveSelection.contains(grant.grantId) { return nil }
            if case let .assigned(assignment) = ProductionGrantMapper.map(authority, grantId: grant.grantId) {
                return (grant, assignment)
            }
            return nil
        }

        var seenRoles: [AppRole] = []
        for pair in assignmentPairs where !seenRoles.contains(pair.1.role) { seenRoles.append(pair.1.role) }
        authorizedRoles = seenRoles

        let next = assignmentPairs.first { $0.0.grantId == activeGrantId }
            ?? assignmentPairs.first { $0.1.role == currentRole }
            ?? assignmentPairs.first

        if let next {
            activeGrantId = next.0.grantId
            currentRole = next.1.role
            currentUserRole = next.1.role.roleId
            weddingId = next.1.weddingId
            weddingTitle = next.1.weddingId
                .flatMap { id in authority.workspaceGrants.first { $0.weddingId == id }?.weddingTitle }
            return
        }

        let nonWeddingGrants = authority.workspaceGrants.filter {
            if case .requiresWeddingSelection = ProductionGrantMapper.map(authority, grantId: $0.grantId) {
                return true
            }
            return false
        }
        let explicitlySelectedLanding = nonWeddingGrants.first { liveSelection.contains($0.grantId) }
        let soleUnambiguousLanding = nonWeddingGrants.count == 1
            && authority.contextSelection.first(where: {
                $0.workspaceKind == nonWeddingGrants[0].workspaceKindWire
            })?.selectionRequired != true
            ? nonWeddingGrants[0]
            : nil
        let landing = explicitlySelectedLanding ?? soleUnambiguousLanding

        activeGrantId = landing?.grantId
        currentRole = nil
        currentUserRole = nil
        weddingId = nil
        weddingTitle = landing?.weddingTitle
    }

    @MainActor
    func refreshActiveWorkspace(client: ProductionAuthorityClient, sessionToken: String) async {
        guard let grantId = activeGrantId else {
            productionWorkspace = nil
            return
        }
        switch await client.fetchWorkspace(sessionToken: sessionToken, grantId: grantId, engagementId: selectedEngagementId) {
        case let .success(workspace):
            if activeGrantId == workspace.grantId { productionWorkspace = workspace }
        case .sessionInvalid:
            clearAccountSession()
        case .grantRevoked:
            let revoked = activeGrantId
            productionWorkspace = nil
            activeGrantId = nil
            currentRole = nil
            currentUserRole = nil
            weddingId = nil
            weddingTitle = nil
            selectedEngagementId = nil
            if let revoked {
                selectedGrantIds.remove(revoked)
                persistSelectedGrantIds(selectedGrantIds)
            }
        case .engagementInvalid:
            // The wedding/business grant underneath is still valid; only the engagement choice was
            // stale/foreign/revoked. Clear the engagement only and re-fetch so the server can either
            // auto-resolve a single remaining engagement or report a fresh choice is needed — never
            // fall back to rendering the rejected engagement.
            selectedEngagementId = nil
            productionWorkspace = nil
            await refreshActiveWorkspace(client: client, sessionToken: sessionToken)
        case .transport:
            productionWorkspace = nil
        }
    }

    /// Records the account's explicit choice among several grants of one workspace kind (master
    /// plan §9). Ignored for a grant id the current authority does not actually hold.
    @MainActor
    public func selectGrant(_ grantId: String) {
        guard let authority = productionAuthority,
              let selected = authority.workspaceGrants.first(where: { $0.grantId == grantId })
        else { return }

        let sameKindIds = Set(
            authority.workspaceGrants
                .filter { $0.workspaceKindWire == selected.workspaceKindWire }
                .map(\.grantId)
        )
        let next = selectedGrantIds.subtracting(sameKindIds).union([grantId])
        selectedGrantIds = next
        persistSelectedGrantIds(next)
        activeGrantId = grantId
        // An engagement choice belongs to the grant it was made for; a fresh grant starts with none
        // (master plan Phase 6 §5). applyAuthority() below already clears the workspace snapshot
        // synchronously, so no stale data can render while the new one is being fetched (§9, §14).
        selectedEngagementId = nil
        applyAuthority(authority, revalidateSelection: false)

        if let client = authorityClient,
           let token = storage.get(key: accountSessionKey) {
            Task { @MainActor in
                await self.refreshActiveWorkspace(client: client, sessionToken: token)
            }
        }
    }

    /// Records the account's explicit choice of engagement for the currently active Vendor wedding
    /// grant. Ignored for an engagement id the current workspace snapshot does not actually list —
    /// the server re-validates it against the fresh grant regardless (master plan Phase 6 §5, §10).
    @MainActor
    public func selectEngagement(_ engagementId: String) {
        guard let workspace = productionWorkspace, workspace.serviceEngagementIds.contains(engagementId) else { return }
        selectedEngagementId = engagementId
        // Clear immediately: the previous engagement's data must never remain visible while the
        // newly-selected one is being fetched (master plan Phase 6 §14).
        productionWorkspace = nil

        if let client = authorityClient,
           let token = storage.get(key: accountSessionKey) {
            Task { @MainActor in
                await self.refreshActiveWorkspace(client: client, sessionToken: token)
            }
        }
    }

    private func readSelectedGrantIds(for accessUserId: String) -> Set<String> {
        guard storage.get(key: selectedGrantsOwnerKey) == accessUserId else {
            // Ownerless selections are legacy Phase-5 preferences. They cannot safely be
            // attributed after a process restart, so fail closed once rather than letting Account
            // B inherit Account A's coincidentally identical grant id.
            storage.delete(key: selectedGrantsKey)
            storage.delete(key: selectedGrantsOwnerKey)
            return []
        }
        guard let stored = storage.get(key: selectedGrantsKey) else { return [] }
        return Set(stored.split(separator: ",").map(String.init).filter { !$0.isEmpty })
    }

    private func persistSelectedGrantIds(_ ids: Set<String>) {
        guard !ids.isEmpty, let owner = productionAuthority?.accessUserId else {
            storage.delete(key: selectedGrantsKey)
            storage.delete(key: selectedGrantsOwnerKey)
            return
        }
        storage.save(key: selectedGrantsOwnerKey, value: owner)
        storage.save(key: selectedGrantsKey, value: ids.joined(separator: ","))
    }

    /// The identity session itself is no longer valid server-side: a full, unambiguous sign-out.
    @MainActor
    private func clearAccountSession() {
        storage.delete(key: accountSessionKey)
        storage.delete(key: selectedGrantsKey)
        storage.delete(key: selectedGrantsOwnerKey)
        isAuthenticated = false
        productionAuthority = nil
        productionWorkspace = nil
        activeGrantId = nil
        authorizedRoles = []
        currentRole = nil
        currentUserRole = nil
        activePersona = nil
        weddingId = nil
        weddingTitle = nil
        selectedGrantIds = []
        selectedEngagementId = nil
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
        storage.delete(key: selectedGrantsOwnerKey)
        self.isAuthenticated = false
        self.currentUserRole = nil
        self.currentRole = nil
        self.currentUserName = nil
        self.weddingId = nil
        self.weddingTitle = nil
        self.activePersona = nil
        self.authorizedRoles = []
        self.productionAuthority = nil
        self.productionWorkspace = nil
        self.activeGrantId = nil
        self.selectedGrantIds = []
        self.selectedEngagementId = nil
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
