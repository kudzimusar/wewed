package pro.wewed.app.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import pro.wewed.app.models.InvitationContext
import pro.wewed.app.models.GuestJourneyReference
import pro.wewed.app.models.GuestJourneyStage
import pro.wewed.app.models.Wedding
import pro.wewed.app.models.WeddingAnnouncement
import pro.wewed.app.models.PlannerDashboardSnapshot
import pro.wewed.app.models.WeddingPass
import pro.wewed.app.state.AppTab
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.ui.invitation.GuestInvitationJourneyScreen
import pro.wewed.app.ui.vendor.VendorPresenceScreen
import pro.wewed.app.theme.WewedColors
import pro.wewed.app.theme.WewedRadius
import pro.wewed.app.theme.WewedSpacing

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(appViewModel: AppViewModel) {
    var wedding by remember { mutableStateOf<Wedding?>(null) }
    var announcements by remember { mutableStateOf<List<WeddingAnnouncement>>(emptyList()) }
    var plannerDashboard by remember { mutableStateOf<PlannerDashboardSnapshot?>(null) }
    var invitationContext by remember { mutableStateOf<InvitationContext?>(null) }
    var quickPass by remember { mutableStateOf<WeddingPass?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var showInvitation by remember { mutableStateOf(false) }
    var showVendor by remember { mutableStateOf(false) }
    var showDirectionsDialog by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        val loadedWedding = appViewModel.repository.getWedding()
        wedding = loadedWedding
        announcements = appViewModel.repository.getAnnouncements()
        plannerDashboard = appViewModel.plannerRepository.getDashboard()
        invitationContext = runCatching {
            appViewModel.repository.resolveInvitation(loadedWedding.id, "shadow-pending-guest")
        }.getOrNull()
        quickPass = runCatching {
            appViewModel.repository.getWeddingPass("shadow-attending-guest")
        }.getOrNull()
        isLoading = false
    }

    if (showInvitation) {
        invitationContext?.let { context ->
            GuestInvitationJourneyScreen(
                reference = GuestJourneyReference(
                    invitation = context,
                    initialStage = GuestJourneyStage.SPLASH
                ),
                appViewModel = appViewModel,
                onExit = { showInvitation = false }
            )
        } ?: Box(
            modifier = Modifier.fillMaxSize().background(WewedColors.Ivory),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator(color = WewedColors.Gold)
        }
        return
    }

    if (showVendor) {
        VendorPresenceScreen(
            appViewModel = appViewModel,
            onClose = { showVendor = false }
        )
        return
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        if (wedding?.lifecycle == "day") "Wedding Day" else "Wedding Command Centre",
                        fontWeight = FontWeight.SemiBold
                    )
                },
                actions = {
                    IconButton(onClick = { showInvitation = true }) {
                        Icon(Icons.Default.Mail, contentDescription = "Ivory Invitation", tint = WewedColors.Gold)
                    }
                    IconButton(onClick = { showVendor = true }) {
                        Icon(Icons.Default.LocalShipping, contentDescription = "Vendor Hub", tint = WewedColors.Gold)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = WewedColors.Ivory)
            )
        },
        containerColor = WewedColors.Ivory
    ) { innerPadding ->
        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = WewedColors.Gold)
            }
        } else {
            wedding?.let { w ->
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(innerPadding)
                        .padding(horizontal = WewedSpacing.base),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                    contentPadding = PaddingValues(vertical = 14.dp)
                ) {
                    // 1. Hero Card
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(WewedRadius.lg),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            elevation = CardDefaults.cardElevation(2.dp)
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(WewedSpacing.base),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(WewedSpacing.sm)
                            ) {
                                Text(
                                    text = w.coupleNames
                                        .split("&")
                                        .mapNotNull { it.trim().firstOrNull()?.uppercaseChar() }
                                        .joinToString(" & "),
                                    fontSize = 32.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Serif,
                                    color = WewedColors.Gold
                                )
                                Text(
                                    text = w.coupleNames,
                                    fontSize = 22.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    fontFamily = FontFamily.Serif
                                )
                                Text(
                                    text = "${plannerDashboard?.weddingDateLabel ?: if (w.date == "pending-production-discovery") "Upcoming wedding" else w.date} • ${w.city}, ${w.country}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = WewedColors.TextSecondaryLight
                                )

                                Surface(
                                    shape = RoundedCornerShape(WewedRadius.pill),
                                    color = WewedColors.Emerald.copy(alpha = 0.10f),
                                    modifier = Modifier.padding(top = WewedSpacing.sm)
                                ) {
                                    Text(
                                        "Planning timeline active",
                                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                        color = WewedColors.Emerald,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                }
                            }
                        }
                    }

                    // 2. Planning pulse — keep the pre-wedding product centred on planning.
                    plannerDashboard?.let { snapshot ->
                        item {
                            PlanningPulseCard(
                                snapshot = snapshot,
                                onOpenPlanner = { appViewModel.selectTab(AppTab.PLAN) }
                            )
                        }
                    }

                    // 3. Next Programme Milestone
                    item {
                        val next = w.programme.firstOrNull()
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(WewedRadius.lg),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            elevation = CardDefaults.cardElevation(2.dp)
                        ) {
                            Column(
                                modifier = Modifier.padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        "NEXT UP",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        letterSpacing = 1.sp,
                                        color = WewedColors.GoldDark
                                    )
                                    next?.let {
                                        Surface(
                                            shape = RoundedCornerShape(WewedRadius.pill),
                                            color = WewedColors.Gold.copy(alpha = 0.2f)
                                        ) {
                                            Text(
                                                it.time,
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = WewedColors.GoldDark,
                                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                                            )
                                        }
                                    }
                                }

                                Text(
                                    next?.title ?: "Programme preparing",
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = WewedColors.TextPrimaryLight
                                )

                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.Place, contentDescription = null, tint = WewedColors.Emerald, modifier = Modifier.size(14.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(next?.location ?: w.venueName, fontSize = 12.sp, color = WewedColors.Emerald)
                                }
                            }
                        }
                    }

                    // 3. My Wedding Pass Quick Card
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(WewedRadius.lg),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            elevation = CardDefaults.cardElevation(2.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(14.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(54.dp)
                                        .background(Color(0xFFFBF5E9), RoundedCornerShape(WewedRadius.md)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(Icons.Default.QrCode, contentDescription = null, tint = WewedColors.Gold, modifier = Modifier.size(32.dp))
                                }

                                Spacer(modifier = Modifier.width(12.dp))

                                Column(modifier = Modifier.weight(1f)) {
                                    Text("YOUR WEDDING PASS", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WewedColors.GoldDark)
                                    Text("Table: ${quickPass?.tableName ?: "To be assigned"}", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = WewedColors.TextPrimaryLight)
                                    Text(
                                        "${quickPass?.guestName ?: invitationContext?.guestName ?: "Guest"} • ${quickPass?.partySize ?: invitationContext?.partySize ?: 1} seat(s)",
                                        fontSize = 11.sp,
                                        color = Color.Gray
                                    )
                                }

                                Button(
                                    onClick = { appViewModel.selectTab(AppTab.PASS) },
                                    colors = ButtonDefaults.buttonColors(containerColor = WewedColors.Gold),
                                    shape = RoundedCornerShape(WewedRadius.pill),
                                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp)
                                ) {
                                    Text("View", color = Color.Black, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                }
                            }
                        }
                    }

                    // 4. Announcements
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(WewedRadius.lg),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            elevation = CardDefaults.cardElevation(2.dp)
                        ) {
                            Column(
                                modifier = Modifier.padding(14.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.Campaign, contentDescription = null, tint = WewedColors.Gold)
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("Announcements", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                }

                                if (announcements.isEmpty()) {
                                    Text("No new announcements right now.", fontSize = 12.sp, color = Color.Gray)
                                } else {
                                    announcements.take(2).forEach { ann ->
                                        Column {
                                            Text(ann.title, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                            Text(ann.message, fontSize = 11.sp, color = Color.Gray)
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // 5. Quick Action Launcher
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            QuickActionItem(
                                title = "Invitation",
                                icon = Icons.Default.Mail,
                                modifier = Modifier.weight(1f)
                            ) { showInvitation = true }

                            QuickActionItem(
                                title = "Directions",
                                icon = Icons.Default.Map,
                                modifier = Modifier.weight(1f)
                            ) { showDirectionsDialog = true }

                            QuickActionItem(
                                title = "Live Wall",
                                icon = Icons.Default.PhotoLibrary,
                                modifier = Modifier.weight(1f)
                            ) { appViewModel.selectTab(AppTab.LIVE) }

                            QuickActionItem(
                                title = "Vendors",
                                icon = Icons.Default.LocalShipping,
                                modifier = Modifier.weight(1f)
                            ) { showVendor = true }
                        }
                    }

                    // 6. Day-Of Programme
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(WewedRadius.lg),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            elevation = CardDefaults.cardElevation(2.dp)
                        ) {
                            Column(
                                modifier = Modifier.padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                Text(
                                    text = "Day-Of Programme",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.SemiBold,
                                    color = WewedColors.TextPrimaryLight
                                )

                                w.programme.forEachIndexed { index, item ->
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(WewedSpacing.md)
                                    ) {
                                        Text(
                                            text = item.time,
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = WewedColors.Gold,
                                            modifier = Modifier.width(46.dp)
                                        )
                                        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                            Text(
                                                text = item.title,
                                                fontSize = 14.sp,
                                                fontWeight = FontWeight.SemiBold
                                            )
                                            Text(
                                                text = item.location,
                                                fontSize = 11.sp,
                                                color = WewedColors.Emerald
                                            )
                                            Text(
                                                text = item.description,
                                                fontSize = 11.sp,
                                                color = WewedColors.TextSecondaryLight
                                            )
                                        }
                                    }
                                    if (index < w.programme.size - 1) {
                                        HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showDirectionsDialog) {
        AlertDialog(
            onDismissRequest = { showDirectionsDialog = false },
            title = { Text("Directions to ${wedding?.venueName ?: "Wedding Venue"}", fontWeight = FontWeight.Bold) },
            text = {
                val w = wedding
                Text(
                    if (w != null) "${w.venueName}, ${w.venueAddress}, ${w.city}, ${w.country}"
                    else "Venue details are still loading."
                )
            },
            confirmButton = {
                Button(
                    onClick = { showDirectionsDialog = false },
                    colors = ButtonDefaults.buttonColors(containerColor = WewedColors.Gold)
                ) {
                    Text("Open Maps", color = Color.Black)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDirectionsDialog = false }) {
                    Text("Close", color = Color.Gray)
                }
            }
        )
    }
}

@Composable
private fun PlanningPulseCard(
    snapshot: PlannerDashboardSnapshot,
    onOpenPlanner: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(WewedRadius.lg),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(2.dp)
    ) {
        Column(
            modifier = Modifier.padding(WewedSpacing.base),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column {
                    Text(
                        "PLANNING PULSE",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = WewedColors.GoldDark
                    )
                    Text(
                        "What needs attention before Wedding Day",
                        fontSize = 11.sp,
                        color = Color.Gray
                    )
                }
                Text(
                    "${snapshot.readinessScore}%",
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    color = WewedColors.Emerald
                )
            }

            LinearProgressIndicator(
                progress = { snapshot.readinessScore / 100f },
                modifier = Modifier.fillMaxWidth(),
                color = WewedColors.Emerald
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                snapshot.modules.take(3).forEach { module ->
                    Column(modifier = Modifier.weight(1f)) {
                        Text(module.title, fontSize = 10.sp, color = Color.Gray)
                        Text(module.value, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            snapshot.attentionItems.firstOrNull()?.let { item ->
                Row(verticalAlignment = Alignment.Top) {
                    Icon(
                        Icons.Default.Warning,
                        contentDescription = null,
                        tint = WewedColors.Warning,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Column {
                        Text(item.title, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        Text(item.detail, fontSize = 10.sp, color = Color.Gray)
                    }
                }
            }

            TextButton(
                onClick = onOpenPlanner,
                modifier = Modifier.align(Alignment.End)
            ) {
                Text(
                    "Open Wedding Planner",
                    color = WewedColors.Emerald,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(modifier = Modifier.width(4.dp))
                Icon(
                    Icons.Default.ChevronRight,
                    contentDescription = null,
                    tint = WewedColors.Emerald
                )
            }
        }
    }
}

@Composable
private fun QuickActionItem(
    title: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Card(
        modifier = modifier.clickable { onClick() },
        shape = RoundedCornerShape(WewedRadius.md),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(1.dp)
    ) {
        Column(
            modifier = Modifier.padding(vertical = 10.dp, horizontal = 4.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(icon, contentDescription = null, tint = WewedColors.Gold, modifier = Modifier.size(20.dp))
            Spacer(modifier = Modifier.height(4.dp))
            Text(title, fontSize = 10.sp, fontWeight = FontWeight.Medium, color = WewedColors.TextPrimaryLight)
        }
    }
}

@Composable
private fun CountdownBadge(value: String, label: String) {
    Surface(
        shape = RoundedCornerShape(WewedRadius.md),
        color = WewedColors.Gold.copy(alpha = 0.12f)
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = value,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = WewedColors.GoldDark
            )
            Text(
                text = label,
                fontSize = 10.sp,
                color = WewedColors.TextSecondaryLight
            )
        }
    }
}
