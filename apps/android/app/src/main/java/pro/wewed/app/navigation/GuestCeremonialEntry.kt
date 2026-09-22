package pro.wewed.app.navigation

import pro.wewed.app.models.RSVPStatus

/**
 * The Guest Entry Contract (master plan §6.2, §6.3).
 *
 * The invitation is the Guest's entrance to the wedding — the Couple's recognition of this person —
 * and the explicit arrival is where that ceremony happens:
 *
 *     private invitation link -> Wewed splash -> the configured Digital Invitation FIRST -> RSVP
 *
 * An ordinary return is not a new arrival:
 *
 *     app icon -> remembered Guest validated -> Guest Home
 *
 * and "My Digital Invitation" stays one tap away, reopening the same saved card. Replaying the whole
 * card every time someone checks their table would be tiresome rather than ceremonial.
 *
 * This file used to state a different rule — the card at the start of EVERY entry session — which
 * the production Guest shell never implemented; only the Shadow workspace root did. Two contracts
 * meant the Shadow harness qualified behaviour production did not have (master plan §8.3, §8.11).
 * There is now one, and both the production Guest shells and the Shadow root read it from here.
 *
 * The card does not disappear once RSVP is answered. What changes is what it ASKS: a guest who has
 * already replied is never asked again, and the same card becomes their reminder, their admission
 * on the day, then a thank-you afterwards.
 */
object GuestCeremonialEntry {

    /**
     * Whether a Guest entry opens on the invitation (true) or on Guest Home (false).
     *
     * Only an explicit invitation arrival — a private link, a redeemed handoff — opens on the card.
     * A remembered Guest returning through the app icon opens on Home.
     */
    fun opensOnInvitation(isExplicitInvitationArrival: Boolean): Boolean = isExplicitInvitationArrival

    /**
     * What the card should say, given what the guest has already answered and where the wedding
     * is in its own life.
     */
    fun presentation(
        rsvp: RSVPStatus,
        lifecycle: WeddingLifecyclePhase
    ): GuestCardPresentation = when (lifecycle) {
        // After the wedding the card stops being an invitation at all. Leaving it reading
        // "RSVP Confirmed" would suggest an event that has not happened yet.
        WeddingLifecyclePhase.AFTER -> GuestCardPresentation(
            headline = "Thank you for celebrating with us",
            statusLabel = null,
            primaryAction = GuestCardAction.VIEW_GALLERY,
            secondaryActions = listOf(GuestCardAction.VIEW_WEDDING_SITE, GuestCardAction.VIEW_MEMORIES),
            issuesPass = false
        )

        WeddingLifecyclePhase.WEDDING_DAY -> when (rsvp) {
            // On the day an attending guest needs their pass, the room and the running order —
            // the card becomes operational without ceasing to be the card.
            RSVPStatus.ATTENDING -> GuestCardPresentation(
                headline = "Today",
                statusLabel = "You're expected today",
                primaryAction = GuestCardAction.VIEW_PASS,
                secondaryActions = listOf(
                    GuestCardAction.OPEN_MAPS,
                    GuestCardAction.VIEW_PROGRAMME,
                    GuestCardAction.VIEW_TABLE
                ),
                issuesPass = true
            )
            RSVPStatus.DECLINED -> GuestCardPresentation(
                headline = "Today",
                statusLabel = "Response recorded — not attending",
                primaryAction = GuestCardAction.VIEW_WEDDING_SITE,
                secondaryActions = listOf(GuestCardAction.VIEW_OUR_STORY),
                issuesPass = false
            )
            RSVPStatus.PENDING -> GuestCardPresentation(
                headline = "Today",
                statusLabel = "We haven't heard from you yet",
                primaryAction = GuestCardAction.RSVP_NOW,
                secondaryActions = listOf(GuestCardAction.OPEN_MAPS, GuestCardAction.VIEW_DETAILS),
                issuesPass = false
            )
        }

        WeddingLifecyclePhase.BEFORE -> when (rsvp) {
            // Already answered: never ask twice. The card becomes the reminder and the way in.
            RSVPStatus.ATTENDING -> GuestCardPresentation(
                headline = "You're going",
                statusLabel = "RSVP confirmed",
                primaryAction = GuestCardAction.VIEW_PASS,
                secondaryActions = listOf(
                    GuestCardAction.CONTINUE_TO_WEDDING,
                    GuestCardAction.VIEW_WEDDING_SITE
                ),
                issuesPass = true
            )
            // A declined guest is still a guest. They keep the wedding's public content, and may
            // change their mind where the couple allows it — but never an admission pass.
            RSVPStatus.DECLINED -> GuestCardPresentation(
                headline = "Response recorded",
                statusLabel = "Not attending",
                primaryAction = GuestCardAction.VIEW_WEDDING_SITE,
                secondaryActions = listOf(
                    GuestCardAction.VIEW_OUR_STORY,
                    GuestCardAction.CHANGE_RESPONSE
                ),
                issuesPass = false
            )
            RSVPStatus.PENDING -> GuestCardPresentation(
                headline = "You're invited",
                statusLabel = null,
                primaryAction = GuestCardAction.RSVP_NOW,
                secondaryActions = listOf(
                    GuestCardAction.VIEW_DETAILS,
                    GuestCardAction.OPEN_MAPS,
                    GuestCardAction.VIEW_WEDDING_SITE
                ),
                issuesPass = false
            )
        }
    }

