package pro.wewed.app.state

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import pro.wewed.app.models.AppRole
import pro.wewed.app.models.AuthorizedSession
import pro.wewed.app.models.RoleGrant

/**
 * Holds who is signed in and which of their authorized roles is active.
 * A role can only become active if the session was granted it; there is no persona switcher.
 */
class SessionViewModel {
    private val _session = MutableStateFlow<AuthorizedSession?>(null)
    val session: StateFlow<AuthorizedSession?> = _session.asStateFlow()

    private val _activeGrant = MutableStateFlow<RoleGrant?>(null)
    /** Null while signed out, or while a multi-role account has not yet chosen how to use the app. */
    val activeGrant: StateFlow<RoleGrant?> = _activeGrant.asStateFlow()

    val isAuthenticated: Boolean get() = _session.value != null

    /** One role enters directly; several roles wait for the person to choose. */
    fun establish(session: AuthorizedSession) {
        _session.value = session
        _activeGrant.value = session.grants.singleOrNull()
    }

    /** Returns false (and changes nothing) if the role is not one this session was granted. */
    fun activate(role: AppRole): Boolean {
        val grant = _session.value?.grantFor(role) ?: return false
        _activeGrant.value = grant
        return true
    }

    /** Back to the role chooser; only meaningful for multi-role sessions. */
    fun clearActiveRole() {
        if (_session.value?.requiresRoleChoice == true) _activeGrant.value = null
    }

    fun signOut() {
        _session.value = null
        _activeGrant.value = null
    }
}
