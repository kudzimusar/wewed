package pro.wewed.app.navigation

import pro.wewed.app.models.InvitationContext
import pro.wewed.app.models.RSVPStatus

/**
 * The Guest Ceremonial Entry Contract.
 *
 * The invitation was being treated as an onboarding page: shown once, answered, then discarded.
 * That is wrong about what the card *is*. The Couple recognised this person; the card is that
 * recognition. It is the Guest's entrance to the wedding, and it belongs at the start of every
 * visit — not only the first.
 *
 * So for a recognised Guest:
 *
 *     Wewed launch -> motion splash -> the personalised card -> the Guest continues from it
 *
 * The card does not disappear once RSVP is answered. What changes is what it ASKS. A guest who
 * has already replied is never asked again; the same card becomes their reminder, then their
 * admission on the day, then a thank-you afterwards. One card, one identity, a whole lifecycle.
 *
 * This is a release invariant, asserted in tests on both platforms.
 */
object GuestCeremonialEntry {

    /**
     * Whether this app-entry session must open with the card.
     *
     * "Every time the app opens" means every new ENTRY SESSION — a cold launch, a relaunch after
     * termination, a fresh deep link, or a restore after process death. It does not mean every
     * return from the background: interrupting someone with a ceremony every time they glance at
     * another app would be an irritation, not a welcome.
     */
    fun shouldPresentCard(
        isRecognisedGuest: Boolean,
        entrySessionPresentedCard: Boolean
    ): Boolean = isRecognisedGuest && !entrySessionPresentedCard

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

    /**
     * Replacing the active guest.
     *
     * Opening Guest B's invitation while Guest A is active must leave nothing of A behind — not
     * their party, not their table, not their pass, not a half-filled RSVP form. And if B's claim
     * turns out to be invalid, the app must NOT quietly fall back to A: showing one person another
     * person's invitation is the worst outcome available here.
     */
    fun replaceActiveGuest(
        current: InvitationContext?,
        incoming: InvitationContext?
    ): GuestReplacement = when {
        incoming != null -> GuestReplacement.Activate(incoming)
        // No valid incoming guest. A is cleared regardless; it is never restored.
        current != null -> GuestReplacement.RejectAndClear
        else -> GuestReplacement.RejectAndClear
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

/** The outcome of opening an invitation while another guest is active. */
sealed class GuestReplacement {
    /** The incoming guest becomes active. Everything belonging to the previous one is dropped. */
    data class Activate(val invitation: InvitationContext) : GuestReplacement()

    /** The incoming claim is invalid. The previous guest is cleared and never restored. */
    data object RejectAndClear : GuestReplacement()
}
