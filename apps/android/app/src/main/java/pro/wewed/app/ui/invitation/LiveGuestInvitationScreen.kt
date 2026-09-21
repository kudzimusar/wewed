package pro.wewed.app.ui.invitation

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import pro.wewed.app.invitation.*
import pro.wewed.app.models.RSVPStatus
import pro.wewed.app.theme.WeddingIdentityPalette
import pro.wewed.app.theme.WewedColors
import pro.wewed.app.ui.invitation.ivory.IvoryActions
import pro.wewed.app.ui.invitation.ivory.IvoryInvitationData

/**
 * The guest's invitation, rendered from the live guest session.
 *
 * The distinction from [GuestInvitationJourneyScreen] is where the data and the RSVP write come
 * from: this one talks to the wedding's own authority through [LiveGuestInvitationCoordinator],
 * and never to a repository. The Shadow journey is kept for Shadow qualification, and the two
 * never fall back to each other — a guest whose live invitation fails is told so, rather than
 * being shown fixture data that looks like their card.
 *
 * It holds no RSVP credential. [LiveInvitationPresentation] deliberately has no field for one.
 */
@Composable
fun LiveGuestInvitationScreen(
    presentation: LiveInvitationPresentation,
    coordinator: LiveGuestInvitationCoordinator,
    onRefreshed: (LiveInvitationState) -> Unit,
    onContinue: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    var rsvpPrompt by remember { mutableStateOf(false) }
    var submitting by remember { mutableStateOf(false) }
    var reopenRequired by remember { mutableStateOf(false) }
    var showNote by remember { mutableStateOf(false) }

    val status = presentation.rsvpStatus

    fun answer(attending: Boolean) {
        if (submitting) return
        submitting = true
        scope.launch {
            when (coordinator.answer(attending)) {
                is RsvpOutcome.Saved -> {
                    rsvpPrompt = false
                    // Re-read rather than trusting the local edit: what the card shows afterwards
                    // is what the server stored.
                    onRefreshed(coordinator.refresh())
                }
                // The card belongs to a guest who is no longer the active one. Saying nothing here
                // would let the guest believe their answer was recorded.
                is RsvpOutcome.ReopenRequired -> { rsvpPrompt = false; reopenRequired = true }
                is RsvpOutcome.ChildrenNotAllowed -> { rsvpPrompt = false; reopenRequired = true }
                is RsvpOutcome.Unavailable -> { rsvpPrompt = false; reopenRequired = true }
            }
            submitting = false
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        NativeInvitationExperience(
            style = presentation.invitationCardStyle,
            data = presentation.toIvoryData(),
            rsvp = ivoryRsvpStateFrom(status),
            actions = IvoryActions(
                onRsvp = if (status == RSVPStatus.PENDING) ({ rsvpPrompt = true }) else null,
                // The snapshot already carries the date and venue, so there was never a reason to
                // withhold this. An insert intent, not a silent write: the guest sees the event and
                // saves it, and the app needs no calendar permission.
                onAddToCalendar = { addWeddingToCalendar(context, presentation) },
                onOpenVenue = {
                    val target = presentation.venueMapUrl?.takeIf { it.isNotBlank() }
                        ?: ("geo:0,0?q=" + Uri.encode(
                            listOfNotNull(presentation.venue, presentation.venueCityCountry)
                                .joinToString(", ")
                        ))
                    runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(target))) }
                },
                onGifts = { openCoupleSite(context, presentation.weddingSlug, "#registry") },
                // The couple's own words, offered only when they wrote some. An invitation that
                // always has "a note from us" is inventing words on their behalf.
                onNote = presentation.invitationCardMessage
                    ?.takeIf { it.isNotBlank() }
                    ?.let { { showNote = true } },
                // Deliberately absent, and it is a release blocker rather than an oversight: no
                // production authority issues a guest admission credential, and this app will not
                // manufacture one out of a token, an id, an email or a name.
                onViewPass = null,
                // The public page, never the private invitation link.
                onVisitCoupleSite = { openCoupleSite(context, presentation.weddingSlug, null) },
                onContinue = onContinue
            )
        )

        if (rsvpPrompt) {
            LiveRsvpPrompt(
                guestName = presentation.guestName,
                isSubmitting = submitting,
                onAccept = { answer(true) },
                onDecline = { answer(false) },
                onDismiss = { if (!submitting) rsvpPrompt = false }
            )
        }

        if (reopenRequired) {
            ReopenRequiredNotice(onDismiss = { reopenRequired = false })
        }

        presentation.invitationCardMessage?.takeIf { showNote && it.isNotBlank() }?.let { note ->
            NoteFromTheCouple(note = note, onDismiss = { showNote = false })
        }
    }
}

