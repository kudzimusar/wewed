package pro.wewed.app.ui.invitation

import android.content.Intent
import android.net.Uri
import androidx.compose.ui.platform.LocalContext
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.R
import pro.wewed.app.models.InvitationContext
import pro.wewed.app.models.WeddingPass
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.theme.WeddingIdentityPalette
import pro.wewed.app.theme.WeddingMonogram
import java.text.SimpleDateFormat
import java.util.Locale

@Composable
fun IvoryInvitationScreen(
    invitation: InvitationContext,
    appViewModel: AppViewModel,
    onRsvpConfirmed: (WeddingPass) -> Unit,
    onClose: () -> Unit,
    allowsClose: Boolean = true,
    onRsvpDeclined: () -> Unit = {}
) {
    var showDetails by remember { mutableStateOf(false) }
    var rsvpSubmitted by remember { mutableStateOf(false) }
    var declined by remember { mutableStateOf(false) }
    var generatedPass by remember { mutableStateOf<WeddingPass?>(null) }
    var pendingAttendance by remember { mutableStateOf<Boolean?>(null) }

    LaunchedEffect(pendingAttendance) {
        val attending = pendingAttendance ?: return@LaunchedEffect
        try {
            val pass = appViewModel.repository.confirmRsvp(
                invitation.weddingSlug,
                invitation.guestToken,
                attending
            )
            if (attending) {
                generatedPass = pass
                rsvpSubmitted = true
                declined = false
            } else {
                generatedPass = null
                rsvpSubmitted = false
                declined = true
                onRsvpDeclined()
            }
        } catch (_: Throwable) {
            // Keep the invitation actionable when a Shadow RSVP operation fails.
        } finally {
            pendingAttendance = null
        }
    }

    IvoryInvitationScaffold(
        invitation = invitation,
        showDetails = showDetails,
        declined = declined,
        rsvpSubmitted = rsvpSubmitted,
        generatedPass = generatedPass,
        isSubmitting = pendingAttendance != null,
        allowsClose = allowsClose,
        onClose = onClose,
        onToggleDetails = { showDetails = !showDetails },
        onAccept = { pendingAttendance = true },
        onDecline = { pendingAttendance = false },
        onViewPass = {
            generatedPass?.let(onRsvpConfirmed)
            if (allowsClose) onClose()
        }
    )
}

@Composable
private fun IvoryInvitationScaffold(
    invitation: InvitationContext,
    showDetails: Boolean,
    declined: Boolean,
    rsvpSubmitted: Boolean,
    generatedPass: WeddingPass?,
    isSubmitting: Boolean,
    allowsClose: Boolean,
    onClose: () -> Unit,
    onToggleDetails: () -> Unit,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
    onViewPass: () -> Unit
) {
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
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            IvoryInvitationHeader(
                allowsClose = allowsClose,
                onClose = onClose
            )

            IvoryInvitationCard(
                invitation = invitation,
                showDetails = showDetails,
                declined = declined,
                rsvpSubmitted = rsvpSubmitted,
                generatedPass = generatedPass,
                isSubmitting = isSubmitting,
                allowsClose = allowsClose,
                onToggleDetails = onToggleDetails,
                onAccept = onAccept,
                onDecline = onDecline,
                onViewPass = onViewPass
            )

            Spacer(modifier = Modifier.height(20.dp))
        }
    }
}

@Composable
private fun IvoryInvitationHeader(
    allowsClose: Boolean,
    onClose: () -> Unit
) {
    Box(modifier = Modifier.fillMaxWidth()) {
        Text(
            "You’re Invited",
            color = WeddingIdentityPalette.Ink,
            fontFamily = FontFamily.Serif,
            fontWeight = FontWeight.SemiBold,
            fontSize = 18.sp,
            modifier = Modifier.align(Alignment.Center)
        )

        if (allowsClose) {
            IconButton(
                onClick = onClose,
                modifier = Modifier
                    .align(Alignment.CenterStart)
                    .size(42.dp)
            ) {
                Icon(
                    Icons.Default.ChevronLeft,
                    contentDescription = "Close invitation",
                    tint = WeddingIdentityPalette.Ink
                )
            }
        }
    }
}

