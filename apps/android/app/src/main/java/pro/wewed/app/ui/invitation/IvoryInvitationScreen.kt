package pro.wewed.app.ui.invitation

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
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
    var isSubmitting by remember { mutableStateOf(false) }
    var generatedPass by remember { mutableStateOf<WeddingPass?>(null) }
    val scope = rememberCoroutineScope()

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
            modifier = Modifier.fillMaxSize().alpha(0.16f)
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            if (allowsClose) {
                Row(modifier = Modifier.fillMaxWidth()) {
                    IconButton(
                        onClick = onClose,
                        modifier = Modifier
                            .size(42.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.82f))
                    ) {
                        Icon(
                            Icons.Default.ChevronLeft,
                            contentDescription = "Close invitation",
                            tint = WeddingIdentityPalette.Ink
                        )
                    }
                }
            }

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
                    modifier = Modifier.matchParentSize().alpha(0.42f)
                )

                Column(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 34.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Text(
                        "You’re Invited",
                        color = WeddingIdentityPalette.Ink,
                        fontFamily = FontFamily.Serif,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 18.sp
                    )

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

                    if (showDetails) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color.White.copy(alpha = 0.72f))
                                .padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    Icons.Default.Place,
                                    contentDescription = null,
                                    tint = WeddingIdentityPalette.ChampagneDeep,
                                    modifier = Modifier.size(17.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    invitation.venueName,
                                    color = WeddingIdentityPalette.Ink,
                                    fontSize = 12.sp
                                )
                            }

                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    Icons.Default.CalendarToday,
                                    contentDescription = null,
                                    tint = WeddingIdentityPalette.ChampagneDeep,
                                    modifier = Modifier.size(17.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    invitation.weddingDate,
                                    color = WeddingIdentityPalette.Ink,
                                    fontSize = 12.sp
                                )
                            }
                        }
                    }
                }
            }

            when {
                declined -> {
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

                rsvpSubmitted && generatedPass != null -> {
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
                            onClick = {
                                generatedPass?.let(onRsvpConfirmed)
                                if (allowsClose) onClose()
                            },
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

                else -> {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Button(
                            onClick = {
                                isSubmitting = true
                                scope.launch {
                                    try {
                                        generatedPass = appViewModel.repository.confirmRsvp(
                                            invitation.weddingSlug,
                                            invitation.guestToken,
                                            true
                                        )
                                        rsvpSubmitted = true
                                        declined = false
                                    } finally {
                                        isSubmitting = false
                                    }
                                }
                            },
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
                            onClick = { showDetails = !showDetails },
                            modifier = Modifier.fillMaxWidth().height(48.dp),
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

                        TextButton(
                            onClick = {
                                isSubmitting = true
                                scope.launch {
                                    try {
                                        appViewModel.repository.confirmRsvp(
                                            invitation.weddingSlug,
                                            invitation.guestToken,
                                            false
                                        )
                                        generatedPass = null
                                        rsvpSubmitted = false
                                        declined = true
                                        onRsvpDeclined()
                                    } finally {
                                        isSubmitting = false
                                    }
                                }
                            },
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
                }
            }

            Spacer(modifier = Modifier.height(20.dp))
        }
    }
}

private fun displayInvitationDate(raw: String): String {
    val parser = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)
    val date = runCatching { parser.parse(raw) }.getOrNull() ?: return raw
    return SimpleDateFormat("dd MMM yyyy", Locale.US).format(date).uppercase()
}
