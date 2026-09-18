package pro.wewed.app.models

enum class GuestJourneyStage {
    SPLASH,
    INVITATION,
    CONFIRMED_ATTENDING,
    DECLINED
}

data class GuestJourneyReference(
    val invitation: InvitationContext,
    val initialStage: GuestJourneyStage = GuestJourneyStage.SPLASH
)
