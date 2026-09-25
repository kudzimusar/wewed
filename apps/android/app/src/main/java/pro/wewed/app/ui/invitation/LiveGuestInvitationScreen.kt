package pro.wewed.app.ui.invitation

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import pro.wewed.app.invitation.*
import pro.wewed.app.models.RSVPStatus
import pro.wewed.app.theme.WeddingBrandMark
import pro.wewed.app.theme.WeddingIdentityPalette
import pro.wewed.app.theme.WeddingOrnamentBackdrop
import pro.wewed.app.theme.WewedColors
import pro.wewed.app.ui.invitation.ivory.IvoryActions
import pro.wewed.app.ui.invitation.ivory.IvoryInvitationData

/**
 * The guest's invitation, rendered from the live guest session.
 *
 * The distinction from [GuestInvitationJourneyScreen] is where the data and the RSVP write come
 * from: this one talks to the wedding's own authority through [LiveGuestInvitationCoordinator],
 * and never to a repository. The Shadow journey is kept for Shadow qualification, and the two
 * never fall back to each other — a guest whose live invitation fails is told so, rather than
 * being shown fixture data that looks like their card.
 *
 * It holds no RSVP credential. [LiveInvitationPresentation] deliberately has no field for one.
 */
@Composable
fun LiveGuestInvitationScreen(
    presentation: LiveInvitationPresentation,
    coordinator: LiveGuestInvitationCoordinator,
    onRefreshed: (LiveInvitationState) -> Unit,
    onContinue: () -> Unit,
    onBackToWedding: (() -> Unit)? = null,
    onViewPass: (() -> Unit)? = null
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    var rsvpPrompt by remember { mutableStateOf(false) }
    var rsvpEditorPresentation by remember { mutableStateOf<LiveInvitationPresentation?>(null) }
    var editorLoading by remember { mutableStateOf(false) }
    var refreshUnavailable by remember { mutableStateOf(false) }
    var submitting by remember { mutableStateOf(false) }
    var reopenRequired by remember { mutableStateOf(false) }
    var staleOrReplacedGuest by remember { mutableStateOf(false) }
    var childrenNotAllowed by remember { mutableStateOf(false) }
    var showNote by remember { mutableStateOf(false) }

    val status = presentation.rsvpStatus

    fun requestRsvpEdit() {
        if (editorLoading || submitting) return
        editorLoading = true
        refreshUnavailable = false
        scope.launch {
            when (val prep = coordinator.prepareRsvpEditor()) {
                is RsvpEditorPreparation.Ready -> {
                    rsvpEditorPresentation = LiveInvitationPresentation.from(prep.snapshot)
                    onRefreshed(LiveInvitationState.Presenting(prep.snapshot))
                    rsvpPrompt = true
                }
                is RsvpEditorPreparation.ReopenRequired -> {
                    rsvpEditorPresentation = null
                    rsvpPrompt = false
                    reopenRequired = true
                }
                is RsvpEditorPreparation.StaleOrReplacedGuest -> {
                    // The coordinator's binding was left untouched — do not clear the presentation
                    // or open the editor on top of a snapshot that is no longer current.
                    rsvpPrompt = false
                    staleOrReplacedGuest = true
                }
                is RsvpEditorPreparation.Unavailable -> {
                    rsvpEditorPresentation = null
                    rsvpPrompt = false
                    refreshUnavailable = true
                }
            }
            editorLoading = false
        }
    }

    // Master plan Phase 9 — the full converged RSVP field set, not just attendance. Respects
    // server-provided policy (adults-only) rather than inventing wedding rules client-side; the
    // server remains the final enforcement authority regardless of what this form allows.
    fun answer(update: GuestRsvpUpdate) {
        if (submitting) return
        submitting = true
        scope.launch {
            when (coordinator.answer(update)) {
                is RsvpOutcome.Saved -> {
                    rsvpPrompt = false
                    rsvpEditorPresentation = null
                    // Re-read rather than trusting the local edit: what the card shows afterwards
                    // is what the server stored.
                    onRefreshed(coordinator.refresh())
                }
                // The card belongs to a guest who is no longer the active one. Saying nothing here
                // would let the guest believe their answer was recorded.
                is RsvpOutcome.ReopenRequired -> {
                    rsvpPrompt = false
                    rsvpEditorPresentation = null
                    reopenRequired = true
                }
                // Distinct from ReopenRequired: this is a policy refusal (adults-only), not a stale
                // session — a "reopen your invitation" message would be actively misleading here.
                is RsvpOutcome.ChildrenNotAllowed -> childrenNotAllowed = true
                is RsvpOutcome.Unavailable -> {
                    rsvpPrompt = false
                    rsvpEditorPresentation = null
                    reopenRequired = true
                }
            }
            submitting = false
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.fillMaxSize().background(WeddingIdentityPalette.Ivory)
        ) {
            if (onBackToWedding != null) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(WeddingIdentityPalette.Ivory)
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(
                        onClick = onBackToWedding,
                        shape = RoundedCornerShape(999.dp),
                        color = WeddingIdentityPalette.IvorySoft,
                        border = BorderStroke(
                            1.dp,
                            WeddingIdentityPalette.Champagne.copy(alpha = 0.70f)
                        ),
                        shadowElevation = 2.dp,
                        modifier = Modifier
                            .heightIn(min = 48.dp)
                            .testTag("invitation-back-to-wedding")
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(7.dp)
                        ) {
                            Icon(
                                Icons.Filled.ArrowBack,
                                contentDescription = null,
                                tint = WeddingIdentityPalette.ChampagneDeep,
                                modifier = Modifier.size(18.dp)
                            )
                            Text(
                                "Back to My Wedding",
                                color = WeddingIdentityPalette.ChampagneDeep,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
            }

            Box(modifier = Modifier.fillMaxWidth().weight(1f)) {
                NativeInvitationExperience(
                    style = presentation.invitationCardStyle,
                    data = presentation.toIvoryData(),
                    rsvp = ivoryRsvpStateFrom(status),
                    actions = resolveLiveInvitationActions(
                        presentation = presentation,
                        onRsvpPrompt = { requestRsvpEdit() },
                        onAddToCalendar = { addWeddingToCalendar(context, presentation) },
                        onOpenVenue = {
                            val target = resolveLiveVenueDestination(presentation)
                            runCatching {
                                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(target)))
                            }
                        },
                        onGifts = { openCoupleSite(context, presentation.weddingSlug, "#registry") },
                        onNote = presentation.invitationCardMessage
                            ?.takeIf { it.isNotBlank() }
                            ?.let { { showNote = true } },
                        onViewPass = onViewPass,
                        onVisitCoupleSite = {
                            openCoupleSite(context, presentation.weddingSlug, null)
                        },
                        onContinue = if (presentation.attending == null) null else onContinue
                    )
                )
            }
        }

        if (rsvpPrompt && rsvpEditorPresentation != null) {
            val editorPresentation = rsvpEditorPresentation!!
            key(editorPresentation) {
                LiveRsvpForm(
                    guestName = editorPresentation.guestName,
                    childrenPolicy = editorPresentation.childrenPolicy,
                    initial = editorPresentation,
                    isSubmitting = submitting,
                    childrenNotAllowed = childrenNotAllowed,
                    onDismissChildrenNotice = { childrenNotAllowed = false },
                    onSubmit = { answer(it) },
                    onDismiss = {
                        if (!submitting) {
                            rsvpPrompt = false
                            rsvpEditorPresentation = null
                        }
                    }
                )
            }
        }

        if (reopenRequired) {
            ReopenRequiredNotice(onDismiss = { reopenRequired = false })
        }

        if (staleOrReplacedGuest) {
            StaleOrReplacedGuestNotice(onDismiss = { staleOrReplacedGuest = false })
        }

        if (refreshUnavailable) {
            RefreshUnavailableNotice(onDismiss = { refreshUnavailable = false })
        }

        presentation.invitationCardMessage?.takeIf { showNote && it.isNotBlank() }?.let { note ->
            NoteFromTheCouple(note = note, onDismiss = { showNote = false })
        }
    }
}

