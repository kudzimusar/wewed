package pro.wewed.app.navigation

import pro.wewed.app.models.AppRole
import pro.wewed.app.models.NativeDataEnvironment

/**
 * Builders for contexts that hold a *verified* assignment, plus deliberately broken ones.
 *
 * Tests must construct authorization the same way production does — actor + role + scope +
 * relationship — so a test cannot accidentally prove more than the app actually allows.
 */
object AuthorizedContexts {

    const val WEDDING = "cmqos70cb0004q6vxe9g9aiu5"
    const val OTHER_WEDDING = "wed_other_001"
    const val VENDOR = "shadow_vnd_06"
    const val OTHER_VENDOR = "shadow_vnd_02"
    const val ENGAGEMENT = "shadow_eng_06"
    const val OTHER_ENGAGEMENT = "shadow_vnd_02"
    const val GATE = "gate_main_entrance"
    const val OTHER_GATE = "gate_side_entrance"
    const val GUEST = "shadow_guest_011"
    const val OTHER_GUEST = "shadow_guest_007"
    const val PASS_TOKEN = "shadow-attending-guest"

    fun assignment(
        role: AppRole,
        actorId: String = "actor_${role.roleId}",
        weddingId: String? = WEDDING
    ): ActorAssignment = ActorAssignment(
        actorId = actorId,
        role = role,
        weddingId = if (role == AppRole.ADMIN) null else weddingId,
        vendorId = if (role == AppRole.VENDOR) VENDOR else null,
        engagementId = if (role == AppRole.VENDOR) ENGAGEMENT else null,
        gateId = if (role == AppRole.USHER) GATE else null,
        guestId = if (role == AppRole.GUEST) GUEST else null,
        passToken = if (role == AppRole.GUEST) PASS_TOKEN else null,
        isShadowTestAccess = role != AppRole.COUPLE
    )

    /** A fully authorized context for [role]. */
    fun authorized(
        role: AppRole,
        environment: NativeDataEnvironment = NativeDataEnvironment.FIXTURE,
        weddingId: String = WEDDING
    ): NavigationContext {
        val a = assignment(role, weddingId = weddingId)
        val systemScoped = IANavigationContract.forRole(role).isSystemScoped
        return NavigationContext(
            actorId = a.actorId,
            activeRole = role,
            activeWeddingId = if (systemScoped) "" else weddingId,
            activeWeddingTitle = if (systemScoped) "" else "Charity & Kudzie",
            environment = environment,
            activeClientId = a.clientId,
            activeVendorId = a.vendorId,
            activeEngagementId = a.engagementId,
            activeGateId = a.gateId,
            activeGuestId = a.guestId,
            activePassToken = a.passToken,
            assignment = a
        )
    }

    /** An actor holding the role but with no assignment at all. */
    fun unassigned(role: AppRole): NavigationContext =
        authorized(role).copy(assignment = null)
}
