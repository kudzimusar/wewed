package pro.wewed.app.navigation

import pro.wewed.app.models.AppRole
import pro.wewed.app.models.NativeDeepLink

/**
 * IA V2 §14 / playbook §19 — deep links and notifications resolve through the same gate as
 * in-app navigation.
 *
 *   parse entity/context -> resolve authorized role -> verify entitlement -> navigate,
 *   or fail safely with an explained boundary and a safe return route.
 *
 * A link never carries its own authority: [NativeDeepLinkParser] only reads intent, and this
 * router decides whether the current actor may act on it.
 */
object DeepLinkRouter {

    /**
     * The destination a link targets for a given role. The same link can legitimately land in
     * different workspaces per role — a Wedding Pass link opens the guest's `Pass` workspace but
     * the couple's `Wedding Day` workspace, because that is where each role owns the pass.
     */
    fun destinationFor(deepLink: NativeDeepLink, role: AppRole): String? = when (deepLink) {
        is NativeDeepLink.Invitation -> when (role) {
            AppRole.GUEST -> "invitation"
            AppRole.COUPLE -> "guests"
            AppRole.PLANNER -> "workspace"
            else -> null
        }
        is NativeDeepLink.Pass -> when (role) {
            AppRole.GUEST -> "pass"
            AppRole.COUPLE -> "wedding_day"
            AppRole.PLANNER -> "wedding_day"
            AppRole.USHER -> "scan"
            else -> null
        }
        is NativeDeepLink.Wedding -> IANavigationContract.forRole(role).primary.first().id
        is NativeDeepLink.Workspace -> deepLink.destinationId
    }

    /**
     * Resolves a link against the active context. Returns a [Entitlements.Resolution.Denied] with a
     * safe return route when the actor may not open the target, so an unauthorized link neither
     * navigates nor leaks what lives there.
     */
    /**
     * The credential a link carries, if any. P0-9: a pass link's token must reach the Pass
     * workspace so it resolves *that* pass rather than a default guest.
     */
    fun credentialToken(deepLink: NativeDeepLink): String? = when (deepLink) {
        is NativeDeepLink.Pass -> deepLink.token
        is NativeDeepLink.Invitation -> deepLink.value.rsvpToken
        else -> null
    }

    fun resolve(deepLink: NativeDeepLink, context: NavigationContext): Entitlements.Resolution {
        val navigation = IANavigationContract.forRole(context.activeRole)
        val safeReturn = navigation.primary.first().id

        val destinationId = destinationFor(deepLink, context.activeRole)
            ?: return Entitlements.Resolution.Denied(
                "This link is not available for the ${navigation.displayName} workspace.",
                safeReturn
            )

        // A link that names a different wedding must not silently rebind the active context.
        val targetWeddingId = (deepLink as? NativeDeepLink.Workspace)?.weddingId
        if (!targetWeddingId.isNullOrBlank() && targetWeddingId != context.activeWeddingId) {
            return Entitlements.Resolution.Denied(
                "This link belongs to a different wedding than the one currently open.",
                safeReturn
            )
        }

        // P0-9: a pass link carrying someone else's credential must not open this actor's pass.
        if (deepLink is NativeDeepLink.Pass) {
            val linkToken = deepLink.token
            val heldToken = context.activePassToken
            if (linkToken != null && heldToken != null && linkToken != heldToken) {
                return Entitlements.Resolution.Denied(
                    "This Wedding Pass link belongs to a different guest.",
                    safeReturn
                )
            }
        }

        return Entitlements.resolve(context, destinationId)
    }

    /** Convenience for callers that only need to know whether to navigate. */
    fun allowedDestination(deepLink: NativeDeepLink, context: NavigationContext): String? =
        (resolve(deepLink, context) as? Entitlements.Resolution.Allowed)?.destination?.id
}