/**
 * Hands the wedding to the phone's calendar.
 *
 * The date arrives as ISO from the graph; older shapes use a space separator. Both are the same
 * instant, and a parser that accepted only one silently produced no event at all.
 */
private fun addWeddingToCalendar(
    context: android.content.Context,
    presentation: LiveInvitationPresentation
) {
    val start = parseWeddingInstant(presentation.weddingDate.orEmpty()) ?: return
    val intent = Intent(Intent.ACTION_INSERT)
        .setData(android.provider.CalendarContract.Events.CONTENT_URI)
        .putExtra(android.provider.CalendarContract.Events.TITLE, presentation.coupleNames)
        .putExtra(
            android.provider.CalendarContract.Events.EVENT_LOCATION,
            listOfNotNull(presentation.venue, presentation.venueCityCountry.takeIf { it.isNotBlank() })
                .joinToString(", ")
        )
        .putExtra(android.provider.CalendarContract.EXTRA_EVENT_BEGIN_TIME, start)
        .putExtra(android.provider.CalendarContract.EXTRA_EVENT_END_TIME, start + 6 * 60 * 60 * 1000L)
    runCatching { context.startActivity(intent) }
}

private fun parseWeddingInstant(raw: String): Long? {
    listOf("yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd'T'HH:mm", "yyyy-MM-dd")
        .forEach { pattern ->
            runCatching {
                java.text.SimpleDateFormat(pattern, java.util.Locale.US).parse(raw.trim())
            }.getOrNull()?.let { return it.time }
        }
    return null
}

/**
 * The couple's own note.
 *
 * Shown only when `invitationCardMessage` is set, because the alternative is putting words in
 * their mouth.
 */
@Composable
private fun NoteFromTheCouple(note: String, onDismiss: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.45f))
            .clickable(onClick = onDismiss)
            .testTag("invitation-note-sheet"),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .padding(32.dp)
                .background(WeddingIdentityPalette.Ivory)
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                "A note from us",
                fontSize = 13.sp,
                letterSpacing = 1.8.sp,
                color = WeddingIdentityPalette.Muted
            )
            Text(
                note,
                fontSize = 16.sp,
                fontFamily = FontFamily.Serif,
                color = WeddingIdentityPalette.Ink,
                textAlign = TextAlign.Center
            )
        }
    }
}

/** The public couple site. Safe to share; the private invitation link is not. */
private fun openCoupleSite(context: android.content.Context, slug: String, fragment: String?) {
    val url = "https://wewed.pro/w/" + Uri.encode(slug) + (fragment ?: "")
    runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
}

private fun LiveInvitationPresentation.toIvoryData(): IvoryInvitationData {
    val iso = weddingDate.orEmpty().trim().take(10)
    val parts = iso.split("-")
    val months = listOf(
        "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
    )
    val weekday = runCatching {
        java.text.SimpleDateFormat("EEEE", java.util.Locale.US).format(
            java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).parse(iso)!!
        )
    }.getOrNull()

    return IvoryInvitationData(
        coupleNames = coupleNames,
        monogram = monogram ?: coupleNames.split(Regex("\\s*&\\s*"))
            .mapNotNull { it.trim().firstOrNull()?.uppercase() }
            .joinToString(" "),
        message = invitationCardMessage?.takeIf { it.isNotBlank() }
            ?: "Request the pleasure of your company as we celebrate our marriage.",
        weddingDateLabel = weddingDate.orEmpty(),
        weekdayLabel = weekday,
        dayLabel = parts.getOrNull(2)?.toIntOrNull()?.toString(),
        monthLabel = parts.getOrNull(1)?.toIntOrNull()?.minus(1)?.let { months.getOrNull(it) },
        yearLabel = parts.getOrNull(0),
        venue = venue.orEmpty(),
        venueAddress = null,
        venueCityCountry = venueCityCountry,
        tagline = tagline,
        guestName = guestName,
        rsvpDeadlineLabel = rsvpDeadline
    )
}

