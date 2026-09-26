package pro.wewed.app.ui.invitation

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.BorderStroke
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
                    modifier = Modifier.fillMaxWidth(),
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
                                        GuestSection.INVITATION -> Icons.Filled.MailOutline
                                        GuestSection.PASS -> Icons.Filled.QrCode
                                        GuestSection.WEDDING_DAY -> Icons.Filled.Celebration
                                        GuestSection.MORE -> Icons.Filled.ManageAccounts
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
                    LiveGuestMore(profile, onForgetWedding, coordinator)
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
                        GuestSection.HOME -> LiveGuestHome(
                            profile = profile,
                            capabilities = capabilities,
                            coordinator = coordinator,
                            onOpenInvitation = onOpenInvitation,
                            onOpenPass = { onSelect(GuestSection.PASS) }
                        )
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
    coordinator: LiveGuestInvitationCoordinator,
    onOpenInvitation: () -> Unit,
    onOpenPass: () -> Unit
) {
    val context = LocalContext.current
    var day by remember(profile.guestId) { mutableStateOf<org.json.JSONObject?>(null) }

    LaunchedEffect(profile.guestId, capabilities) {
        if (GuestCapability.WEDDING_DAY_PROGRAMME in capabilities) {
            try { day = coordinator.weddingDay(profile.guestId) }
            catch (cancelled: kotlinx.coroutines.CancellationException) { throw cancelled }
            catch (_: Exception) { day = null }
        } else {
            day = null
        }
    }

    LiveGuestHero(profile)

    Button(
        onClick = {
            val target = resolveLiveVenueDestination(profile)
            runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(target))) }
        },
        colors = ButtonDefaults.buttonColors(
            containerColor = WeddingIdentityPalette.ChampagneDeep,
            contentColor = Color.White
        ),
        shape = RoundedCornerShape(15.dp),
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 54.dp)
            .testTag("guest-home-directions")
    ) {
        Icon(Icons.Filled.Directions, contentDescription = null, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(9.dp))
        Text("Directions to Venue", fontWeight = FontWeight.SemiBold)
    }

    IACard(
        title = "Wedding Pass",
        subtitle = if (profile.attending == true)
            "Your admission pass is ready."
        else
            "No venue admission pass is currently issued.",
        trailing = if (profile.attending == true) "Ready" else "No admission",
        status = if (profile.attending == true) "Attending" else null,
        testTag = "guest-home-pass",
        onClick = onOpenPass
    )

    IACard(
        title = "My Digital Invitation",
        subtitle = "Reopen your personalised Ivory invitation.",
        trailing = "Open",
        testTag = "guest-home-digital-invitation",
        onClick = onOpenInvitation
    )

    day?.optJSONArray("programme")
        ?.takeIf { it.length() > 0 }
        ?.optJSONObject(0)
        ?.let { item ->
            IACard(
                title = item.optString("title").ifBlank { "Wedding Day" },
                subtitle = listOf(
                    item.optString("time"),
                    item.optString("location")
                ).filter { it.isNotBlank() }.joinToString(" · ").takeIf { it.isNotBlank() },
                trailing = "Next",
                testTag = "guest-home-next-programme"
            )
        }

    day?.optJSONArray("announcements")
        ?.takeIf { GuestCapability.ANNOUNCEMENTS in capabilities && it.length() > 0 }
        ?.optJSONObject(0)
        ?.let { announcement ->
            IACard(
                title = announcement.optString("title").ifBlank { "Wedding update" },
                subtitle = announcement.optString("body").takeIf { it.isNotBlank() },
                status = "Announcement",
                testTag = "guest-home-announcement"
            )
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
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            "Wedding Pass",
            fontFamily = FontFamily.Serif,
            fontSize = 24.sp,
            color = WeddingIdentityPalette.Ink
        )

        when {
            GuestCapability.WEDDING_PASS !in capabilities && profile.attending == null -> {
                IACard(
                    title = "RSVP required",
                    subtitle = "Confirm your attendance from your invitation before a venue pass can be issued.",
                    status = "Locked",
                    testTag = "live-guest-pass-pending",
                    onClick = onOpenInvitation
                )
            }

            GuestCapability.WEDDING_PASS !in capabilities -> {
                Surface(
                    shape = RoundedCornerShape(18.dp),
                    color = WeddingIdentityPalette.IvorySoft,
                    border = BorderStroke(1.dp, WeddingIdentityPalette.Champagne.copy(alpha = 0.45f)),
                    modifier = Modifier.fillMaxWidth().testTag("live-guest-pass-declined")
                ) {
                    Column(
                        modifier = Modifier.padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        WeddingBrandMark()
                        Text(
                            "No venue admission pass",
                            fontFamily = FontFamily.Serif,
                            fontSize = 21.sp,
                            color = WeddingIdentityPalette.Ink
                        )
                        Text(
                            "Your invitation remains active. If your plans change, update your RSVP and Wewed will refresh your admission status.",
                            fontSize = 14.sp,
                            lineHeight = 20.sp,
                            color = WeddingIdentityPalette.Muted
                        )
                        OutlinedButton(
                            onClick = onOpenInvitation,
                            border = BorderStroke(1.dp, WeddingIdentityPalette.ChampagneDeep),
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = WeddingIdentityPalette.ChampagneDeep
                            ),
                            shape = RoundedCornerShape(13.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(min = 48.dp)
                                .testTag("live-guest-pass-change-rsvp")
                        ) {
                            Text("Update RSVP in Invitation", fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }

            else -> IACard(
                title = "Wedding Pass",
                subtitle = "Loading your verified admission credential.",
                status = "Preparing",
                testTag = "live-guest-pass-unavailable"
            )
        }
    }
}

/** Shared wedding-day information for answered Guests; venue-admission details stay attending-only. */
@Composable
private fun LiveGuestWeddingDay(
    profile: LiveInvitationPresentation,
    capabilities: Set<GuestCapability>,
    coordinator: LiveGuestInvitationCoordinator
) {
    val context = LocalContext.current

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
        try {
            day = coordinator.weddingDay(profile.guestId)
            failed = false
        } catch (cancelled: kotlinx.coroutines.CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            failed = true
        }
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
                    subtitle = item.optString("location").takeIf { it.isNotBlank() },
                    trailing = item.optString("time").takeIf { it.isNotBlank() },
                    testTag = "guest-programme-${item.optString("id")}"
                )
            }
            if ((programme?.length() ?: 0) == 0) {
                IACard("Programme", "No programme items have been published yet.")
            }

            GuestSectionHeading("Venue & directions", "guest-day-venue-section")
            IACard(
                title = profile.venue?.takeIf { it.isNotBlank() } ?: "Wedding venue",
                subtitle = profile.venueCityCountry.takeIf { it.isNotBlank() },
                trailing = "Directions",
                testTag = "live-guest-day-venue",
                onClick = {
                    val target = resolveLiveVenueDestination(profile)
                    runCatching {
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(target)))
                    }
                }
            )

            if (GuestCapability.ANNOUNCEMENTS in capabilities) {
                GuestSectionHeading("Announcements", "guest-day-announcements")
                val announcements = data.optJSONArray("announcements")
                for (index in 0 until (announcements?.length() ?: 0)) {
                    val item = announcements!!.getJSONObject(index)
                    IACard(
                        title = item.optString("title").ifBlank { "Wedding update" },
                        subtitle = item.optString("body"),
                        testTag = "guest-announcement-${item.optString("id")}"
                    )
                }
                if ((announcements?.length() ?: 0) == 0) {
                    IACard("No announcements", "The wedding team has not posted an update.")
                }
            }

            val guest = data.getJSONObject("guest")
            GuestSectionHeading("Arrival", "guest-day-arrival")
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

            if (GuestCapability.PARTY_DETAILS in capabilities) {
                val party = guest.optJSONArray("household")
                if ((party?.length() ?: 0) > 0) {
                    GuestSectionHeading("My Party", "guest-day-party")
                    for (index in 0 until party!!.length()) {
                        val member = party.getJSONObject(index)
                        IACard(
                            title = member.optString("attendeeName"),
                            subtitle = "Your wedding party",
                            testTag = "guest-party-member-\$index"
                        )
                    }
                }
            }
        }
    }
}

