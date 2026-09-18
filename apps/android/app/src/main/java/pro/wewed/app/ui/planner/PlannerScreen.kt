package pro.wewed.app.ui.planner

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.outlined.Circle
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlannerScreen(appViewModel: AppViewModel) {
    var dashboard by remember { mutableStateOf<PlannerDashboardSnapshot?>(null) }
    var tasks by remember { mutableStateOf<List<PlannerTask>>(emptyList()) }
    var selectedFilter by remember { mutableStateOf("All") }
    var activeModule by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    if (activeModule != null) {
        when (activeModule) {
            "tasks" -> TasksDestination(appViewModel = appViewModel, onBack = { activeModule = null })
            "budget" -> ShadowBudgetDestination(appViewModel = appViewModel, onBack = { activeModule = null })
            "contributions" -> ShadowContributionsDestination(appViewModel = appViewModel, onBack = { activeModule = null })
            "vendors" -> ShadowVendorsDestination(appViewModel = appViewModel, onBack = { activeModule = null })
            "guests" -> GuestsBridgeDestination(appViewModel = appViewModel, onBack = { activeModule = null })
            "seating" -> ShadowSeatingDestination(appViewModel = appViewModel, onBack = { activeModule = null })
            "timeline" -> ShadowTimelineDestination(appViewModel = appViewModel, onBack = { activeModule = null })
            else -> activeModule = null
        }
        return
    }

    LaunchedEffect(Unit) {
        dashboard = appViewModel.plannerRepository.getDashboard()
        tasks = appViewModel.repository.getTasks()
    }

    val filteredTasks = when (selectedFilter) {
        "To Do" -> tasks.filter { it.status == TaskStatus.TODO }
        "In Progress" -> tasks.filter { it.status == TaskStatus.IN_PROGRESS }
        "Blocked" -> tasks.filter { it.status == TaskStatus.BLOCKED }
        "Done" -> tasks.filter { it.status == TaskStatus.DONE }
        else -> tasks
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Wedding Planner", fontWeight = FontWeight.SemiBold) },
                actions = {
                    Surface(
                        shape = RoundedCornerShape(50),
                        color = WewedColors.Emerald.copy(alpha = 0.12f)
                    ) {
                        Text(
                            appViewModel.dataEnvironment.title.uppercase(),
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                            color = WewedColors.Emerald,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Spacer(modifier = Modifier.width(WewedSpacing.sm))
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = WewedColors.Ivory)
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = {
                    scope.launch {
                        val created = appViewModel.repository.createTask(
                            "New Task",
                            TaskPriority.MEDIUM,
                            "Logistics"
                        )
                        tasks = tasks + created
                    }
                },
                containerColor = WewedColors.Gold,
                contentColor = Color.White
            ) {
                Icon(Icons.Default.Add, contentDescription = "Add Task")
            }
        },
        containerColor = WewedColors.Ivory,
        modifier = Modifier.testTag("planner-root")
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = WewedSpacing.base),
            verticalArrangement = Arrangement.spacedBy(WewedSpacing.md)
        ) {
            dashboard?.let { snapshot ->
                item { PlannerIdentityCard(snapshot) }
                item { ReadinessCard(snapshot) }
                item { AttentionCard(snapshot) }
            }
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Priority Tasks", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    Text(
                        "${tasks.count { it.status != TaskStatus.DONE }} open",
                        fontSize = 12.sp,
                        color = Color.Gray
                    )
                }
            }

            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(WewedSpacing.sm)) {
                    val filters = listOf("All", "To Do", "In Progress", "Blocked", "Done")
                    items(filters) { f ->
                        FilterChip(
                            selected = selectedFilter == f,
                            onClick = { selectedFilter = f },
                            label = { Text(f) }
                        )
                    }
                }
            }

            items(filteredTasks.take(4), key = { it.id }) { task ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(WewedRadius.md),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(1.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(WewedSpacing.base),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = {
                            scope.launch {
                                val updated = appViewModel.repository.toggleTask(task.id)
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
                                text = task.title,
                                fontWeight = FontWeight.SemiBold,
                                textDecoration = if (task.status == TaskStatus.DONE) TextDecoration.LineThrough else null,
                                color = if (task.status == TaskStatus.DONE) Color.Gray else Color.Unspecified
                            )
                            Text(
                                "${task.category} • ${task.priority.title}",
                                fontSize = 11.sp,
                                color = Color.Gray
                            )
                        }
                    }
                }
            }

            item {
                TextButton(
                    onClick = { activeModule = "tasks" },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Open full task workspace", color = WewedColors.Emerald, fontWeight = FontWeight.SemiBold)
                }
            }

            dashboard?.let { snapshot ->
                item { Text("Planning Areas", fontWeight = FontWeight.Bold, fontSize = 18.sp) }

                items(snapshot.modules.chunked(2)) { row ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(WewedSpacing.md)
                    ) {
                        row.forEach { module ->
                            PlanningModuleCard(
                                module = module,
                                modifier = Modifier.weight(1f).testTag("planner-module-${module.id}"),
                                onClick = { activeModule = module.id }
                            )
                        }
                        if (row.size == 1) {
                            Spacer(modifier = Modifier.weight(1f))
                        }
                    }
                }
            }

            dashboard?.let { snapshot ->
                item { RecentActivityCard(snapshot) }
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = WewedColors.Emerald.copy(alpha = 0.08f)),
                        shape = RoundedCornerShape(WewedRadius.md)
                    ) {
                        Text(
                            "Isolated native data • ${snapshot.sourceLabel}",
                            modifier = Modifier.padding(WewedSpacing.base),
                            fontSize = 11.sp,
                            color = WewedColors.Emerald
                        )
                    }
                }
            }

            item { Spacer(modifier = Modifier.height(72.dp)) }
        }
    }
}

