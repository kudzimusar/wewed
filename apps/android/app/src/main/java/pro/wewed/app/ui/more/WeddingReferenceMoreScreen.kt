package pro.wewed.app.ui.more

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
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.theme.*
import pro.wewed.app.ui.planner.ShadowContributionsDestination

@Composable
fun WeddingReferenceMoreScreen(appViewModel: AppViewModel) {
    var wedding by remember { mutableStateOf<Wedding?>(null) }
    var loading by remember { mutableStateOf(true) }
    var destination by remember { mutableStateOf<ReferenceMoreDestination?>(null) }

    LaunchedEffect(Unit) {
        try {
            wedding = appViewModel.repository.getWedding()
        } finally {
            loading = false
        }
    }

    destination?.let { current ->
        when (current) {
            ReferenceMoreDestination.HONEYMOON ->
                ShadowContributionsDestination(appViewModel) { destination = null }
            ReferenceMoreDestination.STORY ->
                ReferenceMoreEmptyScreen("Our Story", "No story or media records are available in this Shadow wedding yet.") { destination = null }
            ReferenceMoreDestination.GALLERY ->
                ReferenceMoreEmptyScreen("Gallery", "No gallery media is available in this Shadow wedding yet.") { destination = null }
            ReferenceMoreDestination.SETTINGS ->
                ReferenceMoreEmptyScreen("Settings", "Wedding app preferences are not configured in this Shadow dataset.") { destination = null }
            ReferenceMoreDestination.SUPPORT ->
                ReferenceMoreEmptyScreen("Help & Support", "Support contact configuration is not part of this Shadow wedding dataset.") { destination = null }
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

                ReferenceMoreRow("Our Story", "Photos, videos and milestones", Icons.Default.PhotoLibrary, "more-story") {
                    destination = ReferenceMoreDestination.STORY
                }
                ReferenceMoreRow("Gallery", "Wedding photos and inspiration", Icons.Default.Collections, "more-gallery") {
                    destination = ReferenceMoreDestination.GALLERY
                }
                ReferenceMoreRow("Honeymoon", "Contributions and plans", Icons.Default.FlightTakeoff, "more-honeymoon") {
                    destination = ReferenceMoreDestination.HONEYMOON
                }
                ReferenceMoreRow("Settings", "App preferences", Icons.Default.Settings, "more-settings") {
                    destination = ReferenceMoreDestination.SETTINGS
                }
                ReferenceMoreRow("Help & Support", "Get in touch", Icons.Default.HelpOutline, "more-support") {
                    destination = ReferenceMoreDestination.SUPPORT
                }

                Spacer(modifier = Modifier.weight(1f))

                WeddingMonogram(
                    names = wedding?.coupleNames ?: "C & K",
                    sizeSp = 34,
                    modifier = Modifier.align(Alignment.CenterHorizontally)
                )
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
    onBack: () -> Unit
) {
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
            WeddingMonogram("C & K", sizeSp = 40)
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

private enum class ReferenceMoreDestination {
    STORY,
    GALLERY,
    HONEYMOON,
    SETTINGS,
    SUPPORT
}
