package pro.wewed.app.invitation

/**
 * What the app should do about invitation entry on this launch.
 *
 * Separated from the UI on purpose: "which guest is this, and may they take over?" is a security
 * decision, and a security decision buried in a composable is one nobody can test.
 */
sealed interface InvitationEntryDecision {

    /** Nothing invitation-shaped happened. Ordinary launch rules apply. */
    data object None : InvitationEntryDecision

    /**
     * Exchange this credential with the server, then present the invitation.
     *
     * Nothing is replaced yet. The active guest survives until the server has accepted the new one.
     */
    data class Establish(val entry: InvitationEntry) : InvitationEntryDecision

    /**
     * Restore the guest this device already holds a session for.
     *
     * Only ever on an ordinary launch, and never over a privileged workspace.
     */
    data object RestoreRememberedGuest : InvitationEntryDecision

    /** Fail closed and say so. Never a silent fallback to whoever was active. */
    data class Reject(val reason: InvitationEntry.Reason) : InvitationEntryDecision
}

/**
 * The precedence rules for invitation entry.
 *
 * Every rule here exists because its absence is a specific, believable bug:
 *
 *  - a stale install referrer resurfacing months later and hijacking an ordinary launch;
 *  - an invalid Guest B link silently presenting Guest A, so the wrong person's card opens;
 *  - remembered guest state taking over a Planner's authenticated workspace;
 *  - an explicit link being ignored because a referrer was already processed.
 */
object InvitationEntryPolicy {

    /**
     * @param launchEntry invitation entry parsed from *this* launch, if any.
     * @param deferredInstallEntry entry recovered from the Play install referrer, if any.
     * @param deferredInstallAlreadyProcessed whether the referrer has been consumed before. It is
     *   marked processed before it is acted on, so an interrupted launch cannot replay it.
     * @param hasRememberedGuestSession whether this device already holds a guest session.
     * @param hasPrivilegedWorkspace whether a Couple/Planner/Admin/Vendor workspace is active.
     */
    fun decide(
        launchEntry: InvitationEntry?,
        deferredInstallEntry: InvitationEntry? = null,
        deferredInstallAlreadyProcessed: Boolean = true,
        hasRememberedGuestSession: Boolean = false,
        hasPrivilegedWorkspace: Boolean = false
    ): InvitationEntryDecision {
        // An explicit link is present user intent and outranks everything, including a privileged
        // workspace: tapping your own invitation on a planner's phone should open your invitation.
        if (launchEntry != null) {
            return when (launchEntry) {
                is InvitationEntry.Rejected -> InvitationEntryDecision.Reject(launchEntry.reason)
                else -> InvitationEntryDecision.Establish(launchEntry)
            }
        }

        // A referrer records how the app was obtained, possibly long ago. It is weaker than a tap,
        // and it is honoured at most once.
        if (deferredInstallEntry != null && !deferredInstallAlreadyProcessed) {
            return when (deferredInstallEntry) {
                is InvitationEntry.Rejected ->
                    InvitationEntryDecision.Reject(deferredInstallEntry.reason)
                else -> InvitationEntryDecision.Establish(deferredInstallEntry)
            }
        }

        // Remembered guest state is the weakest claim of all. It restores an ordinary launch and
        // never displaces someone who is signed in to run a wedding.
        if (hasRememberedGuestSession && !hasPrivilegedWorkspace) {
            return InvitationEntryDecision.RestoreRememberedGuest
        }

        return InvitationEntryDecision.None
    }
}
