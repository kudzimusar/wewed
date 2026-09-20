package pro.wewed.app.models

import java.util.UUID

/**
 * Represents real-time operational vendor presence on the wedding day.
 */
enum class VendorPresenceState(val title: String) {
    NOT_RECORDED("Not recorded"),
    SCHEDULED("Scheduled"),
    EN_ROUTE("En Route"),
    ARRIVED("Arrived on Site"),
    SERVICE_ACTIVE("Service Active"),
    COMPLETED("Completed")
}

data class VendorPresence(
    val id: String,
    val vendorName: String,
    val serviceCategory: String,
    val serviceArea: String,
    var state: VendorPresenceState = VendorPresenceState.NOT_RECORDED,
    val expectedTime: String,
    var lastUpdatedMillis: Long = System.currentTimeMillis()
)

/**
 * Day-of announcement broadcast to guests, bridal party, or vendors.
 */
enum class AnnouncementUrgency {
    INFO,
    ACTION,
    ALERT
}

data class WeddingAnnouncement(
    val id: String = UUID.randomUUID().toString(),
    val title: String,
    val message: String,
    val urgency: AnnouncementUrgency = AnnouncementUrgency.INFO,
    val timestampMillis: Long = System.currentTimeMillis()
)

/**
 * Resolved invitation context for deep-link restoration and Ivory presentation.
 */
data class InvitationContext(
    val weddingSlug: String,
    val guestToken: String,
    val coupleNames: String,
    val guestName: String,
    val householdName: String? = null,
    val partySize: Int,
    val weddingDate: String,
    val venueName: String,
    val venueCity: String,
    val cardStyle: String = "ivory-floral-gold",
    var isConfirmed: Boolean = false,
    /**
     * A declined invitation is a third state, not merely "not confirmed". Collapsing the two sends
     * a guest who already said no back to the RSVP form to answer again.
     */
    var isDeclined: Boolean = false
)