@Composable
private fun PlannerIdentityCard(snapshot: PlannerDashboardSnapshot) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(WewedRadius.lg),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(modifier = Modifier.padding(WewedSpacing.base)) {
            Text(
                snapshot.plannerContext.uppercase(),
                color = WewedColors.Gold,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold
            )
            Text(snapshot.coupleNames, fontSize = 24.sp, fontWeight = FontWeight.Bold)
            Text(snapshot.weddingDateLabel, color = Color.Gray, fontSize = 13.sp)
        }
    }
}

@Composable
private fun ReadinessCard(snapshot: PlannerDashboardSnapshot) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(WewedRadius.lg),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(modifier = Modifier.padding(WewedSpacing.base)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column {
                    Text("PLANNING HEALTH", fontSize = 10.sp, color = WewedColors.Gold, fontWeight = FontWeight.Bold)
                    Text("Ready for the next planning milestone", fontSize = 12.sp, color = Color.Gray)
                }
                Text("${snapshot.readinessScore}%", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = WewedColors.Emerald)
            }
            Spacer(modifier = Modifier.height(WewedSpacing.sm))
            LinearProgressIndicator(
                progress = { snapshot.readinessScore / 100f },
                modifier = Modifier.fillMaxWidth(),
                color = WewedColors.Emerald
            )
        }
    }
}

@Composable
private fun AttentionCard(snapshot: PlannerDashboardSnapshot) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(WewedRadius.lg),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(modifier = Modifier.padding(WewedSpacing.base), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Needs Attention", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            snapshot.attentionItems.take(5).forEach { item ->
                Row(verticalAlignment = Alignment.Top) {
                    Box(
                        modifier = Modifier
                            .padding(top = 5.dp)
                            .size(8.dp)
                            .background(
                                when (item.severity) {
                                    PlannerAttentionSeverity.INFO -> WewedColors.Emerald
                                    PlannerAttentionSeverity.WARNING -> WewedColors.Warning
                                    PlannerAttentionSeverity.URGENT -> WewedColors.Error
                                },
                                CircleShape
                            )
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(item.title, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                        Text(item.detail, fontSize = 11.sp, color = Color.Gray)
                    }
                }
            }
        }
    }
}

@Composable
private fun PlanningModuleCard(module: PlannerModuleSummary, modifier: Modifier, onClick: () -> Unit) {
    Card(
        modifier = modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(WewedRadius.lg),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(modifier = Modifier.padding(WewedSpacing.base)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(module.title, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                Icon(Icons.Default.ArrowForward, contentDescription = null, tint = Color.Gray, modifier = Modifier.size(16.dp))
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(module.value, fontWeight = FontWeight.Bold, color = WewedColors.Emerald, fontSize = 18.sp)
            module.attention?.let {
                Text(it, color = Color.Gray, fontSize = 10.sp, maxLines = 2)
            }
        }
    }
}

@Composable
private fun RecentActivityCard(snapshot: PlannerDashboardSnapshot) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(WewedRadius.lg),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(modifier = Modifier.padding(WewedSpacing.base), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Recent Activity", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            snapshot.recentActivity.forEach { item ->
                Row(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(item.title, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                        Text(item.detail, color = Color.Gray, fontSize = 11.sp)
                    }
                    Text(item.relativeTime, color = Color.Gray, fontSize = 10.sp)
                }
            }
        }
    }
}
