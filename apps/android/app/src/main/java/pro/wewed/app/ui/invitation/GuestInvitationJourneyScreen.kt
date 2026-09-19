package pro.wewed.app.ui.invitation

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import pro.wewed.app.models.InvitationContext
import pro.wewed.app.models.VenueLocation
import pro.wewed.app.theme.WeddingBrandMark
import pro.wewed.app.theme.WeddingIdentityPalette
import pro.wewed.app.theme.WeddingOrnamentBackdrop

/**
 * The couple's preview of the guest invitation: the Wewed splash, then the ivory invitation in
 * preview mode. Nothing here can change a guest's reply.
 */
@Composable
fun InvitationPreviewJourney(
    invitation: InvitationContext,
    fallbackVenue: VenueLocation?,
    onExit: () -> Unit
) {
    var showSplash by remember(invitation.guestId) { mutableStateOf(true) }
    BackHandler(onBack = onExit)

    LaunchedEffect(invitation.guestId) {
        delay(1050)
        showSplash = false
    }

    if (showSplash) {
        WewedInvitationSplash()
    } else {
        IvoryInvitationScreen(
            invitation = invitation,
            mode = InvitationMode.Preview,
            fallbackVenue = fallbackVenue,
            onClose = onExit
        )
    }
}

@Composable
fun WewedInvitationSplash() {
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
                fontSize = 12.sp,
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
