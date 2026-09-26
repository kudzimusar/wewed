package pro.wewed.app.models

import java.util.UUID

enum class PassStage(val title: String) {
    INVITATION("Invitation"),
    ATTENDING("Confirmed Guest"),
    PRE_WEDDING("Upcoming"),
    MORNING("Today"),
    CHECKED_IN("Admitted"),
    AFTER("Memories")
}

data class WeddingPass(
    val token: String,
    val weddingId: String,
    val coupleNames: String,
    val weddingDate: String,
    val venueName: String,
    val venueAddress: String,
    val guestName: String,
    val householdName: String? = null,
    val partySize: Int,
    val tableNumber: Int? = null,
    val tableName: String? = null,
    val seatNumber: String? = null,
    val currentStage: PassStage = PassStage.ATTENDING,
    val qrPayload: String,
    /** The server's credential serial (an index, never admission proof). */
    val passSerial: String? = null
)

/**
 * LQR01 — why the server is not issuing a Guest's Wedding Pass right now. Wire values match the
 * `availability.state` of `GET /api/wedding-day/pass` exactly.
 */
enum class WeddingPassAvailabilityState(val wireValue: String) {
    RSVP_REQUIRED("rsvp_required"),
    DECLINED("declined"),
    NOT_YET_ISSUABLE("not_yet_issuable"),
    ACTIVE("active"),
    ISSUANCE_CLOSED("issuance_closed"),
    REVOKED("revoked");

    companion object {
        fun fromWireValue(value: String?): WeddingPassAvailabilityState? = entries.firstOrNull { it.wireValue == value }
    }
}

/** The server's `availability` block. [opensAt] is the ISO-8601 string exactly as the server sent it. */
data class WeddingPassAvailability(
    val state: WeddingPassAvailabilityState,
    val code: String?,
    val opensAt: String? = null
)

data class CheckInAuditRecord(
    val id: String = UUID.randomUUID().toString(),
    val passSerial: String,
    val guestName: String,
    val countAdmitted: Int,
    val gateName: String = "Gate A — Main Entrance",
    val usherId: String,
    val scannedAtMillis: Long = System.currentTimeMillis(),
    val isSynced: Boolean = false
)

enum class CheckInStatus {
    VALID_PASS,
    PARTIAL_CHECKED_IN,
    ALREADY_CHECKED_IN,
    INVALID_PASS,
    CAPACITY_EXCEEDED
}

data class CheckInVerificationResult(
    val status: CheckInStatus,
    val guestName: String,
    val householdName: String? = null,
    val partySize: Int,
    val alreadyCheckedInCount: Int,
    val remainingCount: Int,
    val tableNumber: Int? = null,
    val tableName: String? = null,
    val gateMessage: String
)
