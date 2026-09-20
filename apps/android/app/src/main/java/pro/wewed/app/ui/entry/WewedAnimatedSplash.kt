package pro.wewed.app.ui.entry

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
import pro.wewed.app.theme.WeddingBrandMark
import pro.wewed.app.theme.WeddingIdentityPalette
import pro.wewed.app.theme.WeddingOrnamentBackdrop

/**
 * The Wewed animated splash.
 *
 * This motion — the mark settling in, the rule drawing out from the centre — belonged only to the
 * guest invitation journey. Every other entry path either flashed a bare window or dropped
 * straight into a form, so the app had two different first impressions depending on how you opened
 * it. One identity, every path: icon launch, invitation link, returning session, new account.
 *
 * The OS launch screen before this is deliberately still, because the system draws it before any
 * application code runs. This is where the product's motion begins.
 *
 * Brief by design: long enough to read as intentional, short enough that nobody waits for it.
 */
@Composable
fun WewedAnimatedSplash(
    modifier: Modifier = Modifier,
    holdMillis: Long = 1_150,
    onFinished: (() -> Unit)? = null
) {
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
    val ruleWidth by animateFloatAsState(
        targetValue = if (appeared) 94f else 26f,
        animationSpec = tween(750),
        label = "wewed-splash-rule"
    )

    LaunchedEffect(Unit) {
        appeared = true
        if (onFinished != null) {
            delay(holdMillis)
            onFinished()
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(WeddingIdentityPalette.Ivory)
            .testTag("wewed-splash"),
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
                    .width(ruleWidth.dp)
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
