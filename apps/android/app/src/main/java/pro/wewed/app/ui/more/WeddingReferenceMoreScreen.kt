package pro.wewed.app.ui.more

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.R
import pro.wewed.app.models.Wedding
import pro.wewed.app.services.RoleScopedAccess
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.state.SessionViewModel
import pro.wewed.app.theme.*
import pro.wewed.app.ui.planner.CoupleContributionsDestination
import pro.wewed.app.ui.shared.*

/** Couple "More": wedding profile, story, gallery, honeymoon and gifts, settings (Account) and help. */
@Composable
fun WeddingReferenceMoreScreen(
    appViewModel: AppViewModel,
    access: RoleScopedAccess,
    sessionViewModel: SessionViewModel
) {
    var wedding by remember { mutableStateOf<Wedding?>(null) }
    var loading by remember { mutableStateOf(true) }
    var destination by rememberSaveable { mutableStateOf<ReferenceMoreDestination?>(null) }

    LaunchedEffect(destination) {
        if (destination == null) {
            wedding = runCatching { appViewModel.repository.getWedding() }.getOrNull()
            loading = false
        }
    }

    destination?.let { current ->
        val back = { destination = null }
        when (current) {
            ReferenceMoreDestination.PROFILE -> WeddingProfileScreen(wedding, back)
            ReferenceMoreDestination.STORY -> MoreEmptyScreen("Our Story", "Your wedding story isn't available in the app yet.", back)
            ReferenceMoreDestination.GALLERY -> MoreEmptyScreen("Gallery", "Wedding photos aren't available in the app yet.", back)
            ReferenceMoreDestination.HONEYMOON -> HoneymoonScreen(access, back) { destination = ReferenceMoreDestination.CONTRIBUTIONS }
            ReferenceMoreDestination.CONTRIBUTIONS -> CoupleContributionsDestination(access) { destination = ReferenceMoreDestination.HONEYMOON }
            ReferenceMoreDestination.SETTINGS -> AccountScreen(sessionViewModel, access.grant, back)
            ReferenceMoreDestination.SUPPORT -> HelpSupportScreen(back)
        }
        return
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WeddingIdentityPalette.Ivory)
            .testTag("more-root")
    ) {
        WeddingOrnamentBackdrop(modifier = Modifier.matchParentSize(), alpha = 0.025f)

        if (loading) {
            CircularProgressIndicator(color = WeddingIdentityPalette.ChampagneDeep, modifier = Modifier.align(Alignment.Center))
            return@Box
        }
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("More", color = WeddingIdentityPalette.Ink, fontFamily = FontFamily.Serif, fontWeight = FontWeight.SemiBold, fontSize = 28.sp)
                    Text("Your wedding, beautifully organised.", color = WeddingIdentityPalette.Muted, fontSize = 14.sp)
                }
                Surface(
                    modifier = Modifier.size(48.dp).testTag("more-settings-shortcut"),
                    shape = CircleShape,
                    color = WeddingIdentityPalette.IvorySoft,
                    border = androidx.compose.foundation.BorderStroke(1.dp, WeddingIdentityPalette.Hairline),
                    onClick = { destination = ReferenceMoreDestination.SETTINGS }
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(Icons.Default.Settings, contentDescription = "Settings", tint = WeddingIdentityPalette.Ink)
                    }
                }
            }

            wedding?.let { currentWedding ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(WeddingIdentityPalette.IvorySoft)
                        .border(1.dp, WeddingIdentityPalette.Hairline, RoundedCornerShape(16.dp))
                        .clickable(role = Role.Button) { destination = ReferenceMoreDestination.PROFILE }
                        .testTag("more-wedding-profile")
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Image(
                        painter = painterResource(R.drawable.hero_wedding),
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.size(58.dp).clip(CircleShape)
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(currentWedding.coupleNames, color = WeddingIdentityPalette.Ink, fontFamily = FontFamily.Serif, fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
                        Text("Wedding Profile", color = WeddingIdentityPalette.Muted, fontSize = 14.sp)
                    }
                    Icon(Icons.Default.ChevronRight, contentDescription = null, tint = WeddingIdentityPalette.Muted)
                }
            }

            MoreRow("Our Story", "Your story and milestones", Icons.Default.PhotoLibrary, "more-story") { destination = ReferenceMoreDestination.STORY }
            MoreRow("Gallery", "Wedding photos", Icons.Default.Collections, "more-gallery") { destination = ReferenceMoreDestination.GALLERY }
            MoreRow("Honeymoon & Gifts", "Contributions from your guests", Icons.Default.FlightTakeoff, "more-honeymoon") { destination = ReferenceMoreDestination.HONEYMOON }
            MoreRow("Settings", "Your account and sign out", Icons.Default.Settings, "more-settings") { destination = ReferenceMoreDestination.SETTINGS }
            MoreRow("Help & Support", "Contact Wewed support", Icons.Default.HelpOutline, "more-support") { destination = ReferenceMoreDestination.SUPPORT }
        }
    }
}

