package pro.wewed.app.ui.invitation.ivory

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.keyframes
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Text
import kotlinx.coroutines.launch
import pro.wewed.app.R
import pro.wewed.app.models.InvitationPresentationState

/**
 * Ivory Floral Gold, natively.
 *
 * This is a port of the approved web invitation
 * (`src/components/wedding/invitation-experience/ivory-floral-gold-trifold.tsx`), not a design
 * inspired by it. The artwork is the shipped artwork, byte-identical on Android; the geometry,
 * the four states and the door keyframes are transcribed from the approved CSS.
 *
 * What this replaces is the mistake: a `GuestCeremonialCardScreen` was invented — monogram,
 * names, status, countdown, buttons — and used as the guest's entrance. An invitation is a
 * wedding-configured product object that Wewed already designed, approved and shipped. Substituting
 * an app-specific summary card for it is not parity, however carefully it matches the palette.
 *
 * ```
 * CLOSED ──tap──▶ OPENING ──1800ms──▶ OPEN ──▶ DETAILS
 * ```
 *
 * Geometry is expressed as percentages of the 1080×2340 canvas, exactly as the web `Region`
 * boxes are, so the two stay aligned when either changes.
 */
object IvoryGeometry {
    /** The stationery's aspect, from `.ivory-stage { aspect-ratio: 9/19.5 }`. */
    const val ASPECT = 9f / 19.5f

    /** `.ivory-stage { max-width: 430px }` — the card keeps a card's size, even on a tablet. */
    const val MAX_STAGE_WIDTH_DP = 430f

    /** `perspective: 1900px` on `.ivory-object`. */
    const val PERSPECTIVE_PX = 1900f

    /** The approved opening duration. */
    const val OPENING_MILLIS = 1800

    /** `cubic-bezier(0.3, 0.1, 0.2, 1)` from the door animations. */
    val DOOR_EASING = CubicBezierEasing(0.3f, 0.1f, 0.2f, 1f)

    // Region boxes: [left%, top%, width%, height%] over the open surface.
    val NAMES = floatArrayOf(27f, 20f, 46f, 19f)
    val MESSAGE = floatArrayOf(24f, 43f, 52f, 12f)
    val DATE = floatArrayOf(24f, 57f, 52f, 8f)
    val LOCATION = floatArrayOf(23f, 68f, 54f, 8f)
    val TAGLINE = floatArrayOf(28f, 79f, 44f, 4.2f)
    val GUEST = floatArrayOf(22f, 83.3f, 56f, 4.2f)
    val MONOGRAM = floatArrayOf(38f, 39f, 24f, 6f)

    /** The "Tap to open" cue the closed artwork draws near the foot of the card. */
    val OPEN_CUE = floatArrayOf(25f, 88f, 50f, 6f)

    // Details surface.
    val DETAIL_COUPLE = floatArrayOf(25f, 2f, 55f, 3f)
    val DETAIL_NOTE_INTRO = floatArrayOf(28f, 26f, 46f, 5f)
    val DETAIL_VENUE = floatArrayOf(35f, 56f, 44f, 5f)
    val DETAIL_NOTE = floatArrayOf(36f, 76f, 44f, 4f)

    /** Interactive regions on the details surface: left 11%, width 78%, per the web `hit()`. */
    const val HIT_LEFT = 11f
    const val HIT_WIDTH = 78f
    val HIT_RSVP = floatArrayOf(35f, 7.2f)
    val HIT_CALENDAR = floatArrayOf(44.2f, 7.3f)
    val HIT_VENUE = floatArrayOf(53.2f, 8.4f)
    val HIT_REGISTRY = floatArrayOf(63.4f, 7.3f)
    val HIT_NOTE = floatArrayOf(72.4f, 8f)
}

/** Everything the invitation renders. Resolved from the wedding graph, never hard-coded. */
data class IvoryInvitationData(
    val coupleNames: String,
    val monogram: String,
    val message: String,
    val weddingDateLabel: String,
    val weekdayLabel: String?,
    val dayLabel: String?,
    val monthLabel: String?,
    val yearLabel: String?,
    val venue: String,
    val venueAddress: String?,
    val venueCityCountry: String,
    val tagline: String?,
    /** The invited guest. This is what makes it *their* invitation. */
    val guestName: String?,
    val rsvpDeadlineLabel: String?
)

