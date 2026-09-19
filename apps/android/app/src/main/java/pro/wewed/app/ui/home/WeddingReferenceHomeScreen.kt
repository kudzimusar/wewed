package pro.wewed.app.ui.home

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import pro.wewed.app.R
import pro.wewed.app.models.*
import pro.wewed.app.state.AppTab
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.theme.*
import pro.wewed.app.ui.invitation.InvitationPreviewJourney
import pro.wewed.app.ui.shared.MinTouchTarget
import java.text.SimpleDateFormat
import java.util.Locale
import kotlin.math.max

@Composable
fun WeddingReferenceHomeScreen(appViewModel: AppViewModel) {
    var wedding by remember { mutableStateOf<Wedding?>(null) }
    var tasks by remember { mutableStateOf<List<PlannerTask>>(emptyList()) }
    var guests by remember { mutableStateOf<List<Guest>>(emptyList()) }
    var budget by remember { mutableStateOf<BudgetSummary?>(null) }
    var vendors by remember { mutableStateOf<List<VendorPresence>>(emptyList()) }
    var invitation by remember { mutableStateOf<InvitationContext?>(null) }
    var showInvitation by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        try {
            val loadedWedding = appViewModel.repository.getWedding()
            wedding = loadedWedding
            tasks = appViewModel.repository.getTasks()
            guests = appViewModel.repository.getGuests()
            budget = appViewModel.repository.getBudget()
            vendors = appViewModel.repository.getVendors()
            invitation = runCatching {
                appViewModel.repository.resolveInvitation(loadedWedding.id, "shadow-pending-guest")
            }.getOrNull()
        } finally {
            isLoading = false
        }
    }

    if (showInvitation) {
        // A read-only preview of what guests see; replying here never changes a guest.
        invitation?.let { context ->
            InvitationPreviewJourney(
                invitation = context,
                fallbackVenue = wedding?.venueLocation,
                onExit = { showInvitation = false }
            )
        } ?: Box(
            modifier = Modifier.fillMaxSize().background(WeddingIdentityPalette.Ivory).padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            androidx.activity.compose.BackHandler { showInvitation = false }
            Text(
                "There is no guest invitation to preview yet.",
                color = WeddingIdentityPalette.Ink,
                fontSize = 17.sp,
                modifier = Modifier.testTag("invitation-preview-unavailable")
            )
        }
        return
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WeddingIdentityPalette.Ivory)
            .testTag("home-root")
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                color = WeddingIdentityPalette.ChampagneDeep,
                modifier = Modifier.align(Alignment.Center)
            )
        } else {
            wedding?.let { currentWedding ->
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    ReferenceHero(
                        wedding = currentWedding,
                        onInvitation = { showInvitation = true }
                    )

                    ReferenceContinuePlanning(
                        ratio = if (tasks.isEmpty()) 0f else tasks.count { it.status == TaskStatus.DONE }.toFloat() / tasks.size.toFloat(),
                        onClick = { appViewModel.selectTab(AppTab.PLAN) }
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth().testTag("home-metrics"),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        ReferenceMetricAction(
                            title = "Tasks",
                            value = "${tasks.count { it.status != TaskStatus.DONE }} left",
                            icon = Icons.Default.Checklist,
                            identifier = "home-metric-tasks",
                            modifier = Modifier.weight(1f),
                            onClick = { appViewModel.selectTab(AppTab.PLAN) }
                        )
                        ReferenceMetricAction(
                            title = "Budget",
                            value = formatMoney(budget?.totalBudget ?: 0.0),
                            icon = Icons.Default.AccountBalanceWallet,
                            identifier = "home-metric-budget",
                            modifier = Modifier.weight(1f),
                            onClick = { appViewModel.selectTab(AppTab.PLAN) }
                        )
                        ReferenceMetricAction(
                            title = "Guests",
                            value = guests.size.toString(),
                            icon = Icons.Default.Group,
                            identifier = "home-metric-guests",
                            modifier = Modifier.weight(1f),
                            onClick = { appViewModel.selectTab(AppTab.GUESTS) }
                        )
                        ReferenceMetricAction(
                            title = "Vendors",
                            value = vendors.size.toString(),
                            icon = Icons.Default.Storefront,
                            identifier = "home-metric-vendors",
                            modifier = Modifier.weight(1f),
                            onClick = { appViewModel.selectTab(AppTab.PLAN) }
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))
                }
            }
        }
    }
}

