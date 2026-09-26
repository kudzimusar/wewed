package pro.wewed.app.ui.entry

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import pro.wewed.app.theme.WewedLogo
import pro.wewed.app.theme.WeddingIdentityPalette
import pro.wewed.app.theme.WeddingOrnamentBackdrop

/**
 * Where the splash is going, which changes how it leaves.
 *
 * A splash that always exits the same way is a loader. One that leaves differently depending on
 * what it is handing over to reads as the product opening: an invitation is *revealed*, a
 * workspace is *entered*.
 */
enum class SplashDestination {
    /** An invitation is being presented. The stage settles and lifts, like a card being offered. */
    INVITATION,

    /** A returning member. The stage recedes and the workspace comes forward. */
    WORKSPACE,

    /** Someone new. The mark stays put and the welcome resolves around it. */
    WELCOME
}

/**
 * The Wewed opening.
 *
 * The first version faded a mark in, showed some text and cut to the next screen after a second.
 * That is an app loader, and it read as one. A wedding product's opening should feel composed —
 * unhurried, restrained, and clearly *presenting* something.
 *
 * The motion is staged rather than simultaneous, because simultaneity is what makes a fade feel
 * cheap: everything arriving at once carries no intent. Here each element waits for the one before
 * it, and nothing bounces, spins or overshoots:
 *
 *   1. the ivory stage settles, ornament breathing up from nothing
 *   2. the Wewed mark enters, rising slightly as it scales from 0.86
 *   3. the wordmark resolves — letter-spacing drawing IN rather than merely fading
 *   4. the champagne rule draws outward from the centre
 *   5. the payoff line lifts into place
 *   6. the whole stage yields to its destination, in the manner that destination deserves
 *
 * Total ~1.9s to hand-over. Long enough to read as deliberate; short enough that nobody waits.
 * If the destination is not ready by then, [onFinished] still fires: the splash hands over to an
 * honest loading state rather than holding the brand hostage to a slow query.
 */
@Composable
fun WewedAnimatedSplash(
    modifier: Modifier = Modifier,
    destination: SplashDestination = SplashDestination.WELCOME,
    onFinished: (() -> Unit)? = null
) {
    // Wedding-appropriate easing: a soft arrival with no overshoot. Anything springy reads as a
    // game loader, which is the opposite of what this surface is for.
    val silk = remember { CubicBezierEasing(0.22f, 0.61f, 0.36f, 1f) }

    val ornament = remember { Animatable(0f) }
    val markScale = remember { Animatable(0.86f) }
    val markAlpha = remember { Animatable(0f) }
    val markRise = remember { Animatable(26f) }
    val wordAlpha = remember { Animatable(0f) }
    val wordTracking = remember { Animatable(14f) }
    val ruleWidth = remember { Animatable(0f) }
    val payoffAlpha = remember { Animatable(0f) }
    val payoffRise = remember { Animatable(10f) }
    val stageScale = remember { Animatable(1f) }
    val stageAlpha = remember { Animatable(1f) }

    LaunchedEffect(Unit) {
        // 1 — the stage. The ornament comes up under everything so the mark never lands on bare white.
        launch { ornament.animateTo(1f, tween(900, easing = LinearOutSlowInEasing)) }

        // 2 — the mark enters.
        launch { markAlpha.animateTo(1f, tween(620, easing = FastOutSlowInEasing)) }
        launch { markRise.animateTo(0f, tween(760, easing = silk)) }
        markScale.animateTo(1f, tween(760, easing = silk))

        // 3 — the wordmark RESOLVES: the letters draw together rather than simply appearing.
        launch { wordAlpha.animateTo(1f, tween(520, easing = FastOutSlowInEasing)) }
        wordTracking.animateTo(0f, tween(700, easing = silk))

        // 4 — the rule draws outward from the centre.
        ruleWidth.animateTo(94f, tween(520, easing = silk))

        // 5 — the payoff lifts into place.
        launch { payoffRise.animateTo(0f, tween(480, easing = silk)) }
        payoffAlpha.animateTo(1f, tween(480, easing = FastOutSlowInEasing))

        delay(240)

        // 6 — hand over, in the manner the destination deserves.
        when (destination) {
            // An invitation is being presented: the stage lifts away, leaving the ivory and the
            // ornament for the card to arrive into. The continuity is the point — Wewed is
            // revealing the invitation, not being replaced by it.
            SplashDestination.INVITATION -> {
                launch { stageScale.animateTo(1.06f, tween(620, easing = silk)) }
                stageAlpha.animateTo(0f, tween(560, easing = FastOutSlowInEasing))
            }
            // A workspace is entered: the stage recedes slightly as the app comes forward.
            SplashDestination.WORKSPACE -> {
                launch { stageScale.animateTo(0.97f, tween(460, easing = silk)) }
                stageAlpha.animateTo(0f, tween(420, easing = FastOutSlowInEasing))
            }
            // The welcome resolves around the mark, so the stage simply yields.
            SplashDestination.WELCOME -> stageAlpha.animateTo(0f, tween(420, easing = FastOutSlowInEasing))
        }

        onFinished?.invoke()
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(WeddingIdentityPalette.Ivory)
            // TalkBack should announce the opening once, as a brand statement, rather than
            // reading five separate fragments of a logo, a wordmark and two taglines. iOS
            // combines the same children behind the same sentence.
            .semantics(mergeDescendants = true) {
                contentDescription =
                    "Wewed. Plan, connect, celebrate. Weddings made more meaningful."
            }
            .testTag("wewed-splash"),
        contentAlignment = Alignment.Center
    ) {
        WeddingOrnamentBackdrop(
            modifier = Modifier.matchParentSize(),
            alpha = 0.13f * ornament.value
        )

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp),
            modifier = Modifier
                .padding(28.dp)
                .graphicsLayer {
                    scaleX = stageScale.value
                    scaleY = stageScale.value
                    alpha = stageAlpha.value
                }
        ) {
            Box(
                modifier = Modifier.graphicsLayer {
                    scaleX = markScale.value
                    scaleY = markScale.value
                    alpha = markAlpha.value
                    translationY = markRise.value
                }
            ) {
                WewedLogo(size = 132)
            }

            Text(
                "Wewed",
                fontSize = 42.sp,
                fontWeight = FontWeight.Medium,
                fontFamily = FontFamily.Serif,
                color = WeddingIdentityPalette.Ink,
                letterSpacing = wordTracking.value.sp,
                modifier = Modifier.graphicsLayer { alpha = wordAlpha.value }
            )

            Text(
                "PLAN  •  CONNECT  •  CELEBRATE",
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 2.4.sp,
                color = WeddingIdentityPalette.Muted,
                textAlign = TextAlign.Center,
                modifier = Modifier.graphicsLayer { alpha = payoffAlpha.value }
            )

            Box(
                modifier = Modifier
                    .width(ruleWidth.value.dp)
                    .height(1.5.dp)
                    .background(WeddingIdentityPalette.Champagne.copy(alpha = 0.72f))
            )

            Text(
                "Weddings Made More Meaningful",
                fontSize = 18.sp,
                fontFamily = FontFamily.Serif,
                color = WeddingIdentityPalette.Ink,
                textAlign = TextAlign.Center,
                modifier = Modifier.graphicsLayer {
                    alpha = payoffAlpha.value
                    translationY = payoffRise.value
                }
            )
        }
    }
}
