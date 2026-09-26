package pro.wewed.app.navigation

import pro.wewed.app.models.AppRole
import pro.wewed.app.models.InvitationContext

/**
 * Everything the app can be doing between the launcher icon and a workspace.
 *
 * Launch decisions used to be scattered: the root screen resolved a deep link, then checked
 * authentication, then resolved a context, each with its own early return and its own loading
 * spinner. Nothing described the lifecycle, so the invitation-before-login rule was an emergent
 * property of statement order rather than a stated one — and a reordering could silently send an
 * invited guest to a sign-in form.
 *
 * This is that lifecycle, named. Both platforms follow the same states in the same order.
 *
 *     INSTALL / OPEN
 *       -> OS launch screen (platform chrome, ivory + brand mark)
 *       -> Launching        first frame, before anything is known
 *       -> Splash           the Wewed animated splash, one identity for every entry path
 *       -> ResolvingDeepLink / RestoringSession
 *       -> Invitation | Workspace | Welcome | Authentication | RoleSelection | ContextSelection
 */
sealed class NativeAppEntryState {

    /** First frame. The OS launch window has just handed over; nothing is known yet. */
    data object Launching : NativeAppEntryState()

    /** The Wewed animated splash. Shown on every entry path, not only the guest journey. */
    data object Splash : NativeAppEntryState()

    /** A link or QR payload is being resolved against the repository. */
    data object ResolvingDeepLink : NativeAppEntryState()

    /**
     * An invitation credential resolved to a real guest.
     *
     * This state is reachable WITHOUT authentication, and that is the point: the invitation token
     * is itself the guest-entry authorization. An invited guest must never be asked to create an
     * account in order to RSVP.
     */
    data class Invitation(
        val invitation: InvitationContext,
        val stage: InvitationEntryStage
    ) : NativeAppEntryState()

    /** A stored session is being validated against the server. */
    data object RestoringSession : NativeAppEntryState()

    /** No session and no invitation: the Wewed welcome surface. */
    data object Welcome : NativeAppEntryState()

    /** Signing in, creating an account, or recovering a password. */
    data class Authentication(val mode: AuthenticationMode) : NativeAppEntryState()

    /** First-run onboarding, after identity is established and authorization is known. */
    data class Onboarding(val role: AppRole) : NativeAppEntryState()

    /**
     * The account holds more than one genuinely authorized role.
     *
     * Distinct from the development persona picker: this lists only roles the server authorized,
     * and it exists in production. The persona picker fabricates a role and is Shadow/UAT only.
     */
    data class RoleSelection(val authorizedRoles: List<AppRole>) : NativeAppEntryState()

    /** The role is settled but the wedding/business context is not (a planner's client list). */
    data class ContextSelection(val role: AppRole) : NativeAppEntryState()

    /** A resolved role workspace. */
    data class Workspace(val role: AppRole) : NativeAppEntryState()

    /** Entry failed in a way the person needs to see. */
    data class Error(val message: String, val recoverable: Boolean = true) : NativeAppEntryState()
}

/** Where an invited guest lands, which depends on what they have already answered. */
enum class InvitationEntryStage {
    /** No response yet: the ivory invitation, then RSVP. */
    PENDING,

    /** Already accepted: straight to the Wedding Pass. Never ask twice. */
    CONFIRMED,

    /** Already declined: the response state, not the RSVP form again. */
    DECLINED
}

/** Which authentication surface is showing. */
enum class AuthenticationMode {
    SIGN_IN,
    CREATE_ACCOUNT,
    FORGOT_PASSWORD,
    RESET_PASSWORD
}

/**
 * Decides where a launch goes.
 *
 * Kept as a pure function of the inputs so the routing rules are testable without a device, and so
 * the invitation-before-login rule is a single assertable statement rather than a property of where
 * an early return happens to sit.
 */
object LaunchRouter {

    /**
     * The one rule that outranks everything else: an invitation credential wins.
     *
     * A person opening an invitation link, scanning an invitation QR or entering an invitation code
     * goes to the invitation — not to a sign-in form, not to a role chooser — whether or not they
     * have a session, and whether or not they have an account.
     */
    fun route(
        invitation: InvitationContext?,
        hasValidSession: Boolean,
        authorizedRoles: List<AppRole>,
        hasResolvedContext: Boolean,
        needsOnboarding: Boolean = false
    ): NativeAppEntryState {
        if (invitation != null) {
            return NativeAppEntryState.Invitation(invitation, stageFor(invitation))
        }

        // A remembered Guest returning without a link is NOT an invitation arrival: under the Guest
        // Entry Contract (GuestCeremonialEntry) they open on Guest Home, with their invitation one
        // tap away. This router used to route every such return to the card, a rule no caller used
        // and the production Guest shell contradicts (master plan §8.11).
        if (!hasValidSession) return NativeAppEntryState.Welcome

        // Authenticated but the server authorized nothing this build can open.
        if (authorizedRoles.isEmpty()) {
            return NativeAppEntryState.Error(
                "This account has no Wewed workspace yet.",
                recoverable = true
            )
        }

        if (needsOnboarding) return NativeAppEntryState.Onboarding(authorizedRoles.first())

        // Exactly one authorized role goes straight through; asking would be a pointless step.
        if (authorizedRoles.size > 1) return NativeAppEntryState.RoleSelection(authorizedRoles)

        val role = authorizedRoles.first()
        if (!hasResolvedContext) return NativeAppEntryState.ContextSelection(role)
        return NativeAppEntryState.Workspace(role)
    }

    /** A confirmed guest goes to their pass; only a pending guest is asked to RSVP. */
    fun stageFor(invitation: InvitationContext): InvitationEntryStage = when {
        invitation.isConfirmed -> InvitationEntryStage.CONFIRMED
        invitation.isDeclined -> InvitationEntryStage.DECLINED
        else -> InvitationEntryStage.PENDING
    }
}
