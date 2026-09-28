package pro.wewed.app.models

/**
 * Where a guest's entry begins.
 *
 * Deliberately only two values. There were once `CONFIRMED_ATTENDING` and `DECLINED` stages, and
 * having them meant RSVP state could choose a *destination* — which is how an answered guest came
 * to be sent somewhere other than their invitation. What a guest has answered now changes what the
 * invitation offers, never where they land.
 */
enum class GuestJourneyStage {
    /** The Wewed brand moment, before the card. */
    SPLASH,

    /** The wedding's configured invitation. Every guest entry ends here, whatever they answered. */
    INVITATION
}

data class GuestJourneyReference(
    val invitation: InvitationContext,
    val initialStage: GuestJourneyStage = GuestJourneyStage.SPLASH
)
