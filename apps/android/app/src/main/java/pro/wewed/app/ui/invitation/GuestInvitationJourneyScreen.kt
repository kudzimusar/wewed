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
import pro.wewed.app.models.GuestJourneyReference
import pro.wewed.app.models.GuestJourneyStage
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.theme.WewedColors
import pro.wewed.app.theme.WeddingBrandMark
import pro.wewed.app.theme.WeddingIdentityPalette
import pro.wewed.app.theme.WeddingOrnamentBackdrop
import pro.wewed.app.models.WeddingPass
import pro.wewed.app.ui.pass.WeddingReferencePassScreen

/**
 * Canonical guest entry sequence for the shadow-real-wedding sprint:
 * Wewed splash -> Ivory Floral Gold invitation -> RSVP -> Wedding Pass.
 *
 * This screen is intentionally isolated from the default GuestShell until
 * local compile and UI qualification are complete.
 */
@Composable
fun GuestInvitationJourneyScreen(
    reference: GuestJourneyReference,
    appViewModel: AppViewModel,
    onExit: () -> Unit = {}
) {
    var stage by remember(reference) { mutableStateOf(reference.initialStage) }
    var confirmedPass by remember(reference) { mutableStateOf<WeddingPass?>(null) }

    LaunchedEffect(stage) {
        if (stage == GuestJourneyStage.SPLASH) {
            delay(1050)
            stage = if (reference.invitation.isConfirmed) {
                GuestJourneyStage.CONFIRMED_ATTENDING
            } else {
                GuestJourneyStage.INVITATION
            }
        }
    }

    when (stage) {
        GuestJourneyStage.SPLASH -> WewedInvitationSplash()
        GuestJourneyStage.INVITATION -> IvoryInvitationScreen(
            invitation = reference.invitation,
            appViewModel = appViewModel,
            onRsvpConfirmed = { pass ->
                confirmedPass = pass
                stage = GuestJourneyStage.CONFIRMED_ATTENDING
            },
            onClose = {},
            allowsClose = false,
            onRsvpDeclined = {
                stage = GuestJourneyStage.DECLINED
            }
        )
        GuestJourneyStage.CONFIRMED_ATTENDING -> Box(modifier = Modifier.fillMaxSize()) {
            WeddingReferencePassScreen(
                appViewModel = appViewModel,
                onOpenScanner = {},
                providedPass = confirmedPass
            )
            TextButton(
                onClick = onExit,
                modifier = Modifier.align(Alignment.TopEnd).padding(12.dp).testTag("guest-journey-done")
            ) {
                Text("Done", fontWeight = FontWeight.SemiBold, color = WewedColors.Emerald)
            }
        }
        GuestJourneyStage.DECLINED -> DeclinedGuestStage(onExit)
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

@Composable
private fun DeclinedGuestStage(onExit: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WewedColors.Ivory)
            .padding(28.dp)
            .testTag("guest-journey-declined"),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("♡", fontSize = 38.sp, color = WewedColors.Gold)
            Text("Thank you for responding", fontSize = 20.sp, fontWeight = FontWeight.Bold)
            Text(
                "Your RSVP response has been recorded. A Wedding Pass is only available to confirmed attending guests.",
                fontSize = 13.sp,
                color = Color.Gray,
                textAlign = TextAlign.Center
            )
            TextButton(onClick = onExit) {
                Text("Return to Wedding", color = WewedColors.Emerald, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}
