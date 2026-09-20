package pro.wewed.app.ui.invitation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.models.*
import pro.wewed.app.theme.WeddingIdentityPalette
import pro.wewed.app.ui.invitation.ivory.*

/**
 * The one place that decides which invitation a guest meets.
 *
 * The invitation is a wedding-configured product object. Individual screens must not decide its
 * design, and RSVP state must not decide it either — that is precisely how an invented summary
 * card came to replace the approved stationery for confirmed guests.
 *
 * ```
 * NativeInvitationExperience
 *   ├── IVORY_FLORAL_GOLD ──▶ IvoryFloralGoldNative   (the approved reference implementation)
 *   └── (future styles plug in here)
 * ```
 *
 * A style this build cannot render is stated plainly. Falling back to Ivory would show one couple
 * another couple's stationery, which is worse than saying the design is not available yet.
 */
@Composable
fun NativeInvitationExperience(
    style: InvitationStyle,
    data: IvoryInvitationData,
    rsvp: IvoryRsvpState,
    actions: IvoryActions,
    reducedMotion: Boolean = false,
    initialState: InvitationPresentationState = InvitationPresentationState.CLOSED,
    onStateChanged: (InvitationPresentationState) -> Unit = {}
) {
    if (style.hasNativeRenderer) {
        // Exactly one design has an exact native renderer today, and the enum — not this screen —
        // is what says so.
        IvoryFloralGoldNative(
            data = data,
            rsvp = rsvp,
            actions = actions,
            reducedMotion = reducedMotion,
            initialState = initialState,
            onStateChanged = onStateChanged
        )
        return
    }

    // A style native cannot yet reproduce is named and declined. Substituting Ivory would show one
    // couple another couple's stationery and report it as parity.
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WeddingIdentityPalette.Ivory)
            .testTag("invitation-style-unsupported"),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier.padding(30.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(
                "${style.displayName} isn't available on mobile yet",
                fontFamily = FontFamily.Serif,
                fontSize = 18.sp,
                color = WeddingIdentityPalette.Ink,
                textAlign = TextAlign.Center,
                modifier = Modifier.testTag("invitation-style-name")
            )
            Text(
                "This is the invitation design your wedding is set to. Open your invitation link " +
                    "in a browser to see it exactly as it was made.",
                fontSize = 13.sp,
                color = WeddingIdentityPalette.Muted,
                textAlign = TextAlign.Center
            )
        }
    }
}

/**
 * Builds the invitation's content from the wedding graph.
 *
 * Every value is resolved, never written here. Baking "Charity & Kudzie" into the renderer would
 * make it a picture of one wedding rather than an invitation.
 */
fun ivoryDataFrom(
    invitation: InvitationContext,
    wedding: Wedding?,
    monogram: String?,
    tagline: String?,
    rsvpDeadlineLabel: String? = null,
    /** The couple's own invitation line, where they wrote one. */
    message: String? = null
): IvoryInvitationData {
    val parts = invitation.weddingDate.trim().take(10).split("-")
    val months = listOf(
        "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
    )
    val monthIndex = parts.getOrNull(1)?.toIntOrNull()?.minus(1)
    val weekday = runCatching {
        val date = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
            .parse(invitation.weddingDate.take(10))
        java.text.SimpleDateFormat("EEEE", java.util.Locale.US).format(date!!)
    }.getOrNull()

    return IvoryInvitationData(
        coupleNames = invitation.coupleNames,
        monogram = monogram ?: invitation.coupleNames
            .split(Regex("\\s*&\\s*"))
            .mapNotNull { it.trim().firstOrNull()?.uppercase() }
            .joinToString(" "),
        message = message?.takeIf { it.isNotBlank() }
            ?: "Request the pleasure of your company as we celebrate our marriage.",
        weddingDateLabel = invitation.weddingDate,
        weekdayLabel = weekday,
        dayLabel = parts.getOrNull(2)?.toIntOrNull()?.toString(),
        monthLabel = monthIndex?.let { months.getOrNull(it) },
        yearLabel = parts.getOrNull(0),
        venue = invitation.venueName,
        venueAddress = wedding?.venueAddress?.takeIf { it != invitation.venueName },
        venueCityCountry = invitation.venueCity,
        tagline = tagline,
        guestName = invitation.guestName,
        rsvpDeadlineLabel = rsvpDeadlineLabel
    )
}

/**
 * Maps RSVP state onto what the invitation offers.
 *
 * It changes the card's ACTIONS and its status line. It never changes which card is shown, and it
 * never asks an answered guest again.
 */
fun ivoryRsvpStateFrom(status: RSVPStatus): IvoryRsvpState = when (status) {
    RSVPStatus.PENDING -> IvoryRsvpState(
        answer = IvoryRsvpAnswer.AWAITING,
        statusLabel = null,
        offersPass = false
    )
    RSVPStatus.ATTENDING -> IvoryRsvpState(
        answer = IvoryRsvpAnswer.ATTENDING,
        statusLabel = "RSVP confirmed",
        offersPass = true
    )
    // A declined guest keeps the invitation and the wedding's public content, but never a pass.
    RSVPStatus.DECLINED -> IvoryRsvpState(
        answer = IvoryRsvpAnswer.DECLINED,
        statusLabel = "Response recorded — not attending",
        offersPass = false
    )
}