@Composable
private fun IvoryInvitationCard(
    invitation: InvitationContext,
    showDetails: Boolean,
    declined: Boolean,
    rsvpSubmitted: Boolean,
    generatedPass: WeddingPass?,
    isSubmitting: Boolean,
    allowsClose: Boolean,
    onToggleDetails: () -> Unit,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
    onViewPass: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(WeddingIdentityPalette.IvorySoft)
            .border(
                1.dp,
                WeddingIdentityPalette.Champagne.copy(alpha = 0.70f),
                RoundedCornerShape(24.dp)
            )
    ) {
        Image(
            painter = painterResource(R.drawable.ornament_frame),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.matchParentSize().alpha(0.15f)
        )

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp, vertical = 34.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            InvitationCardIdentity(invitation)

            if (showDetails) {
                InvitationDetailPanel(invitation)
            }

            InvitationResponseArea(
                showDetails = showDetails,
                declined = declined,
                rsvpSubmitted = rsvpSubmitted,
                hasGeneratedPass = generatedPass != null,
                isSubmitting = isSubmitting,
                allowsClose = allowsClose,
                onToggleDetails = onToggleDetails,
                onAccept = onAccept,
                onDecline = onDecline,
                onViewPass = onViewPass
            )
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
        fontSize = 10.sp,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 1.5.sp,
        textAlign = TextAlign.Center,
        lineHeight = 18.sp
    )

    HorizontalDivider(
        modifier = Modifier.width(72.dp),
        color = WeddingIdentityPalette.Champagne
    )

    Text(
        displayInvitationDate(invitation.weddingDate),
        color = WeddingIdentityPalette.ChampagneDeep,
        fontFamily = FontFamily.Serif,
        fontWeight = FontWeight.Medium,
        fontSize = 23.sp
    )

    Text(
        invitation.venueCity.uppercase(),
        color = WeddingIdentityPalette.Muted,
        fontSize = 10.sp,
        fontWeight = FontWeight.Medium,
        letterSpacing = 1.8.sp
    )

    Text(
        "For ${invitation.guestName} • Party of ${invitation.partySize}",
        color = WeddingIdentityPalette.Muted,
        fontSize = 11.sp
    )
}

@Composable
private fun InvitationDetailPanel(invitation: InvitationContext) {
    val context = LocalContext.current
    val queryAddress = "${invitation.venueName}, ${invitation.venueCity}".trim()
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White.copy(alpha = 0.72f))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        InvitationDetailRow(
            icon = Icons.Default.Place,
            text = "${invitation.venueName}, ${invitation.venueCity}"
        )
        InvitationDetailRow(
            icon = Icons.Default.CalendarToday,
            text = invitation.weddingDate
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.End
        ) {
            TextButton(
                onClick = {
                    try {
                        val encoded = Uri.encode(queryAddress)
                        val mapIntent = Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=$encoded"))
                        mapIntent.setPackage("com.google.android.apps.maps")
                        if (mapIntent.resolveActivity(context.packageManager) != null) {
                            context.startActivity(mapIntent)
                        } else {
                            val browserMap = Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/maps/search/?api=1&query=$encoded"))
                            context.startActivity(browserMap)
                        }
                    } catch (_: Exception) {
                        val browserMap = Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/maps/search/?api=1&query=${Uri.encode(queryAddress)}"))
                        context.startActivity(browserMap)
                    }
                },
                modifier = Modifier.testTag("invitation-open-maps")
            ) {
                Icon(
                    Icons.Default.Directions,
                    contentDescription = null,
                    tint = WeddingIdentityPalette.ChampagneDeep,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    "Open in Maps",
                    color = WeddingIdentityPalette.ChampagneDeep,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

@Composable
private fun InvitationDetailRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    text: String
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(
            icon,
            contentDescription = null,
            tint = WeddingIdentityPalette.ChampagneDeep,
            modifier = Modifier.size(17.dp)
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text,
            color = WeddingIdentityPalette.Ink,
            fontSize = 12.sp
        )
    }
}

@Composable
private fun InvitationResponseArea(
    showDetails: Boolean,
    declined: Boolean,
    rsvpSubmitted: Boolean,
    hasGeneratedPass: Boolean,
    isSubmitting: Boolean,
    allowsClose: Boolean,
    onToggleDetails: () -> Unit,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
    onViewPass: () -> Unit
) {
    when {
        declined -> InvitationDeclinedState()
        rsvpSubmitted && hasGeneratedPass -> InvitationConfirmedState(
            onViewPass = onViewPass
        )
        else -> InvitationActions(
            showDetails = showDetails,
            isSubmitting = isSubmitting,
            allowsClose = allowsClose,
            onToggleDetails = onToggleDetails,
            onAccept = onAccept,
            onDecline = onDecline
        )
    }
}

@Composable
private fun InvitationDeclinedState() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(WeddingIdentityPalette.IvorySoft)
            .border(
                1.dp,
                WeddingIdentityPalette.Hairline,
                RoundedCornerShape(18.dp)
            )
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Icon(
            Icons.Default.FavoriteBorder,
            contentDescription = null,
            tint = WeddingIdentityPalette.ChampagneDeep
        )
        Text(
            "Response Recorded",
            color = WeddingIdentityPalette.Ink,
            fontWeight = FontWeight.SemiBold
        )
        Text(
            "Thank you for letting the wedding team know.",
            color = WeddingIdentityPalette.Muted,
            fontSize = 12.sp,
            textAlign = TextAlign.Center
        )
    }
}

