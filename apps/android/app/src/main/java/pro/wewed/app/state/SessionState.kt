package pro.wewed.app.state

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import pro.wewed.app.services.InMemorySecureStorage
import pro.wewed.app.services.SecureStorage
import java.util.UUID

class SessionViewModel(
    private val storage: SecureStorage = InMemorySecureStorage()
) {
    private val tokenKey = "wewed_session_token"

    private val _isAuthenticated = MutableStateFlow(false)
    val isAuthenticated: StateFlow<Boolean> = _isAuthenticated.asStateFlow()

    private val _currentUserRole = MutableStateFlow<String?>(null)
    val currentUserRole: StateFlow<String?> = _currentUserRole.asStateFlow()

    private val _currentUserName = MutableStateFlow<String?>(null)
    val currentUserName: StateFlow<String?> = _currentUserName.asStateFlow()

    init {
        restoreSession()
    }

    fun restoreSession() {
        val token = storage.get(tokenKey)
        if (!token.isNullOrEmpty()) {
            _isAuthenticated.value = true
            _currentUserRole.value = "couple"
            _currentUserName.value = "Tariro & Shadreck"
        }
    }

    fun login(email: String, role: String = "couple") {
        val dummyToken = "token_${UUID.randomUUID()}"
        storage.save(tokenKey, dummyToken)
        _isAuthenticated.value = true
        _currentUserRole.value = role
        _currentUserName.value = if (role == "usher") "Usher Team" else "Tariro & Shadreck"
    }

    fun logout() {
        storage.delete(tokenKey)
        _isAuthenticated.value = false
        _currentUserRole.value = null
        _currentUserName.value = null
    }
}
