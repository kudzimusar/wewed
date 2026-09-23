package pro.wewed.app.ui.invitation

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
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
import pro.wewed.app.theme.WeddingIdentityPalette
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
    var submitting by remember { mutableStateOf(false) }
    var reopenRequired by remember { mutableStateOf(false) }
    var childrenNotAllowed by remember { mutableStateOf(false) }
    var showNote by remember { mutableStateOf(false) }

    val status = presentation.rsvpStatus

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
                    // Re-read rather than trusting the local edit: what the card shows afterwards
                    // is what the server stored.
                    onRefreshed(coordinator.refresh())
                }
                // The card belongs to a guest who is no longer the active one. Saying nothing here
                // would let the guest believe their answer was recorded.
                is RsvpOutcome.ReopenRequired -> { rsvpPrompt = false; reopenRequired = true }
                // Distinct from ReopenRequired: this is a policy refusal (adults-only), not a stale
                // session — a "reopen your invitation" message would be actively misleading here.
                is RsvpOutcome.ChildrenNotAllowed -> childrenNotAllowed = true
                is RsvpOutcome.Unavailable -> { rsvpPrompt = false; reopenRequired = true }
            }
            submitting = false
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        NativeInvitationExperience(
            style = presentation.invitationCardStyle,
            data = presentation.toIvoryData(),
            rsvp = ivoryRsvpStateFrom(status),
            actions = resolveLiveInvitationActions(
                presentation = presentation,
                onRsvpPrompt = { rsvpPrompt = true },
                onAddToCalendar = { addWeddingToCalendar(context, presentation) },
                onOpenVenue = {
                    val target = presentation.venueMapUrl?.takeIf { it.isNotBlank() }
                        ?: ("geo:0,0?q=" + Uri.encode(
                            listOfNotNull(presentation.venue, presentation.venueCityCountry)
                                .joinToString(", ")
                        ))
                    runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(target))) }
                },
                onGifts = { openCoupleSite(context, presentation.weddingSlug, "#registry") },
                onNote = presentation.invitationCardMessage
                    ?.takeIf { it.isNotBlank() }
                    ?.let { { showNote = true } },
                onViewPass = onViewPass,
                onVisitCoupleSite = { openCoupleSite(context, presentation.weddingSlug, null) },
                onContinue = onContinue
            )
        )

        if (onBackToWedding != null) {
            androidx.compose.material3.TextButton(
                onClick = onBackToWedding,
                modifier = Modifier.align(Alignment.TopStart).testTag("invitation-back-to-wedding")
            ) { Text("Back to My Wedding") }
        }

        if (rsvpPrompt) {
            key(presentation) {
                LiveRsvpForm(
                    guestName = presentation.guestName,
                    childrenPolicy = presentation.childrenPolicy,
                    initial = presentation,
                    isSubmitting = submitting,
                    childrenNotAllowed = childrenNotAllowed,
                    onDismissChildrenNotice = { childrenNotAllowed = false },
                    onSubmit = { answer(it) },
                    onDismiss = { if (!submitting) rsvpPrompt = false }
                )
            }
        }

        if (reopenRequired) {
            ReopenRequiredNotice(onDismiss = { reopenRequired = false })
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
            .background(Color.Black.copy(alpha = 0.45f))
            .clickable(onClick = onDismiss)
            .testTag("invitation-note-sheet"),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .padding(32.dp)
                .background(WeddingIdentityPalette.Ivory)
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                "A note from us",
                fontSize = 13.sp,
                letterSpacing = 1.8.sp,
                color = WeddingIdentityPalette.Muted
            )
            Text(
                note,
                fontSize = 16.sp,
                fontFamily = FontFamily.Serif,
                color = WeddingIdentityPalette.Ink,
                textAlign = TextAlign.Center
            )
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
fun resolveLiveInvitationActions(
    presentation: LiveInvitationPresentation,
    onRsvpPrompt: () -> Unit,
    onAddToCalendar: () -> Unit = {},
    onOpenVenue: () -> Unit = {},
    onGifts: () -> Unit = {},
    onNote: (() -> Unit)? = null,
    onViewPass: (() -> Unit)? = null,
    onVisitCoupleSite: () -> Unit = {},
    onContinue: () -> Unit = {}
): IvoryActions = IvoryActions(
    onRsvp = onRsvpPrompt,
    onAddToCalendar = onAddToCalendar,
    onOpenVenue = onOpenVenue,
    onGifts = onGifts,
    onNote = onNote,
    onViewPass = if (presentation.attending == true) onViewPass else null,
    onVisitCoupleSite = onVisitCoupleSite,
    onContinue = onContinue
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
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.88f)
                .background(WeddingIdentityPalette.Ivory)
                .clickable(enabled = false) {}
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                "Will you be joining us?",
                fontSize = 20.sp,
                fontFamily = FontFamily.Serif,
                color = WeddingIdentityPalette.Ink
            )
            guestName.takeIf { it.isNotBlank() }?.let {
                Text(it, fontSize = 13.sp, color = WeddingIdentityPalette.Muted)
            }

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                RsvpChoiceChip("Joyfully accept", selected = accepting, testTag = "invitation-rsvp-accept") { accepting = true }
                RsvpChoiceChip("Regretfully decline", selected = !accepting, testTag = "invitation-rsvp-decline") { accepting = false }
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
                Text("Recording your answer…", fontSize = 13.sp, color = WeddingIdentityPalette.Muted)
            } else {
                Text(
                    "Save RSVP",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = WewedColors.Emerald,
                    modifier = Modifier
                        .clickable { onSubmit(buildUpdate()) }
                        .padding(vertical = 8.dp)
                        .testTag("invitation-rsvp-save")
                )
            }
        }
    }
}

@Composable
private fun RsvpChoiceChip(label: String, selected: Boolean, testTag: String, onClick: () -> Unit) {
    Text(
        label,
        fontSize = 13.sp,
        fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
        color = if (selected) WewedColors.Emerald else WeddingIdentityPalette.Muted,
        modifier = Modifier
            .clickable(onClick = onClick)
            .padding(vertical = 8.dp, horizontal = 14.dp)
            .testTag(testTag)
    )
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
            colors = SwitchDefaults.colors(checkedTrackColor = WewedColors.Emerald)
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
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.55f))
            .clickable(onClick = onDismiss)
            .testTag("invitation-reopen-required"),
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
                "Your answer wasn't saved",
                fontSize = 18.sp,
                fontFamily = FontFamily.Serif,
                color = WeddingIdentityPalette.Ink,
                textAlign = TextAlign.Center
            )
            Text(
                "Open your invitation link again, then reply.",
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
            Text(
                "Continue to Wewed",
                fontWeight = FontWeight.SemiBold,
                color = WewedColors.Emerald,
                modifier = Modifier
                    .clickable(onClick = onRetry)
                    .padding(8.dp)
                    .testTag("invitation-unavailable-dismiss")
            )
        }
    }
}
