package pro.wewed.app.ui.planner

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.Circle
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import pro.wewed.app.models.*
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.theme.WewedColors
import pro.wewed.app.theme.WewedRadius
import pro.wewed.app.theme.WewedSpacing

// Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 closure §10 (P1-N4 remainder).
//
// This file used to also define `enum class PlannerDestinationRoute` and 20 composables
// (Budget/Contributions/Vendors/Timeline/Seating/Operations/ClientProfile/Collaboration/
// Invitations/EventCommand/ReleaseCentre/WeddingBrief/Notebook/MediaArchive/AIWorkspace/
// Portfolio/Bookings/ContractGovernance/ContractIntelligence/MarketplaceProfile Destinations),
// none of which had a single caller anywhere in the app (confirmed by grep, individually, before
// deletion) — the enum itself was never referenced outside its own declaration either. Several
// hardcoded a "Charity & Kudzie" wedding, an "Eleven Eleven Testing" planner, and invented guest/
// table/contract counts, exactly the production-reachable-fabrication hazard master plan §8.13/
// P1-N4 exists to close. `GenericToolDestination` (the shared renderer those 12 called) became
// dead in turn once they were removed, and is deleted with them. `TasksDestination` and
// `GuestsBridgeDestination` are real, reachable destinations (RoleWorkspaces.kt) and are
// unchanged; the 5 of the 20 that forwarded to a live `Shadow*Destination` sibling
// (`ShadowPlannerDestinations.kt`) left those siblings untouched — they were never called through
// this file's dead wrappers to begin with.

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlannerSubScreenScaffold(
    title: String,
    onBack: () -> Unit,
    content: @Composable (PaddingValues) -> Unit
) {
    BackHandler(onBack = onBack)
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title, fontWeight = FontWeight.SemiBold, fontSize = 18.sp) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = WewedColors.Ivory)
            )
        },
        containerColor = WewedColors.Ivory,
        content = content
    )
}

@Composable
fun TasksDestination(appViewModel: AppViewModel, onBack: () -> Unit) {
    var tasks by remember { mutableStateOf<List<PlannerTask>>(emptyList()) }
    var selectedFilter by remember { mutableStateOf("All") }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        tasks = appViewModel.scopedRepository().getTasks()
    }

    val filteredTasks = when (selectedFilter) {
        "To Do" -> tasks.filter { it.status == TaskStatus.TODO }
        "In Progress" -> tasks.filter { it.status == TaskStatus.IN_PROGRESS }
        "Blocked" -> tasks.filter { it.status == TaskStatus.BLOCKED }
        "Done" -> tasks.filter { it.status == TaskStatus.DONE }
        else -> tasks
    }

    PlannerSubScreenScaffold(title = "Tasks Checklist", onBack = onBack) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = WewedSpacing.base),
            verticalArrangement = Arrangement.spacedBy(WewedSpacing.md)
        ) {
            item {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = WewedSpacing.sm),
                    horizontalArrangement = Arrangement.spacedBy(WewedSpacing.sm)
                ) {
                    listOf("All", "To Do", "In Progress", "Blocked", "Done").forEach { f ->
                        FilterChip(
                            selected = selectedFilter == f,
                            onClick = { selectedFilter = f },
                            label = { Text(f) }
                        )
                    }
                }
            }

            items(filteredTasks, key = { it.id }) { task ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(WewedRadius.md),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Row(
                        modifier = Modifier.padding(WewedSpacing.base),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = {
                            scope.launch {
                                val updated = appViewModel.scopedRepository().toggleTask(task.id)
                                tasks = tasks.map { if (it.id == task.id) updated else it }
                            }
                        }) {
                            Icon(
                                imageVector = if (task.status == TaskStatus.DONE) Icons.Default.CheckCircle else Icons.Outlined.Circle,
                                contentDescription = null,
                                tint = if (task.status == TaskStatus.DONE) WewedColors.Success else WewedColors.Gold
                            )
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                task.title,
                                fontWeight = FontWeight.SemiBold,
                                textDecoration = if (task.status == TaskStatus.DONE) TextDecoration.LineThrough else null,
                                color = if (task.status == TaskStatus.DONE) Color.Gray else Color.Unspecified
                            )
                            Text(
                                "${task.category} • Priority: ${task.priority.title}",
                                fontSize = 12.sp,
                                color = Color.Gray
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun GuestsBridgeDestination(appViewModel: AppViewModel, onBack: () -> Unit) {
    var guests by remember { mutableStateOf<List<Guest>>(emptyList()) }
    LaunchedEffect(Unit) {
        guests = appViewModel.scopedRepository().getGuests()
    }
    PlannerSubScreenScaffold(title = "Guests Roster Bridge", onBack = onBack) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = WewedSpacing.base),
            verticalArrangement = Arrangement.spacedBy(WewedSpacing.md)
        ) {
            item {
                Text("Sync with Wedding Pass Gate Manifest (${guests.size} guests)", fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = WewedSpacing.sm))
            }
            items(guests) { g ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(WewedRadius.md),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Row(
                        modifier = Modifier.padding(WewedSpacing.base),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(g.name, fontWeight = FontWeight.SemiBold)
                            Text("${g.tableName ?: "Unseated"} • Party of ${g.partySize}", fontSize = 12.sp, color = Color.Gray)
                        }
                        Text(
                            if (g.checkedIn) "ADMITTED" else g.rsvpStatus.title.uppercase(),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (g.checkedIn) WewedColors.Success else (if (g.rsvpStatus == RSVPStatus.ATTENDING) WewedColors.Emerald else WewedColors.Gold)
                        )
                    }
                }
            }
        }
    }
}
