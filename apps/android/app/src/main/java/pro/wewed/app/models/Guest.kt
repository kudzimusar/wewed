package pro.wewed.app.models

enum class RSVPStatus(val value: String, val title: String) {
    ATTENDING("attending", "Attending"),
    DECLINED("declined", "Declined"),
    PENDING("pending", "Pending");

    companion object {
        fun fromValue(value: String): RSVPStatus =
            entries.find { it.value == value } ?: PENDING
    }
}

data class Guest(
    val id: String,
    val name: String,
    val householdName: String? = null,
    val partySize: Int = 1,
    val side: String? = null,
    val rsvpStatus: RSVPStatus = RSVPStatus.PENDING,
    val tableNumber: Int? = null,
    val tableName: String? = null,
    val checkedIn: Boolean = false,
    val checkedInCount: Int = 0,
    val passSerial: String? = null
)
