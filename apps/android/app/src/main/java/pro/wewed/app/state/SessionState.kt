package pro.wewed.app.state

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import pro.wewed.app.models.AppRole
import pro.wewed.app.models.DevelopmentPersona
import pro.wewed.app.services.InMemorySecureStorage
import pro.wewed.app.services.SecureStorage
import java.util.UUID

class SessionViewModel(
    private val storage: SecureStorage = InMemorySecureStorage()
) {
    private val tokenKey = "wewed_session_token"

    private val _isAuthenticated = MutableStateFlow(false)
    val isAuthenticated: StateFlow<Boolean> = _isAuthenticated.asStateFlow()

    private val _currentUserRole = MutableStateFlow<String?>("couple")
    val currentUserRole: StateFlow<String?> = _currentUserRole.asStateFlow()

    private val _currentRole = MutableStateFlow(AppRole.COUPLE)
    val currentRole: StateFlow<AppRole> = _currentRole.asStateFlow()

    private val _currentUserName = MutableStateFlow<String?>("Charity & Kudzie")
    val currentUserName: StateFlow<String?> = _currentUserName.asStateFlow()

    private val _activePersonaId = MutableStateFlow("couple_owner")
    val activePersonaId: StateFlow<String> = _activePersonaId.asStateFlow()

    private val _weddingId = MutableStateFlow("cmqos70cb0004q6vxe9g9aiu5")
    val weddingId: StateFlow<String> = _weddingId.asStateFlow()

    private val _weddingTitle = MutableStateFlow("Charity & Kudzie Wedding")
    val weddingTitle: StateFlow<String> = _weddingTitle.asStateFlow()

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

    init {
        restoreSession()
    }

    /**
     * Reads the stored session.
     *
     * A restored session is NOT the same as a validated one. Production must call
     * `/api/mobile/auth/me` before trusting a stored role, because authorization can be revoked
     * between launches and a stale Planner or Admin shell must never remain visible. That server
     * validation is not yet wired; until it is, a restored session is trusted only in the Shadow
     * and UAT environments, which is why [sessionRestored] is exposed separately from
     * [isAuthenticated].
     */
    fun restoreSession() {
        val token = storage.get(tokenKey)
        if (!token.isNullOrEmpty()) {
            _isAuthenticated.value = true
            _currentUserRole.value = _currentRole.value.roleId
            _authorizedRoles.value = listOf(_currentRole.value)
        }
        _sessionRestored.value = true
    }
    /**
     * Signs in with an identity and a secret. No role parameter, by design.
     *
     * Production wiring to `/api/mobile/auth/signin` is NOT yet in place; until it is, this refuses
     * rather than minting a token, because a sign-in that always succeeds is worse than one that
     * is honestly unavailable — it teaches everyone the app is authenticated when it is not.
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
     * Enters the current Shadow/UAT environment without a production credential.
     *
     * Offered only where persona switching is already permitted, and it carries no credential: it
     * opens the qualification environment, not an account.
     */
    fun enterShadowSession() {
        val token = "shadow_session_${UUID.randomUUID()}"
        storage.save(tokenKey, token)
        _isAuthenticated.value = true
        _sessionRestored.value = true
        _authorizedRoles.value = listOf(_currentRole.value)
    }

    @Deprecated(
        "Role is an authorization result, not a caller argument. Use signIn() or enterShadowSession().",
        ReplaceWith("enterShadowSession()")
    )
    fun login(email: String, role: String = "couple") {
        @Suppress("UNUSED_VARIABLE") val _email = email
        val dummyToken = "token_${UUID.randomUUID()}"
        storage.save(tokenKey, dummyToken)
        _isAuthenticated.value = true
        _currentUserRole.value = role
        val parsedRole = AppRole.fromId(role)
        _currentRole.value = parsedRole
        _authorizedRoles.value = listOf(parsedRole)
        _currentUserName.value = if (parsedRole == AppRole.USHER) "Gate Usher" else "Charity & Kudzie"
    }

    fun switchPersona(persona: DevelopmentPersona) {
        _authorizedRoles.value = listOf(persona.role)
        _activePersonaId.value = persona.id
        _currentRole.value = persona.role
        _currentUserRole.value = persona.role.roleId
        _currentUserName.value = persona.name
        _weddingId.value = persona.weddingId
        _weddingTitle.value = persona.weddingTitle
        _isAuthenticated.value = true
    }

    /**
     * Signs out.
     *
     * Clears the stored credential AND the resolved authorization. Dropping only the token would
     * leave a role and a wedding context behind, so the next launch could restore a shell the
     * person is no longer entitled to see.
     *
     * The protected Shadow/UAT snapshot is app-private data governed by the environment security
     * rules, not session state, and is deliberately left alone.
     */
    fun signOut() {
        storage.delete(tokenKey)
        _isAuthenticated.value = false
        _currentUserRole.value = null
        _currentRole.value = AppRole.COUPLE
        _currentUserName.value = null
        _authorizedRoles.value = emptyList()
        _sessionRestored.value = true
    }

    @Deprecated("Use signOut().", ReplaceWith("signOut()"))
    fun logout() = signOut()
}