/**
 * Wedding extras and device relationship. Personal details are deliberately subordinate so More
 * does not duplicate Home, Invitation or Wedding Day.
 */
@Composable
private fun LiveGuestMore(
    profile: LiveInvitationPresentation,
    onForgetWedding: () -> Unit,
    coordinator: LiveGuestInvitationCoordinator
) {
    val context = LocalContext.current
    var story by remember(profile.guestId) { mutableStateOf("") }

    LaunchedEffect(profile.guestId) {
        try { story = coordinator.publishedStory(profile.weddingSlug) }
        catch (cancelled: kotlinx.coroutines.CancellationException) { throw cancelled }
        catch (_: Exception) { story = "" }
    }

    IASectionList(
        title = "More",
        subtitle = "Wedding extras, help and this device"
    ) {
        if (story.isNotBlank()) {
            GuestSectionHeading("Our Story", "guest-more-story")
            IACard(
                title = "Our Story",
                subtitle = story,
                testTag = "guest-published-story"
            )
        }

        GuestSectionHeading("Explore", "guest-more-explore")
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
            title = "Gift & Contribution Info",
            subtitle = "View the couple's published registry and contribution information.",
            trailing = "Open",
            testTag = "guest-more-gifts",
            onClick = {
                context.startActivity(
                    Intent(
                        Intent.ACTION_VIEW,
                        Uri.parse("https://wewed.pro/w/${Uri.encode(profile.weddingSlug)}#registry")
                    )
                )
            }
        )
        IACard(
            title = "Help",
            subtitle = "Open Wewed help and support.",
            trailing = "Open",
            testTag = "guest-more-help",
            onClick = {
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://wewed.pro/help")))
            }
        )
        IACard(
            title = "Privacy & Legal",
            subtitle = "Review Wewed privacy and legal information.",
            trailing = "Open",
            testTag = "guest-more-privacy",
            onClick = {
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://wewed.pro/legal")))
            }
        )

        GuestSectionHeading("My details", "guest-more-my-details")
        IACard("Name", profile.guestName, testTag = "live-guest-profile-name")
        IACard(
            "RSVP",
            rsvpLabel(profile.attending),
            status = if (profile.attending == true) "Attending" else "Not attending",
            testTag = "live-guest-profile-rsvp"
        )

        GuestSectionHeading("This device", "guest-more-device")
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
    // LQR01: the server's availability state, when it named one, so the Guest is told why.
    var availability by remember(profile.guestId) { mutableStateOf<pro.wewed.app.models.WeddingPassAvailability?>(null) }
    LaunchedEffect(profile.guestId) {
        try { pass = coordinator.weddingPass(profile.guestId) }
        catch (cancelled: kotlinx.coroutines.CancellationException) { throw cancelled }
        catch (error: GuestSessionException) {
            availability = (error.error as? GuestSessionError.PassUnavailable)?.availability
            failed = true
        }
        catch (_: Exception) { failed = true }
    }
    if (pass != null) pro.wewed.app.ui.pass.WeddingReferencePassScreen(onOpenScanner = {}, providedPass = pass, showScanner = false)
    else if (failed) Column(
        modifier = Modifier.padding(20.dp).testTag(WeddingPassAvailabilityCopy.testTag(availability)),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Text(WeddingPassAvailabilityCopy.message(availability))
        availability?.let { WeddingPassAvailabilityCopy.availableFrom(it) }?.let { Text(it) }
    }
    else Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
}
