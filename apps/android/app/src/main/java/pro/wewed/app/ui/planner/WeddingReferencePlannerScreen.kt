package pro.wewed.app.ui.planner

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.models.*
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.theme.*

@Composable
fun WeddingReferencePlannerScreen(appViewModel: AppViewModel) {
    var dashboard by remember { mutableStateOf<PlannerDashboardSnapshot?>(null) }
    var tasks by remember { mutableStateOf<List<PlannerTask>>(emptyList()) }
    var selectedSection by remember { mutableStateOf(ReferencePlannerSection.OVERVIEW) }
    var destination by remember { mutableStateOf<ReferencePlannerDestination?>(null) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        try {
            dashboard = appViewModel.plannerRepository.getDashboard()
            tasks = appViewModel.repository.getTasks()
        } finally {
            loading = false
        }
    }

    destination?.let { current ->
        when (current) {
            ReferencePlannerDestination.SEATING ->
                ShadowSeatingDestination(appViewModel) { destination = null }
            ReferencePlannerDestination.TIMELINE ->
                ShadowTimelineDestination(appViewModel) { destination = null }
            ReferencePlannerDestination.DOCUMENTS ->
                ReferencePlannerEmptyDestination(
                    title = "Documents",
                    message = "No contracts recorded for this wedding.",
                    onBack = { destination = null }
                )
        }
        return
    }

    when (selectedSection) {
        ReferencePlannerSection.BUDGET -> {
            ShadowBudgetDestination(appViewModel) { selectedSection = ReferencePlannerSection.OVERVIEW }
            return
        }
        ReferencePlannerSection.VENDORS -> {
            ShadowVendorsDestination(appViewModel) { selectedSection = ReferencePlannerSection.OVERVIEW }
            return
        }
        else -> Unit
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WeddingIdentityPalette.Ivory)
            .testTag("planner-root")
    ) {
        WeddingOrnamentBackdrop(
            modifier = Modifier.matchParentSize(),
            alpha = 0.055f
        )

        if (loading) {
            CircularProgressIndicator(
                color = WeddingIdentityPalette.ChampagneDeep,
                modifier = Modifier.align(Alignment.Center)
            )
        } else {
            Column(
                modifier = Modifier.fillMaxSize().padding(horizontal = 14.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Box(modifier = Modifier.fillMaxWidth().testTag("planner-identity-card")) {
                    WeddingHeaderOrnament(
                        modifier = Modifier.align(Alignment.TopEnd).offset(x = 8.dp, y = (-12).dp)
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.Top
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                        Text(
                            "Wedding Planner",
                            color = WeddingIdentityPalette.Ink,
                            fontFamily = FontFamily.Serif,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 28.sp
                        )
                        Text(
                            "Plan with clarity. Celebrate with confidence.",
                            color = WeddingIdentityPalette.Muted,
                            fontSize = 12.sp
                        )
                    }
                        dashboard?.coupleNames?.let { coupleNames ->
                            WeddingMonogram(
                                coupleNames,
                                sizeSp = 33,
                                modifier = Modifier.padding(end = 8.dp)
                            )
                        }
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    ReferencePlannerSection.entries.forEach { section ->
                        val selected = selectedSection == section
                        Text(
                            text = section.title,
                            color = if (selected) Color.White else WeddingIdentityPalette.Muted,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            modifier = Modifier
                                .clip(CircleShape)
                                .background(if (selected) WeddingIdentityPalette.Forest else WeddingIdentityPalette.IvorySoft)
                                .border(
                                    if (selected) 0.dp else 1.dp,
                                    WeddingIdentityPalette.Hairline,
                                    CircleShape
                                )
                                .clickable { selectedSection = section }
                                .padding(horizontal = 14.dp, vertical = 8.dp)
                        )
                    }
                }

                if (selectedSection == ReferencePlannerSection.TASKS) {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        contentPadding = PaddingValues(bottom = 24.dp)
                    ) {
                        items(tasks) { task ->
                            ReferenceTaskRow(task)
                        }
                    }
                } else {
                    val snap = dashboard
                    if (snap == null) {
                        Text(
                            "Planner unavailable",
                            color = WeddingIdentityPalette.Muted,
                            modifier = Modifier.padding(top = 40.dp)
                        )
                    } else {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                            contentPadding = PaddingValues(bottom = 24.dp)
                        ) {
                            item {
                                val ratio = if (tasks.isEmpty()) 0f else tasks.count { it.status == TaskStatus.DONE }.toFloat() / tasks.size.toFloat()
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(18.dp))
                                        .background(WeddingIdentityPalette.IvorySoft)
                                        .border(1.dp, WeddingIdentityPalette.Hairline, RoundedCornerShape(18.dp))
                                        .padding(16.dp),
                                    verticalArrangement = Arrangement.spacedBy(9.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Column {
                                            Text(
                                                "Planning Progress",
                                                color = WeddingIdentityPalette.Ink,
                                                fontFamily = FontFamily.Serif,
                                                fontWeight = FontWeight.SemiBold,
                                                fontSize = 16.sp
                                            )
                                            Text(
                                                "${(ratio * 100).toInt()}% complete • ${snap.taskCompletionLabel} tasks",
                                                color = WeddingIdentityPalette.Muted,
                                                fontSize = 12.sp
                                            )
                                        }
                                        Icon(
                                            Icons.Default.ChevronRight,
                                            contentDescription = null,
                                            tint = WeddingIdentityPalette.Muted
                                        )
                                    }
                                    LinearProgressIndicator(
                                        progress = { ratio },
                                        modifier = Modifier.fillMaxWidth().height(5.dp).clip(RoundedCornerShape(20.dp)),
                                        color = WeddingIdentityPalette.Forest,
                                        trackColor = Color(0xFFE5E9ED)
                                    )
                                }
                            }

                            item {
                                ReferencePlannerRow(
                                    title = "Tasks",
                                    subtitle = "${tasks.count { it.status != TaskStatus.DONE }} remaining",
                                    icon = Icons.Default.Checklist,
                                    identifier = "planner-module-tasks"
                                ) { selectedSection = ReferencePlannerSection.TASKS }
                            }
                            item {
                                ReferencePlannerRow(
                                    title = "Budget",
                                    subtitle = moduleSubtitle(snap, "budget"),
                                    icon = Icons.Default.AccountBalanceWallet,
                                    identifier = "planner-module-budget"
                                ) { selectedSection = ReferencePlannerSection.BUDGET }
                            }
                            item {
                                ReferencePlannerRow(
                                    title = "Vendors",
                                    subtitle = moduleSubtitle(snap, "vendors"),
                                    icon = Icons.Default.Storefront,
                                    identifier = "planner-module-vendors"
                                ) { selectedSection = ReferencePlannerSection.VENDORS }
                            }
                            item {
                                ReferencePlannerRow(
                                    title = "Seating",
                                    subtitle = moduleSubtitle(snap, "seating"),
                                    icon = Icons.Default.TableRestaurant,
                                    identifier = "planner-module-seating"
                                ) { destination = ReferencePlannerDestination.SEATING }
                            }
                            item {
                                ReferencePlannerRow(
                                    title = "Timeline",
                                    subtitle = moduleSubtitle(snap, "timeline"),
                                    icon = Icons.Default.CalendarMonth,
                                    identifier = "planner-module-timeline"
                                ) { destination = ReferencePlannerDestination.TIMELINE }
                            }
                            item {
                                ReferencePlannerRow(
                                    title = "Documents",
                                    subtitle = "Contracts, notes, files",
                                    icon = Icons.Default.Description,
                                    identifier = "planner-module-documents"
                                ) { destination = ReferencePlannerDestination.DOCUMENTS }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ReferencePlannerRow(
    title: String,
    subtitle: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    identifier: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(WeddingIdentityPalette.IvorySoft)
            .border(1.dp, WeddingIdentityPalette.Hairline, RoundedCornerShape(16.dp))
            .clickable { onClick() }
            .testTag(identifier)
            .padding(14.dp),
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
                fontSize = 15.sp
            )
            Text(subtitle, color = WeddingIdentityPalette.Muted, fontSize = 12.sp)
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
private fun ReferenceTaskRow(task: PlannerTask) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(15.dp))
            .background(WeddingIdentityPalette.IvorySoft)
            .border(1.dp, WeddingIdentityPalette.Hairline, RoundedCornerShape(15.dp))
            .padding(13.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            if (task.status == TaskStatus.DONE) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
            contentDescription = null,
            tint = if (task.status == TaskStatus.DONE) WeddingIdentityPalette.Forest else WeddingIdentityPalette.ChampagneDeep
        )
        Spacer(modifier = Modifier.width(11.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                task.title,
                color = WeddingIdentityPalette.Ink,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium
            )
            Text(
                "${task.category} • ${task.priority.title}",
                color = WeddingIdentityPalette.Muted,
                fontSize = 11.sp
            )
        }
    }
}

@Composable
private fun ReferencePlannerEmptyDestination(
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
            WeddingBrandMark()
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

private fun moduleSubtitle(snapshot: PlannerDashboardSnapshot, id: String): String {
    val module = snapshot.modules.firstOrNull { it.id == id } ?: return "No data recorded"
    return if (!module.attention.isNullOrBlank()) "${module.value} • ${module.attention}" else module.value
}

private enum class ReferencePlannerSection(val title: String) {
    OVERVIEW("Overview"),
    TASKS("Tasks"),
    BUDGET("Budget"),
    VENDORS("Vendors")
}

private enum class ReferencePlannerDestination {
    SEATING,
    TIMELINE,
    DOCUMENTS
}