/** What the details surface offers. Availability is data-driven, never assumed. */
data class IvoryActions(
    val onRsvp: (() -> Unit)?,
    val onAddToCalendar: (() -> Unit)?,
    val onOpenVenue: (() -> Unit)?,
    /** Only present when the wedding actually has a configured gift destination. */
    val onGifts: (() -> Unit)?,
    val onNote: (() -> Unit)?,
    val onViewPass: (() -> Unit)?,
    /** The couple's public wedding site. Present for every guest; it is not private. */
    val onVisitCoupleSite: (() -> Unit)? = null,
    val onContinue: (() -> Unit)?
)

/** What the guest has already said. Three states, because "not attending" is not "not answered". */
enum class IvoryRsvpAnswer { AWAITING, ATTENDING, DECLINED }

/** A line the invitation shows instead of RSVP once the guest has already answered. */
data class IvoryRsvpState(
    val answer: IvoryRsvpAnswer,
    val statusLabel: String?,
    val offersPass: Boolean
) {
    /** An answered guest is never asked again, whichever way they answered. */
    val awaitsResponse: Boolean get() = answer == IvoryRsvpAnswer.AWAITING
}

/**
 * Positions a child over the artwork using the approved percentage box.
 *
 * The web lays text over the same surface with percentage boxes; doing the same here keeps the
 * two implementations comparable line by line rather than approximately.
 */
@Composable
private fun IvoryRegion(
    box: FloatArray,
    stageWidth: androidx.compose.ui.unit.Dp,
    stageHeight: androidx.compose.ui.unit.Dp,
    testTag: String? = null,
    content: @Composable BoxScope.() -> Unit
) {
    Box(
        modifier = Modifier
            .offset(x = stageWidth * (box[0] / 100f), y = stageHeight * (box[1] / 100f))
            .width(stageWidth * (box[2] / 100f))
            .height(stageHeight * (box[3] / 100f))
            .then(
                if (testTag != null) {
                    Modifier
                        .semantics(mergeDescendants = true) {}
                        .testTag(testTag)
                } else {
                    Modifier
                }
            ),
        contentAlignment = Alignment.Center,
        content = content
    )
}

/** A tappable region over the details artwork, matching the web hit boxes. */
@Composable
private fun IvoryHit(
    topPercent: Float,
    heightPercent: Float,
    stageWidth: androidx.compose.ui.unit.Dp,
    stageHeight: androidx.compose.ui.unit.Dp,
    label: String,
    testTag: String,
    onClick: (() -> Unit)?
) {
    if (onClick == null) return
    Box(
        modifier = Modifier
            .offset(
                x = stageWidth * (IvoryGeometry.HIT_LEFT / 100f),
                y = stageHeight * (topPercent / 100f)
            )
            .width(stageWidth * (IvoryGeometry.HIT_WIDTH / 100f))
            .height(stageHeight * (heightPercent / 100f))
            .semantics { contentDescription = label }
            .testTag(testTag)
            .clickable(onClick = onClick)
    )
}

/**
 * The invitation.
 *
 * @param reducedMotion when true the doors do not animate; the guest still meets the closed
 *   stationery and still opens it, because the object and its ceremony are the product — only the
 *   motion is reduced.
 */