/**
 * Hands the wedding to the phone's calendar.
 *
 * The date arrives as ISO from the graph; older shapes use a space separator. Both are the same
 * instant, and a parser that accepted only one silently produced no event at all.
 */
private fun addWeddingToCalendar(
    context: android.content.Context,
    presentation: LiveInvitationPresentation
) {
    val start = parseWeddingInstant(presentation.weddingDate.orEmpty()) ?: return
    val intent = Intent(Intent.ACTION_INSERT)
        .setData(android.provider.CalendarContract.Events.CONTENT_URI)
        .putExtra(android.provider.CalendarContract.Events.TITLE, presentation.coupleNames)
        .putExtra(
            android.provider.CalendarContract.Events.EVENT_LOCATION,
            listOfNotNull(presentation.venue, presentation.venueCityCountry.takeIf { it.isNotBlank() })
                .joinToString(", ")
        )
        .putExtra(android.provider.CalendarContract.EXTRA_EVENT_BEGIN_TIME, start)
        .putExtra(android.provider.CalendarContract.EXTRA_EVENT_END_TIME, start + 6 * 60 * 60 * 1000L)
    runCatching { context.startActivity(intent) }
}

private fun parseWeddingInstant(raw: String): Long? {
    listOf("yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd'T'HH:mm", "yyyy-MM-dd")
        .forEach { pattern ->
            runCatching {
                java.text.SimpleDateFormat(pattern, java.util.Locale.US).parse(raw.trim())
            }.getOrNull()?.let { return it.time }
        }
    return null
}

