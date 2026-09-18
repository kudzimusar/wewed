package pro.wewed.app.ui.invitation

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.scaleIn
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import pro.wewed.app.models.InvitationContext
import pro.wewed.app.models.WeddingPass
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.theme.WewedColors
import pro.wewed.app.theme.WewedRadius
import pro.wewed.app.theme.WewedSpacing

private val StageBackground = Color(0xFF17130F)
private val IvoryPaper = Color(0xFFFBF5E9)
private val DeepInk = Color(0xFF42372F)

/**
 * Premium native Jetpack Compose Ivory Floral Gold invitation experience.
 * Unfolds with celebratory reveal and directly establishes the Wewed Wedding Pass.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun IvoryInvitationScreen(
    invitation: InvitationContext,
    appViewModel: AppViewModel,
    onRsvpConfirmed: (WeddingPass) -> Unit,
    onClose: () -> Unit,
    allowsClose: Boolean = true,
    onRsvpDeclined: () -> Unit = {}
) {
    var isRevealed by remember { mutableStateOf(false) }
    var rsvpSubmitted by remember { mutableStateOf(false) }
    var declined by remember { mutableStateOf(false) }
    var isSubmitting by remember { mutableStateOf(false) }
    var generatedPass by remember { mutableStateOf<WeddingPass?>(null) }
    val scope = rememberCoroutineScope()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Wedding Invitation", color = WewedColors.Gold, fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    if (allowsClose) {
                        IconButton(onClick = onClose) {
                            Icon(Icons.Default.Close, contentDescription = "Close", tint = WewedColors.Gold)
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = StageBackground)
            )
        },
        containerColor = StageBackground,
        modifier = Modifier.testTag("ivory-invitation-root")
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            if (!isRevealed) {
                // Closed Ceremonial Envelope
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 16.dp),
                    shape = RoundedCornerShape(WewedRadius.lg),
                    colors = CardDefaults.cardColors(containerColor = IvoryPaper),
                    elevation = CardDefaults.cardElevation(12.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Monogram seal
                        Box(
                            modifier = Modifier
                                .size(68.dp)
                                .background(WewedColors.Gold, CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                invitation.coupleNames
                                    .split("&")
                                    .mapNotNull { it.trim().firstOrNull()?.uppercaseChar() }
                                    .joinToString("&"),
                                fontWeight = FontWeight.Bold,
                                fontSize = 22.sp,
                                color = Color.Black
                            )
                        }

                        Text(
                            invitation.coupleNames.uppercase(),
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            letterSpacing = 2.sp,
                            color = DeepInk
                        )

                        Text(
                            "A PERSONAL INVITATION FOR",
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp,
                            letterSpacing = 2.sp,
                            color = WewedColors.GoldDark
                        )

                        Text(
                            invitation.guestName,
                            fontWeight = FontWeight.Bold,
                            fontSize = 24.sp,
                            color = DeepInk,
                            textAlign = TextAlign.Center
                        )

                        Text(
                            "${invitation.partySize} Seats Reserved in Your Honour",
                            fontSize = 13.sp,
                            color = Color.Gray
                        )

                        Spacer(modifier = Modifier.height(16.dp))

                        Button(
                            onClick = { isRevealed = true },
                            colors = ButtonDefaults.buttonColors(containerColor = WewedColors.Gold),
                            shape = RoundedCornerShape(WewedRadius.pill),
                            modifier = Modifier.padding(bottom = 16.dp).testTag("ivory-invitation-open")
                        ) {
                            Icon(Icons.Default.Mail, contentDescription = null, tint = Color.Black)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Open Invitation", color = Color.Black, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                    }
                }
            } else {
                // Unfolded Premium Invitation Card
                AnimatedVisibility(
                    visible = isRevealed,
                    enter = fadeIn() + scaleIn(initialScale = 0.92f)
                ) {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.5.dp, WewedColors.Gold.copy(alpha = 0.5f), RoundedCornerShape(WewedRadius.lg)),
                        shape = RoundedCornerShape(WewedRadius.lg),
                        colors = CardDefaults.cardColors(containerColor = IvoryPaper),
                        elevation = CardDefaults.cardElevation(16.dp)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            Text(
                                "TOGETHER WITH THEIR FAMILIES",
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                letterSpacing = 2.sp,
                                color = WewedColors.GoldDark
                            )

                            Text(
                                invitation.coupleNames,
                                fontWeight = FontWeight.Bold,
                                fontSize = 30.sp,
                                color = DeepInk,
                                textAlign = TextAlign.Center
                            )

                            HorizontalDivider(
                                modifier = Modifier.width(80.dp),
                                color = WewedColors.Gold,
                                thickness = 2.dp
                            )

                            Text(
                                "REQUEST THE PLEASURE OF YOUR COMPANY\nTO CELEBRATE THEIR MARRIAGE",
                                fontSize = 11.sp,
                                letterSpacing = 1.5.sp,
                                color = DeepInk.copy(alpha = 0.75f),
                                textAlign = TextAlign.Center,
                                lineHeight = 18.sp
                            )

                            // Event Details Box
                            Surface(
                                shape = RoundedCornerShape(WewedRadius.md),
                                color = Color.White.copy(alpha = 0.7f),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(
                                    modifier = Modifier.padding(16.dp),
                                    verticalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Default.CalendarToday, contentDescription = null, tint = WewedColors.Gold, modifier = Modifier.size(18.dp))
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(invitation.weddingDate, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = DeepInk)
                                    }
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Default.Schedule, contentDescription = null, tint = WewedColors.Gold, modifier = Modifier.size(18.dp))
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text("Ceremony at 14:00 (Doors open 13:15)", fontSize = 13.sp, color = DeepInk)
                                    }
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Default.Place, contentDescription = null, tint = WewedColors.Gold, modifier = Modifier.size(18.dp))
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text("${invitation.venueName} • ${invitation.venueCity}", fontSize = 13.sp, color = DeepInk)
                                    }
                                }
                            }

                            // RSVP Section
                            if (!rsvpSubmitted && !declined) {
                                Column(
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.spacedBy(12.dp),
                                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
                                ) {
                                    Text("Kindly respond to continue your wedding experience", fontSize = 12.sp, color = Color.Gray)

                                    Button(
                                        onClick = {
                                            isSubmitting = true
                                            scope.launch {
                                                try {
                                                    val pass = appViewModel.repository.confirmRsvp(
                                                        invitation.weddingSlug,
                                                        invitation.guestToken,
                                                        true
                                                    )
                                                    generatedPass = pass
                                                    rsvpSubmitted = true
                                                    declined = false
                                                } finally {
                                                    isSubmitting = false
                                                }
                                            }
                                        },
                                        colors = ButtonDefaults.buttonColors(containerColor = WewedColors.Gold),
                                        shape = RoundedCornerShape(WewedRadius.pill),
                                        modifier = Modifier.fillMaxWidth().height(48.dp).testTag("ivory-rsvp-accept"),
                                        enabled = !isSubmitting
                                    ) {
                                        if (isSubmitting) {
                                            CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.Black)
                                        } else {
                                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color.Black)
                                            Spacer(modifier = Modifier.width(8.dp))
                                            Text("Accept with Pleasure", color = Color.Black, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                        }
                                    }

                                    OutlinedButton(
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
                                        modifier = Modifier.fillMaxWidth().height(46.dp).testTag("ivory-rsvp-decline"),
                                        shape = RoundedCornerShape(WewedRadius.pill),
                                        colors = ButtonDefaults.outlinedButtonColors(contentColor = DeepInk),
                                        enabled = !isSubmitting
                                    ) {
                                        Text("Decline with Regret", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                                    }
                                }
                            } else if (declined) {
                                Column(
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.spacedBy(10.dp),
                                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
                                ) {
                                    Icon(Icons.Default.FavoriteBorder, contentDescription = null, tint = WewedColors.Gold)
                                    Text("Response Recorded", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = DeepInk)
                                    Text(
                                        "Thank you for letting ${invitation.coupleNames}'s wedding team know. No admission pass is issued for a declined RSVP.",
                                        fontSize = 12.sp,
                                        color = Color.Gray,
                                        textAlign = TextAlign.Center
                                    )
                                }
                            } else {
                                // Confirmed State
                                Column(
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.spacedBy(12.dp),
                                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Default.Verified, contentDescription = null, tint = WewedColors.Success)
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text("RSVP Confirmed", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = WewedColors.Success)
                                    }

                                    Text(
                                        "We are thrilled to celebrate with you!",
                                        fontSize = 13.sp,
                                        color = DeepInk
                                    )

                                    generatedPass?.let { pass ->
                                        Button(
                                            onClick = {
                                                onRsvpConfirmed(pass)
                                                onClose()
                                            },
                                            colors = ButtonDefaults.buttonColors(containerColor = WewedColors.Gold),
                                            shape = RoundedCornerShape(WewedRadius.pill),
                                            modifier = Modifier.fillMaxWidth().height(48.dp).testTag("ivory-view-wedding-pass")
                                        ) {
                                            Icon(Icons.Default.QrCode, contentDescription = null, tint = Color.Black)
                                            Spacer(modifier = Modifier.width(8.dp))
                                            Text("View My Wedding Pass", color = Color.Black, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
