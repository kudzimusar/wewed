package pro.wewed.app.ui.more

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.R
import pro.wewed.app.models.Wedding
import pro.wewed.app.models.WeddingContentSection
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.ui.roles.GalleryContentSection
import pro.wewed.app.ui.roles.WeddingContentSectionView
import pro.wewed.app.ui.roles.BundledWeddingMedia
import pro.wewed.app.ui.planner.ShadowDocumentsDestination
import pro.wewed.app.ui.shared.AccountPrivacyScreen
import pro.wewed.app.theme.*
import pro.wewed.app.ui.planner.ShadowContributionsDestination

@Composable
fun WeddingReferenceMoreScreen(appViewModel: AppViewModel) {
    var wedding by remember { mutableStateOf<Wedding?>(null) }
    var loading by remember { mutableStateOf(true) }
    var destination by remember { mutableStateOf<ReferenceMoreDestination?>(null) }
    // Our Story and Gallery are published through the wedding content graph, which the couple's
    // More screen previously never read — so two populated sections rendered as "will appear here".
    var contentSections by remember { mutableStateOf<List<WeddingContentSection>>(emptyList()) }
    var weddingSlug by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        try {
            val scoped = appViewModel.scopedRepository()
            wedding = scoped.getWedding()
            contentSections = scoped.getWeddingContentSections()
            weddingSlug = scoped.weddingSlug()
        } finally {
            loading = false
        }
    }

    fun contentSection(key: String): WeddingContentSection =
        contentSections.firstOrNull { it.section == key }
            ?: WeddingContentSection(key, WeddingContentSection.titleFor(key), emptyList())

    destination?.let { current ->
        when (current) {
            ReferenceMoreDestination.PROFILE -> {
                val currentWedding = wedding
                if (currentWedding != null) {
                    ReferenceWeddingProfileScreen(currentWedding) { destination = null }
                } else {
                    ReferenceMoreEmptyScreen("Wedding", "Wedding details are unavailable.", "") { destination = null }
                }
            }
            // P0-12: the four Private Real Shadow contributions are blessing/wish/story/memory
            // records, not monetary honeymoon gifts. Routing Honeymoon at them presented guest
            // messages as honeymoon funding. No honeymoon/gift contract exists natively yet.
            ReferenceMoreDestination.HONEYMOON ->
                ReferenceMoreEmptyScreen(
                    "Honeymoon",
                    "Honeymoon and gift contributions are not configured for this wedding. The wedding graph records guest messages and memories, which are shown under Plan → Contributions; it holds no honeymoon fund.",
                    wedding?.coupleNames ?: ""
                ) { destination = null }
            ReferenceMoreDestination.WEDDING_SITE -> WeddingSiteScreen(
                coupleNames = wedding?.coupleNames.orEmpty(),
                weddingSlug = weddingSlug,
                sections = contentSections
            ) { destination = null }
            ReferenceMoreDestination.STORY -> {
                BackHandler { destination = null }
                WeddingContentSectionView(contentSection("story"), "more-story")
            }
            ReferenceMoreDestination.GALLERY -> {
                BackHandler { destination = null }
                GalleryContentSection(
                    section = contentSection("gallery"),
                    bundledMedia = BundledWeddingMedia.names,
                    testTagPrefix = "more-gallery"
                )
            }
            ReferenceMoreDestination.SETTINGS ->
                ReferenceMoreEmptyScreen("Settings", "Manage notification preferences, display style, and offline credentials cache.", wedding?.coupleNames ?: "") { destination = null }
            ReferenceMoreDestination.DOCUMENTS ->
                ShadowDocumentsDestination(appViewModel) { destination = null }
            ReferenceMoreDestination.ACCOUNT ->
                AccountPrivacyScreen { destination = null }
            ReferenceMoreDestination.SUPPORT ->
                ReferenceMoreEmptyScreen("Help & Support", "Need assistance? Contact the wedding team at support@wewed.pro • Version 1.0.0 (ECDSA P-256 Offline Active)", wedding?.coupleNames ?: "") { destination = null }
        }
        return
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WeddingIdentityPalette.Ivory)
            .testTag("more-root")
    ) {
        WeddingOrnamentBackdrop(
            modifier = Modifier.matchParentSize(),
            alpha = 0.025f
        )

        if (loading) {
            CircularProgressIndicator(
                color = WeddingIdentityPalette.ChampagneDeep,
                modifier = Modifier.align(Alignment.Center)
            )
        } else {
            Column(
                modifier = Modifier.fillMaxSize().padding(horizontal = 14.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.Top
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            "More",
                            color = WeddingIdentityPalette.Ink,
                            fontFamily = FontFamily.Serif,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 28.sp
                        )
                        Text(
                            "Your wedding, beautifully organised.",
                            color = WeddingIdentityPalette.Muted,
                            fontSize = 12.sp
                        )
                    }

                    Surface(
                        modifier = Modifier.size(40.dp).testTag("more-settings-shortcut"),
                        shape = CircleShape,
                        color = WeddingIdentityPalette.IvorySoft,
                        border = androidx.compose.foundation.BorderStroke(1.dp, WeddingIdentityPalette.Hairline),
                        onClick = { destination = ReferenceMoreDestination.SETTINGS }
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                Icons.Default.Settings,
                                contentDescription = "Settings",
                                tint = WeddingIdentityPalette.Ink
                            )
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
                            .testTag("more-wedding-profile")
                            .clickable { destination = ReferenceMoreDestination.PROFILE }
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
                            Text(
                                currentWedding.coupleNames,
                                color = WeddingIdentityPalette.Ink,
                                fontFamily = FontFamily.Serif,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 16.sp
                            )
                            Text("Wedding Couple", color = WeddingIdentityPalette.Muted, fontSize = 11.sp)
                        }
                        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = WeddingIdentityPalette.Muted)
                    }
                }

                // The couple's published site lives in the same graph as the app, so it belongs
                // in the app rather than being treated as a separate product elsewhere.
                ReferenceMoreRow("Wedding Site", "Your published wedding site", Icons.Default.Language, "more-wedding-site") {
                    destination = ReferenceMoreDestination.WEDDING_SITE
                }
                ReferenceMoreRow("Our Story", "Photos, videos and milestones", Icons.Default.PhotoLibrary, "more-story") {
                    destination = ReferenceMoreDestination.STORY
                }
                ReferenceMoreRow("Gallery", "Wedding photos and inspiration", Icons.Default.Collections, "more-gallery") {
                    destination = ReferenceMoreDestination.GALLERY
                }
                ReferenceMoreRow("Honeymoon", "Gift and honeymoon fund", Icons.Default.FlightTakeoff, "more-honeymoon") {
                    destination = ReferenceMoreDestination.HONEYMOON
                }
                // P0-10: Documents and Account are declared in the IA V2 Couple More contract and
                // must exist at runtime, not only in the contract declaration.
                ReferenceMoreRow("Documents", "Contracts and wedding files", Icons.Default.Description, "more-documents") {
                    destination = ReferenceMoreDestination.DOCUMENTS
                }
                ReferenceMoreRow("Settings", "App preferences", Icons.Default.Settings, "more-settings") {
                    destination = ReferenceMoreDestination.SETTINGS
                }
                ReferenceMoreRow("Help & Support", "Get in touch", Icons.Default.HelpOutline, "more-support") {
                    destination = ReferenceMoreDestination.SUPPORT
                }
                ReferenceMoreRow("Account", "Identity, privacy and sign out", Icons.Default.AccountCircle, "more-account") {
                    destination = ReferenceMoreDestination.ACCOUNT
                }

                Spacer(modifier = Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun ReferenceMoreRow(
    title: String,
    subtitle: String,
    icon: ImageVector,
    identifier: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(15.dp))
            .background(WeddingIdentityPalette.IvorySoft)
            .border(1.dp, WeddingIdentityPalette.Hairline, RoundedCornerShape(15.dp))
            .clickable { onClick() }
            .testTag(identifier)
            .padding(13.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        WeddingListRowIcon(icon)
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                title,
                color = WeddingIdentityPalette.Ink,
                fontFamily = FontFamily.Serif,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp
            )
            Text(subtitle, color = WeddingIdentityPalette.Muted, fontSize = 11.sp)
        }
        Icon(
            Icons.Default.ChevronRight,
            contentDescription = null,
            tint = WeddingIdentityPalette.Muted,
            modifier = Modifier.size(18.dp)
        )
    }
}

