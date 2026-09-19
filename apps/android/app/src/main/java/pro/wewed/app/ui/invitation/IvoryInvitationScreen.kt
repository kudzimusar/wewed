package pro.wewed.app.ui.invitation

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import pro.wewed.app.R
import pro.wewed.app.models.InvitationContext
import pro.wewed.app.models.VenueLocation
import pro.wewed.app.models.WeddingPass
import pro.wewed.app.theme.WeddingIdentityPalette
import pro.wewed.app.theme.WeddingMonogram
import pro.wewed.app.ui.shared.Formatting
import pro.wewed.app.ui.shared.MinTouchTarget
import pro.wewed.app.ui.shared.OpenInMapsButton

/** Who is looking at the invitation decides whether the reply buttons do anything. */
sealed interface InvitationMode {
    /** A guest replying to their own invitation. */
    data class Guest(
        val respond: suspend (attending: Boolean) -> WeddingPass,
        val onViewPass: () -> Unit
    ) : InvitationMode

    /** The couple previewing what guests see. The reply buttons never change any guest. */
    data object Preview : InvitationMode
}

private enum class ReplyState { NONE, ACCEPTED, DECLINED }

@Composable
fun IvoryInvitationScreen(
    invitation: InvitationContext,
    mode: InvitationMode,
    fallbackVenue: VenueLocation? = null,
    onClose: (() -> Unit)? = null
) {
    val scope = rememberCoroutineScope()
    var showDetails by remember { mutableStateOf(false) }
    var reply by remember(invitation.guestId) {
        mutableStateOf(if (mode is InvitationMode.Guest && invitation.isConfirmed) ReplyState.ACCEPTED else ReplyState.NONE)
    }
    var submitting by remember { mutableStateOf(false) }
    var problem by remember { mutableStateOf<String?>(null) }
    var previewNote by remember { mutableStateOf<String?>(null) }

    fun respond(attending: Boolean) {
        when (mode) {
            InvitationMode.Preview -> {
                previewNote = if (attending) {
                    "Preview only. In a guest's own invitation, Accept confirms their place. No reply was recorded."
                } else {
                    "Preview only. In a guest's own invitation, Decline sends their regrets. No reply was recorded."
                }
            }
            is InvitationMode.Guest -> {
                if (submitting) return
                submitting = true
                problem = null
                scope.launch {
                    try {
                        mode.respond(attending)
                        reply = if (attending) ReplyState.ACCEPTED else ReplyState.DECLINED
                    } catch (_: Exception) {
                        problem = "Your reply couldn't be sent. Please try again."
                    } finally {
                        submitting = false
                    }
                }
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WeddingIdentityPalette.Ivory)
            .testTag("ivory-invitation-root")
    ) {
        Image(
            painter = painterResource(R.drawable.ornament_frame),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize().alpha(0.07f)
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            InvitationHeader(onClose)

            if (mode == InvitationMode.Preview) {
                Text(
                    "This is how your guests see their invitation. Guests reply from their own invitation.",
                    color = WeddingIdentityPalette.Ink,
                    fontSize = 15.sp,
                    lineHeight = 21.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFFFFF4DE))
                        .border(1.dp, Color(0xFFE8C98E), RoundedCornerShape(12.dp))
                        .padding(12.dp)
                        .testTag("invitation-preview-notice")
                )
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(24.dp))
                    .background(WeddingIdentityPalette.IvorySoft)
                    .border(1.dp, WeddingIdentityPalette.Champagne.copy(alpha = 0.70f), RoundedCornerShape(24.dp))
            ) {
                Image(
                    painter = painterResource(R.drawable.ornament_frame),
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.matchParentSize().alpha(0.15f)
                )
                Column(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 22.dp, vertical = 30.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    InvitationCardIdentity(invitation)
                    OpenInMapsButton(
                        venue = invitation.venue,
                        fallback = fallbackVenue,
                        tag = "invitation-open-maps"
                    )
                    if (showDetails) InvitationDetailPanel(invitation)

                    when (reply) {
                        ReplyState.ACCEPTED -> AcceptedState(
                            onViewPass = (mode as? InvitationMode.Guest)?.onViewPass
                        )
                        ReplyState.DECLINED -> DeclinedState(onChangeReply = { reply = ReplyState.NONE })
                        ReplyState.NONE -> ReplyActions(
                            submitting = submitting,
                            showDetails = showDetails,
                            onAccept = { respond(true) },
                            onDecline = { respond(false) },
                            onToggleDetails = { showDetails = !showDetails }
                        )
                    }

                    previewNote?.let {
                        Text(
                            it,
                            color = WeddingIdentityPalette.Ink,
                            fontSize = 15.sp,
                            lineHeight = 21.sp,
                            textAlign = TextAlign.Center,
                            modifier = Modifier
                                .testTag("invitation-preview-rsvp-note")
                                .semantics { liveRegion = LiveRegionMode.Polite }
                        )
                    }
                    problem?.let {
                        Text(
                            it,
                            color = Color(0xFF9B1C1C),
                            fontSize = 15.sp,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@Composable
private fun InvitationHeader(onClose: (() -> Unit)?) {
    Box(modifier = Modifier.fillMaxWidth().heightIn(min = MinTouchTarget)) {
        Text(
            "You’re Invited",
            color = WeddingIdentityPalette.Ink,
            fontFamily = FontFamily.Serif,
            fontWeight = FontWeight.SemiBold,
            fontSize = 20.sp,
            modifier = Modifier.align(Alignment.Center)
        )
        if (onClose != null) {
            IconButton(
                onClick = onClose,
                modifier = Modifier.align(Alignment.CenterStart).testTag("invitation-close")
            ) {
                Icon(Icons.Default.ChevronLeft, contentDescription = "Close invitation", tint = WeddingIdentityPalette.Ink)
            }
        }
    }
}

@Composable
private fun InvitationCardIdentity(invitation: InvitationContext) {
    WeddingMonogram(invitation.coupleNames, sizeSp = 54)
    Text(
        invitation.coupleNames,
        color = WeddingIdentityPalette.Ink,
        fontFamily = FontFamily.Serif,
        fontStyle = FontStyle.Italic,
        fontSize = 29.sp,
        textAlign = TextAlign.Center
    )
    Text(
        "TOGETHER WITH OUR FAMILIES\nWE INVITE YOU TO CELEBRATE\nOUR WEDDING",
        color = WeddingIdentityPalette.Ink.copy(alpha = 0.86f),
        fontSize = 12.sp,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 1.4.sp,
        textAlign = TextAlign.Center,
        lineHeight = 19.sp
    )
    HorizontalDivider(modifier = Modifier.width(72.dp), color = WeddingIdentityPalette.Champagne)
    Text(
        Formatting.shortDate(invitation.weddingDate).uppercase(),
        color = WeddingIdentityPalette.ChampagneDeep,
        fontFamily = FontFamily.Serif,
        fontWeight = FontWeight.Medium,
        fontSize = 23.sp
    )
    Text(
        listOf(invitation.venueName, invitation.venueCity).filter { it.isNotBlank() }.joinToString(" · ").uppercase(),
        color = WeddingIdentityPalette.Muted,
        fontSize = 12.sp,
        fontWeight = FontWeight.Medium,
        letterSpacing = 1.4.sp,
        textAlign = TextAlign.Center
    )
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text("Prepared for", color = WeddingIdentityPalette.Muted, fontSize = 13.sp)
        Text(
            invitation.guestName,
            color = WeddingIdentityPalette.Ink,
            fontFamily = FontFamily.Serif,
            fontWeight = FontWeight.SemiBold,
            fontSize = 20.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.testTag("invitation-guest-name")
        )
        Text("Party of ${invitation.partySize}", color = WeddingIdentityPalette.Muted, fontSize = 14.sp)
    }
}

@Composable
private fun InvitationDetailPanel(invitation: InvitationContext) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White.copy(alpha = 0.72f))
            .padding(12.dp)
            .testTag("ivory-details-panel"),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        DetailRow(Icons.Default.Place, listOf(invitation.venueName, invitation.venueCity).filter { it.isNotBlank() }.joinToString(", "))
        DetailRow(Icons.Default.CalendarToday, Formatting.dateAndTime(invitation.weddingDate))
    }
}

@Composable
private fun DetailRow(icon: androidx.compose.ui.graphics.vector.ImageVector, text: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, tint = WeddingIdentityPalette.ChampagneDeep, modifier = Modifier.size(18.dp))
        Spacer(modifier = Modifier.width(8.dp))
        Text(text, color = WeddingIdentityPalette.Ink, fontSize = 15.sp)
    }
}

