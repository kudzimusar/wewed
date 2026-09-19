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
    val guestId: String? = null,
    val venue: VenueLocation? = null
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