@Composable
private fun InvitationConfirmedState(
    onViewPass: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(WeddingIdentityPalette.IvorySoft)
            .border(
                1.dp,
                WeddingIdentityPalette.Hairline,
                RoundedCornerShape(18.dp)
            )
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                Icons.Default.Verified,
                contentDescription = null,
                tint = WeddingIdentityPalette.Forest
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                "RSVP Confirmed",
                color = WeddingIdentityPalette.Forest,
                fontWeight = FontWeight.Bold
            )
        }

        Button(
            onClick = onViewPass,
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
                .testTag("ivory-view-wedding-pass"),
            colors = ButtonDefaults.buttonColors(
                containerColor = WeddingIdentityPalette.Forest
            ),
            shape = RoundedCornerShape(13.dp)
        ) {
            Icon(Icons.Default.QrCode, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("View My Wedding Pass", fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun InvitationActions(
    showDetails: Boolean,
    isSubmitting: Boolean,
    allowsClose: Boolean,
    onToggleDetails: () -> Unit,
    onAccept: () -> Unit,
    onDecline: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Button(
            onClick = onAccept,
            enabled = !isSubmitting,
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp)
                .testTag("ivory-rsvp-accept"),
            shape = RoundedCornerShape(13.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color.Transparent
            ),
            contentPadding = PaddingValues(0.dp)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.horizontalGradient(
                            listOf(
                                WeddingIdentityPalette.ChampagneDeep,
                                WeddingIdentityPalette.Champagne
                            )
                        )
                    ),
                contentAlignment = Alignment.Center
            ) {
                if (isSubmitting) {
                    CircularProgressIndicator(
                        color = Color.White,
                        modifier = Modifier.size(20.dp),
                        strokeWidth = 2.dp
                    )
                } else {
                    Text(
                        "RSVP Now",
                        color = Color.White,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }

        OutlinedButton(
            onClick = onToggleDetails,
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
                .testTag("ivory-details-toggle"),
            shape = RoundedCornerShape(13.dp),
            border = androidx.compose.foundation.BorderStroke(
                1.dp,
                WeddingIdentityPalette.Champagne
            ),
            colors = ButtonDefaults.outlinedButtonColors(
                contentColor = WeddingIdentityPalette.Ink
            )
        ) {
            Text(
                if (showDetails) "Hide Details" else "View Details",
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp
            )
        }

        if (showDetails) {
            TextButton(
                onClick = onDecline,
                enabled = !isSubmitting,
                modifier = Modifier
                    .align(Alignment.CenterHorizontally)
                    .testTag("ivory-rsvp-decline")
            ) {
                Text(
                    "Decline with Regret",
                    color = WeddingIdentityPalette.Muted,
                    fontSize = 12.sp
                )
            }
        }

        if (!allowsClose) {
            Spacer(modifier = Modifier.height(2.dp))
        }
    }
}

private fun displayInvitationDate(raw: String): String {
    val parser = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)
    val date = runCatching { parser.parse(raw) }.getOrNull() ?: return raw
    return SimpleDateFormat("dd MMM yyyy", Locale.US).format(date).uppercase()
}
