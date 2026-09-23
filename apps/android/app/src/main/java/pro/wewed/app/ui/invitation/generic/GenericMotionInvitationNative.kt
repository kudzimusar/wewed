package pro.wewed.app.ui.invitation.generic

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import pro.wewed.app.models.*
import pro.wewed.app.ui.invitation.ivory.*

/**
 * Native generic premium invitation renderer for Android Compose.
 *
 * Faithfully ports the PWA generic motion card engine (`premium-invitation-experience.tsx`)
 * across all 11 non-Ivory styles. Ivory Floral Gold retains its dedicated flagship renderer.
 *
 * Supports the 6 generic motion presets:
 * - gate-fold (Midnight Gold, African Luxe, Black Tie)
 * - envelope-letter (Royal Emerald, Blush Romance)
 * - book-open (Classic White, Celestial)
 * - single-card-lift (Modern Editorial)
 * - floral-reveal (Garden Romance / botanical, Watercolour Garden)
 * - sleeve-pull (Sunset Terracotta)
 *
 * And the 7 atmosphere presets:
 * - champagne-glow, soft-bokeh, petals, candlelight, stars, watercolour-bloom, minimal.
 */
@Composable
fun GenericMotionInvitationNative(
    style: InvitationStyle,
    data: IvoryInvitationData,
    rsvp: IvoryRsvpState,
    actions: IvoryActions,
    reducedMotion: Boolean = false,
    initialState: InvitationPresentationState = InvitationPresentationState.CLOSED,
    onStateChanged: (InvitationPresentationState) -> Unit = {}
) {
    var presentationState by remember(initialState) { mutableStateOf(initialState) }
    val scope = rememberCoroutineScope()
    val isOpen = presentationState == InvitationPresentationState.OPEN ||
            presentationState == InvitationPresentationState.DETAILS
    val isOpening = presentationState == InvitationPresentationState.OPENING

    val palette = style.palette
    val motion = style.motion
    val atmosphere = style.atmosphere

    // Transition progress [0f..1f] for opening animations
    val progress by animateFloatAsState(
        targetValue = if (isOpen) 1f else 0f,
        animationSpec = if (reducedMotion) {
            snap()
        } else {
            tween(durationMillis = 1100, easing = CubicBezierEasing(0.2f, 0.75f, 0.2f, 1f))
        },
        label = "genericMotionProgress"
    )

    fun openInvitation() {
        if (presentationState != InvitationPresentationState.CLOSED) return
        if (reducedMotion) {
            presentationState = InvitationPresentationState.OPEN
            onStateChanged(InvitationPresentationState.OPEN)
            return
        }
        presentationState = InvitationPresentationState.OPENING
        onStateChanged(InvitationPresentationState.OPENING)
        scope.launch {
            delay(1150)
            presentationState = InvitationPresentationState.OPEN
            onStateChanged(InvitationPresentationState.OPEN)
        }
    }

    // The style/motion identity hooks are applied by the dispatcher (NativeInvitationExperience),
    // which wraps whichever renderer it chooses in its own semantic nodes — so the identity tags
    // live in exactly one place for every style, ivory-floral-gold included, rather than being
    // duplicated per renderer.
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.radialGradient(
                    colors = listOf(palette.primary.copy(alpha = 0.24f), palette.stage),
                    center = Offset.Unspecified
                )
            )
            .testTag("premium-invitation-experience")
    ) {
        // Atmosphere overlay
        AtmosphereOverlay(
            atmosphere = atmosphere,
            primary = palette.primary,
            accent = palette.accent,
            isOpen = isOpen || isOpening
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Header tag
            Text(
                text = "Wewed · Private wedding invitation",
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 2.sp,
                color = Color.White.copy(alpha = 0.65f),
                modifier = Modifier.padding(bottom = 16.dp)
            )

            // Motion card stage
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 520.dp),
                contentAlignment = Alignment.Center
            ) {
                when (motion) {
                    InvitationMotion.GATE_FOLD -> GateFoldCard(
                        data = data,
                        palette = palette,
                        progress = progress
                    )
                    InvitationMotion.ENVELOPE_LETTER -> EnvelopeLetterCard(
                        data = data,
                        palette = palette,
                        progress = progress
                    )
                    InvitationMotion.BOOK_OPEN -> BookOpenCard(
                        data = data,
                        palette = palette,
                        progress = progress
                    )
                    InvitationMotion.SINGLE_CARD_LIFT -> SingleCardLiftCard(
                        data = data,
                        palette = palette,
                        progress = progress
                    )
                    InvitationMotion.FLORAL_REVEAL -> FloralRevealCard(
                        data = data,
                        palette = palette,
                        progress = progress
                    )
                    InvitationMotion.SLEEVE_PULL -> SleevePullCard(
                        data = data,
                        palette = palette,
                        progress = progress
                    )
                    InvitationMotion.TRI_FOLD -> SingleCardLiftCard(
                        data = data,
                        palette = palette,
                        progress = progress
                    )
                }

                // Initial closed state CTA button
                if (!isOpen) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .padding(bottom = 32.dp)
                    ) {
                        Button(
                            onClick = { openInvitation() },
                            enabled = !isOpening,
                            shape = CircleShape,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = palette.primary,
                                contentColor = palette.paper
                            ),
                            border = androidx.compose.foundation.BorderStroke(1.5.dp, palette.accent),
                            modifier = Modifier
                                .height(48.dp)
                                .shadow(12.dp, CircleShape)
                                .testTag("invitation-open-button")
                        ) {
                            Text(
                                text = "Open invitation",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
            }

            // Interactive Actions and Status Details when opened
            if (isOpen) {
                Spacer(modifier = Modifier.height(24.dp))
                Box(modifier = Modifier.testTag("invitation-details")) {
                    GenericInvitationActionSection(
                        rsvp = rsvp,
                        actions = actions,
                        palette = palette
                    )
                }
            }
        }
    }
}