    /**
     * A human count of the time remaining, for the card's reminder line.
     *
     * Derived from the wedding date rather than written anywhere, so it stays true without anyone
     * maintaining it.
     */
    fun countdownLabel(daysRemaining: Int): String = when {
        daysRemaining > 7 -> "$daysRemaining days to go"
        daysRemaining in 2..7 -> "This week"
        daysRemaining == 1 -> "Tomorrow"
        daysRemaining == 0 -> "Today"
        else -> "Thank you for celebrating with us"
    }

    /** Where the wedding is in its own life, derived from its date. */
    fun phaseFor(daysRemaining: Int): WeddingLifecyclePhase = when {
        daysRemaining > 0 -> WeddingLifecyclePhase.BEFORE
        daysRemaining == 0 -> WeddingLifecyclePhase.WEDDING_DAY
        else -> WeddingLifecyclePhase.AFTER
    }
}

/** Where the wedding is in its own life. */
enum class WeddingLifecyclePhase { BEFORE, WEDDING_DAY, AFTER }

/** What the card offers. Which of these appear depends on RSVP state and lifecycle phase. */
enum class GuestCardAction(val label: String) {
    RSVP_NOW("RSVP Now"),
    VIEW_DETAILS("View Details"),
    OPEN_MAPS("Maps"),
    VIEW_WEDDING_SITE("View Wedding Site"),
    VIEW_PASS("View My Wedding Pass"),
    CONTINUE_TO_WEDDING("Continue to Wedding"),
    CHANGE_RESPONSE("Change My Response"),
    VIEW_OUR_STORY("Our Story"),
    VIEW_PROGRAMME("View Programme"),
    VIEW_TABLE("My Table"),
    VIEW_GALLERY("View Gallery"),
    VIEW_MEMORIES("Memories")
}

/** The card's current face: what it says, what it offers, and whether a pass exists behind it. */
data class GuestCardPresentation(
    val headline: String,
    val statusLabel: String?,
    val primaryAction: GuestCardAction,
    val secondaryActions: List<GuestCardAction>,
    /** Only an attending guest has an admission pass. A declined guest never does. */
    val issuesPass: Boolean
) {
    /** True when the card is still asking the guest to answer. */
    val awaitsResponse: Boolean get() = primaryAction == GuestCardAction.RSVP_NOW

    fun offers(action: GuestCardAction): Boolean =
        primaryAction == action || action in secondaryActions
}
