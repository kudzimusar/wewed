package pro.wewed.app.ui.invitation

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import pro.wewed.app.R
import pro.wewed.app.invitation.*
import pro.wewed.app.theme.WeddingBrandMark
import pro.wewed.app.theme.WeddingIdentityPalette
import pro.wewed.app.theme.WewedColors
import pro.wewed.app.ui.roles.IACard
import pro.wewed.app.ui.roles.IASectionList
import java.text.SimpleDateFormat
import java.util.Locale
import kotlin.math.max

/**
 * The persistent experience an invitation-bound Guest lands in.
 *
 * It reuses the Guest information architecture the app already defines — Home, Invitation, Pass,
 * Wedding Day, More — rather than inventing a second set of tab names. What it does *not* reuse is
 * the Shadow guest shell's implementation, which depends on the wedding graph, navigation context
 * and the full repository. Those are exactly the production surfaces this slice is not authorized
 * to switch on, so the live shell is built from the guest-authorized session alone.
 *
 * This shell is reachable only after RSVP completion. Attending and declined Guests both retain
 * the persistent experience; venue admission remains attending-only.
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
            Column(modifier = Modifier.background(WeddingIdentityPalette.IvorySoft)) {
                HorizontalDivider(thickness = 1.dp, color = WeddingIdentityPalette.Hairline)
                NavigationBar(
                    containerColor = WeddingIdentityPalette.IvorySoft,
                    tonalElevation = 0.dp
                ) {
                    GuestSection.entries.forEach { candidate ->
                        NavigationBarItem(
                            selected = section == candidate,
                            onClick = {
                                if (candidate == GuestSection.INVITATION) onOpenInvitation()
                                else onSelect(candidate)
                            },
                            icon = {
                                Icon(
                                    when (candidate) {
                                        GuestSection.HOME -> Icons.Filled.Home
                                        GuestSection.INVITATION -> Icons.Filled.Email
                                        GuestSection.PASS -> Icons.Filled.QrCode
                                        GuestSection.WEDDING_DAY -> Icons.Filled.Event
                                        GuestSection.MORE -> Icons.Filled.Person
                                    },
                                    contentDescription = candidate.label
                                )
                            },
                            label = {
                                Text(
                                    candidate.label,
                                    fontSize = 11.sp,
                                    maxLines = 1,
                                    softWrap = false
                                )
                            },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = WeddingIdentityPalette.ChampagneDeep,
                                selectedTextColor = WeddingIdentityPalette.ChampagneDeep,
                                indicatorColor = Color.Transparent,
                                unselectedIconColor = WeddingIdentityPalette.Muted,
                                unselectedTextColor = WeddingIdentityPalette.Muted
                            ),
                            modifier = Modifier.testTag("nav-guest-${candidate.id}")
                        )
                    }
                }
            }
        }
    ) { padding ->
        when {
            section == GuestSection.INVITATION -> {
                Box(Modifier.fillMaxSize().padding(padding)) { invitationContent() }
            }
            section == GuestSection.PASS && profile.attending == true -> {
                Box(Modifier.fillMaxSize().padding(padding)) {
                    LiveIssuedGuestPass(profile, coordinator)
                }
            }
            section == GuestSection.WEDDING_DAY -> {
                Box(Modifier.fillMaxSize().padding(padding)) {
                    LiveGuestWeddingDay(profile, capabilities, coordinator)
                }
            }
            section == GuestSection.MORE -> {
                Box(Modifier.fillMaxSize().padding(padding)) {
                    LiveGuestProfile(profile, onForgetWedding, onOpenInvitation, coordinator)
                }
            }
            else -> {
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
                        GuestSection.PASS -> LiveGuestPass(profile, capabilities, onOpenInvitation)
                        else -> Unit
                    }
                }
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
    LiveGuestHero(profile)

    Card(
        onClick = onOpenInvitation,
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(
            containerColor = WeddingIdentityPalette.Champagne.copy(alpha = 0.20f)
        ),
        modifier = Modifier
            .fillMaxWidth()
            .testTag("guest-home-digital-invitation")
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Text(
                "MY DIGITAL INVITATION",
                style = MaterialTheme.typography.labelMedium,
                color = WeddingIdentityPalette.ChampagneDeep
            )
            Text(
                profile.coupleNames,
                fontFamily = FontFamily.Serif,
                fontSize = 22.sp,
                color = WeddingIdentityPalette.Ink
            )
            Text(
                "Open your interactive invitation →",
                fontSize = 14.sp,
                color = WewedColors.Emerald
            )
        }
    }

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        GuestFact(
            "RSVP",
            rsvpLabel(profile.attending),
            "live-guest-rsvp-status",
            modifier = Modifier.weight(1f)
        )
        if (GuestCapability.WEDDING_PASS in capabilities) {
            GuestFact(
                "Wedding Pass",
                "Ready in Pass",
                "live-guest-pass-hint",
                modifier = Modifier.weight(1f)
            )
        }
    }

    GuestFact("When", formatWeddingDate(profile.weddingDate), "live-guest-date")
    GuestFact(
        "Where",
        listOfNotNull(profile.venue, profile.venueCityCountry.takeIf { it.isNotBlank() })
            .joinToString(" · "),
        "live-guest-venue"
    )

    if (GuestCapability.SEATING in capabilities) {
        profile.tableName?.takeIf { it.isNotBlank() }?.let {
            GuestFact("Your table", it, "live-guest-table")
        }
    }
}

@Composable
private fun LiveGuestHero(profile: LiveInvitationPresentation) {
    val countdown by produceState(
        initialValue = guestCountdownFrom(profile.weddingDate),
        key1 = profile.weddingDate
    ) {
        while (true) {
            value = guestCountdownFrom(profile.weddingDate)
            delay(1_000)
        }
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(350.dp)
            .clip(RoundedCornerShape(23.dp))
            .border(
                1.dp,
                WeddingIdentityPalette.Champagne.copy(alpha = 0.35f),
                RoundedCornerShape(23.dp)
            )
            .testTag("live-guest-hero")
    ) {
        Image(
            painter = painterResource(R.drawable.hero_wedding),
            contentDescription = "Wedding visual",
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize()
        )
        Box(
            Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        listOf(
                            Color.Transparent,
                            Color.Black.copy(alpha = 0.16f),
                            Color.Black.copy(alpha = 0.82f)
                        )
                    )
                )
        )
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(17.dp)
        ) {
            WeddingBrandMark()
            Spacer(Modifier.weight(1f))
            Text(
                profile.coupleNames,
                fontFamily = FontFamily.Serif,
                fontStyle = FontStyle.Italic,
                fontSize = 34.sp,
                color = Color.White,
                modifier = Modifier.testTag("live-guest-couple")
            )
            Text(
                "YOUR WEDDING INVITATION",
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 2.6.sp,
                color = Color.White.copy(alpha = 0.90f)
            )
            Text(
                formatWeddingDate(profile.weddingDate),
                fontSize = 17.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color.White
            )
            countdown?.let { remaining ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    GuestCountdownTile(remaining.days, "Days", Modifier.weight(1f))
                    GuestCountdownTile(remaining.hours, "Hours", Modifier.weight(1f))
                    GuestCountdownTile(remaining.minutes, "Mins", Modifier.weight(1f))
                    GuestCountdownTile(remaining.seconds, "Secs", Modifier.weight(1f))
                }
            }
            Text(
                "Welcome, ${profile.guestName}",
                fontSize = 14.sp,
                color = Color.White.copy(alpha = 0.94f),
                modifier = Modifier
                    .padding(top = 8.dp)
                    .testTag("live-guest-name")
            )
        }
    }
}

@Composable
private fun GuestCountdownTile(value: Long, label: String, modifier: Modifier = Modifier) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(Color.Black.copy(alpha = 0.46f))
            .padding(vertical = 7.dp)
    ) {
        Text(value.toString(), fontFamily = FontFamily.Serif, fontSize = 21.sp, color = Color.White)
        Text(label, fontSize = 9.sp, color = Color.White.copy(alpha = 0.88f))
    }
}

private data class GuestCountdown(
    val days: Long,
    val hours: Long,
    val minutes: Long,
    val seconds: Long
)

private fun guestCountdownFrom(raw: String?): GuestCountdown? {
    val source = raw.orEmpty().trim()
    if (source.isEmpty()) return null
    val target = listOf(
        "yyyy-MM-dd'T'HH:mm:ssXXX",
        "yyyy-MM-dd'T'HH:mm:ss",
        "yyyy-MM-dd HH:mm:ss",
        "yyyy-MM-dd'T'HH:mm",
        "yyyy-MM-dd"
    ).firstNotNullOfOrNull { pattern ->
        runCatching {
            SimpleDateFormat(pattern, Locale.US).apply { isLenient = false }.parse(source)
        }.getOrNull()
    } ?: return null
    var seconds = max(0L, (target.time - System.currentTimeMillis()) / 1_000L)
    val days = seconds / 86_400L
    seconds %= 86_400L
    val hours = seconds / 3_600L
    seconds %= 3_600L
    val minutes = seconds / 60L
    seconds %= 60L
    return GuestCountdown(days, hours, minutes, seconds)
}

/** The pass, or an honest statement of why there isn't one. */
@Composable
private fun LiveGuestPass(
    profile: LiveInvitationPresentation,
    capabilities: Set<GuestCapability>,
    onOpenInvitation: () -> Unit
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

        GuestCapability.WEDDING_PASS !in capabilities -> {
            GuestFact(
                "No venue admission pass is currently issued",
                "Your invitation remains active. If your plans change, return to your invitation and update your RSVP.",
                "live-guest-pass-declined"
            )
            TextButton(
                onClick = onOpenInvitation,
                modifier = Modifier.testTag("live-guest-pass-change-rsvp")
            ) {
                Text("Update RSVP in Invitation")
            }
        }

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

/** Shared wedding-day information for answered Guests; venue-admission details stay attending-only. */
@Composable
private fun LiveGuestWeddingDay(
    profile: LiveInvitationPresentation,
    capabilities: Set<GuestCapability>,
    coordinator: LiveGuestInvitationCoordinator
) {
    if (GuestCapability.WEDDING_DAY_PROGRAMME !in capabilities) {
        IASectionList(
            title = "Wedding Day",
            subtitle = formatWeddingDate(profile.weddingDate)
        ) {
            IACard(
                title = "Wedding Day details",
                subtitle = if (profile.attending == null)
                    "Confirm your attendance to see the day's plan."
                else
                    "The day's plan is for guests who are joining on the day.",
                testTag = "live-guest-day-locked"
            )
        }
        return
    }

    var day by remember(profile.guestId) { mutableStateOf<org.json.JSONObject?>(null) }
    var failed by remember(profile.guestId) { mutableStateOf(false) }
    LaunchedEffect(profile.guestId) {
        try { day = coordinator.weddingDay(profile.guestId) }
        catch (cancelled: kotlinx.coroutines.CancellationException) { throw cancelled }
        catch (_: Exception) { failed = true }
    }

    IASectionList(
        title = "Wedding Day",
        subtitle = listOf(
            formatWeddingDate(profile.weddingDate),
            profile.venue.orEmpty()
        ).filter { it.isNotBlank() }.joinToString(" · ")
    ) {
        if (failed) {
            IACard(
                title = "Wedding Day unavailable",
                subtitle = "We couldn't load the day's details. Please try again.",
                testTag = "guest-day-unavailable"
            )
        } else if (day == null) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp),
                horizontalArrangement = Arrangement.Center
            ) {
                CircularProgressIndicator(color = WeddingIdentityPalette.ChampagneDeep)
            }
        }

        day?.let { data ->
            GuestSectionHeading("Programme", "guest-day-programme")
            val programme = data.optJSONArray("programme")
            for (index in 0 until (programme?.length() ?: 0)) {
                val item = programme!!.getJSONObject(index)
                IACard(
                    title = item.optString("title"),
                    trailing = item.optString("time").takeIf { it.isNotBlank() },
                    testTag = "guest-programme-${item.optString("id")}"
                )
            }
            if ((programme?.length() ?: 0) == 0) {
                IACard("Programme", "No programme items have been published yet.")
            }

            if (GuestCapability.ANNOUNCEMENTS in capabilities) {
                GuestSectionHeading("Announcements", "guest-day-announcements")
                val announcements = data.optJSONArray("announcements")
                for (index in 0 until (announcements?.length() ?: 0)) {
                    val item = announcements!!.getJSONObject(index)
                    IACard(
                        title = item.optString("title"),
                        subtitle = item.optString("body"),
                        testTag = "guest-announcement-${item.optString("id")}"
                    )
                }
                if ((announcements?.length() ?: 0) == 0) {
                    IACard("No announcements", "The wedding team has not posted an update.")
                }
            }

            val guest = data.getJSONObject("guest")
            if (GuestCapability.PARTY_DETAILS in capabilities) {
                GuestSectionHeading("My Party", "guest-day-party")
                val party = guest.optJSONArray("household")
                for (index in 0 until (party?.length() ?: 0)) {
                    val member = party!!.getJSONObject(index)
                    IACard(
                        title = member.optString("attendeeName"),
                        subtitle = "Your wedding party",
                        testTag = "guest-party-member-$index"
                    )
                }
            }

            GuestSectionHeading("Wedding details", "guest-day-details")
            IACard(
                title = "Date",
                subtitle = formatWeddingDate(profile.weddingDate),
                testTag = "live-guest-day-date"
            )
            IACard(
                title = "Venue",
                subtitle = listOfNotNull(
                    profile.venue,
                    profile.venueCityCountry.takeIf { it.isNotBlank() }
                ).joinToString(" · "),
                testTag = "live-guest-day-venue"
            )
            if (GuestCapability.SEATING in capabilities && !guest.isNull("tableName")) {
                IACard(
                    title = "My Table",
                    subtitle = guest.getString("tableName"),
                    testTag = "guest-day-table"
                )
            }
            if (GuestCapability.CHECK_IN_STATE in capabilities) {
                IACard(
                    title = "Admission",
                    subtitle = if (guest.optBoolean("checkedIn")) "Checked in" else "Not yet checked in",
                    status = if (guest.optBoolean("checkedIn")) "Arrived" else "Wedding-day status",
                    testTag = "guest-day-check-in"
                )
            }
        }
    }
}

