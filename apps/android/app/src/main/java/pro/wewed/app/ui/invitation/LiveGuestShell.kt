package pro.wewed.app.ui.invitation

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.invitation.*
import pro.wewed.app.theme.WeddingIdentityPalette
import pro.wewed.app.theme.WewedColors

/**
 * The persistent experience an invitation-bound Guest lands in.
 *
 * It reuses the Guest information architecture the app already defines — Home, Invitation, Pass,
 * Wedding Day, More — rather than inventing a second set of tab names. What it does *not* reuse is
 * the Shadow guest shell's implementation, which depends on the wedding graph, navigation context
 * and the full repository. Those are exactly the production surfaces this slice is not authorized
 * to switch on, so the live shell is built from the guest-authorized session alone.
 *
 * The Guest reaches this without answering anything. RSVP decides what is *in* here, not whether
 * they may be here.
 */
@Composable
fun LiveGuestShell(
    profile: LiveInvitationPresentation,
    coordinator: LiveGuestInvitationCoordinator,
    onOpenInvitation: () -> Unit,
    section: GuestSection,
    onSelect: (GuestSection) -> Unit,
    invitationContent: @Composable () -> Unit,
    onForgetWedding: () -> Unit,
    modifier: Modifier = Modifier
) {
    val capabilities = remember(profile.attending) {
        GuestCapabilityPolicy.capabilities(profile.attending)
    }

    Scaffold(
        modifier = modifier.testTag("live-guest-shell"),
        containerColor = WeddingIdentityPalette.Ivory,
        bottomBar = {
            NavigationBar(containerColor = WeddingIdentityPalette.Ivory) {
                GuestSection.entries.forEach { candidate ->
                    NavigationBarItem(
                        selected = section == candidate,
                        onClick = {
                            if (candidate == GuestSection.INVITATION) onOpenInvitation()
                            else onSelect(candidate)
                        },
                        icon = { Icon(when (candidate) {
                            GuestSection.HOME -> Icons.Outlined.Home
                            GuestSection.INVITATION -> Icons.Outlined.MailOutline
                            GuestSection.PASS -> Icons.Outlined.QrCode
                            GuestSection.WEDDING_DAY -> Icons.Outlined.Event
                            GuestSection.MORE -> Icons.Outlined.PersonOutline
                        }, contentDescription = null) },
                        label = { Text(candidate.label, fontSize = 11.sp) },
                        modifier = Modifier.testTag("nav-guest-${candidate.id}")
                    )
                }
            }
        }
    ) { padding ->
        if (section == GuestSection.INVITATION) {
            Box(Modifier.fillMaxSize().padding(padding)) { invitationContent() }
            return@Scaffold
        }
        if (section == GuestSection.PASS && profile.attending == true) {
            Box(Modifier.fillMaxSize().padding(padding)) { LiveIssuedGuestPass(profile, coordinator) }
            return@Scaffold
        }
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            when (section) {
                GuestSection.HOME -> LiveGuestHome(profile, capabilities, onOpenInvitation)
                GuestSection.INVITATION -> LiveGuestHome(profile, capabilities, onOpenInvitation)
                GuestSection.PASS -> LiveGuestPass(profile, capabilities)
                GuestSection.WEDDING_DAY -> LiveGuestWeddingDay(profile, capabilities, coordinator)
                GuestSection.MORE -> LiveGuestProfile(profile, onForgetWedding, onOpenInvitation, coordinator)
            }
        }
    }
}

/** The Guest tabs, named to match the IA contract rather than reinvented. */
enum class GuestSection(val id: String, val label: String) {
    HOME("home", "Home"),
    INVITATION("invitation", "Invitation"),
    PASS("pass", "Pass"),
    WEDDING_DAY("wedding_day", "Wedding Day"),
    MORE("more", "More")
}

/**
 * The Guest's own wedding at a glance.
 *
 * Deliberately useful rather than another onboarding page: who is marrying, when, where, who they
 * are, what they answered, and where they are sitting if that is known.
 */
@Composable
private fun LiveGuestHome(
    profile: LiveInvitationPresentation,
    capabilities: Set<GuestCapability>,
    onOpenInvitation: () -> Unit
) {
    Text(
        profile.coupleNames,
        fontFamily = FontFamily.Serif,
        fontSize = 28.sp,
        color = WeddingIdentityPalette.Ink,
        modifier = Modifier.testTag("live-guest-couple")
    )
    Text(
        profile.guestName,
        fontSize = 16.sp,
        fontWeight = FontWeight.Medium,
        color = WeddingIdentityPalette.Ink,
        modifier = Modifier.testTag("live-guest-name")
    )
    Text(
        rsvpLabel(profile.attending),
        fontSize = 14.sp,
        color = WewedColors.Emerald,
        modifier = Modifier.testTag("live-guest-rsvp-status")
    )

    Card(onClick = onOpenInvitation, modifier = Modifier.fillMaxWidth().testTag("guest-home-digital-invitation")) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("MY DIGITAL INVITATION", style = MaterialTheme.typography.labelMedium)
            Text(profile.coupleNames, fontFamily = FontFamily.Serif, fontSize = 22.sp)
            Text("View invitation →")
        }
    }
    GuestFact("When", formatWeddingDate(profile.weddingDate), "live-guest-date")
    GuestFact(
        "Where",
        listOfNotNull(profile.venue, profile.venueCityCountry.takeIf { it.isNotBlank() })
            .joinToString(" · "),
        "live-guest-venue"
    )

    // Seating is attending-only: it presumes someone is coming.
    if (GuestCapability.SEATING in capabilities) {
        profile.tableName?.takeIf { it.isNotBlank() }?.let {
            GuestFact("Your table", it, "live-guest-table")
        }
    }

    if (GuestCapability.WEDDING_PASS in capabilities) {
        GuestFact("Wedding Pass", "Available in the Pass tab", "live-guest-pass-hint")
    }
}