/**
 * Atmosphere effects matching the 7 PWA presets.
 */
@Composable
private fun AtmosphereOverlay(
    atmosphere: InvitationAtmosphere,
    primary: Color,
    accent: Color,
    isOpen: Boolean
) {
    val alpha = when {
        !isOpen -> 0f
        atmosphere == InvitationAtmosphere.STARS -> 0.70f
        atmosphere == InvitationAtmosphere.PETALS ||
                atmosphere == InvitationAtmosphere.WATERCOLOUR_BLOOM -> 0.55f
        atmosphere == InvitationAtmosphere.MINIMAL -> 0.15f
        else -> 0.45f
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .alpha(alpha)
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val w = size.width
            val h = size.height

            // Glow fields
            drawCircle(
                color = primary.copy(alpha = 0.35f),
                radius = 120.dp.toPx(),
                center = Offset(w * 0.15f, h * 0.20f)
            )
            drawCircle(
                color = accent.copy(alpha = 0.28f),
                radius = 140.dp.toPx(),
                center = Offset(w * 0.85f, h * 0.80f)
            )

            if (atmosphere == InvitationAtmosphere.STARS) {
                // Subtle stars
                val stars = listOf(
                    Offset(w * 0.20f, h * 0.25f),
                    Offset(w * 0.75f, h * 0.18f),
                    Offset(w * 0.62f, h * 0.72f),
                    Offset(w * 0.30f, h * 0.80f),
                    Offset(w * 0.50f, h * 0.10f),
                    Offset(w * 0.88f, h * 0.45f)
                )
                for (star in stars) {
                    drawCircle(color = Color.White.copy(alpha = 0.75f), radius = 2.5.dp.toPx(), center = star)
                }
            }

            if (atmosphere == InvitationAtmosphere.PETALS || atmosphere == InvitationAtmosphere.WATERCOLOUR_BLOOM) {
                // Petal marks
                drawOval(
                    color = primary.copy(alpha = 0.45f),
                    topLeft = Offset(w * 0.17f, h * 0.22f),
                    size = androidx.compose.ui.geometry.Size(24.dp.toPx(), 14.dp.toPx())
                )
                drawOval(
                    color = accent.copy(alpha = 0.45f),
                    topLeft = Offset(w * 0.80f, h * 0.31f),
                    size = androidx.compose.ui.geometry.Size(20.dp.toPx(), 12.dp.toPx())
                )
                drawOval(
                    color = primary.copy(alpha = 0.40f),
                    topLeft = Offset(w * 0.27f, h * 0.75f),
                    size = androidx.compose.ui.geometry.Size(18.dp.toPx(), 10.dp.toPx())
                )
            }
        }
    }
}

