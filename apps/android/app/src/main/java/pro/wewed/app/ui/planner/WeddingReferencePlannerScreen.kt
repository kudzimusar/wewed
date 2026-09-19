package pro.wewed.app.ui.planner

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import pro.wewed.app.models.*
import pro.wewed.app.services.RoleScopedAccess
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.theme.*
import pro.wewed.app.ui.shared.TaskRow

/** The couple's "Our Wedding Plan" tab. */
@Composable
fun WeddingReferencePlannerScreen(appViewModel: AppViewModel, access: RoleScopedAccess) {
    val scope = rememberCoroutineScope()
    var dashboard by remember { mutableStateOf<PlannerDashboardSnapshot?>(null) }
    var tasks by remember { mutableStateOf<List<PlannerTask>>(emptyList()) }
    var selectedSection by rememberSaveable { mutableStateOf(ReferencePlannerSection.OVERVIEW) }
    var destination by rememberSaveable { mutableStateOf<ReferencePlannerDestination?>(null) }
    var busyTaskIds by remember { mutableStateOf(setOf<String>()) }
    var loading by remember { mutableStateOf(true) }
    var problem by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        try {
            dashboard = appViewModel.plannerRepository.getDashboard()
            tasks = appViewModel.repository.getTasks()
        } catch (_: Exception) {
            problem = "Your plan couldn't be loaded. Please try again."
        } finally {
            loading = false
        }
    }

    destination?.let { current ->
        val back = { destination = null }
        when (current) {
            ReferencePlannerDestination.BUDGET -> CoupleBudgetDestination(access, back)
            ReferencePlannerDestination.VENDORS -> CoupleVendorsDestination(access, back)
            ReferencePlannerDestination.SEATING -> CoupleSeatingDestination(access, back)
            ReferencePlannerDestination.TIMELINE -> CoupleTimelineDestination(access, back)
            ReferencePlannerDestination.CONTRIBUTIONS -> CoupleContributionsDestination(access, back)
            ReferencePlannerDestination.DOCUMENTS -> CoupleDocumentsDestination(access, back)
        }
        return
    }

    fun toggle(task: PlannerTask) {
        if (task.id in busyTaskIds) return
        busyTaskIds = busyTaskIds + task.id
        scope.launch {
            try {
                val updated = access.toggleTask(task.id)
                tasks = tasks.map { if (it.id == updated.id) updated else it }
            } catch (_: Exception) {
                problem = "That task couldn't be updated. Please try again."
            } finally {
                busyTaskIds = busyTaskIds - task.id
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WeddingIdentityPalette.Ivory)
            .testTag("planner-root")
    ) {
        WeddingOrnamentBackdrop(modifier = Modifier.matchParentSize(), alpha = 0.018f)

        if (loading) {
            CircularProgressIndicator(
                color = WeddingIdentityPalette.ChampagneDeep,
                modifier = Modifier.align(Alignment.Center)
            )
            return@Box
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            item {
                Row(modifier = Modifier.fillMaxWidth().testTag("planner-identity-card"), verticalAlignment = Alignment.Top) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            "Our Wedding Plan",
                            color = WeddingIdentityPalette.Ink,
                            fontFamily = FontFamily.Serif,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 28.sp
                        )
                        Text(
                            "Plan with clarity. Celebrate with confidence.",
                            color = WeddingIdentityPalette.Muted,
                            fontSize = 14.sp
                        )
                    }
                    dashboard?.coupleNames?.let { WeddingMonogramBadge(names = it, size = 58) }
                }
            }
            item {
                Row(
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    ReferencePlannerSection.entries.forEach { section ->
                        val selected = selectedSection == section
                        Box(
                            modifier = Modifier
                                .heightIn(min = 48.dp)
                                .clip(CircleShape)
                                .background(if (selected) WeddingIdentityPalette.Forest else WeddingIdentityPalette.IvorySoft)
                                .border(if (selected) 0.dp else 1.dp, WeddingIdentityPalette.Hairline, CircleShape)
                                .clickable(role = Role.Tab) {
                                    when (section) {
                                        ReferencePlannerSection.BUDGET -> destination = ReferencePlannerDestination.BUDGET
                                        ReferencePlannerSection.VENDORS -> destination = ReferencePlannerDestination.VENDORS
                                        else -> selectedSection = section
                                    }
                                }
                                .semantics { this.selected = selected }
                                .testTag("planner-section-${section.name.lowercase()}")
                                .padding(horizontal = 18.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                section.title,
                                color = if (selected) Color.White else WeddingIdentityPalette.Ink,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
            }
            problem?.let { item { Text(it, color = Color(0xFF9B1C1C), fontSize = 15.sp) } }

            if (selectedSection == ReferencePlannerSection.TASKS) {
                item {
                    Text(
                        "${tasks.count { it.status == TaskStatus.DONE }} of ${tasks.size} tasks done",
                        color = WeddingIdentityPalette.Muted,
                        fontSize = 14.sp
                    )
                }
                if (tasks.isEmpty()) {
                    item { Text("No tasks are recorded for this wedding.", color = WeddingIdentityPalette.Muted, fontSize = 16.sp) }
                }
                items(tasks, key = { it.id }) { task ->
                    TaskRow(task, onToggleDone = { toggle(task) }, busy = task.id in busyTaskIds)
                }
            } else {
                val snap = dashboard
                val done = tasks.count { it.status == TaskStatus.DONE }
                val ratio = if (tasks.isEmpty()) 0f else done.toFloat() / tasks.size.toFloat()
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(18.dp))
                            .background(WeddingIdentityPalette.IvorySoft)
                            .border(1.dp, WeddingIdentityPalette.Hairline, RoundedCornerShape(18.dp))
                            .clickable(role = Role.Button) { selectedSection = ReferencePlannerSection.TASKS }
                            .testTag("planner-progress")
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(9.dp)
                    ) {
                        Text(
                            "Planning Progress",
                            color = WeddingIdentityPalette.Ink,
                            fontFamily = FontFamily.Serif,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 17.sp
                        )
                        Text(
                            "${(ratio * 100).toInt()}% complete · $done of ${tasks.size} tasks done",
                            color = WeddingIdentityPalette.Muted,
                            fontSize = 14.sp
                        )
                        LinearProgressIndicator(
                            progress = { ratio },
                            modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(20.dp)),
                            color = WeddingIdentityPalette.Forest,
                            trackColor = Color(0xFFE5E9ED)
                        )
                    }
                }
                item {
                    ReferencePlannerRow("Tasks", "${tasks.count { it.status != TaskStatus.DONE }} remaining", Icons.Default.Checklist, "planner-module-tasks") {
                        selectedSection = ReferencePlannerSection.TASKS
                    }
                }
                item {
                    ReferencePlannerRow("Budget", moduleSubtitle(snap, "budget"), Icons.Default.AccountBalanceWallet, "planner-module-budget") {
                        destination = ReferencePlannerDestination.BUDGET
                    }
                }
                item {
                    ReferencePlannerRow("Contributions", moduleSubtitle(snap, "contributions"), Icons.Default.CardGiftcard, "planner-module-contributions") {
                        destination = ReferencePlannerDestination.CONTRIBUTIONS
                    }
                }
                item {
                    ReferencePlannerRow("Vendors", moduleSubtitle(snap, "vendors"), Icons.Default.Storefront, "planner-module-vendors") {
                        destination = ReferencePlannerDestination.VENDORS
                    }
                }
                item {
                    ReferencePlannerRow("Seating", moduleSubtitle(snap, "seating"), Icons.Default.TableRestaurant, "planner-module-seating") {
                        destination = ReferencePlannerDestination.SEATING
                    }
                }
                item {
                    ReferencePlannerRow("Timeline", moduleSubtitle(snap, "timeline"), Icons.Default.CalendarMonth, "planner-module-timeline") {
                        destination = ReferencePlannerDestination.TIMELINE
                    }
                }
                item {
                    ReferencePlannerRow("Documents", "Contracts and files", Icons.Default.Description, "planner-module-documents") {
                        destination = ReferencePlannerDestination.DOCUMENTS
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
            .heightIn(min = 64.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(WeddingIdentityPalette.IvorySoft)
            .border(1.dp, WeddingIdentityPalette.Hairline, RoundedCornerShape(16.dp))
            .clickable(role = Role.Button) { onClick() }
            .testTag(identifier)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        WeddingListRowIcon(icon)
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, color = WeddingIdentityPalette.Ink, fontFamily = FontFamily.Serif, fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
            Text(subtitle, color = WeddingIdentityPalette.Muted, fontSize = 14.sp)
        }
        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = WeddingIdentityPalette.Muted, modifier = Modifier.size(20.dp))
    }
}

private fun moduleSubtitle(snapshot: PlannerDashboardSnapshot?, id: String): String {
    val module = snapshot?.modules?.firstOrNull { it.id == id } ?: return "Open to see what's recorded"
    return if (!module.attention.isNullOrBlank()) "${module.value} · ${module.attention}" else module.value
}

private enum class ReferencePlannerSection(val title: String) {
    OVERVIEW("Overview"),
    TASKS("Tasks"),
    BUDGET("Budget"),
    VENDORS("Vendors")
}

private enum class ReferencePlannerDestination {
    BUDGET,
    VENDORS,
    SEATING,
    TIMELINE,
    CONTRIBUTIONS,
    DOCUMENTS
}
