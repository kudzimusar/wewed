package pro.wewed.app.ui.invitation

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import android.content.Intent
import android.net.Uri
import android.provider.CalendarContract
import androidx.compose.foundation.clickable
import androidx.compose.ui.platform.LocalContext
import pro.wewed.app.models.InvitationContext
import pro.wewed.app.models.WeddingInvitationConfiguration
import pro.wewed.app.models.GuestJourneyReference
import pro.wewed.app.models.InvitationStyle
import pro.wewed.app.models.RSVPStatus
import pro.wewed.app.ui.invitation.ivory.IvoryActions
import pro.wewed.app.models.GuestJourneyStage
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.theme.WewedColors
import pro.wewed.app.theme.WeddingBrandMark
import pro.wewed.app.theme.WeddingIdentityPalette
import pro.wewed.app.theme.WeddingOrnamentBackdrop
import pro.wewed.app.models.WeddingPass
import pro.wewed.app.ui.pass.WeddingReferencePassScreen

/**
 * Hosts a guest's entry into the wedding's configured digital invitation.
 *
 * This screen owns the journey — splash, RSVP submission, the pass — and owns none of the
 * invitation's appearance. That belongs to [NativeInvitationExperience], which renders whichever
 * design the couple actually saved.
 *
 * The previous version chose between the invitation and a different screen based on RSVP state, so
 * a guest who had already answered never saw their invitation again. RSVP state now changes only
 * what the card OFFERS.
 */
@Composable
fun GuestInvitationJourneyScreen(
    reference: GuestJourneyReference,
    appViewModel: AppViewModel,
    onExit: () -> Unit = {}
) {
    var showSplash by remember(reference) {
        mutableStateOf(reference.initialStage == GuestJourneyStage.SPLASH)
    }
    var invitation by remember(reference) { mutableStateOf(reference.invitation) }
    var configuration by remember(reference) {
        mutableStateOf<WeddingInvitationConfiguration?>(null)
    }
    val style = InvitationStyle.fromWire(
        configuration?.cardStyle ?: reference.invitation.cardStyle
    )
    var generatedPass by remember(reference) { mutableStateOf<WeddingPass?>(null) }
    var showPass by remember(reference) { mutableStateOf(false) }
    var rsvpPrompt by remember(reference) { mutableStateOf(false) }
    var showNote by remember(reference) { mutableStateOf(false) }
    var pendingAttendance by remember(reference) { mutableStateOf<Boolean?>(null) }

    // The wedding row is the authority on the invitation; the invitation context carries a
    // resolved copy for offline entry. If the two disagree, the wedding wins.
    LaunchedEffect(reference) {
        configuration = runCatching {
            appViewModel.repository.invitationConfigurationForSlug(reference.invitation.weddingSlug)
        }.getOrNull()
    }

    LaunchedEffect(showSplash) {
        if (showSplash) {
            delay(1050)
            showSplash = false
        }
    }

    LaunchedEffect(pendingAttendance) {
        val attending = pendingAttendance ?: return@LaunchedEffect
        try {
            val pass = appViewModel.repository.confirmRsvp(
                invitation.weddingSlug,
                invitation.guestToken,
                attending
            )
            invitation = invitation.copy(isConfirmed = attending, isDeclined = !attending)
            generatedPass = if (attending) pass else null
            rsvpPrompt = false
        } catch (_: Throwable) {
            // Keep the invitation actionable when a Shadow RSVP operation fails. A failed write
            // must not leave the guest looking at a card that claims an answer was recorded.
        } finally {
            pendingAttendance = null
        }
    }

    if (showSplash) {
        WewedInvitationSplash()
        return
    }

    if (showPass) {
        Box(modifier = Modifier.fillMaxSize()) {
            WeddingReferencePassScreen(
                appViewModel = appViewModel,
                onOpenScanner = {},
                providedPass = generatedPass
            )
            TextButton(
                onClick = { showPass = false },
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(12.dp)
                    .testTag("guest-journey-done")
            ) {
                Text("Done", fontWeight = FontWeight.SemiBold, color = WewedColors.Emerald)
            }
        }
        return
    }

    val status = when {
        invitation.isConfirmed -> RSVPStatus.ATTENDING
        invitation.isDeclined -> RSVPStatus.DECLINED
        else -> RSVPStatus.PENDING
    }

    val context = LocalContext.current
    val note = configuration?.message?.takeIf { it.isNotBlank() }

    Box(modifier = Modifier.fillMaxSize()) {
        NativeInvitationExperience(
            style = style,
            data = ivoryDataFrom(
                invitation = invitation,
                wedding = null,
                monogram = configuration?.monogram,
                tagline = configuration?.tagline,
                rsvpDeadlineLabel = configuration?.rsvpDeadline,
                message = note
            ),
            rsvp = ivoryRsvpStateFrom(status),
            actions = IvoryActions(
                // Only a guest who has not answered is offered the question.
                onRsvp = if (status == RSVPStatus.PENDING) ({ rsvpPrompt = true }) else null,
                // The date and venue are on the card already; these hand them to the phone's own
                // calendar and maps rather than asking the guest to copy them across.
                onAddToCalendar = { addWeddingToCalendar(context, invitation) },
                onOpenVenue = { openVenueLocation(context, invitation, configuration?.venueMapUrl) },
                // Gifts appear only where the wedding has a configured destination.
                onGifts = configuration?.giftDestinationUrl
                    ?.takeIf { it.isNotBlank() }
                    ?.let { url -> { openExternal(context, url) } },
                // The note is the couple's own words. No note means no note, not a stock sentence.
                onNote = note?.let { { showNote = true } },
                // A declined guest never gets a pass.
                onViewPass = if (status == RSVPStatus.ATTENDING) ({ showPass = true }) else null,
                onContinue = onExit
            )
        )

        if (showNote && note != null) {
            NoteFromTheCouple(note = note, onDismiss = { showNote = false })
        }

        if (rsvpPrompt) {
            RsvpAnswerPrompt(
                guestName = invitation.guestName,
                isSubmitting = pendingAttendance != null,
                onAccept = { pendingAttendance = true },
                onDecline = { pendingAttendance = false },
                onDismiss = { if (pendingAttendance == null) rsvpPrompt = false }
            )
        }
    }
}