/**
 * The couple's own note.
 *
 * Shown only when `invitationCardMessage` is set, because the alternative is putting words in
 * their mouth.
 */
@Composable
private fun NoteFromTheCouple(note: String, onDismiss: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.40f))
            .clickable(onClick = onDismiss)
            .testTag("invitation-note-sheet"),
        contentAlignment = Alignment.Center
    ) {
        Surface(
            modifier = Modifier
                .padding(horizontal = 16.dp)
                .fillMaxWidth()
                .widthIn(max = 420.dp)
                .clickable(enabled = false) {},
            shape = RoundedCornerShape(24.dp),
            color = WeddingIdentityPalette.IvorySoft,
            border = BorderStroke(1.dp, WeddingIdentityPalette.Champagne.copy(alpha = 0.55f)),
            shadowElevation = 10.dp
        ) {
            Box {
                WeddingOrnamentBackdrop(
                    modifier = Modifier.matchParentSize(),
                    alpha = 0.075f
                )
                Column(
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 18.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End
                    ) {
                        Surface(
                            onClick = onDismiss,
                            shape = RoundedCornerShape(999.dp),
                            color = WeddingIdentityPalette.IvorySoft.copy(alpha = 0.94f),
                            border = BorderStroke(
                                1.dp,
                                WeddingIdentityPalette.Champagne.copy(alpha = 0.55f)
                            ),
                            modifier = Modifier
                                .size(44.dp)
                                .testTag("invitation-note-dismiss")
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    Icons.Filled.Close,
                                    contentDescription = "Close note",
                                    tint = WeddingIdentityPalette.ChampagneDeep
                                )
                            }
                        }
                    }
                    WeddingBrandMark()
                    Text(
                        "A note from us",
                        fontFamily = FontFamily.Serif,
                        fontSize = 21.sp,
                        color = WeddingIdentityPalette.Ink
                    )
                    HorizontalDivider(
                        modifier = Modifier.width(64.dp),
                        thickness = 1.dp,
                        color = WeddingIdentityPalette.Champagne.copy(alpha = 0.70f)
                    )
                    Text(
                        note,
                        fontSize = 16.sp,
                        fontFamily = FontFamily.Serif,
                        color = WeddingIdentityPalette.Ink,
                        textAlign = TextAlign.Center,
                        lineHeight = 24.sp
                    )
                    Text(
                        "Your invitation remains behind this note.",
                        fontSize = 11.sp,
                        color = WeddingIdentityPalette.Muted,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}

/** The public couple site. Safe to share; the private invitation link is not. */
private fun openCoupleSite(context: android.content.Context, slug: String, fragment: String?) {
    val url = "https://wewed.pro/w/" + Uri.encode(slug) + (fragment ?: "")
    runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
}

private fun LiveInvitationPresentation.toIvoryData(): IvoryInvitationData {
    val iso = weddingDate.orEmpty().trim().take(10)
    val parts = iso.split("-")
    val months = listOf(
        "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
    )
    val weekday = runCatching {
        java.text.SimpleDateFormat("EEEE", java.util.Locale.US).format(
            java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).parse(iso)!!
        )
    }.getOrNull()

    return IvoryInvitationData(
        coupleNames = coupleNames,
        monogram = monogram ?: coupleNames.split(Regex("\\s*&\\s*"))
            .mapNotNull { it.trim().firstOrNull()?.uppercase() }
            .joinToString(" "),
        message = invitationCardMessage?.takeIf { it.isNotBlank() }
            ?: "Request the pleasure of your company as we celebrate our marriage.",
        weddingDateLabel = weddingDate.orEmpty(),
        weekdayLabel = weekday,
        dayLabel = parts.getOrNull(2)?.toIntOrNull()?.toString(),
        monthLabel = parts.getOrNull(1)?.toIntOrNull()?.minus(1)?.let { months.getOrNull(it) },
        yearLabel = parts.getOrNull(0),
        venue = venue.orEmpty(),
        venueAddress = null,
        venueCityCountry = venueCityCountry,
        tagline = tagline,
        guestName = guestName,
        rsvpDeadlineLabel = rsvpDeadline
    )
}

