package pro.wewed.app.ui.planner

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckCircle
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

@Composable
fun PlannerScreen(appViewModel: AppViewModel) {
    var tasks by remember { mutableStateOf<List<PlannerTask>>(emptyList()) }
    var budget by remember { mutableStateOf<BudgetSummary?>(null) }
    var selectedFilter by remember { mutableStateOf("All") }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        tasks = appViewModel.repository.getTasks()
        budget = appViewModel.repository.getBudget()
    }

    val filteredTasks = when (selectedFilter) {
        "To Do" -> tasks.filter { it.status == TaskStatus.TODO }
        "In Progress" -> tasks.filter { it.status == TaskStatus.IN_PROGRESS }
        "Done" -> tasks.filter { it.status == TaskStatus.DONE }
        else -> tasks
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Wedding Planner", fontWeight = FontWeight.SemiBold) },
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
        containerColor = WewedColors.Ivory
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = WewedSpacing.base),
            verticalArrangement = Arrangement.spacedBy(WewedSpacing.md)
        ) {
            item {
                // Budget Overview Card
                budget?.let { b ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(WewedRadius.lg),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(2.dp)
                    ) {
                        Column(modifier = Modifier.padding(WewedSpacing.base)) {
                            Text("Budget Overview", fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.height(WewedSpacing.sm))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(WewedSpacing.sm)
                            ) {
                                BudgetPill("Total", "$${b.totalBudget.toInt()}", WewedColors.Gold, Modifier.weight(1f))
                                BudgetPill("Allocated", "$${b.totalAllocated.toInt()}", WewedColors.Emerald, Modifier.weight(1f))
                                BudgetPill("Paid", "$${b.totalPaid.toInt()}", WewedColors.Burgundy, Modifier.weight(1f))
                            }
                        }
                    }
                }
            }

            item {
                // Filter Row
                LazyRow(horizontalArrangement = Arrangement.spacedBy(WewedSpacing.sm)) {
                    val filters = listOf("All", "To Do", "In Progress", "Done")
                    items(filters) { f ->
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
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(WewedSpacing.sm),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    task.category,
                                    fontSize = 11.sp,
                                    modifier = Modifier
                                        .background(WewedColors.GoldLight.copy(alpha = 0.4f), RoundedCornerShape(4.dp))
                                        .padding(horizontal = 4.dp, vertical = 2.dp)
                                )
                                Text(
                                    task.priority.title,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = when (task.priority) {
                                        TaskPriority.LOW -> Color.Gray
                                        TaskPriority.MEDIUM -> WewedColors.Emerald
                                        TaskPriority.HIGH -> WewedColors.Warning
                                        TaskPriority.URGENT -> WewedColors.Error
                                    }
                                )
                            }
                        }
                    }
                }
            }

            item {
                Spacer(modifier = Modifier.height(72.dp))
            }
        }
    }
}

@Composable
private fun BudgetPill(title: String, amount: String, color: Color, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .background(color.copy(alpha = 0.1f), RoundedCornerShape(WewedRadius.sm))
            .padding(vertical = 8.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(title, fontSize = 11.sp, color = Color.Gray)
            Text(amount, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = color)
        }
    }
}