@Composable
private fun ReplyActions(
    submitting: Boolean,
    showDetails: Boolean,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
    onToggleDetails: () -> Unit
) {
    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Button(
            onClick = onAccept,
            enabled = !submitting,
            modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp).testTag("ivory-rsvp-accept"),
            shape = RoundedCornerShape(13.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
            contentPadding = PaddingValues(0.dp)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 52.dp)
                    .background(Brush.horizontalGradient(listOf(WeddingIdentityPalette.ChampagneDeep, WeddingIdentityPalette.Champagne))),
                contentAlignment = Alignment.Center
            ) {
                if (submitting) {
                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(22.dp), strokeWidth = 2.dp)
                } else {
                    Text("Accept", color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
                }
            }
        }
        OutlinedButton(
            onClick = onDecline,
            enabled = !submitting,
            modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp).testTag("ivory-rsvp-decline"),
            shape = RoundedCornerShape(13.dp),
            border = BorderStroke(1.dp, WeddingIdentityPalette.Champagne),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = WeddingIdentityPalette.Ink)
        ) {
            Text("Decline", fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
        }
        TextButton(
            onClick = onToggleDetails,
            modifier = Modifier.fillMaxWidth().heightIn(min = MinTouchTarget).testTag("ivory-details-toggle")
        ) {
            Text(
                if (showDetails) "Hide details" else "View details",
                color = WeddingIdentityPalette.ChampagneDeep,
                fontWeight = FontWeight.SemiBold,
                fontSize = 16.sp
            )
        }
    }
}

