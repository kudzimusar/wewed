package pro.wewed.app.invitation

import pro.wewed.app.models.InvitationStyle
import pro.wewed.app.models.RSVPStatus
import pro.wewed.app.models.WeddingPassAvailability
import pro.wewed.app.models.WeddingPassAvailabilityState
import pro.wewed.app.services.parseWeddingDayIsoDate
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/**
 * What the live card renders from.
 *
 * Everything here is safe to hold: it is what the wedding's own authority said about this guest.
 * There is deliberately **no RSVP credential**. The token opened the door once, during exchange;
 * carrying it into the view model would turn a one-time key into the app's identity, which is the
 * exact model the invitation protocol exists to avoid.
 *
 * The Shadow-era `InvitationContext` carries `guestToken` because its RSVP write needed it. The
 * live route does not: the answer is bound by [guestId], which the server checks.
 */
data class LiveInvitationPresentation(
    val weddingSlug: String,
    val guestId: String,
    val guestName: String,

    val coupleNames: String,
    val monogram: String?,
    val tagline: String?,

    val weddingDate: String?,
    val venue: String?,
    val venueCity: String?,
    val venueCountry: String?,
    val venueMapUrl: String?,

    val invitationCardStyle: InvitationStyle,
    val invitationCardMessage: String?,
    val rsvpDeadline: String?,
    val childrenPolicy: String?,

    val email: String?,
    val tableNumber: Int?,
    /** e.g. "Table 1 — Family". Server-projected; never another guest's record. */
    val tableName: String?,

    val attending: Boolean?,
    val mealChoice: String?,
    val plusOne: Boolean,
    val plusOneName: String?,
    val plusOneMeal: String?,
    val kidsAttending: Boolean,
    val kidsCount: Int?,
    val dietaryNotes: String?,
    val message: String?,
    val checkedIn: Boolean,
    val checkedInAt: String?
) {
    /** Three states, because "not attending" is not "not answered". */
    val rsvpStatus: RSVPStatus
        get() = when (attending) {
            true -> RSVPStatus.ATTENDING
            false -> RSVPStatus.DECLINED
            null -> RSVPStatus.PENDING
        }

    /** "Harare, Zimbabwe" — joined here so the card never has to know either may be absent. */
    val venueCityCountry: String
        get() = listOfNotNull(
            venueCity?.takeIf { it.isNotBlank() },
            venueCountry?.takeIf { it.isNotBlank() }
        ).joinToString(", ")

    companion object {
        /**
         * Builds the presentation from what the server returned.
         *
         * The style comes from the wedding's saved `invitationCardStyle` and nothing else — not
         * from the link, which may be forwarded or long-lived.
         */
        fun from(snapshot: GuestInvitationSnapshot): LiveInvitationPresentation =
            LiveInvitationPresentation(
                weddingSlug = snapshot.weddingSlug,
                guestId = snapshot.guestId,
                guestName = snapshot.guestName,
                coupleNames = snapshot.title,
                monogram = snapshot.monogram,
                tagline = snapshot.tagline,
                weddingDate = snapshot.date,
                venue = snapshot.venue,
                venueCity = snapshot.venueCity,
                venueCountry = snapshot.venueCountry,
                venueMapUrl = snapshot.venueMapUrl,
                invitationCardStyle = InvitationStyle.fromWire(snapshot.invitationCardStyle),
                invitationCardMessage = snapshot.invitationCardMessage,
                rsvpDeadline = snapshot.rsvpDeadline,
                childrenPolicy = snapshot.childrenPolicy,
                email = snapshot.email,
                tableNumber = snapshot.tableNumber,
                tableName = snapshot.tableName,
                attending = snapshot.attending,
                mealChoice = snapshot.mealChoice,
                plusOne = snapshot.plusOne,
                plusOneName = snapshot.plusOneName,
                plusOneMeal = snapshot.plusOneMeal,
                kidsAttending = snapshot.kidsAttending,
                kidsCount = snapshot.kidsCount,
                dietaryNotes = snapshot.dietaryNotes,
                message = snapshot.message,
                checkedIn = snapshot.checkedIn,
                checkedInAt = snapshot.checkedInAt
            )
    }
}

/**
 * LQR01 — the Pass tab's copy when the server has said a Guest's Wedding Pass is not issued now.
 *
 * Each availability state gets its own sentence and test tag; anything unrecognised keeps the
 * generic line. This copy is only ever about the WW2 Wedding Pass — never a Printed or Open
 * Invitation credential.
 */
object WeddingPassAvailabilityCopy {
    const val GENERIC_UNAVAILABLE = "Your Wedding Pass is unavailable. Please try again later."

    fun message(availability: WeddingPassAvailability?): String = when (availability?.state) {
        WeddingPassAvailabilityState.NOT_YET_ISSUABLE -> "Your Wedding Pass will be available closer to the wedding."
        WeddingPassAvailabilityState.ISSUANCE_CLOSED -> "Wedding Pass issuance has closed for this wedding."
        WeddingPassAvailabilityState.REVOKED ->
            "This Wedding Pass is no longer valid. Please contact the couple or the wedding team."
        WeddingPassAvailabilityState.DECLINED -> "You declined this invitation, so no Wedding Pass is issued."
        WeddingPassAvailabilityState.RSVP_REQUIRED -> "Confirm your attendance to receive your Wedding Pass."
        WeddingPassAvailabilityState.ACTIVE, null -> GENERIC_UNAVAILABLE
    }

    fun testTag(availability: WeddingPassAvailability?): String =
        availability?.state?.takeIf { it != WeddingPassAvailabilityState.ACTIVE }
            ?.let { "live-guest-pass-state-${it.wireValue}" }
            ?: "live-guest-pass-unavailable"

    /** "Available from 16 December 2026" for a not-yet-issuable pass whose opening time parses. */
    fun availableFrom(
        availability: WeddingPassAvailability,
        timeZone: TimeZone = TimeZone.getDefault()
    ): String? {
        if (availability.state != WeddingPassAvailabilityState.NOT_YET_ISSUABLE) return null
        val opensAt = availability.opensAt?.let(::parseWeddingDayIsoDate) ?: return null
        val format = SimpleDateFormat("d MMMM yyyy", Locale.US).apply { this.timeZone = timeZone }
        return "Available from ${format.format(opensAt)}"
    }
}
