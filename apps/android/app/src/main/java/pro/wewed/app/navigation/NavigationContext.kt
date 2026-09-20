package pro.wewed.app.navigation

import pro.wewed.app.models.AppRole
import pro.wewed.app.models.NativeDataEnvironment

/**
 * IA V2 §13.1 — the active context envelope every repository-backed screen resolves from.
 *
 * Navigation transitions carry this value forward unchanged, which is what stops a route change
 * from silently switching the wedding graph underneath a workspace (IA V2 §13.2).
 */
data class NavigationContext(
    val actorId: String,
    val activeRole: AppRole,
    val activeWeddingId: String,
    val activeWeddingTitle: String,
    val environment: NativeDataEnvironment,
    val activeClientId: String? = null,
    val activeEngagementId: String? = null,
    val activeGateId: String? = null
) {
    /** True when the role's declared context scopes are all satisfied. */
    val isComplete: Boolean
        get() = IANavigationContract.forRole(activeRole).contextScopes.all { scope ->
            when (scope) {
                ContextScope.WEDDING -> activeWeddingId.isNotBlank()
                // Client/engagement/gate are resolved on entry to their workspace; a blank value is
                // an unselected state, not an invalid envelope.
                ContextScope.CLIENT, ContextScope.ENGAGEMENT, ContextScope.GATE -> true
            }
        }

    /**
     * Role switch must never silently inherit a scope the new role does not own.
     * Wedding identity is preserved; role-specific scopes are dropped.
     */
    fun withRole(role: AppRole): NavigationContext {
        val scopes = IANavigationContract.forRole(role).contextScopes
        return copy(
            activeRole = role,
            activeClientId = activeClientId.takeIf { scopes.contains(ContextScope.CLIENT) },
            activeEngagementId = activeEngagementId.takeIf { scopes.contains(ContextScope.ENGAGEMENT) },
            activeGateId = activeGateId.takeIf { scopes.contains(ContextScope.GATE) }
        )
    }

    fun withWedding(weddingId: String, weddingTitle: String): NavigationContext =
        copy(activeWeddingId = weddingId, activeWeddingTitle = weddingTitle)

    /** Human-readable Level-0 context line (IA V2 §1.2). */
    val contextLabel: String
        get() = buildString {
            append(IANavigationContract.forRole(activeRole).displayName)
            if (activeWeddingTitle.isNotBlank()) {
                append(" • ")
                append(activeWeddingTitle)
            }
            activeGateId?.takeIf { it.isNotBlank() }?.let {
                append(" • ")
                append(it)
            }
        }
}
