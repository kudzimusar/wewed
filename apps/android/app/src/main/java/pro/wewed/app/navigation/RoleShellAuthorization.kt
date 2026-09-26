package pro.wewed.app.navigation

/**
 * What a role shell may render, derived only from [Entitlements] and [NavigationContext].
 *
 * This is not a second authorization model. Every transition goes through [Entitlements.resolve],
 * and the workspace gate is [Entitlements.relationshipHolds] plus [NavigationContext.isComplete].
 * It exists so the shell cannot reach content by any other road (Phase 1 independent review):
 *
 *  - the initial destination used to render without ever being resolved;
 *  - a denial moved the selection to its safe return, so dismissing the notice showed that
 *    destination's content without it ever having been authorized.
 *
 * Content renders only for [visibleDestinationId], which is always a destination that
 * [Entitlements.resolve] actually allowed for this context. With none, the actor stays at the
 * access boundary; no destination is invented for them.
 */
data class RoleShellAuthorization(
    /** The last destination [Entitlements.resolve] allowed, or null if none ever was. */
    val authorizedDestinationId: String?,
    /** The boundary currently being explained, if any. */
    val denial: Entitlements.Resolution.Denied?
) {
    /** The destination whose content may render now; null means the access boundary. */
    val visibleDestinationId: String? get() = if (denial == null) authorizedDestinationId else null

    /** Whether dismissing the notice leads anywhere. Without an authorized destination it cannot. */
    val canDismissDenial: Boolean get() = denial != null && authorizedDestinationId != null

    /**
     * Applies a resolution from [Entitlements.resolve] or [DeepLinkRouter.resolve].
     *
     * A denial keeps the last authorized destination; it never adopts the denial's safe return,
     * because that destination has not been resolved for this context.
     */
    fun applying(resolution: Entitlements.Resolution): RoleShellAuthorization = when (resolution) {
        is Entitlements.Resolution.Allowed ->
            RoleShellAuthorization(authorizedDestinationId = resolution.destination.id, denial = null)
        is Entitlements.Resolution.Denied -> copy(denial = resolution)
    }

    /** A tab tap: resolved exactly like a deep link. */
    fun selecting(context: NavigationContext, destinationId: String): RoleShellAuthorization =
        applying(Entitlements.resolve(context, destinationId))

    /** Returns to the last authorized destination, or stays at the boundary if there is none. */
    fun dismissingDenial(): RoleShellAuthorization =
        if (canDismissDenial) copy(denial = null) else this

    companion object {
        /**
         * Whether a role workspace may be composed for [context] at all.
         *
         * An assignment is mandatory — a system-scoped Admin still needs a real system-scope
         * assignment; a null wedding is valid, a null assignment is not. Every required scope must
         * be resolved, and the assignment must actually hold for this actor, role and wedding.
         */
        fun admitsWorkspace(context: NavigationContext): Boolean =
            context.assignment != null &&
                context.isComplete &&
                Entitlements.relationshipHolds(context)

        /** The shell's starting state: the contract's first destination, resolved like any other. */
        fun initial(context: NavigationContext): RoleShellAuthorization {
            val first = IANavigationContract.forRole(context.activeRole).primary.first().id
            return RoleShellAuthorization(authorizedDestinationId = null, denial = null)
                .selecting(context, first)
        }
    }
}