@Composable
private fun AcceptedState(onViewPass: (() -> Unit)?) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(WeddingIdentityPalette.IvorySoft)
            .border(1.dp, WeddingIdentityPalette.Hairline, RoundedCornerShape(18.dp))
            .padding(16.dp)
            .testTag("invitation-accepted")
            .semantics { liveRegion = LiveRegionMode.Polite },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.Verified, contentDescription = null, tint = WeddingIdentityPalette.Forest)
            Spacer(modifier = Modifier.width(8.dp))
            Text("You accepted. Your place is confirmed.", color = WeddingIdentityPalette.Forest, fontWeight = FontWeight.Bold, fontSize = 16.sp)
        }
        if (onViewPass != null) {
            Button(
                onClick = onViewPass,
                modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp).testTag("ivory-view-wedding-pass"),
                colors = ButtonDefaults.buttonColors(containerColor = WeddingIdentityPalette.Forest),
                shape = RoundedCornerShape(13.dp)
            ) {
                Icon(Icons.Default.QrCode, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("View my pass", fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
            }
        }
    }
}

@Composable
private fun DeclinedState(onChangeReply: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(WeddingIdentityPalette.IvorySoft)
            .border(1.dp, WeddingIdentityPalette.Hairline, RoundedCornerShape(18.dp))
            .padding(16.dp)
            .testTag("invitation-declined")
            .semantics { liveRegion = LiveRegionMode.Polite },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Icon(Icons.Default.FavoriteBorder, contentDescription = null, tint = WeddingIdentityPalette.ChampagneDeep)
        Text("You declined. Your reply was sent.", color = WeddingIdentityPalette.Ink, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
        Text(
            "Thank you for letting the couple know. A pass is only issued to guests who accept.",
            color = WeddingIdentityPalette.Muted,
            fontSize = 14.sp,
            textAlign = TextAlign.Center
        )
        TextButton(
            onClick = onChangeReply,
            modifier = Modifier.heightIn(min = MinTouchTarget).testTag("ivory-change-reply")
        ) {
            Text("Change my reply", color = WeddingIdentityPalette.ChampagneDeep, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
        }
    }
}