/**
 * Centre invitation face rendering the authoritative information hierarchy.
 */
@Composable
private fun CentreInvitationContent(
    data: IvoryInvitationData,
    palette: InvitationPalette,
    modifier: Modifier = Modifier,
    compact: Boolean = false
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(if (compact) 16.dp else 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(if (compact) 6.dp else 10.dp)
    ) {
        Text(
            text = "TOGETHER WITH OUR FAMILIES",
            fontSize = if (compact) 8.sp else 10.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 2.5.sp,
            color = palette.muted,
            textAlign = TextAlign.Center
        )

        data.monogram?.takeIf { it.isNotBlank() }?.let { mono ->
            Text(
                text = mono,
                fontSize = if (compact) 16.sp else 22.sp,
                fontFamily = FontFamily.Serif,
                letterSpacing = 2.sp,
                color = palette.primary,
                textAlign = TextAlign.Center
            )
        }

        data.guestName?.takeIf { it.isNotBlank() }?.let { guest ->
            Text(
                text = "Especially for $guest",
                fontSize = if (compact) 11.sp else 13.sp,
                fontStyle = FontStyle.Italic,
                color = palette.muted,
                textAlign = TextAlign.Center,
                modifier = Modifier.testTag("invitation-guest-name")
            )
        }

        Text(
            text = data.coupleNames,
            fontSize = if (compact) 22.sp else 28.sp,
            fontFamily = FontFamily.Serif,
            fontWeight = FontWeight.Normal,
            color = palette.ink,
            textAlign = TextAlign.Center,
            modifier = Modifier.testTag("invitation-couple-names")
        )

        data.message.takeIf { it.isNotBlank() }?.let { msg ->
            Text(
                text = msg,
                fontSize = if (compact) 11.sp else 13.sp,
                color = palette.ink.copy(alpha = 0.85f),
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 8.dp)
            )
        }

        Spacer(modifier = Modifier.height(4.dp))

        Text(
            text = data.weddingDateLabel.orEmpty(),
            fontSize = if (compact) 13.sp else 16.sp,
            fontFamily = FontFamily.Serif,
            color = palette.ink,
            textAlign = TextAlign.Center
        )

        Divider(
            modifier = Modifier.width(48.dp),
            thickness = 1.dp,
            color = palette.primary.copy(alpha = 0.35f)
        )

        data.venue?.takeIf { it.isNotBlank() }?.let { venue ->
            Text(
                text = venue.uppercase(),
                fontSize = if (compact) 10.sp else 12.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 1.5.sp,
                color = palette.ink,
                textAlign = TextAlign.Center
            )
        }

        data.venueCityCountry?.takeIf { it.isNotBlank() }?.let { loc ->
            Text(
                text = loc,
                fontSize = if (compact) 10.sp else 12.sp,
                color = palette.muted,
                textAlign = TextAlign.Center
            )
        }

        data.rsvpDeadlineLabel?.takeIf { it.isNotBlank() }?.let { deadline ->
            Text(
                text = "RSVP BY $deadline".uppercase(),
                fontSize = 9.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 1.2.sp,
                color = palette.primary,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .padding(top = 4.dp)
                    .testTag("invitation-rsvp-deadline")
            )
        }
    }
}

/**
 * Base stationery card frame.
 */