/** The pass, or an honest statement of why there isn't one. */
@Composable
private fun LiveGuestPass(
    profile: LiveInvitationPresentation,
    capabilities: Set<GuestCapability>
) {
    Text("Wedding Pass", fontFamily = FontFamily.Serif, fontSize = 22.sp,
         color = WeddingIdentityPalette.Ink)

    when {
        GuestCapability.WEDDING_PASS !in capabilities && profile.attending == null ->
            GuestFact(
                "Not yet",
                "Available after you confirm attendance.",
                "live-guest-pass-pending"
            )

        GuestCapability.WEDDING_PASS !in capabilities ->
            GuestFact(
                "No admission",
                "You let the couple know you can't make it, so there's no pass to issue.",
                "live-guest-pass-declined"
            )

        else ->
            // Attending, but the credential itself comes from the Wedding Day issuer, which is not
            // reachable in production yet. Saying so is better than rendering an empty QR frame.
            GuestFact(
                "Coming soon",
                "Your pass will appear here once the couple's wedding-day check-in is live.",
                "live-guest-pass-unavailable"
            )
    }
}

/** The day itself. Attending-only, because it presumes someone is coming. */
@Composable
private fun LiveGuestWeddingDay(
    profile: LiveInvitationPresentation,
    capabilities: Set<GuestCapability>,
    coordinator: LiveGuestInvitationCoordinator
) {
    Text("Wedding Day", fontFamily = FontFamily.Serif, fontSize = 22.sp,
         color = WeddingIdentityPalette.Ink)

    if (GuestCapability.WEDDING_DAY_PROGRAMME !in capabilities) {
        GuestFact(
            "Not yet",
            if (profile.attending == null) "Confirm your attendance to see the day's plan."
            else "The day's plan is for guests who are joining on the day.",
            "live-guest-day-locked"
        )
        return
    }

    var day by remember(profile.guestId) { mutableStateOf<org.json.JSONObject?>(null) }
    var failed by remember(profile.guestId) { mutableStateOf(false) }
    LaunchedEffect(profile.guestId) {
        try { day = coordinator.weddingDay(profile.guestId) }
        catch (cancelled: kotlinx.coroutines.CancellationException) { throw cancelled }
        catch (_: Exception) { failed = true }
    }
    if (failed) GuestFact("Unavailable", "We couldn't load the day's details. Please try again.", "guest-day-unavailable")
    if (day == null && !failed) CircularProgressIndicator()
    day?.let { data ->
        val programme = data.optJSONArray("programme")
        Text("Programme", modifier = Modifier.testTag("guest-day-programme"))
        for (index in 0 until (programme?.length() ?: 0)) {
            val item = programme!!.getJSONObject(index)
            GuestFact(item.optString("time"), item.optString("title"), "guest-programme-${item.optString("id")}")
        }
        Text("Announcements", modifier = Modifier.testTag("guest-day-announcements"))
        val announcements = data.optJSONArray("announcements")
        for (index in 0 until (announcements?.length() ?: 0)) {
            val item = announcements!!.getJSONObject(index)
            GuestFact(item.optString("title"), item.optString("body"), "guest-announcement-${item.optString("id")}")
        }
        val guest = data.getJSONObject("guest")
        val party = guest.optJSONArray("household")
        Text("My Party", modifier = Modifier.testTag("guest-day-party"))
        for (index in 0 until (party?.length() ?: 0)) Text(party!!.getJSONObject(index).optString("attendeeName"))
        if (!guest.isNull("tableName")) GuestFact("My Table", guest.getString("tableName"), "guest-day-table")
        GuestFact("Admission", if (guest.optBoolean("checkedIn")) "Checked in" else "Not yet checked in", "guest-day-check-in")
    }

    GuestFact("When", formatWeddingDate(profile.weddingDate), "live-guest-day-date")
    GuestFact("Where", profile.venue.orEmpty(), "live-guest-day-venue")
    profile.tableName?.takeIf { it.isNotBlank() }?.let {
        GuestFact("Your table", it, "live-guest-day-table")
    }
    if (profile.checkedIn) {
        GuestFact("Arrived", "You're checked in.", "live-guest-checked-in")
    }
}

