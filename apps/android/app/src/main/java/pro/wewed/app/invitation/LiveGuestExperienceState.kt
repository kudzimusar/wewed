package pro.wewed.app.invitation

/**
 * Where an invitation-bound Guest is in their own experience.
 *
 * This is deliberately a different axis from account onboarding. An invited Guest has already been
 * provisioned by the couple and has already authenticated themselves by opening their private
 * link; they are not a stranger who needs an email and a password. The states below describe a
 * guest moving around *their own wedding*, never a signup funnel.
 */
sealed interface LiveGuestExperienceState {

    /** Checking whether this device still holds a valid Guest session. */
    data object Restoring : LiveGuestExperienceState

    /**
     * The ceremonial entry: the configured digital invitation, shown first.
     *
     * Reached by opening a private link, and again whenever the Guest chooses Invitation. It is
     * not a gate — [LiveGuestExperienceState.Home] is reachable without answering.
     */
    data class Invitation(val presentation: LiveInvitationPresentation) : LiveGuestExperienceState

    /** The persistent Guest experience: their wedding, their details, their pass if attending. */
    data class Home(val profile: LiveInvitationPresentation) : LiveGuestExperienceState

    /** Wewed could not be reached. Distinct from being refused. */
    data class Unavailable(val status: Int?) : LiveGuestExperienceState

    /**
     * No valid Guest session on this device.
     *
     * Either nothing was stored, or what was stored is no longer good — an expired session, or an
     * invitation the couple has since rotated. The Guest is asked to reopen their invitation, and
     * is never shown someone else's wedding instead.
     */
    data class NeedsInvitation(val reason: InvitationEntry.Reason?) : LiveGuestExperienceState
}