/**
 * The Guest's own profile.
 *
 * Everything here is theirs and already known to the wedding. Presentation reuses the approved
 * Wewed IA cards; authority remains the live Guest Session and guest-scoped published content.
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

    IASectionList(
        title = "My details",
        subtitle = profile.coupleNames
    ) {
        IACard(
            title = "My Digital Invitation",
            subtitle = "Open the Ivory invitation and update your RSVP.",
            trailing = "Open",
            testTag = "guest-profile-digital-invitation",
            onClick = onOpenInvitation
        )
        IACard("Name", profile.guestName, testTag = "live-guest-profile-name")
        IACard("Wedding", profile.coupleNames, testTag = "live-guest-profile-wedding")
        IACard(
            "RSVP",
            rsvpLabel(profile.attending),
            status = if (profile.attending == true) "Attending" else if (profile.attending == false) "Not attending" else "Pending",
            testTag = "live-guest-profile-rsvp"
        )
        profile.mealChoice?.takeIf { it.isNotBlank() }?.let {
            IACard("Meal", it, testTag = "live-guest-profile-meal")
        }
        if (profile.plusOne) {
            IACard("Plus one", profile.plusOneName ?: "Yes", testTag = "live-guest-profile-plus-one")
        }
        if (profile.kidsAttending) {
            IACard(
                "Children",
                profile.kidsCount?.toString() ?: "Yes",
                testTag = "live-guest-profile-kids"
            )
        }
        profile.dietaryNotes?.takeIf { it.isNotBlank() }?.let {
            IACard("Dietary / access", it, testTag = "live-guest-profile-dietary")
        }
        profile.message?.takeIf { it.isNotBlank() }?.let {
            IACard("Your message", it, testTag = "live-guest-profile-message")
        }
        profile.tableName?.takeIf { it.isNotBlank() }?.let {
            IACard("Table", it, testTag = "live-guest-profile-table")
        }
        if (story.isNotBlank()) {
            IACard("Our Story", story, testTag = "guest-published-story")
        }
        IACard(
            title = "Couple Website",
            subtitle = "Open the couple's public wedding site.",
            trailing = "Open",
            testTag = "guest-profile-couple-site",
            onClick = {
                context.startActivity(
                    Intent(
                        Intent.ACTION_VIEW,
                        Uri.parse("https://wewed.pro/w/${Uri.encode(profile.weddingSlug)}")
                    )
                )
            }
        )
        IACard(
            title = "Forget this wedding on this device",
            subtitle = "Removes this Guest relationship from this device. It does not affect your RSVP.",
            testTag = "live-guest-forget-wedding",
            onClick = onForgetWedding
        )
    }
}

@Composable
private fun GuestSectionHeading(title: String, tag: String) {
    Text(
        title,
        fontFamily = FontFamily.Serif,
        fontSize = 17.sp,
        fontWeight = FontWeight.SemiBold,
        color = WeddingIdentityPalette.Ink,
        modifier = Modifier.padding(top = 8.dp, bottom = 2.dp).testTag(tag)
    )
}

@Composable
private fun GuestFact(
    label: String,
    value: String,
    tag: String,
    modifier: Modifier = Modifier
) {
    if (value.isBlank()) return
    Surface(
        modifier = modifier.fillMaxWidth().testTag(tag),
        shape = RoundedCornerShape(12.dp),
        color = WeddingIdentityPalette.IvorySoft,
        border = BorderStroke(1.dp, WeddingIdentityPalette.Hairline)
    ) {
        Column(modifier = Modifier.padding(horizontal = 13.dp, vertical = 11.dp)) {
            Text(
                label.uppercase(),
                fontSize = 10.sp,
                letterSpacing = 1.4.sp,
                color = WeddingIdentityPalette.Muted
            )
            Text(value, fontSize = 15.sp, color = WeddingIdentityPalette.Ink)
        }
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
