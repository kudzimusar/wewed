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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.models.*
import pro.wewed.app.services.ServiceEngagementSummary
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
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = WewedSpacing.base).testTag("planner-budget-root"),
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
        Text(formatUsd(amount), fontSize = 11.sp, fontWeight = FontWeight.Bold)
    }
}

private fun formatUsd(amount: Double): String =
    String.format(java.util.Locale.US, "$%,.0f", amount)

@Composable
fun ShadowContributionsDestination(appViewModel: AppViewModel, onBack: () -> Unit) {
    // Master plan Phase 8 closure round 3 §2 — a live failure (transport/permission/revocation)
    // must render distinctly from an authoritative empty ledger, never fall back to one silently.
    val state = pro.wewed.app.ui.roles.rememberProductionLoad(Unit) { appViewModel.plannerRepository.getContributions() }
    when (state) {
        is pro.wewed.app.ui.roles.ProductionLoadState.Loading -> {
            PlannerSubScreenScaffold(title = "Contributions", onBack = onBack) { padding ->
                Box(modifier = Modifier.fillMaxSize().padding(padding)) { pro.wewed.app.ui.roles.IALoading() }
            }
            return
        }
        is pro.wewed.app.ui.roles.ProductionLoadState.Unavailable -> {
            PlannerSubScreenScaffold(title = "Contributions", onBack = onBack) { padding ->
                Box(modifier = Modifier.fillMaxSize().padding(padding)) {
                    pro.wewed.app.ui.roles.IASectionUnavailable("Contributions", appViewModel.dataEnvironment)
                }
            }
            return
        }
        is pro.wewed.app.ui.roles.ProductionLoadState.Loaded -> Unit
    }
    val records = state.value

    val hasMonetaryValues = records.any { it.value > 0.0 }

    PlannerSubScreenScaffold(title = "Contributions", onBack = onBack) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = WewedSpacing.base).testTag("planner-contributions-root"),
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
                            Text(
                                if (hasMonetaryValues) formatUsd(total) else records.size.toString(),
                                fontSize = 26.sp,
                                fontWeight = FontWeight.Bold,
                                color = WewedColors.Emerald
                            )
                            Text(
                                if (hasMonetaryValues) "recorded contribution value" else "memories, blessings & stories",
                                fontSize = 11.sp,
                                color = Color.Gray
                            )
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
                            if (record.value > 0.0) {
                                Text(formatUsd(record.value), fontWeight = FontWeight.Bold, color = WewedColors.Emerald)
                            }
                        }
                        Text(record.typeLabel, fontSize = 11.sp, color = Color.Gray)
                        if (record.allocationLabel.isNotBlank()) {
                            Text(record.allocationLabel, fontSize = 10.sp, color = WewedColors.Gold)
                        }
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