@Composable
private fun BaseStationeryCard(
    data: IvoryInvitationData,
    palette: InvitationPalette,
    modifier: Modifier = Modifier,
    compact: Boolean = false
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .shadow(16.dp, RoundedCornerShape(20.dp)),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = palette.paper),
        border = androidx.compose.foundation.BorderStroke(1.dp, palette.primary.copy(alpha = 0.5f))
    ) {
        Box(modifier = Modifier.fillMaxWidth()) {
            CornerBotanicalOrnament(
                color = palette.primary,
                modifier = Modifier
                    .size(56.dp)
                    .align(Alignment.TopStart)
            )
            CornerBotanicalOrnament(
                color = palette.accent,
                modifier = Modifier
                    .size(56.dp)
                    .align(Alignment.TopEnd)
                    .graphicsLayer(scaleX = -1f)
            )
            CentreInvitationContent(data = data, palette = palette, compact = compact)
        }
    }
}

@Composable
private fun CornerBotanicalOrnament(color: Color, modifier: Modifier = Modifier) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val path = Path().apply {
            moveTo(0f, h * 0.8f)
            quadraticBezierTo(w * 0.2f, h * 0.3f, w * 0.8f, 0f)
        }
        drawPath(path, color = color.copy(alpha = 0.45f), style = androidx.compose.ui.graphics.drawscope.Stroke(width = 1.5.dp.toPx()))
    }
}

/**
 * Gate-fold reveal: two doors swing open from the centre.
 */
@Composable
private fun GateFoldCard(
    data: IvoryInvitationData,
    palette: InvitationPalette,
    progress: Float
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("motion-gate-fold")
    ) {
        BaseStationeryCard(data = data, palette = palette)

        // Left door (rotates -118 deg on left hinge)
        val leftRotation = -118f * progress
        Box(
            modifier = Modifier
                .fillMaxWidth(0.5f)
                .matchParentSize()
                .align(Alignment.CenterStart)
                .graphicsLayer {
                    rotationY = leftRotation
                    cameraDistance = 16f
                    transformOrigin = androidx.compose.ui.graphics.TransformOrigin(0f, 0.5f)
                }
                .clip(RoundedCornerShape(topStart = 20.dp, bottomStart = 20.dp))
                .background(palette.paper)
                .border(
                    1.dp,
                    palette.primary.copy(alpha = 0.5f),
                    RoundedCornerShape(topStart = 20.dp, bottomStart = 20.dp)
                )
        )

        // Right door (rotates 118 deg on right hinge)
        val rightRotation = 118f * progress
        Box(
            modifier = Modifier
                .fillMaxWidth(0.5f)
                .matchParentSize()
                .align(Alignment.CenterEnd)
                .graphicsLayer {
                    rotationY = rightRotation
                    cameraDistance = 16f
                    transformOrigin = androidx.compose.ui.graphics.TransformOrigin(1f, 0.5f)
                }
                .clip(RoundedCornerShape(topEnd = 20.dp, bottomEnd = 20.dp))
                .background(palette.paper)
                .border(
                    1.dp,
                    palette.primary.copy(alpha = 0.5f),
                    RoundedCornerShape(topEnd = 20.dp, bottomEnd = 20.dp)
                )
        )
    }
}

/**
 * Envelope-letter reveal: letter card emerges out of an envelope.
 */
@Composable
private fun EnvelopeLetterCard(
    data: IvoryInvitationData,
    palette: InvitationPalette,
    progress: Float
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("motion-envelope-letter")
    ) {
        // Letter card sliding out upwards
        val translationY = (1f - progress) * 120.dp.value
        val cardScale = 0.94f + (0.06f * progress)

        BaseStationeryCard(
            data = data,
            palette = palette,
            modifier = Modifier.graphicsLayer {
                this.translationY = translationY
                scaleX = cardScale
                scaleY = cardScale
            }
        )

        // Foreground envelope fold at bottom
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(80.dp)
                .align(Alignment.BottomCenter)
                .alpha(1f - progress * 0.85f)
                .clip(RoundedCornerShape(bottomStart = 20.dp, bottomEnd = 20.dp))
                .background(palette.primary.copy(alpha = 0.85f))
                .border(1.dp, palette.accent, RoundedCornerShape(bottomStart = 20.dp, bottomEnd = 20.dp))
        )
    }
}

