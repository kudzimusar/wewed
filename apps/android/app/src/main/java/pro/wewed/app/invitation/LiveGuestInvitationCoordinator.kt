package pro.wewed.app.invitation

import androidx.annotation.VisibleForTesting

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
    /** Master plan Phase 9 — carries the full record the server actually stored. */
    data class Saved(val rsvp: GuestRsvpRecord) : RsvpOutcome

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
 * Outcome of pre-open RSVP refresh.
 *
 * Ensures that tapping RSVP / Update RSVP loads fresh server truth before the editor opens,
 * eliminating stale client overwrites.
 */
sealed interface RsvpEditorPreparation {
    data class Ready(val snapshot: GuestInvitationSnapshot) : RsvpEditorPreparation
    data object ReopenRequired : RsvpEditorPreparation
    data class Unavailable(val status: Int?) : RsvpEditorPreparation
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

    /**
     * The wedding of the card currently presented — the presentation, not the stored session.
     * Set only when a card is actually presented; cleared the moment a new entry begins.
     */
    private var activeWeddingSlug: String? = null

    /** The guest the presented card belongs to. It is what binds an answer to the right record. */
    private var presentedGuestId: String? = null

    @VisibleForTesting
    internal val testActiveWeddingSlug: String? get() = activeWeddingSlug

    @VisibleForTesting
    internal val testPresentedGuestId: String? get() = presentedGuestId

    /**
     * Enters the invitation.
     *
     * A private link is exchanged; an opaque handoff is redeemed. Both end in the same place — a
     * server-issued session and a snapshot read back from it — because after entry the two are
     * indistinguishable and should be.
     */
    suspend fun enter(entry: InvitationEntry): LiveInvitationState {
        // A new explicit entry ends the current presentation before anything else happens. The
        // binding below names the card on screen, and from this moment that card is no longer
        // what the guest is acting on: if the new entry is refused or cannot reach Wewed, nothing
        // may still answer or refresh as the previously presented Guest (master plan §6.5).
        //
        // This clears the PRESENTATION only. The remembered secure session is untouched — the
        // client writes a session only after a new one is issued — so a refused Guest B never
        // deletes Guest A's session, and an explicit restore can bring A back.
        endPresentation()
        return when (entry) {
            is InvitationEntry.Rejected -> LiveInvitationState.Refused(entry.reason)

            is InvitationEntry.PrivateInvitation -> exchange {
                client.exchangePrivateInvitation(entry.weddingSlug, entry.rsvpToken)
            }

            // The path that used to be acknowledged and then dropped.
            is InvitationEntry.Handoff -> exchange { client.redeemHandoff(entry.secret) }
        }
    }

    /** Drops the presented-card binding. Never touches the stored session. */
    private fun endPresentation() {
        activeWeddingSlug = null
        presentedGuestId = null
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
     *
     * Master plan Phase 9 — [update] carries the full converged RSVP field set (attendance, meal,
     * plus-one, children, dietary notes, message), not just attendance. [presentedGuestId] is
     * untouched by this change: it remains captured only at presentation time, never at save time.
     */
    suspend fun answer(update: GuestRsvpUpdate): RsvpOutcome {
        val slug = activeWeddingSlug ?: return RsvpOutcome.ReopenRequired
        val guestId = presentedGuestId?.takeIf { it.isNotBlank() }
            ?: return RsvpOutcome.ReopenRequired

        return try {
            when (val result = client.saveRsvp(slug, guestId, update)) {
                is RsvpSaveResult.Saved -> RsvpOutcome.Saved(result.rsvp)
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

    /**
     * Pre-open refresh before opening the RSVP editor.
     *
     * In accordance with Master Plan Phase 9:
     * Tapping RSVP / Update RSVP captures expectedWeddingSlug and expectedGuestId
     * prior to network I/O, executes client.loadInvitation(expectedWeddingSlug),
     * and strictly verifies snapshot equality (weddingSlug and guestId) before rebinding state.
     * If session moved on, was revoked, or mismatched, fails closed returning ReopenRequired.
     */
    suspend fun prepareRsvpEditor(): RsvpEditorPreparation {
        val expectedWeddingSlug = activeWeddingSlug ?: return RsvpEditorPreparation.ReopenRequired
        val expectedGuestId = presentedGuestId?.takeIf { it.isNotBlank() } ?: return RsvpEditorPreparation.ReopenRequired

        val refreshedSnapshot = try {
            client.loadInvitation(expectedWeddingSlug)
        } catch (error: GuestSessionException) {
            return when (val reason = error.error) {
                is GuestSessionError.Unauthorized -> {
                    endPresentation()
                    RsvpEditorPreparation.ReopenRequired
                }
                is GuestSessionError.Transport -> RsvpEditorPreparation.Unavailable(reason.status)
            }
        }

        if (refreshedSnapshot.weddingSlug != expectedWeddingSlug || refreshedSnapshot.guestId != expectedGuestId) {
            endPresentation()
            return RsvpEditorPreparation.ReopenRequired
        }

        activeWeddingSlug = refreshedSnapshot.weddingSlug
        presentedGuestId = refreshedSnapshot.guestId
        return RsvpEditorPreparation.Ready(refreshedSnapshot)
    }
}
