package pro.wewed.app.ui.planner

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.models.*
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.theme.WewedColors
import pro.wewed.app.theme.WewedRadius
import pro.wewed.app.theme.WewedSpacing

@Composable
fun ShadowBudgetDestination(appViewModel: AppViewModel, onBack: () -> Unit) {
    var lines by remember { mutableStateOf<List<PlannerBudgetLine>>(emptyList()) }
    LaunchedEffect(Unit) { lines = appViewModel.plannerRepository.getBudgetLines() }

    val totalEstimated = lines.sumOf { it.estimated }
    val totalActual = lines.sumOf { it.actual }
    val totalPaid = lines.sumOf { it.paid }
    val totalOutstanding = (totalActual - totalPaid).coerceAtLeast(0.0)

    PlannerSubScreenScaffold(title = "Budget", onBack = onBack) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = WewedSpacing.base),
            verticalArrangement = Arrangement.spacedBy(WewedSpacing.md)
        ) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth().padding(top = WewedSpacing.sm),
                    shape = RoundedCornerShape(WewedRadius.lg),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Column(modifier = Modifier.padding(WewedSpacing.base)) {
                        Text("Financial Position", fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(WewedSpacing.sm))
                        Row(modifier = Modifier.fillMaxWidth()) {
                            FinanceValue("Estimated", totalEstimated, Modifier.weight(1f))
                            FinanceValue("Actual", totalActual, Modifier.weight(1f))
                            FinanceValue("Paid", totalPaid, Modifier.weight(1f))
                            FinanceValue("Outstanding", totalOutstanding, Modifier.weight(1f))
                        }
                        Spacer(modifier = Modifier.height(WewedSpacing.sm))
                        LinearProgressIndicator(
                            progress = { if (totalActual <= 0.0) 0f else (totalPaid / totalActual).toFloat() },
                            modifier = Modifier.fillMaxWidth(),
                            color = WewedColors.Emerald
                        )
                    }
                }
            }

            items(lines) { line ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(WewedRadius.lg),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Column(modifier = Modifier.padding(WewedSpacing.base), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Column {
                                Text(line.category, fontWeight = FontWeight.SemiBold)
                                line.vendorName?.let { Text(it, fontSize = 11.sp, color = Color.Gray) }
                            }
                            Text(line.statusLabel, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WewedColors.Emerald)
                        }
                        Row(modifier = Modifier.fillMaxWidth()) {
                            FinanceValue("Estimated", line.estimated, Modifier.weight(1f))
                            FinanceValue("Actual", line.actual, Modifier.weight(1f))
                            FinanceValue("Paid", line.paid, Modifier.weight(1f))
                            FinanceValue("Outstanding", (line.actual - line.paid).coerceAtLeast(0.0), Modifier.weight(1f))
                        }
                        Text(line.fundingLabel, fontSize = 10.sp, color = WewedColors.Gold)
                        line.dueDateLabel?.let { Text(it, fontSize = 10.sp, color = Color.Gray) }
                    }
                }
            }
        }
    }
}

@Composable
private fun FinanceValue(label: String, amount: Double, modifier: Modifier = Modifier) {
    Column(modifier = modifier) {
        Text(label, fontSize = 9.sp, color = Color.Gray)
        Text("\${amount.toInt()}", fontSize = 11.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun ShadowContributionsDestination(appViewModel: AppViewModel, onBack: () -> Unit) {
    var records by remember { mutableStateOf<List<PlannerContributionRecord>>(emptyList()) }
    LaunchedEffect(Unit) { records = appViewModel.plannerRepository.getContributions() }

    PlannerSubScreenScaffold(title = "Contributions", onBack = onBack) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = WewedSpacing.base),
            verticalArrangement = Arrangement.spacedBy(WewedSpacing.md)
        ) {
            item {
                val total = records.sumOf { it.value }
                val unverified = records.count { !it.verified }
                Card(
                    modifier = Modifier.fillMaxWidth().padding(top = WewedSpacing.sm),
                    shape = RoundedCornerShape(WewedRadius.lg),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(WewedSpacing.base),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text("\${total.toInt()}", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = WewedColors.Emerald)
                            Text("recorded contribution value", fontSize = 11.sp, color = Color.Gray)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text("$unverified", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = if (unverified > 0) WewedColors.Warning else WewedColors.Emerald)
                            Text("need verification", fontSize = 11.sp, color = Color.Gray)
                        }
                    }
                }
            }

            items(records) { record ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(WewedRadius.lg),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Column(modifier = Modifier.padding(WewedSpacing.base), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(record.contributorLabel, fontWeight = FontWeight.SemiBold)
                            Text("\${record.value.toInt()}", fontWeight = FontWeight.Bold, color = WewedColors.Emerald)
                        }
                        Text(record.typeLabel, fontSize = 11.sp, color = Color.Gray)
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(record.allocationLabel, fontSize = 10.sp, color = WewedColors.Gold)
                            Text(
                                record.statusLabel,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (record.verified) WewedColors.Emerald else WewedColors.Warning
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ShadowVendorsDestination(appViewModel: AppViewModel, onBack: () -> Unit) {
    var vendors by remember { mutableStateOf<List<PlannerVendorEngagement>>(emptyList()) }
    LaunchedEffect(Unit) { vendors = appViewModel.plannerRepository.getVendorEngagements() }

    PlannerSubScreenScaffold(title = "Vendors", onBack = onBack) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = WewedSpacing.base),
            verticalArrangement = Arrangement.spacedBy(WewedSpacing.md)
        ) {
            items(vendors) { vendor ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(WewedRadius.lg),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Column(modifier = Modifier.padding(WewedSpacing.base), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Column {
                                Text(vendor.vendorName, fontWeight = FontWeight.SemiBold)
                                Text(vendor.category, fontSize = 11.sp, color = Color.Gray)
                            }
                            Text(vendor.bookingStatus, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WewedColors.Emerald)
                        }
                        Text("Contract: ${vendor.contractStatus}", fontSize = 10.sp, color = Color.Gray)
                        Text("Payment: ${vendor.paymentStatus}", fontSize = 10.sp, color = Color.Gray)
                        Text("Next: ${vendor.nextAction}", fontSize = 11.sp, color = WewedColors.Gold)
                    }
                }
            }
        }
    }
}