@Composable
fun IvoryFloralGoldNative(
    data: IvoryInvitationData,
    rsvp: IvoryRsvpState,
    actions: IvoryActions,
    reducedMotion: Boolean = false,
    initialState: InvitationPresentationState = InvitationPresentationState.CLOSED,
    onStateChanged: (InvitationPresentationState) -> Unit = {}
) {
    var view by remember { mutableStateOf(initialState) }
    val leftDoor = remember { Animatable(0f) }
    val rightDoor = remember { Animatable(0f) }
    val centreSettle = remember { Animatable(if (initialState == InvitationPresentationState.CLOSED) 0f else 1f) }

    LaunchedEffect(view) { onStateChanged(view) }

    // The reveal. Progress drives both doors and the centre settle so they stay in step, exactly
    // as the three CSS animations share one 1800ms timeline.
    suspend fun openDoors() {
        if (reducedMotion) {
            leftDoor.snapTo(1f); rightDoor.snapTo(1f); centreSettle.snapTo(1f)
            view = InvitationPresentationState.OPEN
            return
        }
        view = InvitationPresentationState.OPENING
        val spec = tween<Float>(IvoryGeometry.OPENING_MILLIS, easing = IvoryGeometry.DOOR_EASING)
        launchAll(
            { leftDoor.animateTo(1f, spec) },
            { rightDoor.animateTo(1f, spec) },
            { centreSettle.animateTo(1f, tween(IvoryGeometry.OPENING_MILLIS)) }
        )
        view = InvitationPresentationState.OPEN
    }

    val scope = rememberCoroutineScope()
    val density = LocalDensity.current

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(IvoryPalette.Stage)
            .testTag("invitation-trifold"),
        contentAlignment = Alignment.Center
    ) {
        // The stationery keeps its authored aspect and is centred, the way a physical card sits on
        // a surface. It is never stretched to the viewport.
        val availableW = maxWidth
        val availableH = maxHeight
        val stageWidth = minOf(
            availableW,
            availableH * IvoryGeometry.ASPECT,
            IvoryGeometry.MAX_STAGE_WIDTH_DP.dp
        )
        val stageHeight = stageWidth / IvoryGeometry.ASPECT
        val cameraDistance = with(density) { IvoryGeometry.PERSPECTIVE_PX.dp.toPx() } /
            with(density) { 1.dp.toPx() }

        Box(
            modifier = Modifier
                .width(stageWidth)
                .height(stageHeight)
                .clip(androidx.compose.foundation.shape.RoundedCornerShape(2.dp))
        ) {
            // --- The invitation face, beneath the doors ---
            if (view != InvitationPresentationState.DETAILS) {
                Box(
                    modifier = Modifier
                        .matchParentSize()
                        .graphicsLayer {
                            // `ivory-settle`: 0.94 -> 1 with a brightness lift.
                            val s = 0.94f + 0.06f * centreSettle.value
                            scaleX = s; scaleY = s
                        }
                        .testTag("invitation-panel-centre")
                ) {
                    Image(
                        painter = painterResource(R.drawable.ivory_open_surface),
                        contentDescription = null,
                        contentScale = ContentScale.FillBounds,
                        modifier = Modifier.matchParentSize()
                    )

                    IvoryRegion(IvoryGeometry.NAMES, stageWidth, stageHeight, "invitation-couple-names") {
                        Text(
                            data.coupleNames,
                            color = IvoryPalette.Ink,
                            // `.ivory-names { font-family: IvoryScript }` — the couple's names are
                            // the one place the script face carries the whole design.
                            fontFamily = IvoryTypography.Script,
                            fontSize = (stageWidth.value * 0.112f).sp,
                            lineHeight = (stageWidth.value * 0.118f).sp,
                            textAlign = TextAlign.Center
                        )
                    }
                    IvoryRegion(IvoryGeometry.MESSAGE, stageWidth, stageHeight) {
                        Text(
                            // `.ivory-message { text-transform: uppercase; letter-spacing: .13em }`
                            data.message.uppercase(),
                            color = IvoryPalette.Ink,
                            fontFamily = IvoryTypography.Body,
                            fontSize = (stageWidth.value * 0.030f).sp,
                            letterSpacing = (stageWidth.value * 0.030f * 0.13f).sp,
                            lineHeight = (stageWidth.value * 0.030f * 1.7f).sp,
                            textAlign = TextAlign.Center
                        )
                    }
                    IvoryRegion(IvoryGeometry.DATE, stageWidth, stageHeight, "invitation-date") {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            data.weekdayLabel?.let {
                                Text(
                                    it.uppercase(),
                                    color = IvoryPalette.Gold,
                                    fontSize = (stageWidth.value * 0.026f).sp,
                                    letterSpacing = (stageWidth.value * 0.006f).sp
                                )
                            }
                            // `.ivory-date-parts { justify-content: space-between; width: 100% }`
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                data.monthLabel?.let {
                                    Text(
                                        it.uppercase(),
                                        color = IvoryPalette.Ink,
                                        fontFamily = IvoryTypography.Body,
                                        fontSize = (stageWidth.value * 0.030f).sp
                                    )
                                }
                                data.dayLabel?.let {
                                    Text(
                                        it,
                                        color = IvoryPalette.Ink,
                                        fontFamily = IvoryTypography.Body,
                                        fontWeight = FontWeight.SemiBold,
                                        fontSize = (stageWidth.value * 0.050f).sp
                                    )
                                }
                                data.yearLabel?.let {
                                    Text(
                                        it,
                                        color = IvoryPalette.Ink,
                                        fontFamily = IvoryTypography.Body,
                                        fontSize = (stageWidth.value * 0.030f).sp
                                    )
                                }
                            }
                        }
                    }
                    IvoryRegion(IvoryGeometry.LOCATION, stageWidth, stageHeight, "invitation-venue") {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                // `.ivory-location strong { text-transform: uppercase }`
                                data.venue.uppercase(),
                                color = IvoryPalette.Ink,
                                fontFamily = IvoryTypography.Body,
                                fontSize = (stageWidth.value * 0.038f).sp,
                                textAlign = TextAlign.Center
                            )
                            data.venueAddress?.let {
                                Text(
                                    it,
                                    color = IvoryPalette.InkSoft,
                                    fontSize = (stageWidth.value * 0.024f).sp,
                                    textAlign = TextAlign.Center
                                )
                            }
                            Text(
                                data.venueCityCountry,
                                color = IvoryPalette.InkSoft,
                                fontSize = (stageWidth.value * 0.024f).sp,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                    data.tagline?.takeIf { it.isNotBlank() }?.let {
                        IvoryRegion(IvoryGeometry.TAGLINE, stageWidth, stageHeight) {
                            Text(
                                it,
                                color = IvoryPalette.Gold,
                                // `.ivory-tagline { font-family: IvoryScript }`.
                                fontFamily = IvoryTypography.Script,
                                fontSize = (stageWidth.value * 0.050f).sp,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                    // The personalisation. Without it this is a template, not an invitation.
                    IvoryRegion(
                        IvoryGeometry.GUEST, stageWidth, stageHeight,
                        "invitation-guest-personalization"
                    ) {
                        // `.ivory-guest { gap: .25cqw; font-size: 2.2cqw; line-height: 1.4 }`.
                        // The line height is explicit: the authored box holds two lines only at the
                        // web's spacing, and the platform default silently pushed the RSVP deadline
                        // out of it.
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(stageWidth * 0.0025f)
                        ) {
                            data.guestName?.takeIf { it.isNotBlank() }?.let {
                                Text(
                                    "Especially for $it",
                                    color = IvoryPalette.Ink,
                                    fontFamily = IvoryTypography.Body,
                                    fontSize = (stageWidth.value * 0.022f).sp,
                                    lineHeight = (stageWidth.value * 0.022f * 1.4f).sp,
                                    textAlign = TextAlign.Center
                                )
                            }
                            data.rsvpDeadlineLabel?.let {
                                Text(
                                    "RSVP by $it",
                                    color = IvoryPalette.Ink,
                                    fontFamily = IvoryTypography.Body,
                                    fontSize = (stageWidth.value * 0.022f).sp,
                                    lineHeight = (stageWidth.value * 0.022f * 1.4f).sp,
                                    textAlign = TextAlign.Center
                                )
                            }
                        }
                    }

                    // Once open, the invitation offers its details. The status line replaces the
                    // prompt for a guest who has already answered — the card is the same object.
                    if (view == InvitationPresentationState.OPEN) {
                        Box(
                            modifier = Modifier
                                .align(Alignment.BottomCenter)
                                .fillMaxWidth()
                                .height(stageHeight * 0.075f)
                                .clickable { view = InvitationPresentationState.DETAILS }
                                .testTag("invitation-details-button"),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                rsvp.statusLabel ?: "Wedding details ↓",
                                color = IvoryPalette.Gold,
                                fontFamily = IvoryTypography.Body,
                                fontSize = (stageWidth.value * 0.030f).sp,
                                modifier = Modifier.testTag(
                                    when (rsvp.answer) {
                                        IvoryRsvpAnswer.ATTENDING -> "invitation-rsvp-confirmed"
                                        IvoryRsvpAnswer.DECLINED -> "invitation-response-recorded"
                                        IvoryRsvpAnswer.AWAITING -> "invitation-details-cue"
                                    }
                                )
                            )
                        }
                    }
                }
            }

            // --- The details surface ---
            if (view == InvitationPresentationState.DETAILS) {
                Box(
                    modifier = Modifier
                        .matchParentSize()
                        .testTag("invitation-interactive-details")
                ) {
                    Image(
                        painter = painterResource(R.drawable.ivory_details_surface),
                        contentDescription = null,
                        contentScale = ContentScale.FillBounds,
                        modifier = Modifier.matchParentSize()
                    )
                    IvoryRegion(IvoryGeometry.DETAIL_COUPLE, stageWidth, stageHeight) {
                        Text(
                            data.coupleNames,
                            color = IvoryPalette.Ink,
                            fontFamily = IvoryTypography.Body,
                            fontSize = (stageWidth.value * 0.030f).sp,
                            textAlign = TextAlign.Center
                        )
                    }
                    // The artwork's own sample copy is erased in these regions; leaving them
                    // empty showed the erasure as a smudge where the couple's words belong.
                    data.tagline?.takeIf { it.isNotBlank() }?.let {
                        IvoryRegion(IvoryGeometry.DETAIL_NOTE_INTRO, stageWidth, stageHeight) {
                            Text(
                                it,
                                color = IvoryPalette.Gold,
                                fontFamily = IvoryTypography.Script,
                                fontSize = (stageWidth.value * 0.052f).sp,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                    IvoryRegion(IvoryGeometry.DETAIL_VENUE, stageWidth, stageHeight) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                data.venue,
                                color = IvoryPalette.Ink,
                                fontSize = (stageWidth.value * 0.024f).sp,
                                textAlign = TextAlign.Center
                            )
                            data.venueAddress?.takeIf { it.isNotBlank() }?.let {
                                Text(
                                    it,
                                    color = IvoryPalette.InkSoft,
                                    fontSize = (stageWidth.value * 0.022f).sp,
                                    textAlign = TextAlign.Center
                                )
                            }
                            Text(
                                data.venueCityCountry,
                                color = IvoryPalette.InkSoft,
                                fontSize = (stageWidth.value * 0.022f).sp,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                    IvoryRegion(IvoryGeometry.DETAIL_NOTE, stageWidth, stageHeight) {
                        Text(
                            "A special message from us",
                            color = IvoryPalette.InkSoft,
                            fontSize = (stageWidth.value * 0.024f).sp,
                            textAlign = TextAlign.Center
                        )
                    }

                    // The details hits, at the approved coordinates. A guest who has already
                    // answered is never offered RSVP again; gifts appear only when configured.
                    IvoryHit(
                        IvoryGeometry.HIT_RSVP[0], IvoryGeometry.HIT_RSVP[1], stageWidth, stageHeight,
                        if (rsvp.awaitsResponse) "RSVP" else "RSVP recorded",
                        "invitation-cta-rsvp", if (rsvp.awaitsResponse) actions.onRsvp else null
                    )
                    IvoryHit(
                        IvoryGeometry.HIT_CALENDAR[0], IvoryGeometry.HIT_CALENDAR[1], stageWidth, stageHeight,
                        "Add to Calendar", "invitation-cta-calendar", actions.onAddToCalendar
                    )
                    IvoryHit(
                        IvoryGeometry.HIT_VENUE[0], IvoryGeometry.HIT_VENUE[1], stageWidth, stageHeight,
                        "Venue Location", "invitation-cta-venue", actions.onOpenVenue
                    )
                    IvoryHit(
                        IvoryGeometry.HIT_REGISTRY[0], IvoryGeometry.HIT_REGISTRY[1], stageWidth, stageHeight,
                        "Gift / Contributions", "invitation-cta-registry", actions.onGifts
                    )
                    IvoryHit(
                        IvoryGeometry.HIT_NOTE[0], IvoryGeometry.HIT_NOTE[1], stageWidth, stageHeight,
                        "A Note from Us", "invitation-cta-note", actions.onNote
                    )

                    Row(
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .fillMaxWidth()
                            .padding(bottom = stageHeight * 0.02f),
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Text(
                            "View invitation",
                            color = IvoryPalette.Gold,
                            fontSize = (stageWidth.value * 0.026f).sp,
                            modifier = Modifier
                                .clickable { view = InvitationPresentationState.OPEN }
                                .padding(horizontal = 10.dp)
                                .testTag("invitation-back-to-invitation")
                        )
                        if (rsvp.offersPass && actions.onViewPass != null) {
                            Text(
                                "Guest Pass",
                                color = IvoryPalette.Gold,
                                fontSize = (stageWidth.value * 0.026f).sp,
                                modifier = Modifier
                                    .clickable { actions.onViewPass.invoke() }
                                    .padding(horizontal = 10.dp)
                                    .testTag("invitation-cta-pass")
                            )
                        }
                        actions.onVisitCoupleSite?.let {
                            Text(
                                "Visit Couple Website",
                                color = IvoryPalette.Gold,
                                fontSize = (stageWidth.value * 0.026f).sp,
                                modifier = Modifier
                                    .clickable(onClick = it)
                                    .padding(horizontal = 10.dp)
                                    .testTag("invitation-cta-couple-site")
                            )
                        }
                        actions.onContinue?.let {
                            Text(
                                "Continue",
                                color = IvoryPalette.InkSoft,
                                fontSize = (stageWidth.value * 0.026f).sp,
                                modifier = Modifier
                                    .clickable(onClick = it)
                                    .padding(horizontal = 10.dp)
                                    .testTag("invitation-continue")
                            )
                        }
                    }
                }
            }

            // --- The doors, above everything until they have swung away ---
            if (view == InvitationPresentationState.CLOSED || view == InvitationPresentationState.OPENING) {
                Box(
                    modifier = Modifier
                        .matchParentSize()
                        .testTag("invitation-closed-cover")
                ) {
                    // Anywhere on the closed card opens it. This target carries no semantics on
                    // purpose: Compose drops a semantics node that another one completely covers,
                    // so a described full-surface overlay would hide the doors and the seal from
                    // assistive technology — and from the assertions that prove they are drawn.
                    if (view == InvitationPresentationState.CLOSED) {
                        Box(
                            modifier = Modifier
                                .matchParentSize()
                                .pointerInput(Unit) {
                                    detectTapGestures { scope.launch { openDoors() } }
                                }
                        )
                    }

                    IvoryDoor(
                        drawable = R.drawable.ivory_left_door,
                        progress = leftDoor.value,
                        isLeft = true,
                        cameraDistance = cameraDistance,
                        modifier = Modifier
                            .align(Alignment.CenterStart)
                            .fillMaxHeight()
                            .width(stageWidth / 2)
                            .semantics { contentDescription = "Invitation left door" }
                            .testTag("invitation-panel-left")
                    )
                    IvoryDoor(
                        drawable = R.drawable.ivory_right_door,
                        progress = rightDoor.value,
                        isLeft = false,
                        cameraDistance = cameraDistance,
                        modifier = Modifier
                            .align(Alignment.CenterEnd)
                            .fillMaxHeight()
                            .width(stageWidth / 2)
                            .semantics { contentDescription = "Invitation right door" }
                            .testTag("invitation-panel-right")
                    )

                    // The seal sits over the closed doors, and inks out as they part.
                    IvoryRegion(
                        IvoryGeometry.MONOGRAM, stageWidth, stageHeight, "invitation-monogram"
                    ) {
                        Text(
                            data.monogram.replace(Regex("[·|]"), " "),
                            color = IvoryPalette.Ink,
                            fontFamily = IvoryTypography.Body,
                            fontSize = (stageWidth.value * 0.055f).sp,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.graphicsLayer {
                                alpha = (1f - leftDoor.value * 6f).coerceIn(0f, 1f)
                            }
                        )
                    }


                    // The named control sits on the cue the artwork draws, not over the whole card.
                    if (view == InvitationPresentationState.CLOSED) {
                        IvoryRegion(IvoryGeometry.OPEN_CUE, stageWidth, stageHeight) {
                            Box(
                                modifier = Modifier
                                    .matchParentSize()
                                    .semantics {
                                        contentDescription =
                                            "A special invitation awaits. Tap to open."
                                    }
                                    .testTag("invitation-open-button")
                                    .clickable { scope.launch { openDoors() } }
                            )
                        }
                    }
                }
            }

            if (view == InvitationPresentationState.OPENING) {
                Box(modifier = Modifier.matchParentSize().testTag("invitation-opening"))
            }
        }
    }
}

/**
 * One hinged door.
 *
 * The keyframes are the approved ones: a small lift away from the centre, a mid-swing at 44°, and
 * a finish translated fully clear at 82°. `TransformOrigin` puts the hinge on the outer edge, and
 * `cameraDistance` supplies the perspective the web gets from `perspective: 1900px`.
 */
@Composable
private fun IvoryDoor(
    drawable: Int,
    progress: Float,
    isLeft: Boolean,
    cameraDistance: Float,
    modifier: Modifier = Modifier
) {
    val sign = if (isLeft) -1f else 1f
    // Piecewise from the CSS keyframes at 0 / 12% / 60% / 100%.
    val rotation: Float
    val translateFraction: Float
    when {
        progress <= 0.12f -> {
            val t = progress / 0.12f
            rotation = sign * 2f * t
            translateFraction = 0f
        }
        progress <= 0.60f -> {
            val t = (progress - 0.12f) / 0.48f
            rotation = sign * (2f + 42f * t)
            translateFraction = sign * 0.24f * t
        }
        else -> {
            val t = (progress - 0.60f) / 0.40f
            rotation = sign * (44f + 38f * t)
            translateFraction = sign * (0.24f + 0.88f * t)
        }
    }

    Image(
        painter = painterResource(drawable),
        contentDescription = null,
        contentScale = ContentScale.FillBounds,
        modifier = modifier.graphicsLayer {
            transformOrigin = TransformOrigin(if (isLeft) 0f else 1f, 0.5f)
            rotationY = rotation
            translationX = translateFraction * size.width
            this.cameraDistance = cameraDistance
        }
    )
}

/** Runs the door and settle animations on one timeline. */
private suspend fun launchAll(vararg blocks: suspend () -> Unit) {
    kotlinx.coroutines.coroutineScope {
        blocks.forEach { block -> launch { block() } }
    }
}

/** Ink and gold sampled from the approved stationery. */
/**
 * The stationery's own colours, taken from `ivory-floral-gold.css` rather than chosen.
 *
 * The whole open face inherits one warm gold-brown from `.ivory-stage { color: #70501f }`. Using a
 * darker "ink" instead is subtle enough to survive review and still be the wrong invitation.
 */
object IvoryPalette {
    /** The surface the card sits on. */
    val Stage = Color(0xFF15100B)

    /** `.ivory-stage { color: #70501f }` — inherited by every region on the open face. */
    val Ink = Color(0xFF70501F)

    /** `.ivory-detail-venue, .ivory-detail-note { color: #322b22 }` on the details surface. */
    val InkSoft = Color(0xFF322B22)

    /** The footer actions on the details surface, `#76501d`. */
    val Gold = Color(0xFF76501D)
}
