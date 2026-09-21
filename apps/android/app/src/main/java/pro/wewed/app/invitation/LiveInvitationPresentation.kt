package pro.wewed.app.invitation

import pro.wewed.app.models.InvitationStyle
import pro.wewed.app.models.RSVPStatus

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
