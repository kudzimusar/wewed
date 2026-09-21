package pro.wewed.app.invitation

/**
 * Where a guest is in their live invitation entry.
 *
 * Every state is one the UI must actually be able to show. There is deliberately no "failed
 * quietly" state: a guest whose entry did not work has to be told, because the alternative looks
 * identical to the app opening as whoever was already signed in.
 */
sealed interface LiveInvitationState {

    data object Idle : LiveInvitationState

    /** The credential is being exchanged. The card is not shown yet, and neither is the workspace. */
    data object Exchanging : LiveInvitationState

    /**
     * The wedding's own authority has answered. Everything the card needs is in [snapshot], and the
     * raw credential is gone.
     */
    data class Presenting(val snapshot: GuestInvitationSnapshot) : LiveInvitationState

    /** The invitation was refused. Fails closed: never falls back to the previously active guest. */
    data class Refused(val reason: InvitationEntry.Reason?) : LiveInvitationState

    /**
     * The invitation is probably fine but Wewed could not be reached.
     *
     * Kept distinct from [Refused] because they mean opposite things to a guest: one says "this
     * link is not yours", the other says "try again in a moment".
     */
    data class Unavailable(val status: Int?) : LiveInvitationState
}

/** What came back from answering. */
sealed interface RsvpOutcome {
    data class Saved(val attending: Boolean?) : RsvpOutcome

    /**
     * The card on screen belongs to a guest who is no longer the active one.
     *
     * Surfaced, never swallowed. The server refused to write Guest A's answer onto Guest B, and
     * the guest needs to know their answer did not save rather than believing it did.
     */
    data object ReopenRequired : RsvpOutcome

    data object ChildrenNotAllowed : RsvpOutcome
    data class Unavailable(val status: Int?) : RsvpOutcome
}

/**
 * The one place the live invitation journey happens.
 *
 * ```
 * InvitationEntry → identity exchange → guest-session snapshot → presentation → RSVP
 * ```
 *
 * It exists so that live network behaviour is not scattered through views. Before this, a parsed
 * handoff was recognised and then never redeemed, and RSVP went to a Shadow repository — so the
 * parser tests passed while the app ignored the result. One coordinator makes that gap impossible
 * to reintroduce without deleting a method.
 *
 * It holds no raw credential. The token is used once, by [GuestSessionClient], and the coordinator
 * only ever sees what the server said about the guest.
 */
class LiveGuestInvitationCoordinator(
    private val client: GuestSessionClient
) {

    suspend fun publishedStory(slug: String) = client.publishedStory(slug)
    suspend fun weddingDay(guestId: String) = client.loadWeddingDay(guestId)
    suspend fun weddingPass(guestId: String) = client.loadWeddingPass(guestId)

    /** The wedding the active session belongs to, once one exists. */
    private var activeWeddingSlug: String? = null

    /** The guest the presented card belongs to. It is what binds an answer to the right record. */
    private var presentedGuestId: String? = null

    /**
     * Enters the invitation.
     *
     * A private link is exchanged; an opaque handoff is redeemed. Both end in the same place — a
     * server-issued session and a snapshot read back from it — because after entry the two are
     * indistinguishable and should be.
     */
    suspend fun enter(entry: InvitationEntry): LiveInvitationState {
        return when (entry) {
            is InvitationEntry.Rejected -> LiveInvitationState.Refused(entry.reason)

            is InvitationEntry.PrivateInvitation -> exchange {
                client.exchangePrivateInvitation(entry.weddingSlug, entry.rsvpToken)
            }

            // The path that used to be acknowledged and then dropped.
            is InvitationEntry.Handoff -> exchange { client.redeemHandoff(entry.secret) }
        }
    }

    /** Restores the guest this device already holds a session for, without any credential. */
    suspend fun restoreRememberedGuest(): LiveInvitationState {
        val slug = client.activeSessionSlug() ?: return LiveInvitationState.Idle
        return load(slug)
    }

    private suspend inline fun exchange(
        block: () -> GuestSessionIdentity
    ): LiveInvitationState {
        val identity = try {
            block()
        } catch (error: GuestSessionException) {
            return when (val reason = error.error) {
                // The server declined the credential. That is a refusal, and it must not restore
                // whoever was active before.
                is GuestSessionError.Unauthorized -> LiveInvitationState.Refused(null)
                is GuestSessionError.Transport -> LiveInvitationState.Unavailable(reason.status)
            }
        }
        return load(identity.weddingSlug)
    }

    private suspend fun load(weddingSlug: String): LiveInvitationState {
        return try {
            val snapshot = client.loadInvitation(weddingSlug)
            activeWeddingSlug = snapshot.weddingSlug
            presentedGuestId = snapshot.guestId
            LiveInvitationState.Presenting(snapshot)
        } catch (error: GuestSessionException) {
            when (val reason = error.error) {
                is GuestSessionError.Unauthorized -> LiveInvitationState.Refused(null)
                is GuestSessionError.Transport -> LiveInvitationState.Unavailable(reason.status)
            }
        }
    }

    /**
     * Answers on behalf of the guest whose card is open.
     *
     * The binding is [presentedGuestId], captured when the card was built — not whoever the session
     * happens to name now. That is the whole point: if the session moved on while the card was
     * open, the server returns `STALE_GUEST_CONTEXT` and the answer is not written to the wrong
     * person.
     */
    suspend fun answer(
        attending: Boolean,
        dietaryNotes: String? = null,
        message: String? = null
    ): RsvpOutcome {
        val slug = activeWeddingSlug ?: return RsvpOutcome.ReopenRequired
        val guestId = presentedGuestId?.takeIf { it.isNotBlank() }
            ?: return RsvpOutcome.ReopenRequired

        return try {
            when (val result = client.saveRsvp(slug, guestId, attending, dietaryNotes, message)) {
                is RsvpSaveResult.Saved -> RsvpOutcome.Saved(result.attending)
                is RsvpSaveResult.StaleGuestContext -> RsvpOutcome.ReopenRequired
                is RsvpSaveResult.NotAuthorized -> RsvpOutcome.ReopenRequired
                is RsvpSaveResult.ChildrenNotAllowed -> RsvpOutcome.ChildrenNotAllowed
                is RsvpSaveResult.Failed -> RsvpOutcome.Unavailable(result.status)
            }
        } catch (error: GuestSessionException) {
            RsvpOutcome.Unavailable((error.error as? GuestSessionError.Transport)?.status)
        }
    }

    /** Re-reads the card after an answer, so what is shown is what the server stored. */
    suspend fun refresh(): LiveInvitationState =
        activeWeddingSlug?.let { load(it) } ?: LiveInvitationState.Idle
}
