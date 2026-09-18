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

    init {
        restoreSession()
    }

    fun restoreSession() {
        val token = storage.get(tokenKey)
        if (!token.isNullOrEmpty()) {
            _isAuthenticated.value = true
            _currentUserRole.value = "couple"
            _currentRole.value = AppRole.COUPLE
            _currentUserName.value = "Charity & Kudzie"
        }
    }
    fun login(email: String, role: String = "couple") {
        @Suppress("UNUSED_VARIABLE") val _email = email
        val dummyToken = "token_${UUID.randomUUID()}"
        storage.save(tokenKey, dummyToken)
        _isAuthenticated.value = true
        _currentUserRole.value = role
        val parsedRole = AppRole.fromId(role)
        _currentRole.value = parsedRole
        _currentUserName.value = if (parsedRole == AppRole.USHER) "Gate Usher" else "Charity & Kudzie"
    }

    fun switchPersona(persona: DevelopmentPersona) {
        _activePersonaId.value = persona.id
        _currentRole.value = persona.role
        _currentUserRole.value = persona.role.roleId
        _currentUserName.value = persona.name
        _weddingId.value = persona.weddingId
        _weddingTitle.value = persona.weddingTitle
        _isAuthenticated.value = true
    }

    fun logout() {
        storage.delete(tokenKey)
        _isAuthenticated.value = false
        _currentUserRole.value = null
        _currentRole.value = AppRole.COUPLE
        _currentUserName.value = null
    }
}