/**
 * Book-open reveal: left page carries monogram, right cover opens around left hinge.
 */
@Composable
private fun BookOpenCard(
    data: IvoryInvitationData,
    palette: InvitationPalette,
    progress: Float
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("motion-book-open")
    ) {
        BaseStationeryCard(data = data, palette = palette, compact = true)

        // Right cover opening around left-side hinge
        val rightRotation = -165f * progress
        Box(
            modifier = Modifier
                .fillMaxWidth(0.5f)
                .matchParentSize()
                .align(Alignment.CenterEnd)
                .graphicsLayer {
                    rotationY = rightRotation
                    cameraDistance = 16f
                    transformOrigin = androidx.compose.ui.graphics.TransformOrigin(0f, 0.5f)
                }
                .clip(RoundedCornerShape(topEnd = 20.dp, bottomEnd = 20.dp))
                .background(palette.paper)
                .border(1.dp, palette.primary.copy(alpha = 0.45f), RoundedCornerShape(topEnd = 20.dp, bottomEnd = 20.dp))
        )
    }
}

/**
 * Single-card lift: card rises and scales up from a slightly tilted/scaled closed state.
 */
@Composable
private fun SingleCardLiftCard(
    data: IvoryInvitationData,
    palette: InvitationPalette,
    progress: Float
) {
    val translationY = (1f - progress) * 28.dp.value
    val cardScale = 0.94f + (0.06f * progress)
    val cardRotationX = (1f - progress) * 8f
    val cardAlpha = 0.78f + (0.22f * progress)

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("motion-single-card-lift")
            .graphicsLayer {
                this.translationY = translationY
                scaleX = cardScale
                scaleY = cardScale
                rotationX = cardRotationX
                alpha = cardAlpha
            }
    ) {
        BaseStationeryCard(data = data, palette = palette)
    }
}

/**
 * Floral reveal: card fades in gently while scaling up from 0.92f.
 */
@Composable
private fun FloralRevealCard(
    data: IvoryInvitationData,
    palette: InvitationPalette,
    progress: Float
) {
    val translationY = (1f - progress) * 12.dp.value
    val cardScale = 0.92f + (0.08f * progress)
    val cardAlpha = 0.75f + (0.25f * progress)

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("motion-floral-reveal")
            .graphicsLayer {
                this.translationY = translationY
                scaleX = cardScale
                scaleY = cardScale
                alpha = cardAlpha
            }
    ) {
        BaseStationeryCard(data = data, palette = palette)
    }
}

/**
 * Sleeve pull reveal: outer sleeve translates away downward while card rises.
 */
@Composable
private fun SleevePullCard(
    data: IvoryInvitationData,
    palette: InvitationPalette,
    progress: Float
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("motion-sleeve-pull")
    ) {
        // Card rising
        val cardY = (1f - progress) * 30.dp.value
        BaseStationeryCard(
            data = data,
            palette = palette,
            modifier = Modifier.graphicsLayer {
                translationY = cardY
            }
        )

        // Outer sleeve sliding down
        val sleeveY = progress * 140.dp.value
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(180.dp)
                .align(Alignment.BottomCenter)
                .graphicsLayer {
                    translationY = sleeveY
                    alpha = 1f - progress * 0.9f
                }
                .clip(RoundedCornerShape(bottomStart = 20.dp, bottomEnd = 20.dp))
                .background(palette.primary.copy(alpha = 0.88f))
                .border(1.dp, palette.accent, RoundedCornerShape(bottomStart = 20.dp, bottomEnd = 20.dp))
        )
    }
}

/**
 * Interactive actions surface attached to every opened generic invitation design.
 */
