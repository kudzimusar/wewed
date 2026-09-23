package pro.wewed.app.state

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import pro.wewed.app.models.AppRole
import pro.wewed.app.models.DevelopmentPersona
import pro.wewed.app.models.NativeDataEnvironment
import pro.wewed.app.navigation.ProductionAuthority
import pro.wewed.app.navigation.ProductionGrantMapper
import pro.wewed.app.navigation.ProductionGateGrantMapper
import pro.wewed.app.navigation.GateOperationalContext
import pro.wewed.app.services.InMemorySecureStorage
import pro.wewed.app.services.NativeAccountSignInOutcome
import pro.wewed.app.services.ProductionAuthorityClient
import pro.wewed.app.services.ProductionAuthorityFetch
import pro.wewed.app.services.ProductionWorkspaceFetch
import pro.wewed.app.services.ProductionWorkspaceSnapshot
import pro.wewed.app.services.SecureStorage
import java.util.UUID

/**
 * The account session.
 *
 * It starts EMPTY: no identity, no role, no persona, no wedding. Every one of those is an answer
 * that has to come from somewhere — a Shadow persona in a development environment, or (master plan
 * Phase 5) the real, server-resolved `WewedProductionAuthorityV1` for a signed-in account. It used
 * to start as the Charity & Kudzie couple on a real production wedding id, so anything that read
 * the session before authority resolved saw a real couple's workspace (master plan §8.2).
 *
 * A stored identity credential is never itself authority (master plan §8, §8.8): every restore
 * re-fetches and re-resolves the account's grants from the server. Nothing here ever calls
 * `AppRole.fromId` on server data or invents a wedding for a Planner-portfolio/Vendor-business
 * grant with none selected — that is [ProductionGrantMapper]'s job, unchanged from Phase 2.
 *
 * Guest Session v2 is a completely separate identity path (its own secure-storage keys, its own
 * client) and is never touched from here.
 *
 * @param environment decides whether Shadow personas may be applied at all. It defaults to
 *   [NativeDataEnvironment.PRODUCTION] so a session built without thinking about it is the
 *   fail-closed one.
 * @param authorityClient the Phase-5 native identity + authority client. Null means production
 *   sign-in/restore is not connected in this build (e.g. Fixture/Shadow), matching the previous
 *   always-refuses behaviour exactly.
 * @param scope where the async sign-in/restore work runs. The actual network I/O always happens on
 *   `Dispatchers.IO` inside the transport regardless of this scope's own dispatcher.
 */