@Composable
private fun MoreRow(
    title: String,
    subtitle: String,
    icon: ImageVector,
    identifier: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 60.dp)
            .clip(RoundedCornerShape(15.dp))
            .background(WeddingIdentityPalette.IvorySoft)
            .border(1.dp, WeddingIdentityPalette.Hairline, RoundedCornerShape(15.dp))
            .clickable(role = Role.Button) { onClick() }
            .testTag(identifier)
            .padding(13.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        WeddingListRowIcon(icon)
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, color = WeddingIdentityPalette.Ink, fontFamily = FontFamily.Serif, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
            Text(subtitle, color = WeddingIdentityPalette.Muted, fontSize = 14.sp)
        }
        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = WeddingIdentityPalette.Muted, modifier = Modifier.size(20.dp))
    }
}

@Composable
private fun MoreEmptyScreen(title: String, message: String, onBack: () -> Unit) {
    SubScreen(title, onBack, Modifier.testTag("more-destination-root")) {
        Column(modifier = Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            EmptyStateText(message, "more-empty-state")
        }
    }
}

@Composable
private fun WeddingProfileScreen(wedding: Wedding?, onBack: () -> Unit) {
    SubScreen("Wedding Profile", onBack, Modifier.testTag("more-wedding-profile-root")) {
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (wedding == null) {
                EmptyStateText("Wedding details couldn't be loaded.", "more-empty-state")
                return@Column
            }
            WeddingMonogram(wedding.coupleNames, sizeSp = 42)
            InfoCard {
                LabeledValue("Couple", wedding.coupleNames)
                LabeledValue("Date", Formatting.dateAndTime(wedding.date))
                LabeledValue("Venue", wedding.venueName.ifBlank { "Not recorded" })
                LabeledValue("City", wedding.city.ifBlank { "Not recorded" })
                LabeledValue("Country", wedding.country.ifBlank { "Not recorded" })
                OpenInMapsButton(venue = wedding.venueLocation, tag = "wedding-profile-open-maps")
            }
        }
    }
}

@Composable
private fun HoneymoonScreen(access: RoleScopedAccess, onBack: () -> Unit, onOpenContributions: () -> Unit) {
    val records = rememberLoad(Unit) { access.contributions() }
    SubScreen("Honeymoon & Gifts", onBack, Modifier.testTag("more-honeymoon-root")) {
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            LoadContent(records) { rows ->
                InfoCard(modifier = Modifier.testTag("more-contributions-summary")) {
                    SectionTitle("Contributions")
                    BodyText(Formatting.plural(rows.size, "contribution") + " recorded")
                    val types = rows.map { it.typeLabel }.distinct()
                    if (types.isNotEmpty()) SupportingText("Types: ${types.joinToString(", ")}")
                    SecondaryButton(
                        text = "View contributions",
                        onClick = onOpenContributions,
                        modifier = Modifier.fillMaxWidth().testTag("more-open-contributions")
                    )
                }
            }
            EmptyStateText("The honeymoon fund isn't available in the app yet.", "more-empty-state")
        }
    }
}

private enum class ReferenceMoreDestination {
    PROFILE,
    STORY,
    GALLERY,
    HONEYMOON,
    CONTRIBUTIONS,
    SETTINGS,
    SUPPORT
}