@Composable
fun ShadowSeatingDestination(appViewModel: AppViewModel, onBack: () -> Unit) {
    var tables by remember { mutableStateOf<List<PlannerSeatingTable>>(emptyList()) }
    LaunchedEffect(Unit) { tables = appViewModel.plannerRepository.getSeatingTables() }

    PlannerSubScreenScaffold(title = "Seating", onBack = onBack) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = WewedSpacing.base),
            verticalArrangement = Arrangement.spacedBy(WewedSpacing.md)
        ) {
            item {
                val assigned = tables.sumOf { it.assigned }
                val capacity = tables.sumOf { it.capacity }
                Card(
                    modifier = Modifier.fillMaxWidth().padding(top = WewedSpacing.sm),
                    shape = RoundedCornerShape(WewedRadius.lg),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(WewedSpacing.base),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("$assigned assigned", fontWeight = FontWeight.Bold)
                        Text("${(capacity - assigned).coerceAtLeast(0)} available", color = WewedColors.Emerald, fontWeight = FontWeight.SemiBold)
                    }
                }
            }

            items(tables) { table ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(WewedRadius.lg),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Column(modifier = Modifier.padding(WewedSpacing.base)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(table.name, fontWeight = FontWeight.SemiBold)
                            Text("${table.assigned}/${table.capacity}", fontWeight = FontWeight.Bold)
                        }
                        Text(table.zone, fontSize = 11.sp, color = Color.Gray)
                        Spacer(modifier = Modifier.height(6.dp))
                        LinearProgressIndicator(
                            progress = { if (table.capacity <= 0) 0f else table.assigned.toFloat() / table.capacity.toFloat() },
                            modifier = Modifier.fillMaxWidth(),
                            color = if (table.assigned > table.capacity) WewedColors.Error else WewedColors.Emerald
                        )
                        table.attentionLabel?.let { Text(it, fontSize = 10.sp, color = WewedColors.Gold) }
                    }
                }
            }
        }
    }
}

@Composable
fun ShadowTimelineDestination(appViewModel: AppViewModel, onBack: () -> Unit) {
    var entries by remember { mutableStateOf<List<PlannerTimelineEntry>>(emptyList()) }
    LaunchedEffect(Unit) { entries = appViewModel.plannerRepository.getTimelineEntries() }

    PlannerSubScreenScaffold(title = "Timeline", onBack = onBack) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = WewedSpacing.base),
            verticalArrangement = Arrangement.spacedBy(WewedSpacing.md)
        ) {
            items(entries) { entry ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(WewedRadius.lg),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Row(modifier = Modifier.padding(WewedSpacing.base), verticalAlignment = Alignment.Top) {
                        Text(entry.time, fontWeight = FontWeight.Bold, color = WewedColors.Gold, modifier = Modifier.width(54.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(entry.title, fontWeight = FontWeight.SemiBold)
                            Text(entry.location, fontSize = 11.sp, color = Color.Gray)
                            entry.linkedVendor?.let { Text(it, fontSize = 10.sp, color = WewedColors.Emerald) }
                        }
                        Text(entry.statusLabel, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }
}
