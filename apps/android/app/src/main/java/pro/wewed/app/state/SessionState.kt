package pro.wewed.app.state

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import pro.wewed.app.models.AppRole
import pro.wewed.app.models.DevelopmentPersona
import pro.wewed.app.models.NativeDataEnvironment
import pro.wewed.app.services.InMemorySecureStorage
import pro.wewed.app.services.SecureStorage
import java.util.UUID

/**
 * The account session.
 *
 * It starts EMPTY: no identity, no role, no persona, no wedding. Every one of those is an answer
 * that has to come from somewhere — a Shadow persona in a development environment today, the
 * production grant contract later (master plan Phases 2 and 5). It used to start as the Charity &
 * Kudzie couple on a real production wedding id, so anything that read the session before
 * authority resolved saw a real couple's workspace (master plan §8.2).
 *
 * @param environment decides whether Shadow personas may be applied at all. It defaults to
 *   [NativeDataEnvironment.PRODUCTION] so a session built without thinking about it is the
 *   fail-closed one.
 */
class SessionViewModel(
    private val storage: SecureStorage = InMemorySecureStorage(),
    private val environment: NativeDataEnvironment = NativeDataEnvironment.PRODUCTION
) {
    private val tokenKey = "wewed_session_token"

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

    /** Whether this session may apply Shadow qualification personas. */
    val allowsDevelopmentPersonas: Boolean get() = environment.allowsDevelopmentPersonaSwitching

    init {
        restoreSession()
    }

    /**
     * Reads the stored session.
     *
     * A stored token is NOT authority. Production must validate it with the server before any role
     * is trusted, because authorization can be revoked between launches; that validation is master
     * plan Phase 5 and is not wired. Until it is, a restored token grants nothing: no role, no
     * wedding, not authenticated. It used to grant whatever `currentRole` held — which defaulted to
     * Couple — to anyone holding any token (master plan §8.8).
     */
    fun restoreSession() {
        _sessionRestored.value = true
    }

    /**
     * Signs in with an identity and a secret. No role parameter, by design.
     *
     * Production wiring is NOT yet in place (master plan Phase 5); until it is, this refuses rather
     * than minting a token, because a sign-in that always succeeds is worse than one that is
     * honestly unavailable — it teaches everyone the app is authenticated when it is not.
     */
    fun signIn(email: String, password: String) {
        require(email.isNotBlank()) { "Enter your email address." }
        require(password.isNotBlank()) { "Enter your password." }
        throw IllegalStateException(
            "Wewed account sign-in is not connected in this build. Use an invitation link, or " +
                "continue in the current Shadow environment."
        )
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
     * Clears the stored credential AND every resolved answer — role, persona, wedding. Dropping only
     * the token would leave a role and a wedding context behind, so the next reader could see a
     * shell the person is no longer entitled to.
     *
     * The protected Shadow/UAT snapshot is app-private data governed by the environment security
     * rules, not session state, and is deliberately left alone.
     */
    fun signOut() {
        storage.delete(tokenKey)
        _isAuthenticated.value = false
        _currentUserRole.value = null
        _currentRole.value = null
        _currentUserName.value = null
        _activePersonaId.value = null
        _weddingId.value = null
        _weddingTitle.value = null
        _authorizedRoles.value = emptyList()
        _sessionRestored.value = true
    }

    @Deprecated("Use signOut().", ReplaceWith("signOut()"))
    fun logout() = signOut()
}