@Composable
private fun ReferenceMoreEmptyScreen(
    title: String,
    message: String,
    coupleNames: String,
    onBack: () -> Unit
) {
    BackHandler(onBack = onBack)
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title, fontFamily = FontFamily.Serif) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = WeddingIdentityPalette.Ivory)
            )
        },
        containerColor = WeddingIdentityPalette.Ivory
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(30.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            WeddingMonogram(coupleNames, sizeSp = 40)
            Spacer(modifier = Modifier.height(12.dp))
            Text(title, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
            Text(
                message,
                color = WeddingIdentityPalette.Muted,
                fontSize = 13.sp,
                modifier = Modifier.padding(top = 8.dp)
            )
        }
    }
}

@Composable
private fun ReferenceWeddingProfileScreen(
    wedding: Wedding,
    onBack: () -> Unit
) {
    BackHandler(onBack = onBack)
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Wedding", fontFamily = FontFamily.Serif) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = WeddingIdentityPalette.Ivory)
            )
        },
        containerColor = WeddingIdentityPalette.Ivory
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(18.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Image(
                painter = painterResource(R.drawable.hero_wedding),
                contentDescription = "Wedding visual",
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(260.dp)
                    .clip(RoundedCornerShape(22.dp))
            )
            WeddingMonogram(wedding.coupleNames, sizeSp = 42)
            Text(
                wedding.coupleNames,
                color = WeddingIdentityPalette.Ink,
                fontFamily = FontFamily.Serif,
                fontWeight = FontWeight.SemiBold,
                fontSize = 27.sp
            )
            Text(wedding.venueName, color = WeddingIdentityPalette.Muted)
            Text("${wedding.city}, ${wedding.country}", color = WeddingIdentityPalette.Muted)
            Text(wedding.date, color = WeddingIdentityPalette.Muted)
        }
    }
}

private enum class ReferenceMoreDestination {
    PROFILE,
    WEDDING_SITE,
    STORY,
    GALLERY,
    HONEYMOON,
    SETTINGS,
    SUPPORT,
    DOCUMENTS,
    ACCOUNT
}