class SessionViewModel(
    private val storage: SecureStorage = InMemorySecureStorage(),
    private val environment: NativeDataEnvironment = NativeDataEnvironment.PRODUCTION,
    private val authorityClient: ProductionAuthorityClient? = null,
    private val scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Unconfined)
) {
    private val tokenKey = "wewed_session_token"
    private val accountSessionKey = "wewed.account.session"
    private val selectedGrantsKey = "wewed.account.selected-grants"
    private val selectedGrantsOwnerKey = "wewed.account.selected-grants.owner"
    private val selectedGateGrantKey = "wewed.account.selected-gate-grant"
    private val selectedGateGrantOwnerKey = "wewed.account.selected-gate-grant.owner"

    /**
     * Master plan Phase 8 — the same bearer token [ProductionAuthorityClient] already uses
     * internally (`storage.get(accountSessionKey)`), exposed read-only so a production domain
     * repository can be constructed with it. Returns null exactly when no account is signed in.
     */
    fun currentSessionToken(): String? = storage.get(accountSessionKey)

    private val _isAuthenticated = MutableStateFlow(false)
    val isAuthenticated: StateFlow<Boolean> = _isAuthenticated.asStateFlow()

    private val _currentUserRole = MutableStateFlow<String?>(null)
    val currentUserRole: StateFlow<String?> = _currentUserRole.asStateFlow()

    /** The workspace role in use, or null when no authority has been resolved. Never a default. */
    private val _currentRole = MutableStateFlow<AppRole?>(null)
    val currentRole: StateFlow<AppRole?> = _currentRole.asStateFlow()

    private val _currentUserName = MutableStateFlow<String?>(null)
    val currentUserName: StateFlow<String?> = _currentUserName.asStateFlow()

    private val _activePersonaId = MutableStateFlow<String?>(null)
    val activePersonaId: StateFlow<String?> = _activePersonaId.asStateFlow()

    private val _weddingId = MutableStateFlow<String?>(null)
    val weddingId: StateFlow<String?> = _weddingId.asStateFlow()

    private val _weddingTitle = MutableStateFlow<String?>(null)
    val weddingTitle: StateFlow<String?> = _weddingTitle.asStateFlow()

    /**
     * Roles this identity is authorized to open, as resolved after authentication.
     *
     * Empty until an identity is established. Authorization is an ANSWER, never an argument: the
     * old `login(email, role)` let its caller state the role, which is how three chips on a sign-in
     * form became the authorization mechanism.
     */
    private val _authorizedRoles = MutableStateFlow<List<AppRole>>(emptyList())
    val authorizedRoles: StateFlow<List<AppRole>> = _authorizedRoles.asStateFlow()

    /** True once a stored session has been read and either validated or discarded. */
    private val _sessionRestored = MutableStateFlow(false)
    val sessionRestored: StateFlow<Boolean> = _sessionRestored.asStateFlow()

    /**
     * The full, freshly-resolved `WewedProductionAuthorityV1` for a signed-in production account.
     * Null in every Shadow/Fixture path and whenever no successful authority fetch has completed.
     */
    private val _productionAuthority = MutableStateFlow<ProductionAuthority?>(null)
    val productionAuthority: StateFlow<ProductionAuthority?> = _productionAuthority.asStateFlow()

    /** Selected operational Gate authority. Separate from workspace grants by design (Phase 10). */
    private val _selectedGateGrantId = MutableStateFlow<String?>(null)
    val selectedGateGrantId: StateFlow<String?> = _selectedGateGrantId.asStateFlow()

    private val _activeGateContext = MutableStateFlow<GateOperationalContext?>(null)
    val activeGateContext: StateFlow<GateOperationalContext?> = _activeGateContext.asStateFlow()

    /**
     * Grant ids the person has explicitly chosen, for workspace kinds where more than one grant
     * exists. Persisted only as a preference (master plan §9): it is revalidated against every
     * fresh [productionAuthority] fetch, and a grant id that no longer exists there has no effect.
     */
    private val _selectedGrantIds = MutableStateFlow<Set<String>>(emptySet())
    val selectedGrantIds: StateFlow<Set<String>> = _selectedGrantIds.asStateFlow()

    /** The exact current server-issued grant, if one has been resolved/selected. */
    private val _activeGrantId = MutableStateFlow<String?>(null)
    val activeGrantId: StateFlow<String?> = _activeGrantId.asStateFlow()

    /** Minimal real, server-revalidated read-only data for the active production workspace. */
    private val _productionWorkspace = MutableStateFlow<ProductionWorkspaceSnapshot?>(null)
    val productionWorkspace: StateFlow<ProductionWorkspaceSnapshot?> = _productionWorkspace.asStateFlow()

    /**
     * The engagement the person explicitly chose for a Vendor wedding grant with more than one.
     * Null means "let the server auto-resolve a single engagement, or report that a choice is
     * needed" — never a client-side guess. Reset whenever [activeGrantId] changes, since an
     * engagement id is only ever meaningful for the grant it came from (master plan Phase 6 §5).
     */
    private val _selectedEngagementId = MutableStateFlow<String?>(null)
    val selectedEngagementId: StateFlow<String?> = _selectedEngagementId.asStateFlow()

    private val _isSigningIn = MutableStateFlow(false)
    val isSigningIn: StateFlow<Boolean> = _isSigningIn.asStateFlow()

    private val _authenticationError = MutableStateFlow<String?>(null)
    val authenticationError: StateFlow<String?> = _authenticationError.asStateFlow()

    /** Whether this session may apply Shadow qualification personas. */
    val allowsDevelopmentPersonas: Boolean get() = environment.allowsDevelopmentPersonaSwitching

    init {
        restoreSession()
    }

    /**
     * Reads the stored identity session.
     *
     * A stored token is NOT authority. It only re-identifies the account; production validates it
     * with the server on every restore, because authorization can be revoked between launches. No
     * role, wedding or grant is ever trusted from local storage alone (master plan §8, §8.8) — it
     * used to grant whatever `currentRole` held, which defaulted to Couple, to anyone holding any
     * token.
     *
     * With no stored session, or no [authorityClient] configured for this build, this resolves
     * synchronously to "nothing to restore" — exactly the previous behaviour. With a stored session
     * and a client, it launches the real server round trip and only then marks the session
     * restored, so a caller observing [sessionRestored] never sees a false "signed out" flash before
     * the server has actually been asked.
     */
    fun restoreSession() {
        val storedToken = storage.get(accountSessionKey)
        val client = authorityClient
        if (storedToken == null || client == null) {
            _sessionRestored.value = true
            return
        }
        scope.launch {
            restoreFromServer(client, storedToken)
            _sessionRestored.value = true
        }
    }

    internal suspend fun restoreFromServer(client: ProductionAuthorityClient, storedToken: String) {
        when (val fetch = client.fetchAuthority(storedToken)) {
            is ProductionAuthorityFetch.Success -> {
                applyAuthority(fetch.authority, revalidateSelection = true)
                refreshActiveWorkspace(client, storedToken)
            }
            is ProductionAuthorityFetch.SessionInvalid -> clearAccountSession()
            is ProductionAuthorityFetch.Transport -> {
                // A transient failure proves nothing either way. Do not open a workspace from an
                // unreachable server, and do not throw away a possibly-good credential over a
                // network blip. Neither authenticated-with-a-workspace nor signed-out; the caller
                // may call restoreSession() again once connectivity returns.
            }
        }
    }

    /**
     * Signs in with an identity and a secret. No role parameter, by design.
     *
     * With no [authorityClient] configured for this build (Fixture/Shadow), this still refuses
     * exactly as before: a sign-in that always succeeds is worse than one that is honestly
     * unavailable. With a client, it verifies the credential against Supabase server-side, stores
     * only the resulting opaque identity session, then immediately resolves real authority for it —
     * never a role chosen by the caller.
     */
    fun signIn(email: String, password: String) {
        require(email.isNotBlank()) { "Enter your email address." }
        require(password.isNotBlank()) { "Enter your password." }
        val client = authorityClient
            ?: throw IllegalStateException(
                "Wewed account sign-in is not connected in this build. Use an invitation link, or " +
                    "continue in the current Shadow environment."
            )
        scope.launch { signInWithServer(client, email, password) }
    }

    internal suspend fun signInWithServer(client: ProductionAuthorityClient, email: String, password: String) {
        _isSigningIn.value = true
        _authenticationError.value = null
        when (val outcome = client.signIn(email, password)) {
            is NativeAccountSignInOutcome.Success -> {
                storage.save(accountSessionKey, outcome.sessionToken)
                when (val fetch = client.fetchAuthority(outcome.sessionToken)) {
                    is ProductionAuthorityFetch.Success -> {
                        applyAuthority(fetch.authority, revalidateSelection = false)
                        refreshActiveWorkspace(client, outcome.sessionToken)
                    }
                    is ProductionAuthorityFetch.SessionInvalid -> clearAccountSession()
                    is ProductionAuthorityFetch.Transport ->
                        _authenticationError.value = "Signed in, but Wewed could not be reached. Please try again."
                }
            }
            is NativeAccountSignInOutcome.InvalidCredentials ->
                _authenticationError.value = "Invalid email or password."
            is NativeAccountSignInOutcome.Transport ->
                _authenticationError.value = "Wewed could not be reached. Please try again."
        }
        _isSigningIn.value = false
    }

    /**
     * Applies a freshly-fetched, server-verified authority document.
     *
     * `accountStatus != "authorized"` (unknown/inactive/unverified/banned/any future status) keeps
     * the identity session (it may recover — a transient ban lift, a completed verification) but
     * grants nothing: empty roles, no current role, no wedding, no selection. This is the one place
     * that decides what "authenticated" means for a workspace, and it is never widened to "a
     * session token exists".
     */
    private fun applyAuthority(authority: ProductionAuthority, revalidateSelection: Boolean) {
        // A different verified account than whatever this process last held, signing in directly
        // over it with no prior signOut(). Account A's selection/active grant must never leak into
        // Account B merely because a grant id happens to coincide, or because in-memory state from
        // A's session is still sitting in these fields (master plan Phase 6 §4). Ordinary restores
        // and refreshes of the SAME account never hit this: previousAccessUserId is null on first
        // application, and unchanged on every subsequent one.
        val previousAccessUserId = _productionAuthority.value?.accessUserId
        if (previousAccessUserId != null && previousAccessUserId != authority.accessUserId) {
            _selectedGrantIds.value = emptySet()
            storage.delete(selectedGrantsKey)
            storage.delete(selectedGrantsOwnerKey)
            _selectedGateGrantId.value = null
            _activeGateContext.value = null
            storage.delete(selectedGateGrantKey)
            storage.delete(selectedGateGrantOwnerKey)
            _activeGrantId.value = null
            _currentRole.value = null
            _currentUserRole.value = null
            _weddingId.value = null
            _weddingTitle.value = null
            _selectedEngagementId.value = null
        }

        _productionAuthority.value = authority
        _productionWorkspace.value = null
        _isAuthenticated.value = true

        if (!ProductionGrantMapper.isUsable(authority)) {
            _authorizedRoles.value = emptyList()
            _currentRole.value = null
            _currentUserRole.value = null
            _activePersonaId.value = null
            _weddingId.value = null
            _weddingTitle.value = null
            _activeGrantId.value = null
            _selectedGrantIds.value = emptySet()
            _selectedEngagementId.value = null
            _selectedGateGrantId.value = null
            _activeGateContext.value = null
            storage.delete(selectedGrantsKey)
            storage.delete(selectedGrantsOwnerKey)
            storage.delete(selectedGateGrantKey)
            storage.delete(selectedGateGrantOwnerKey)
            return
        }

        _activePersonaId.value = authority.accessUserId

        val storedSelection = if (revalidateSelection) {
            readSelectedGrantIds(authority.accessUserId!!)
        } else {
            _selectedGrantIds.value
        }
        // Revalidate against the fresh contract and fail closed if stale storage somehow contains
        // more than one selected grant for the same workspace kind. One kind may have ONE active
        // selection; never let a historical union make two weddings active simultaneously.
        val liveGrants = storedSelection.mapNotNull { id -> authority.grants.firstOrNull { it.grantId == id } }
        val liveSelection = liveGrants
            .groupBy { it.workspaceKindWire }
            .values
            .filter { it.size == 1 }
            .mapTo(mutableSetOf()) { it.single().grantId }
        _selectedGrantIds.value = liveSelection
        persistSelectedGrantIds(liveSelection)

        val assignmentPairs = authority.grants.mapNotNull { grant ->
            val requiresSelection = authority.contextSelection
                .firstOrNull { it.workspaceKindWire == grant.workspaceKindWire }
                ?.selectionRequired == true
            if (requiresSelection && grant.grantId !in liveSelection) return@mapNotNull null
            val assignment = (ProductionGrantMapper.map(authority, grant.grantId)
                as? ProductionGrantMapper.Outcome.Assigned)?.assignment ?: return@mapNotNull null
            grant to assignment
        }

        // Operational Gate authority is a separate axis. A pure usher may have zero
        // WeddingMembership/workspace grants; AppRole.USHER is presentation derived ONLY from a
        // selected server operational grant, never from User.role/WeddingMembership.
        val rememberedGateId = if (revalidateSelection) {
            readSelectedGateGrantId(authority.accessUserId!!)
        } else {
            _selectedGateGrantId.value
        }
        val rememberedGateStillExists = rememberedGateId?.let { id ->
            authority.operationalGrants.any { it.grantId == id }
        } == true
        val gateOutcome = when {
            rememberedGateStillExists ->
                ProductionGateGrantMapper.map(authority, rememberedGateId)
            // A previously selected Gate vanished/revoked: fail closed and do NOT silently replace it.
            rememberedGateId != null ->
                ProductionGateGrantMapper.Outcome.Denied("The selected gate grant is no longer authorized.")
            else ->
                ProductionGateGrantMapper.map(authority)
        }
        val gateContext = (gateOutcome as? ProductionGateGrantMapper.Outcome.Selected)?.context
        _activeGateContext.value = gateContext
        if (rememberedGateId != null && !rememberedGateStillExists) {
            // Keep the stale id only as a re-selection marker. It is never mapped to authority,
            // but prevents a later refresh from silently auto-selecting a different remaining gate.
            _selectedGateGrantId.value = rememberedGateId
            persistSelectedGateGrantId(rememberedGateId)
        } else {
            _selectedGateGrantId.value = gateContext?.grantId
            persistSelectedGateGrantId(gateContext?.grantId)
        }

        val workspaceRoles = assignmentPairs.map { it.second.role }.distinct()
        _authorizedRoles.value = if (authority.operationalGrants.isNotEmpty()) {
            (workspaceRoles + AppRole.USHER).distinct()
        } else {
            workspaceRoles
        }

        val previousGrantId = _activeGrantId.value
        val previousRole = _currentRole.value

        // Preserve an already-selected Gate context across a fresh authority read, but only while
        // the exact same operational grant still exists.
        if (previousRole == AppRole.USHER && gateContext != null) {
            _activeGrantId.value = null
            _productionWorkspace.value = null
            _currentRole.value = AppRole.USHER
            _currentUserRole.value = AppRole.USHER.roleId
            _weddingId.value = gateContext.weddingId
            _weddingTitle.value = gateContext.weddingTitle
            return
        }

        val next = assignmentPairs.firstOrNull { it.first.grantId == previousGrantId }
            ?: assignmentPairs.firstOrNull { it.second.role == previousRole }
            ?: assignmentPairs.firstOrNull()

        if (next != null) {
            _activeGrantId.value = next.first.grantId
            _currentRole.value = next.second.role
            _currentUserRole.value = next.second.role.roleId
            _weddingId.value = next.second.weddingId
            _weddingTitle.value = next.second.weddingId
                ?.let { id -> authority.grants.firstOrNull { it.weddingId == id }?.weddingTitle }
            return
        }

        // Portfolio/business authority is valid even when it deliberately cannot become a wedding
        // ActorAssignment. Keep that real grant active for a read-only landing rather than lying
        // that the authenticated account has "no Wewed workspace".
        val nonWeddingGrants = authority.grants.filter {
            ProductionGrantMapper.map(authority, it.grantId) is ProductionGrantMapper.Outcome.RequiresWeddingSelection
        }
        val landing = nonWeddingGrants.firstOrNull { it.grantId in liveSelection }
            ?: nonWeddingGrants.singleOrNull()?.takeIf { grant ->
                authority.contextSelection
                    .firstOrNull { it.workspaceKindWire == grant.workspaceKindWire }
                    ?.selectionRequired != true
            }

        if (landing != null) {
            _activeGrantId.value = landing.grantId
            _currentRole.value = null
            _currentUserRole.value = null
            _weddingId.value = null
            _weddingTitle.value = landing.weddingTitle
            return
        }

        // Pure operational actor: one (or explicitly selected) valid gate opens the Gate shell
        // without inventing a planning membership or workspace grant.
        if (gateContext != null) {
            _activeGrantId.value = null
            _productionWorkspace.value = null
            _currentRole.value = AppRole.USHER
            _currentUserRole.value = AppRole.USHER.roleId
            _weddingId.value = gateContext.weddingId
            _weddingTitle.value = gateContext.weddingTitle
            return
        }

        _activeGrantId.value = null
        _currentRole.value = null
        _currentUserRole.value = null
        _weddingId.value = null
        _weddingTitle.value = null
    }

    private suspend fun refreshActiveWorkspace(client: ProductionAuthorityClient, sessionToken: String) {
        val grantId = _activeGrantId.value ?: run {
            _productionWorkspace.value = null
            return
        }
        when (val fetch = client.fetchWorkspace(sessionToken, grantId, _selectedEngagementId.value)) {
            is ProductionWorkspaceFetch.Success -> {
                if (_activeGrantId.value == fetch.workspace.grantId) {
                    _productionWorkspace.value = fetch.workspace
                }
            }
            is ProductionWorkspaceFetch.SessionInvalid -> clearAccountSession()
            is ProductionWorkspaceFetch.GrantRevoked -> {
                handleNativeDomainGrantRevoked(_activeGrantId.value)
                // Do not guess a replacement from stale authority. A fresh authority fetch on the
                // next restore/refresh decides what remains.
            }
            is ProductionWorkspaceFetch.EngagementInvalid -> {
                // The wedding/business grant underneath is still valid; only the engagement choice
                // was stale/foreign/revoked. Clear the engagement only and re-fetch so the server
                // can either auto-resolve a single remaining engagement or report a fresh choice is
                // needed — never fall back to rendering the rejected engagement.
                _selectedEngagementId.value = null
                _productionWorkspace.value = null
                refreshActiveWorkspace(client, sessionToken)
            }
            is ProductionWorkspaceFetch.Transport -> {
                _productionWorkspace.value = null
            }
        }
    }

    /**
     * Records the account's explicit choice among several grants of one workspace kind (master
     * plan §9). Ignored for a grant id the current authority does not actually hold.
     */
    fun selectGrant(grantId: String) {
        val authority = _productionAuthority.value ?: return
        val selected = authority.grants.firstOrNull { it.grantId == grantId } ?: return

        // Replace the prior choice for THIS workspace kind. Unioning selections let two Planner
        // weddings stay selected at once and could leave the old wedding active after a new tap.
        val sameKindIds = authority.grants
            .filter { it.workspaceKindWire == selected.workspaceKindWire }
            .mapTo(mutableSetOf()) { it.grantId }
        val next = (_selectedGrantIds.value - sameKindIds) + grantId
        _selectedGrantIds.value = next
        persistSelectedGrantIds(next)
        _activeGrantId.value = grantId
        // A workspace selection is an explicit axis switch. Keep the remembered Gate selection
        // for a later switch back, but stop treating Usher as the active presentation role now.
        if (_currentRole.value == AppRole.USHER) {
            _activeGateContext.value = null
            _currentRole.value = null
            _currentUserRole.value = null
        }
        // An engagement choice belongs to the grant it was made for; a fresh grant starts with none
        // (master plan Phase 6 §5). applyAuthority() below already clears the workspace snapshot
        // synchronously, so no stale data can render while the new one is being fetched (§9, §14).
        _selectedEngagementId.value = null
        applyAuthority(authority, revalidateSelection = false)

        val client = authorityClient
        val token = storage.get(accountSessionKey)
        if (client != null && token != null) {
            scope.launch { refreshActiveWorkspace(client, token) }
        }
    }

    /**
     * Records the account's explicit choice of engagement for the currently active Vendor wedding
     * grant. Ignored for an engagement id the current workspace snapshot does not actually list —
     * the server re-validates it against the fresh grant regardless (master plan Phase 6 §5, §10).
     */
    fun selectEngagement(engagementId: String) {
        val workspace = _productionWorkspace.value ?: return
        if (engagementId !in workspace.serviceEngagementIds) return
        _selectedEngagementId.value = engagementId
        // Clear immediately: the previous engagement's data must never remain visible while the
        // newly-selected one is being fetched (master plan Phase 6 §14).
        _productionWorkspace.value = null

        val client = authorityClient
        val token = storage.get(accountSessionKey)
        if (client != null && token != null) {
            scope.launch { refreshActiveWorkspace(client, token) }
        }
    }

    /**
     * Selects a real operational Gate grant. This never creates a workspace grant and never
     * converts a raw role string into authority.
     */
    fun selectGateGrant(grantId: String) {
        val authority = _productionAuthority.value ?: return
        val selected = (ProductionGateGrantMapper.map(authority, grantId)
            as? ProductionGateGrantMapper.Outcome.Selected)?.context ?: return

        _selectedGateGrantId.value = selected.grantId
        persistSelectedGateGrantId(selected.grantId)
        _activeGateContext.value = selected
        _activeGrantId.value = null
        _productionWorkspace.value = null
        _selectedEngagementId.value = null
        _currentRole.value = AppRole.USHER
        _currentUserRole.value = AppRole.USHER.roleId
        _weddingId.value = selected.weddingId
        _weddingTitle.value = selected.weddingTitle
    }

    private fun readSelectedGateGrantId(accessUserId: String): String? {
        if (storage.get(selectedGateGrantOwnerKey) != accessUserId) {
            storage.delete(selectedGateGrantKey)
            storage.delete(selectedGateGrantOwnerKey)
            return null
        }
        return storage.get(selectedGateGrantKey)?.takeIf { it.isNotBlank() }
    }

    private fun persistSelectedGateGrantId(grantId: String?) {
        val owner = _productionAuthority.value?.accessUserId
        if (grantId.isNullOrBlank() || owner == null) {
            storage.delete(selectedGateGrantKey)
            storage.delete(selectedGateGrantOwnerKey)
            return
        }
        storage.save(selectedGateGrantOwnerKey, owner)
        storage.save(selectedGateGrantKey, grantId)
    }

    private fun readSelectedGrantIds(accessUserId: String): Set<String> {
        val owner = storage.get(selectedGrantsOwnerKey)
        if (owner != accessUserId) {
            // Ownerless selections are legacy Phase-5 preferences. They cannot safely be attributed
            // after a process restart, so fail closed once rather than letting Account B inherit
            // Account A's coincidentally identical grant id.
            storage.delete(selectedGrantsKey)
            storage.delete(selectedGrantsOwnerKey)
            return emptySet()
        }
        return storage.get(selectedGrantsKey)
            ?.split(',')
            ?.filter { it.isNotBlank() }
            ?.toSet()
            ?: emptySet()
    }

    private fun persistSelectedGrantIds(ids: Set<String>) {
        val owner = _productionAuthority.value?.accessUserId
        if (ids.isEmpty() || owner == null) {
            storage.delete(selectedGrantsKey)
            storage.delete(selectedGrantsOwnerKey)
        } else {
            storage.save(selectedGrantsOwnerKey, owner)
            storage.save(selectedGrantsKey, ids.joinToString(","))
        }
    }

    /** Phase 8 domain calls share the same identity lifecycle as the account workspace probe. */
    internal fun handleNativeDomainSessionInvalid() {
        clearAccountSession()
    }

    /**
     * Clears only the rejected grant/context. Permission denials and resource-level 404s must never
     * call this; the native domain client invokes it only for an explicit GRANT_REVOKED or
     * AUTHORITY_UNAVAILABLE server code.
     */
    internal fun handleNativeDomainGrantRevoked(grantId: String?) {
        if (grantId == null) return
        val next = _selectedGrantIds.value - grantId
        _selectedGrantIds.value = next
        persistSelectedGrantIds(next)

        if (_activeGrantId.value != grantId) return

        _productionWorkspace.value = null
        _activeGrantId.value = null
        _currentRole.value = null
        _currentUserRole.value = null
        _weddingId.value = null
        _weddingTitle.value = null
        _selectedEngagementId.value = null
    }

    /** The identity session itself is no longer valid server-side: a full, unambiguous sign-out. */
    private fun clearAccountSession() {
        storage.delete(accountSessionKey)
        storage.delete(selectedGrantsKey)
        storage.delete(selectedGrantsOwnerKey)
        storage.delete(selectedGateGrantKey)
        storage.delete(selectedGateGrantOwnerKey)
        _isAuthenticated.value = false
        _productionAuthority.value = null
        _productionWorkspace.value = null
        _activeGrantId.value = null
        _authorizedRoles.value = emptyList()
        _currentRole.value = null
        _currentUserRole.value = null
        _activePersonaId.value = null
        _weddingId.value = null
        _weddingTitle.value = null
        _selectedGrantIds.value = emptySet()
        _selectedEngagementId.value = null
        _selectedGateGrantId.value = null
        _activeGateContext.value = null
    }

    /**
     * Enters the current Shadow/UAT environment as its default qualification actor.
     *
     * Offered only where persona switching is permitted, and it carries no credential: it opens the
     * qualification environment, not an account. Refused — returning false and changing nothing —
     * in any other environment.
     */
    fun enterShadowSession(): Boolean {
        if (!allowsDevelopmentPersonas) return false
        storage.save(tokenKey, "shadow_session_${UUID.randomUUID()}")
        return switchPersona(DevelopmentPersona.defaultShadowPersona)
    }

    /**
     * Applies a Shadow qualification persona.
     *
     * Development and Shadow environments only. In production or production-read-verify this
     * returns false and leaves the session untouched: a persona hands an actor an arbitrary role,
     * and production roles come from real authorization, never from a picker (P0-16).
     */
    fun switchPersona(persona: DevelopmentPersona): Boolean {
        if (!allowsDevelopmentPersonas) return false
        _authorizedRoles.value = listOf(persona.role)
        _activePersonaId.value = persona.id
        _currentRole.value = persona.role
        _currentUserRole.value = persona.role.roleId
        _currentUserName.value = persona.name
        _weddingId.value = persona.weddingId
        _weddingTitle.value = persona.weddingTitle
        _isAuthenticated.value = true
        _sessionRestored.value = true
        return true
    }

    /**
     * Signs out.
     *
     * Clears every stored credential (Shadow placeholder AND the real account session) and every
     * resolved answer — role, persona, wedding, authority, selection. Dropping only one token would
     * leave a role and a wedding context behind, so the next reader could see a shell the person is
     * no longer entitled to.
     *
     * The protected Shadow/UAT snapshot is app-private data governed by the environment security
     * rules, not session state, and is deliberately left alone. Guest Session v2's own secure
     * storage is a separate identity path and is never touched here.
     */
    fun signOut() {
        storage.delete(tokenKey)
        storage.delete(accountSessionKey)
        storage.delete(selectedGrantsKey)
        storage.delete(selectedGrantsOwnerKey)
        storage.delete(selectedGateGrantKey)
        storage.delete(selectedGateGrantOwnerKey)
        _isAuthenticated.value = false
        _currentUserRole.value = null
        _currentRole.value = null
        _currentUserName.value = null
        _activePersonaId.value = null
        _weddingId.value = null
        _weddingTitle.value = null
        _authorizedRoles.value = emptyList()
        _productionAuthority.value = null
        _productionWorkspace.value = null
        _activeGrantId.value = null
        _selectedGrantIds.value = emptySet()
        _selectedEngagementId.value = null
        _selectedGateGrantId.value = null
        _activeGateContext.value = null
        _authenticationError.value = null
        _sessionRestored.value = true
    }

    @Deprecated("Use signOut().", ReplaceWith("signOut()"))
    fun logout() = signOut()
}