@Composable
fun ShadowVendorsDestination(appViewModel: AppViewModel, onBack: () -> Unit) {
    var vendors by remember { mutableStateOf<List<PlannerVendorEngagement>>(emptyList()) }
    LaunchedEffect(Unit) { vendors = appViewModel.plannerRepository.getVendorEngagements() }

    // Master plan Phase 8 closure round 3 §3 — Contracts/Deal-Room, folded into this EXISTING,
    // already-authorized "Vendors" navigation entry rather than added as a new Level-2 section: the
    // locked cross-platform IA V2 navigation contract (mobile/contracts/ia-v2-navigation.json,
    // status AUTHORITATIVE) enumerates every Level-2 section for Planner/Couple by name, and both
    // platforms assert equality against it in unit tests — adding a new entry there is a product/IA
    // decision, not the "wire existing UI to real data" mandate this closure item is scoped to.
    // `Vendor.id` and `ServiceEngagement.vendorId` are the same id space (see the Prisma schema's
    // `Vendor.serviceEngagements` relation), so this is a genuinely adjacent, not arbitrary, home for
    // it. `PlannerVendorEngagement` above (the `Vendor.contractStatus`/`paymentStatus` planning
    // fields) and `ServiceEngagementSummary` below (the managed-contract lifecycle) are rendered as
    // two clearly separate, distinctly-labelled lists from two distinct DTOs/repositories — never
    // merged into one model, so neither domain is conflated with the other.
    val contractsState = if (appViewModel.dataEnvironment == NativeDataEnvironment.PRODUCTION) {
        pro.wewed.app.ui.roles.rememberProductionLoad(Unit) { appViewModel.contractsRepository.getServiceEngagements() }
    } else null

    PlannerSubScreenScaffold(title = "Vendors", onBack = onBack) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = WewedSpacing.base).testTag("planner-vendors-root"),
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

            if (contractsState != null) {
                item {
                    Text(
                        "Contracts & Engagements",
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(top = WewedSpacing.md).testTag("planner-contracts-header")
                    )
                }
                when (contractsState) {
                    is pro.wewed.app.ui.roles.ProductionLoadState.Loading -> item { pro.wewed.app.ui.roles.IALoading() }
                    is pro.wewed.app.ui.roles.ProductionLoadState.Unavailable -> item {
                        pro.wewed.app.ui.roles.IASectionUnavailable("Contracts", appViewModel.dataEnvironment)
                    }
                    is pro.wewed.app.ui.roles.ProductionLoadState.Loaded -> {
                        val engagements = contractsState.value
                        if (engagements.isEmpty()) {
                            item { Text("No managed service engagements recorded for this wedding.", color = Color.Gray, fontSize = 12.sp) }
                        } else {
                            items(engagements) { engagement -> ServiceEngagementCard(engagement) }
                        }
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
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = WewedSpacing.base).testTag("planner-seating-root"),
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
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = WewedSpacing.base).testTag("planner-timeline-root"),
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


@Composable
fun ShadowDocumentsDestination(appViewModel: AppViewModel, onBack: () -> Unit) {
    // Master plan Phase 8 closure §3/round 3 §2 — ProductionPlannerDashboardRepository.getDocuments()
    // reads the real Vault catalog (`/api/native/wedding/vault`, the same `listWeddingVaultObjects`
    // engine the PWA uses). A genuinely fetched empty list is an honest "no documents recorded",
    // exactly like Budget/Seating/Timeline; a live failure (transport/permission/revocation) must
    // render as unavailable instead, never fall back to that same empty state. The managed-contract
    // lifecycle (Deal Room, versions, review/acceptance) is a separate, still-unwired domain — not
    // shown here at all, so it is never confused with this Vault listing.
    val state = pro.wewed.app.ui.roles.rememberProductionLoad(Unit) { appViewModel.plannerRepository.getDocuments() }
    if (state is pro.wewed.app.ui.roles.ProductionLoadState.Loading) {
        PlannerSubScreenScaffold(title = "Documents", onBack = onBack) { padding ->
            Box(modifier = Modifier.fillMaxSize().padding(padding)) { pro.wewed.app.ui.roles.IALoading() }
        }
        return
    }
    if (state is pro.wewed.app.ui.roles.ProductionLoadState.Unavailable) {
        PlannerSubScreenScaffold(title = "Documents", onBack = onBack) { padding ->
            Box(modifier = Modifier.fillMaxSize().padding(padding)) {
                pro.wewed.app.ui.roles.IASectionUnavailable("Documents", appViewModel.dataEnvironment)
            }
        }
        return
    }
    val records = (state as pro.wewed.app.ui.roles.ProductionLoadState.Loaded).value

    PlannerSubScreenScaffold(title = "Documents", onBack = onBack) { padding ->
        if (records.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .testTag("planner-documents-root"),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Documents", fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "No contracts or documents recorded for this wedding.",
                        color = Color.Gray,
                        fontSize = 13.sp
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(horizontal = WewedSpacing.base)
                    .testTag("planner-documents-root"),
                verticalArrangement = Arrangement.spacedBy(WewedSpacing.md)
            ) {
                items(records) { record ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(WewedRadius.lg),
                        colors = CardDefaults.cardColors(containerColor = Color.White)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(WewedSpacing.base),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(record.title, fontWeight = FontWeight.SemiBold)
                                Text(record.kind, fontSize = 11.sp, color = Color.Gray)
                            }
                            record.statusLabel?.let {
                                Text(it, fontSize = 10.sp, color = WewedColors.Emerald, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ServiceEngagementCard(engagement: ServiceEngagementSummary) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(WewedRadius.lg),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(modifier = Modifier.padding(WewedSpacing.base), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column {
                    Text(engagement.vendorName, fontWeight = FontWeight.SemiBold)
                    Text(engagement.serviceCategory, fontSize = 11.sp, color = Color.Gray)
                }
                Text(engagement.lifecycleStatus, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WewedColors.Emerald)
            }
            engagement.agreedAmount?.let {
                Text("Agreed: $it ${engagement.currency}", fontSize = 11.sp, color = WewedColors.Gold)
            }
            if (engagement.contracts.isEmpty()) {
                Text("No contract drafted yet", fontSize = 10.sp, color = Color.Gray)
            } else {
                engagement.contracts.forEach { contract ->
                    Text(
                        "${contract.contractNumber} · ${contract.status} · v${contract.currentVersionNumber}",
                        fontSize = 10.sp,
                        color = Color.Gray
                    )
                }
            }
        }
    }
}