@Composable
private fun GenericInvitationActionSection(
    rsvp: IvoryRsvpState,
    actions: IvoryActions,
    palette: InvitationPalette
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        // Response confirmation badge
        rsvp.statusLabel?.takeIf { it.isNotBlank() }?.let { label ->
            val isDeclined = label.contains("not attending", ignoreCase = true)
            Surface(
                color = if (isDeclined) palette.muted.copy(alpha = 0.2f) else palette.primary.copy(alpha = 0.15f),
                shape = RoundedCornerShape(12.dp),
                border = androidx.compose.foundation.BorderStroke(
                    1.dp,
                    if (isDeclined) palette.muted.copy(alpha = 0.4f) else palette.primary.copy(alpha = 0.3f)
                ),
                modifier = Modifier
                    .padding(bottom = 6.dp)
                    .testTag(if (isDeclined) "invitation-status-declined" else "invitation-status-attending")
            ) {
                Text(
                    text = label,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    color = if (isDeclined) palette.ink else palette.primary,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp)
                )
            }
        }

        // Primary RSVP CTA (reachable across PENDING, ACCEPTED, DECLINED)
        Button(
            onClick = { actions.onRsvp?.invoke() },
            colors = ButtonDefaults.buttonColors(
                containerColor = palette.primary,
                contentColor = palette.paper
            ),
            shape = CircleShape,
            modifier = Modifier
                .fillMaxWidth(0.85f)
                .height(48.dp)
                .testTag("invitation-cta-rsvp")
        ) {
            Text(
                text = ivoryRsvpActionLabel(rsvp),
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold
            )
        }

        // Secondary actions row
        Row(
            modifier = Modifier.fillMaxWidth(0.85f),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedButton(
                onClick = { actions.onAddToCalendar?.invoke() },
                shape = CircleShape,
                colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.35f)),
                modifier = Modifier
                    .weight(1f)
                    .height(42.dp)
                    .testTag("invitation-cta-calendar")
            ) {
                Text("Calendar", fontSize = 12.sp)
            }

            OutlinedButton(
                onClick = { actions.onOpenVenue?.invoke() },
                shape = CircleShape,
                colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.35f)),
                modifier = Modifier
                    .weight(1f)
                    .height(42.dp)
                    .testTag("invitation-cta-venue")
            ) {
                Text("Venue", fontSize = 12.sp)
            }
        }

        // Additional actions
        actions.onGifts?.let { onGifts ->
            OutlinedButton(
                onClick = onGifts,
                shape = CircleShape,
                colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.35f)),
                modifier = Modifier
                    .fillMaxWidth(0.85f)
                    .height(42.dp)
                    .testTag("invitation-cta-gifts")
            ) {
                Text("Gift Contributions", fontSize = 12.sp)
            }
        }

        actions.onNote?.let { onNote ->
            OutlinedButton(
                onClick = onNote,
                shape = CircleShape,
                colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.35f)),
                modifier = Modifier
                    .fillMaxWidth(0.85f)
                    .height(42.dp)
                    .testTag("invitation-cta-note")
            ) {
                Text("A note from us", fontSize = 12.sp)
            }
        }

        if (rsvp.offersPass && actions.onViewPass != null) {
            Button(
                onClick = { actions.onViewPass.invoke() },
                shape = CircleShape,
                colors = ButtonDefaults.buttonColors(
                    containerColor = palette.accent,
                    contentColor = palette.paper
                ),
                modifier = Modifier
                    .fillMaxWidth(0.85f)
                    .height(44.dp)
                    .testTag("invitation-cta-pass")
            ) {
                Text("View Guest Pass", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            }
        }

        actions.onVisitCoupleSite?.let { onVisit ->
            TextButton(
                onClick = onVisit,
                modifier = Modifier.testTag("invitation-cta-couple-site")
            ) {
                Text("Visit Couple Website", fontSize = 12.sp, color = Color.White.copy(alpha = 0.75f))
            }
        }

        actions.onContinue?.let { onCont ->
            Button(
                onClick = onCont,
                shape = CircleShape,
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color.White.copy(alpha = 0.15f),
                    contentColor = Color.White
                ),
                modifier = Modifier
                    .fillMaxWidth(0.85f)
                    .height(44.dp)
                    .testTag("invitation-continue-button")
            ) {
                Text("Continue to wedding details", fontSize = 13.sp)
            }
        }
    }
}