/**
 * Resolves the actions available from the live invitation details surface.
 *
 * RSVP editing remains accessible across all states (PENDING, ACCEPTED, DECLINED) so guests
 * can update meal choice, plus-one, children, notes, or change attendance at any time.
 */
fun resolveLiveVenueDestination(presentation: LiveInvitationPresentation): String {
    presentation.venueMapUrl?.takeIf { it.isNotBlank() }?.let { return it }
    val query = listOfNotNull(
        presentation.venue?.takeIf { it.isNotBlank() },
        presentation.venueCityCountry.takeIf { it.isNotBlank() }
    ).joinToString(", ")
    val encoded = java.net.URLEncoder.encode(query, Charsets.UTF_8.name()).replace("+", "%20")
    return "geo:0,0?q=$encoded"
}

fun resolveLiveInvitationActions(
    presentation: LiveInvitationPresentation,
    onRsvpPrompt: () -> Unit,
    onAddToCalendar: () -> Unit = {},
    onOpenVenue: () -> Unit = {},
    onGifts: () -> Unit = {},
    onNote: (() -> Unit)? = null,
    onViewPass: (() -> Unit)? = null,
    onVisitCoupleSite: () -> Unit = {},
    onContinue: (() -> Unit)? = null
): IvoryActions = IvoryActions(
    onRsvp = onRsvpPrompt,
    onAddToCalendar = onAddToCalendar,
    onOpenVenue = onOpenVenue,
    onGifts = onGifts,
    onNote = onNote,
    // Pending stays inside Ivory: the locked Pass affordance opens RSVP instead of navigating.
    // Once answered, both attending and declined Guests may enter the persistent Pass destination.
    onViewPass = if (presentation.attending == null) onRsvpPrompt else onViewPass,
    onVisitCoupleSite = onVisitCoupleSite,
    onContinue = if (presentation.attending == null) null else onContinue
)

/** The 5 meal options the PWA's own premium RSVP dialog offers (`mealChoice` is otherwise free text). */
private val MEAL_OPTIONS = listOf(
    "beef" to "Beef", "chicken" to "Chicken", "vegetarian" to "Vegetarian",
    "vegan" to "Vegan", "traditional" to "Traditional"
)

/**
 * Master plan Phase 9 — the full converged RSVP form: attendance, meal, plus-one (+ name/meal),
 * children (+ count, respecting adults-only), dietary notes and a message to the couple. Mirrors
 * the PWA's own `premium-invitation-rsvp-dialog.tsx` field set and submission shape exactly, so the
 * two clients converge on the same server contract rather than inventing a mobile-only one.
 */