/**
 * The Guest's own profile.
 *
 * Everything here is theirs and already known to the wedding. There is deliberately no "create an
 * account", "set a password" or "complete your profile" wall: the invitation was the onboarding.
 */
@Composable
private fun LiveGuestProfile(
    profile: LiveInvitationPresentation,
    onForgetWedding: () -> Unit,
    onOpenInvitation: () -> Unit,
    coordinator: LiveGuestInvitationCoordinator
) {
    val context = LocalContext.current
    var story by remember(profile.guestId) { mutableStateOf("") }
    LaunchedEffect(profile.guestId) {
        try { story = coordinator.publishedStory(profile.weddingSlug) }
        catch (cancelled: kotlinx.coroutines.CancellationException) { throw cancelled }
        catch (_: Exception) { }
    }
    TextButton(onClick = onOpenInvitation, modifier = Modifier.testTag("guest-profile-digital-invitation")) {
        Text("View my Digital Invitation")
    }
    Text("Your details", fontFamily = FontFamily.Serif, fontSize = 22.sp,
         color = WeddingIdentityPalette.Ink,
         modifier = Modifier.testTag("live-guest-profile"))

    GuestFact("Name", profile.guestName, "live-guest-profile-name")
    GuestFact("Wedding", profile.coupleNames, "live-guest-profile-wedding")
    GuestFact("RSVP", rsvpLabel(profile.attending), "live-guest-profile-rsvp")
    profile.mealChoice?.let { GuestFact("Meal", it, "live-guest-profile-meal") }
    if (profile.plusOne) {
        GuestFact("Plus one", profile.plusOneName ?: "Yes", "live-guest-profile-plus-one")
    }
    if (profile.kidsAttending) {
        GuestFact("Children", profile.kidsCount?.toString() ?: "Yes", "live-guest-profile-kids")
    }
    profile.dietaryNotes?.let { GuestFact("Dietary / access", it, "live-guest-profile-dietary") }
    profile.message?.let { GuestFact("Your message", it, "live-guest-profile-message") }
    profile.tableName?.takeIf { it.isNotBlank() }
        ?.let { GuestFact("Table", it, "live-guest-profile-table") }

    if (story.isNotBlank()) GuestFact("Our Story", story, "guest-published-story")
    TextButton(onClick = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://wewed.pro/w/${Uri.encode(profile.weddingSlug)}"))) }) {
        Text("Back to Wewed Couple Site")
    }
    Spacer(Modifier.height(8.dp))

    // Guest access is device-persistent, so there has to be a way to remove it. Deliberately not
    // called Sign Out: it ends a wedding relationship on this device, not a Wewed account.
    Text(
        "Forget this wedding on this device",
        fontSize = 14.sp,
        fontWeight = FontWeight.SemiBold,
        color = WewedColors.Gold,
        modifier = Modifier
            .clickable(onClick = onForgetWedding)
            .padding(vertical = 10.dp)
            .testTag("live-guest-forget-wedding")
    )
}

@Composable
private fun GuestFact(label: String, value: String, tag: String) {
    if (value.isBlank()) return
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(WeddingIdentityPalette.Ivory)
            .padding(vertical = 6.dp)
            .testTag(tag)
    ) {
        Text(label.uppercase(), fontSize = 10.sp, letterSpacing = 1.4.sp,
             color = WeddingIdentityPalette.Muted)
        Text(value, fontSize = 15.sp, color = WeddingIdentityPalette.Ink)
    }
}

private fun rsvpLabel(attending: Boolean?): String = when (attending) {
    true -> "RSVP confirmed"
    false -> "Response recorded — not attending"
    null -> "Awaiting your reply"
}

/** "23 December 2026" from whatever shape the graph returned. */
private fun formatWeddingDate(raw: String?): String {
    val iso = raw.orEmpty().trim().take(10)
    val parts = iso.split("-")
    if (parts.size < 3) return raw.orEmpty()
    val months = listOf(
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    )
    val month = parts[1].toIntOrNull()?.minus(1)?.let { months.getOrNull(it) } ?: return raw.orEmpty()
    val day = parts[2].toIntOrNull() ?: return raw.orEmpty()
    return "$day $month ${parts[0]}"
}

@Composable
private fun LiveIssuedGuestPass(profile: LiveInvitationPresentation, coordinator: LiveGuestInvitationCoordinator) {
    var pass by remember(profile.guestId) { mutableStateOf<pro.wewed.app.models.WeddingPass?>(null) }
    var failed by remember(profile.guestId) { mutableStateOf(false) }
    LaunchedEffect(profile.guestId) {
        try { pass = coordinator.weddingPass(profile.guestId) }
        catch (cancelled: kotlinx.coroutines.CancellationException) { throw cancelled }
        catch (_: Exception) { failed = true }
    }
    if (pass != null) pro.wewed.app.ui.pass.WeddingReferencePassScreen(onOpenScanner = {}, providedPass = pass, showScanner = false)
    else if (failed) Text("Your Wedding Pass is unavailable. Please try again later.", modifier = Modifier.padding(20.dp).testTag("live-guest-pass-unavailable"))
    else Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
}