@Composable
private fun ReferenceMetricAction(
    title: String,
    value: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    identifier: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(15.dp))
            .clickable { onClick() }
            .testTag(identifier)
    ) {
        WeddingMetricTile(
            title = title,
            value = value,
            icon = icon,
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
private fun ReferenceHero(
    wedding: Wedding,
    onInvitation: () -> Unit
) {
    val countdown by produceState(initialValue = countdownFrom(wedding.date), wedding.date) {
        while (true) {
            value = countdownFrom(wedding.date)
            delay(1000)
        }
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(390.dp)
            .clip(RoundedCornerShape(23.dp))
            .border(
                1.dp,
                WeddingIdentityPalette.Champagne.copy(alpha = 0.35f),
                RoundedCornerShape(23.dp)
            )
    ) {
        Image(
            painter = painterResource(id = R.drawable.hero_wedding),
            contentDescription = "Wedding visual",
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize()
        )

        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        listOf(
                            Color.Transparent,
                            Color.Black.copy(alpha = 0.12f),
                            Color.Black.copy(alpha = 0.80f)
                        )
                    )
                )
        )

        Column(
            modifier = Modifier.fillMaxSize().padding(16.dp)
        ) {
            Box(modifier = Modifier.fillMaxWidth()) {
                WeddingBrandMark(modifier = Modifier.align(Alignment.Center))

                Surface(
                    onClick = onInvitation,
                    shape = RoundedCornerShape(50),
                    color = Color.Black.copy(alpha = 0.42f),
                    modifier = Modifier
                        .align(Alignment.CenterEnd)
                        .heightIn(min = MinTouchTarget)
                        .testTag("home-open-invitation")
                ) {
                    Row(
                        modifier = Modifier.heightIn(min = MinTouchTarget).padding(horizontal = 14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.MailOutline, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Preview invitation", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            Text(
                wedding.coupleNames,
                fontFamily = FontFamily.Serif,
                fontStyle = FontStyle.Italic,
                fontSize = 37.sp,
                color = Color.White
            )
            Text(
                "OUR WEDDING JOURNEY",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 3.sp,
                color = Color.White.copy(alpha = 0.90f)
            )
            Spacer(modifier = Modifier.height(7.dp))
            Text(
                displayWeddingDate(wedding.date),
                fontSize = 19.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 2.sp,
                color = Color.White
            )
            Spacer(modifier = Modifier.height(8.dp))

            countdown?.let { c ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(7.dp)
                ) {
                    ReferenceCountdownTile(c.days, "Days", Modifier.weight(1f))
                    ReferenceCountdownTile(c.hours, "Hours", Modifier.weight(1f))
                    ReferenceCountdownTile(c.minutes, "Mins", Modifier.weight(1f))
                    ReferenceCountdownTile(c.seconds, "Secs", Modifier.weight(1f))
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            Text(
                "“Two hearts, one beautiful tomorrow.”",
                fontFamily = FontFamily.Serif,
                fontStyle = FontStyle.Italic,
                fontSize = 15.sp,
                color = Color.White.copy(alpha = 0.92f)
            )
        }
    }
}

@Composable
private fun ReferenceCountdownTile(value: Int, label: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(Color.Black.copy(alpha = 0.46f))
            .padding(vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            value.toString(),
            color = Color.White,
            fontFamily = FontFamily.Serif,
            fontSize = 23.sp,
            fontWeight = FontWeight.Medium
        )
        Text(label, color = Color.White, fontSize = 12.sp)
    }
}

@Composable
private fun ReferenceContinuePlanning(
    ratio: Float,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth().testTag("home-continue-planning"),
        shape = RoundedCornerShape(18.dp),
        color = WeddingIdentityPalette.IvorySoft,
        tonalElevation = 0.dp,
        shadowElevation = 2.dp,
        onClick = onClick
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(52.dp)
                    .clip(RoundedCornerShape(13.dp))
                    .background(WeddingIdentityPalette.Champagne.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Default.Checklist,
                    contentDescription = null,
                    tint = WeddingIdentityPalette.ChampagneDeep
                )
            }

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    "Continue Planning",
                    color = WeddingIdentityPalette.Ink,
                    fontFamily = FontFamily.Serif,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 17.sp
                )
                Text(
                    "You’re ${(ratio * 100).toInt()}% there",
                    color = WeddingIdentityPalette.Muted,
                    fontSize = 12.sp
                )
                Spacer(modifier = Modifier.height(5.dp))
                LinearProgressIndicator(
                    progress = { ratio.coerceIn(0f, 1f) },
                    modifier = Modifier.fillMaxWidth().height(5.dp).clip(RoundedCornerShape(20.dp)),
                    color = WeddingIdentityPalette.Forest,
                    trackColor = Color(0xFFE5E9ED)
                )
            }

            Icon(
                Icons.Default.ChevronRight,
                contentDescription = null,
                tint = WeddingIdentityPalette.ChampagneDeep
            )
        }
    }
}

private data class ReferenceCountdown(
    val days: Int,
    val hours: Int,
    val minutes: Int,
    val seconds: Int
)

private fun countdownFrom(raw: String): ReferenceCountdown? {
    val parser = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)
    val target = runCatching { parser.parse(raw) }.getOrNull() ?: return null
    val totalSeconds = max(0L, (target.time - System.currentTimeMillis()) / 1000L)
    return ReferenceCountdown(
        days = (totalSeconds / 86_400L).toInt(),
        hours = ((totalSeconds % 86_400L) / 3_600L).toInt(),
        minutes = ((totalSeconds % 3_600L) / 60L).toInt(),
        seconds = (totalSeconds % 60L).toInt()
    )
}

private fun displayWeddingDate(raw: String): String {
    val parser = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)
    val date = runCatching { parser.parse(raw) }.getOrNull() ?: return raw.uppercase()
    return SimpleDateFormat("dd MMM yyyy", Locale.US).format(date).uppercase()
}

private fun formatMoney(amount: Double): String =
    String.format(Locale.US, "$%,.0f", amount)