@Composable
private fun LiveRsvpPrompt(
    guestName: String,
    isSubmitting: Boolean,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
    onDismiss: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.45f))
            .clickable(enabled = !isSubmitting, onClick = onDismiss)
            .testTag("invitation-rsvp-prompt"),
        contentAlignment = Alignment.BottomCenter
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(WeddingIdentityPalette.Ivory)
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Text(
                "Will you be joining us?",
                fontSize = 20.sp,
                fontFamily = FontFamily.Serif,
                color = WeddingIdentityPalette.Ink
            )
            guestName.takeIf { it.isNotBlank() }?.let {
                Text(it, fontSize = 13.sp, color = WeddingIdentityPalette.Muted)
            }
            if (isSubmitting) {
                Text("Recording your answer…", fontSize = 13.sp, color = WeddingIdentityPalette.Muted)
            } else {
                Text(
                    "Joyfully accept",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = WewedColors.Emerald,
                    modifier = Modifier
                        .clickable(onClick = onAccept)
                        .padding(vertical = 8.dp, horizontal = 20.dp)
                        .testTag("invitation-rsvp-accept")
                )
                Text(
                    "Regretfully decline",
                    fontSize = 14.sp,
                    color = WeddingIdentityPalette.Muted,
                    modifier = Modifier
                        .clickable(onClick = onDecline)
                        .padding(vertical = 8.dp, horizontal = 20.dp)
                        .testTag("invitation-rsvp-decline")
                )
            }
        }
    }
}

/**
 * Shown when the server refused the write because the session moved on.
 *
 * It says the answer was not saved. A silent failure here is worse than an error, because the
 * guest walks away believing they have replied.
 */
@Composable
private fun ReopenRequiredNotice(onDismiss: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.55f))
            .clickable(onClick = onDismiss)
            .testTag("invitation-reopen-required"),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .padding(28.dp)
                .background(WeddingIdentityPalette.Ivory)
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(
                "Your answer wasn't saved",
                fontSize = 18.sp,
                fontFamily = FontFamily.Serif,
                color = WeddingIdentityPalette.Ink,
                textAlign = TextAlign.Center
            )
            Text(
                "Open your invitation link again, then reply.",
                fontSize = 13.sp,
                color = WeddingIdentityPalette.Muted,
                textAlign = TextAlign.Center
            )
        }
    }
}

/**
 * Wewed could not be reached.
 *
 * Deliberately distinct from a refusal: "try again in a moment" and "this link is not yours" are
 * opposite messages, and showing the wrong one is how a working invitation gets abandoned.
 */
@Composable
fun InvitationUnavailableScreen(onRetry: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WeddingIdentityPalette.Ivory)
            .testTag("invitation-unavailable"),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier.padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                "We couldn't reach Wewed",
                fontFamily = FontFamily.Serif,
                fontSize = 20.sp,
                color = WeddingIdentityPalette.Ink,
                textAlign = TextAlign.Center
            )
            Text(
                "Your invitation is fine. Check your connection and open the link again.",
                fontSize = 14.sp,
                color = WeddingIdentityPalette.Muted,
                textAlign = TextAlign.Center
            )
            Text(
                "Continue to Wewed",
                fontWeight = FontWeight.SemiBold,
                color = WewedColors.Emerald,
                modifier = Modifier
                    .clickable(onClick = onRetry)
                    .padding(8.dp)
                    .testTag("invitation-unavailable-dismiss")
            )
        }
    }
}
