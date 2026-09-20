package pro.wewed.app.navigation

import pro.wewed.app.models.AppRole
import pro.wewed.app.models.NativeDataEnvironment

/**
 * IA V2 §13.1 — the active context envelope every repository-backed screen resolves from.
 *
 * Every scoped id here must have come from a verified [ActorAssignment]. Nothing in this type may
 * be invented by the root or a screen (P0-3).
 */
data class NavigationContext(
    val actorId: String,
    val activeRole: AppRole,
    val activeWeddingId: String,
    val activeWeddingTitle: String,
    val environment: NativeDataEnvironment,
    val activeClientId: String? = null,
    val activeEngagementId: String? = null,
    val activeGateId: String? = null,
    /** Which guest record this actor is, for guest-scoped roles (P0-4). */
    val activeGuestId: String? = null,
    /** The credential authorising this actor's pass (P0-5). */
    val activePassToken: String? = null,
    /** The verified relationship this context was resolved from; null means unauthorised. */
    val assignment: ActorAssignment? = null
) {
    private val navigation get() = IANavigationContract.forRole(activeRole)

    /** The value currently held for a scope, or null when unresolved. */
    fun valueFor(scope: ContextScope): String? = when (scope) {
        ContextScope.WEDDING -> activeWeddingId.takeIf { it.isNotBlank() }
        ContextScope.CLIENT -> activeClientId
        ContextScope.ENGAGEMENT -> activeEngagementId
        ContextScope.GATE -> activeGateId
        ContextScope.GUEST -> activeGuestId
        // System scope is satisfied by holding a system-scope assignment, not by an id.
        ContextScope.SYSTEM -> if (assignment?.isSystemScope == true) actorId else null
    }

    /** Scopes this role requires that are still unresolved. */
    val missingRequiredScopes: List<ContextScope>
        get() = navigation.requiredScopes.filter { valueFor(it) == null }

    /**
     * True only when every REQUIRED scope is resolved.
     *
     * Unlike the previous model, an absent engagement/gate/guest is NOT treated as complete —
     * that was how a vendor with no engagement and an usher with no gate both looked authorised.
     */
    val isComplete: Boolean get() = missingRequiredScopes.isEmpty()

    /**
     * Role switch must never silently inherit a scope the new role does not own, and must drop the
     * previous role's assignment so the new role re-resolves its own (P0-7).
     */
    fun withRole(role: AppRole): NavigationContext {
        val scopes = IANavigationContract.forRole(role).contextScopes
        return copy(
            activeRole = role,
            activeClientId = activeClientId.takeIf { scopes.contains(ContextScope.CLIENT) },
            activeEngagementId = activeEngagementId.takeIf { scopes.contains(ContextScope.ENGAGEMENT) },
            activeGateId = activeGateId.takeIf { scopes.contains(ContextScope.GATE) },
            activeGuestId = activeGuestId.takeIf { scopes.contains(ContextScope.GUEST) },
            activePassToken = activePassToken.takeIf { scopes.contains(ContextScope.GUEST) },
            assignment = null
        )
    }

    /**
     * Changing wedding invalidates every wedding-dependent scope (P0-7).
     *
     * Client, engagement, gate, guest identity and pass token all belong to the previous wedding,
     * so they are cleared and must be re-resolved from an assignment for the new wedding.
     */
    fun withWedding(weddingId: String, weddingTitle: String): NavigationContext {
        if (weddingId == activeWeddingId) return copy(activeWeddingTitle = weddingTitle)
        return copy(
            activeWeddingId = weddingId,
            activeWeddingTitle = weddingTitle,
            activeClientId = null,
            activeEngagementId = null,
            activeGateId = null,
            activeGuestId = null,
            activePassToken = null,
            assignment = null
        )
    }

    /** Human-readable Level-0 context line (IA V2 §1.2). */
    val contextLabel: String
        get() = buildString {
            append(navigation.displayName)
            if (navigation.isSystemScoped && activeWeddingId.isBlank()) {
                append(" • All weddings")
            } else if (activeWeddingTitle.isNotBlank()) {
                append(" • ")
                append(activeWeddingTitle)
            }
            activeGateId?.takeIf { it.isNotBlank() }?.let {
                append(" • ")
                append(it)
            }
            if (assignment?.isShadowTestAccess == true) append(" • Test access only")
        }
}