@Composable
private fun LiveRsvpForm(
    guestName: String,
    childrenPolicy: String?,
    initial: LiveInvitationPresentation,
    isSubmitting: Boolean,
    childrenNotAllowed: Boolean,
    onDismissChildrenNotice: () -> Unit,
    onSubmit: (GuestRsvpUpdate) -> Unit,
    onDismiss: () -> Unit
) {
    val adultsOnly = childrenPolicy == "adults_only"
    var accepting by remember(initial) { mutableStateOf(initial.attending != false) }
    var mealChoice by remember(initial) { mutableStateOf(initial.mealChoice.orEmpty()) }
    var plusOne by remember(initial) { mutableStateOf(initial.plusOne) }
    var plusOneName by remember(initial) { mutableStateOf(initial.plusOneName.orEmpty()) }
    var plusOneMeal by remember(initial) { mutableStateOf(initial.plusOneMeal.orEmpty()) }
    // Never let a stale client pre-select children attendance on an adults-only wedding — the
    // server remains final enforcement authority regardless, but the form must not encourage it.
    var kidsAttending by remember(initial) { mutableStateOf(if (adultsOnly) false else initial.kidsAttending) }
    var kidsCount by remember(initial) { mutableStateOf(initial.kidsCount ?: 0) }
    var dietaryNotes by remember(initial) { mutableStateOf(initial.dietaryNotes.orEmpty()) }
    var message by remember(initial) { mutableStateOf(initial.message.orEmpty()) }

    fun buildUpdate(): GuestRsvpUpdate = GuestRsvpUpdate(
        attending = accepting,
        // Sent (never omitted) only while accepting — an empty string here intentionally clears a
        // previously-saved choice, matching the server's own trim-to-null semantics; omitted
        // entirely while declining, so a decline never disturbs a meal choice saved from a prior
        // acceptance.
        mealChoice = if (accepting) mealChoice.trim() else null,
        plusOne = if (accepting) plusOne else false,
        plusOneName = if (accepting && plusOne) plusOneName.trim() else null,
        plusOneMeal = if (accepting && plusOne) plusOneMeal.trim() else null,
        kidsAttending = if (accepting && !adultsOnly) kidsAttending else false,
        kidsCount = if (accepting && !adultsOnly && kidsAttending) kidsCount else null,
        dietaryNotes = if (accepting) dietaryNotes.trim() else null,
        // Always sent: a message to the couple is meaningful whether or not the guest is attending.
        message = message.trim(),
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.45f))
            .clickable(enabled = !isSubmitting, onClick = onDismiss)
            .testTag("invitation-rsvp-prompt"),
        contentAlignment = Alignment.BottomCenter
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.88f)
                .clickable(enabled = false) {},
            shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp),
            color = WeddingIdentityPalette.IvorySoft,
            border = BorderStroke(1.dp, WeddingIdentityPalette.Champagne.copy(alpha = 0.42f)),
            shadowElevation = 12.dp
        ) {
            Box {
                WeddingOrnamentBackdrop(
                    modifier = Modifier.matchParentSize(),
                    alpha = 0.045f
                )
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 24.dp, vertical = 22.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        WeddingBrandMark()
                        Column {
                            Text(
                                "RSVP",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                letterSpacing = 2.sp,
                                color = WeddingIdentityPalette.ChampagneDeep
                            )
                            Text(
                                "Will you be joining us?",
                                fontSize = 23.sp,
                                fontFamily = FontFamily.Serif,
                                color = WeddingIdentityPalette.Ink
                            )
                        }
                    }
                    guestName.takeIf { it.isNotBlank() }?.let {
                        Text(
                            "For $it",
                            fontSize = 13.sp,
                            color = WeddingIdentityPalette.Muted
                        )
                    }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                RsvpChoiceChip(
                    "Joyfully accept",
                    selected = accepting,
                    testTag = "invitation-rsvp-accept",
                    modifier = Modifier.weight(1f)
                ) { accepting = true }
                RsvpChoiceChip(
                    "Regretfully decline",
                    selected = !accepting,
                    testTag = "invitation-rsvp-decline",
                    modifier = Modifier.weight(1f)
                ) { accepting = false }
            }

            if (accepting) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.testTag("invitation-rsvp-attending-fields")) {
                    Text("Meal preference", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = WeddingIdentityPalette.Muted)
                    Row(
                        modifier = Modifier.horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        MEAL_OPTIONS.forEach { (value, label) ->
                            RsvpChoiceChip(label, selected = mealChoice == value, testTag = "invitation-rsvp-meal-$value") { mealChoice = value }
                        }
                    }

                    HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

                    RsvpToggleRow(
                        label = "Bringing a plus one",
                        checked = plusOne,
                        onCheckedChange = { plusOne = it },
                        testTag = "invitation-rsvp-plus-one-toggle"
                    )
                    if (plusOne) {
                        Column(
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.testTag("invitation-rsvp-plus-one-details")
                        ) {
                            OutlinedTextField(
                                value = plusOneName,
                                onValueChange = { plusOneName = it },
                                label = { Text("Plus one's name") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth().testTag("invitation-rsvp-plus-one-name")
                            )
                            OutlinedTextField(
                                value = plusOneMeal,
                                onValueChange = { plusOneMeal = it },
                                label = { Text("Their meal preference") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth().testTag("invitation-rsvp-plus-one-meal")
                            )
                        }
                    }

                    HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

                    if (adultsOnly) {
                        Text(
                            "With love, we kindly ask that this be an adults-only celebration.",
                            fontSize = 12.sp,
                            color = WeddingIdentityPalette.Muted,
                            modifier = Modifier.testTag("invitation-rsvp-adults-only-note")
                        )
                    } else {
                        RsvpToggleRow(
                            label = "Children are attending",
                            checked = kidsAttending,
                            onCheckedChange = { kidsAttending = it },
                            testTag = "invitation-rsvp-kids-toggle"
                        )
                        if (kidsAttending) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(16.dp),
                                modifier = Modifier.testTag("invitation-rsvp-kids-stepper")
                            ) {
                                Text(
                                    "−",
                                    fontSize = 20.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = WeddingIdentityPalette.Ink,
                                    modifier = Modifier
                                        .clickable(enabled = kidsCount > 0) { kidsCount = (kidsCount - 1).coerceAtLeast(0) }
                                        .padding(8.dp)
                                )
                                Text("$kidsCount", fontSize = 15.sp, color = WeddingIdentityPalette.Ink)
                                Text(
                                    "+",
                                    fontSize = 20.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = WeddingIdentityPalette.Ink,
                                    modifier = Modifier
                                        .clickable { kidsCount = (kidsCount + 1).coerceAtMost(20) }
                                        .padding(8.dp)
                                )
                            }
                        }
                    }

                    OutlinedTextField(
                        value = dietaryNotes,
                        onValueChange = { dietaryNotes = it },
                        label = { Text("Dietary notes") },
                        modifier = Modifier.fillMaxWidth().testTag("invitation-rsvp-dietary-notes")
                    )
                }
            }

            OutlinedTextField(
                value = message,
                onValueChange = { message = it },
                label = { Text("Message to the couple") },
                modifier = Modifier.fillMaxWidth().testTag("invitation-rsvp-message")
            )

            if (childrenNotAllowed) {
                Text(
                    "This celebration is adults only, so children can't be added to your RSVP.",
                    fontSize = 12.sp,
                    color = WewedColors.Error,
                    modifier = Modifier
                        .clickable(onClick = onDismissChildrenNotice)
                        .testTag("invitation-rsvp-children-not-allowed")
                )
            }

                    if (isSubmitting) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                strokeWidth = 2.dp,
                                color = WeddingIdentityPalette.ChampagneDeep
                            )
                            Text("Recording your answer…", fontSize = 13.sp, color = WeddingIdentityPalette.Muted)
                        }
                    } else {
                        Button(
                            onClick = { onSubmit(buildUpdate()) },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = WeddingIdentityPalette.ChampagneDeep,
                                contentColor = Color.White
                            ),
                            shape = RoundedCornerShape(13.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(min = 50.dp)
                                .testTag("invitation-rsvp-save")
                        ) {
                            Text("Save RSVP", fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RsvpChoiceChip(
    label: String,
    selected: Boolean,
    testTag: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(999.dp),
        color = if (selected) WeddingIdentityPalette.ForestSoft else WeddingIdentityPalette.IvorySoft,
        border = BorderStroke(
            1.dp,
            if (selected) WeddingIdentityPalette.Forest.copy(alpha = 0.55f)
            else WeddingIdentityPalette.Hairline
        ),
        modifier = modifier
            .heightIn(min = 48.dp)
            .testTag(testTag)
    ) {
        Box(
            modifier = Modifier.padding(horizontal = 10.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                label,
                fontSize = 13.sp,
                fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                color = if (selected) WeddingIdentityPalette.Forest else WeddingIdentityPalette.Muted,
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
private fun RsvpToggleRow(label: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit, testTag: String) {
    Row(
        modifier = Modifier.fillMaxWidth().testTag(testTag),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, fontSize = 14.sp, color = WeddingIdentityPalette.Ink)
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(checkedTrackColor = WeddingIdentityPalette.Forest)
        )
    }
}

/**
 * Shown when the server refused the write because the session moved on.
 *
 * It says the answer was not saved. A silent failure here is worse than an error, because the
 * guest walks away believing they have replied.
 */
@Composable
private fun ReopenRequiredNotice(onDismiss: () -> Unit) {
    InvitationEditorBlockedNotice(
        testTag = "invitation-reopen-required",
        title = "Your answer wasn't saved",
        body = "Open your invitation link again, then reply.",
        onDismiss = onDismiss
    )
}

/**
 * Shown when the pre-open refresh finds the session now names a different wedding or guest.
 *
 * Distinct from [ReopenRequiredNotice]: nothing was submitted and nothing failed to save — the
 * presented card simply is not the one the server would hand back right now. The coordinator's
 * binding is left untouched, so the guest can still answer as themselves; this only stops the
 * editor from opening on top of a snapshot that is no longer current.
 */
@Composable
private fun StaleOrReplacedGuestNotice(onDismiss: () -> Unit) {
    InvitationEditorBlockedNotice(
        testTag = "invitation-stale-or-replaced-guest",
        title = "This invitation has moved on",
        body = "Open your invitation link again to see the latest.",
        onDismiss = onDismiss
    )
}

@Composable
private fun InvitationEditorBlockedNotice(testTag: String, title: String, body: String, onDismiss: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.55f))
            .clickable(onClick = onDismiss)
            .testTag(testTag),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .padding(28.dp)
                .background(WeddingIdentityPalette.Ivory)
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(
                title,
                fontSize = 18.sp,
                fontFamily = FontFamily.Serif,
                color = WeddingIdentityPalette.Ink,
                textAlign = TextAlign.Center
            )
            Text(
                body,
                fontSize = 13.sp,
                color = WeddingIdentityPalette.Muted,
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
private fun RefreshUnavailableNotice(onDismiss: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.55f))
            .clickable(onClick = onDismiss)
            .testTag("invitation-refresh-unavailable"),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .padding(28.dp)
                .background(WeddingIdentityPalette.Ivory)
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(
                "Couldn't load latest RSVP",
                fontSize = 18.sp,
                fontFamily = FontFamily.Serif,
                color = WeddingIdentityPalette.Ink,
                textAlign = TextAlign.Center
            )
            Text(
                "Please check your internet connection and try again.",
                fontSize = 13.sp,
                color = WeddingIdentityPalette.Muted,
                textAlign = TextAlign.Center
            )
        }
    }
}

/**
 * Wewed could not be reached.
 *
 * Deliberately distinct from a refusal: "try again in a moment" and "this link is not yours" are
 * opposite messages, and showing the wrong one is how a working invitation gets abandoned.
 */
@Composable
fun InvitationUnavailableScreen(onRetry: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WeddingIdentityPalette.Ivory)
            .testTag("invitation-unavailable"),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier.padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                "We couldn't reach Wewed",
                fontFamily = FontFamily.Serif,
                fontSize = 20.sp,
                color = WeddingIdentityPalette.Ink,
                textAlign = TextAlign.Center
            )
            Text(
                "Your invitation is fine. Check your connection and open the link again.",
                fontSize = 14.sp,
                color = WeddingIdentityPalette.Muted,
                textAlign = TextAlign.Center
            )
            Button(
                onClick = onRetry,
                colors = ButtonDefaults.buttonColors(
                    containerColor = WeddingIdentityPalette.ChampagneDeep,
                    contentColor = Color.White
                ),
                shape = RoundedCornerShape(13.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .testTag("invitation-unavailable-dismiss")
            ) {
                Text("Continue to Wewed", fontWeight = FontWeight.SemiBold)
            }
        }
    }
}