/**
 * The RSVP question, asked over the invitation rather than instead of it.
 *
 * It is a sheet, not a screen, so the card the couple designed stays on screen while the guest
 * answers it.
 */
@Composable
private fun RsvpAnswerPrompt(
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
            .testTag("ivory-card-rsvp-prompt"),
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
                Text(
                    it,
                    fontSize = 13.sp,
                    color = WeddingIdentityPalette.Muted,
                    textAlign = TextAlign.Center
                )
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
                        .testTag("ivory-card-rsvp-accept")
                )
                Text(
                    "Regretfully decline",
                    fontSize = 14.sp,
                    color = WeddingIdentityPalette.Muted,
                    modifier = Modifier
                        .clickable(onClick = onDecline)
                        .padding(vertical = 8.dp, horizontal = 20.dp)
                        .testTag("ivory-card-rsvp-decline")
                )
            }
        }
    }
}

@Composable
private fun WewedInvitationSplash() {
    var appeared by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(
        targetValue = if (appeared) 1f else 0.94f,
        animationSpec = tween(650),
        label = "wewed-splash-scale"
    )
    val alpha by animateFloatAsState(
        targetValue = if (appeared) 1f else 0f,
        animationSpec = tween(650),
        label = "wewed-splash-alpha"
    )

    LaunchedEffect(Unit) { appeared = true }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WeddingIdentityPalette.Ivory)
            .testTag("guest-journey-splash"),
        contentAlignment = Alignment.Center
    ) {
        WeddingOrnamentBackdrop(
            modifier = Modifier.matchParentSize(),
            alpha = 0.11f
        )

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp),
            modifier = Modifier
                .padding(28.dp)
                .graphicsLayer {
                    scaleX = scale
                    scaleY = scale
                    this.alpha = alpha
                    translationY = if (appeared) 0f else 18f
                }
        ) {
            WeddingBrandMark()
            Text(
                "Wewed",
                fontSize = 42.sp,
                fontWeight = FontWeight.Medium,
                fontFamily = FontFamily.Serif,
                color = WeddingIdentityPalette.Ink
            )
            Text(
                "PLAN  •  CONNECT  •  CELEBRATE",
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 2.4.sp,
                color = WeddingIdentityPalette.Muted,
                textAlign = TextAlign.Center
            )
            Box(
                modifier = Modifier
                    .width(if (appeared) 94.dp else 26.dp)
                    .height(1.5.dp)
                    .background(WeddingIdentityPalette.Champagne.copy(alpha = 0.72f))
            )
            Text(
                "Weddings Made More Meaningful",
                fontSize = 18.sp,
                fontFamily = FontFamily.Serif,
                color = WeddingIdentityPalette.Ink,
                textAlign = TextAlign.Center
            )
        }
    }
}

/**
 * The couple's own note, shown over the card.
 *
 * It is offered only when `wedding.invitationCardMessage` is actually set. An invitation that
 * always has "a note from us" would be inventing words on the couple's behalf.
 */
@Composable
private fun NoteFromTheCouple(note: String, onDismiss: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.45f))
            .clickable(onClick = onDismiss)
            .testTag("ivory-card-note-sheet"),
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

/**
 * Hands the wedding to the phone's calendar.
 *
 * An insert intent, not a silent write: the guest sees the event and saves it themselves, and the
 * app never needs calendar permissions.
 */
private fun addWeddingToCalendar(context: android.content.Context, invitation: InvitationContext) {
    val startMillis = parseWeddingInstant(invitation.weddingDate) ?: return
    val intent = Intent(Intent.ACTION_INSERT)
        .setData(CalendarContract.Events.CONTENT_URI)
        .putExtra(CalendarContract.Events.TITLE, invitation.coupleNames)
        .putExtra(CalendarContract.Events.EVENT_LOCATION, invitation.venueName)
        .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, startMillis)
        .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, startMillis + 6 * 60 * 60 * 1000L)
    runCatching { context.startActivity(intent) }
}

/** Opens the couple's own map link where they set one, and a venue search where they did not. */
private fun openVenueLocation(
    context: android.content.Context,
    invitation: InvitationContext,
    venueMapUrl: String?
) {
    val url = venueMapUrl?.takeIf { it.isNotBlank() }
        ?: "geo:0,0?q=" + Uri.encode("${invitation.venueName}, ${invitation.venueCity}")
    openExternal(context, url)
}

private fun openExternal(context: android.content.Context, url: String) {
    runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
}

/** The graph writes ISO; older fixtures write a space separator. Both are the same instant. */
private fun parseWeddingInstant(raw: String): Long? {
    val patterns = listOf(
        "yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd'T'HH:mm", "yyyy-MM-dd"
    )
    patterns.forEach { pattern ->
        runCatching {
            java.text.SimpleDateFormat(pattern, java.util.Locale.US).parse(raw.trim())
        }.getOrNull()?.let { return it.time }
    }
    return null
}
