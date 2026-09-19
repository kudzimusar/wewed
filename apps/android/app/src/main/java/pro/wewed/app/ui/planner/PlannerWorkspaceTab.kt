package pro.wewed.app.ui.planner

import android.webkit.WebView
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import pro.wewed.app.services.PlannerWorksheet
import pro.wewed.app.services.WorksheetCsv
import pro.wewed.app.ui.shared.*

private const val IMPORT_ELSEWHERE = "Import for this worksheet is available in the web workspace."

/** Workspace tab: client selector, worksheet picker, Actions, and the current worksheet. */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun PlannerWorkspaceTab(model: PlannerWorkspaceModel) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var showActions by remember { mutableStateOf(false) }
    var showPicker by remember { mutableStateOf(false) }
    var showArrange by remember { mutableStateOf(false) }
    var showClients by remember { mutableStateOf(false) }
    var bulkMarkDone by remember { mutableStateOf<Boolean?>(null) }
    var printView by remember { mutableStateOf<WebView?>(null) }
    val ws = model.worksheet
    val data = model.data

    val importLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            try {
                val text = WorksheetFileActions.readText(context, uri)
                val name = WorksheetFileActions.displayName(context, uri) ?: "Selected file"
                model.push(PlannerRoute.ImportPreview(ImportDraft(name, WorksheetCsv.previewTaskImport(text))))
            } catch (error: Exception) {
                model.message = error.message?.takeIf { it.startsWith("The file") } ?: "The file couldn't be read."
            }
        }
    }

    fun export(only: Set<String>?) {
        val d = model.data ?: return
        val csv = WorksheetOutput.csv(ws, d, model.arrangeMode(), only) ?: return
        WorksheetFileActions.shareCsv(context, ws.exportFileName, csv)?.let { model.message = it }
    }

    fun print(only: Set<String>?) {
        val d = model.data ?: return
        val table = WorksheetOutput.table(ws, d, model.arrangeMode(), only)
        val subtitle = buildString {
            append(if (only == null) "All rows" else "Selected rows (${only.size})")
            append(" · Printed ${Formatting.dateTime(System.currentTimeMillis())}")
        }
        val html = WorksheetOutput.html(table, d.wedding.coupleNames, subtitle)
        WorksheetFileActions.print(context, "Wewed ${table.title}", html) { printView = it }?.let { model.message = it }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("planner-workspace-tab"),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item { ClientSelector(model, expanded = showClients, onExpandedChange = { showClients = it }) }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                SecondaryButton(
                    text = "Worksheet: ${ws.title}",
                    icon = Icons.Default.TableChart,
                    onClick = { showPicker = true },
                    modifier = Modifier.weight(1f).testTag("planner-worksheet-picker")
                )
                PrimaryButton(
                    text = "Actions",
                    icon = Icons.Default.MoreHoriz,
                    onClick = { showActions = true },
                    modifier = Modifier.testTag("planner-actions-button")
                )
            }
        }
        item {
            val status = buildList {
                model.loadedAtMillis?.let { add("Updated ${Formatting.time(it)}") }
                if (model.loading) add("Refreshing…")
                val mode = model.arrangeMode()
                if (mode != ArrangeMode.DEFAULT) add("Arranged: ${mode.label} (this device)")
            }
            if (status.isNotEmpty()) SupportingText(status.joinToString(" · "), Modifier.testTag("planner-workspace-status"))
        }
        model.message?.let { text ->
            item {
                Text(
                    text,
                    color = Ui.Ink,
                    fontSize = 16.sp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Ui.Notice)
                        .padding(12.dp)
                        .testTag("planner-workspace-message")
                        .semantics { liveRegion = LiveRegionMode.Polite }
                )
            }
        }
        model.loadProblem?.let { item { ProblemText(it) } }

        if (model.selectionMode && data != null) {
            item {
                SelectionBar(
                    model = model,
                    allIds = currentRowIds(model),
                    onMarkDone = { bulkMarkDone = true },
                    onMarkToDo = { bulkMarkDone = false },
                    onExport = { export(model.selectedIds) },
                    onPrint = { print(model.selectedIds) }
                )
            }
        }

        if (data == null) {
            if (model.loadProblem == null) item { LoadingIndicator() }
        } else {
            worksheetBody(model, data)
        }
    }

    if (showActions) {
        ModalBottomSheet(
            onDismissRequest = { showActions = false },
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
            containerColor = Ui.Background
        ) {
            ActionsSheetContent(
                model = model,
                onRefresh = { showActions = false; model.refresh() },
                onSwitch = { showActions = false; showPicker = true },
                onPrint = { showActions = false; print(null) },
                onArrange = { showActions = false; showArrange = true },
                onSelect = { showActions = false; model.startSelecting() },
                onTemplate = {
                    showActions = false
                    WorksheetFileActions.shareCsv(context, ws.templateFileName, WorksheetCsv.template(ws))?.let { model.message = it }
                },
                onExport = { showActions = false; export(null) },
                onImport = { showActions = false; importLauncher.launch(arrayOf("text/*")) },
                onRecentImports = { showActions = false; model.push(PlannerRoute.RecentImports) },
                onEditWedding = { showActions = false; model.push(PlannerRoute.ClientProfileEditor) }
            )
        }
    }

    if (showPicker) {
        ModalBottomSheet(
            onDismissRequest = { showPicker = false },
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
            containerColor = Ui.Background
        ) {
            Column(
                modifier = Modifier
                    .exposeTestTags()
                    .testTag("planner-worksheet-picker-sheet")
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp)
                    .padding(bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                ScreenHeading("Choose a worksheet")
                PlannerWorksheet.entries.forEach { option ->
                    val current = option == ws
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 52.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (current) Ui.Notice else Ui.Card)
                            .border(1.dp, if (current) Ui.Accent else Ui.Hairline, RoundedCornerShape(12.dp))
                            .selectable(selected = current, role = Role.RadioButton) {
                                model.switchWorksheet(option)
                                showPicker = false
                            }
                            .testTag("planner-worksheet-${option.slug}")
                            .padding(horizontal = 14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(option.title, fontSize = 17.sp, color = Ui.Ink, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                        if (current) Text("Showing", fontSize = 14.sp, color = Ui.Accent, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }

    if (showArrange) {
        ArrangeDialog(model, onDismiss = { showArrange = false })
    }

    bulkMarkDone?.let { markDone ->
        BulkMarkDialog(model, markDone, onDismiss = { bulkMarkDone = null })
    }

    // Keep the print WebView referenced until this screen leaves.
    DisposableEffect(Unit) { onDispose { printView = null } }
}

@Composable
private fun ClientSelector(model: PlannerWorkspaceModel, expanded: Boolean, onExpandedChange: (Boolean) -> Unit) {
    val grant = model.access.grant
    val wedding = model.data?.wedding
    Box {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(Ui.Card)
                .border(1.dp, Ui.Hairline, RoundedCornerShape(14.dp))
                .clickable(role = Role.DropdownList) { onExpandedChange(true) }
                .testTag("planner-client-selector")
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            Text("Client wedding", color = Ui.Muted, fontSize = 13.sp)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(grant.weddingTitle, color = Ui.Ink, fontSize = 19.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                Icon(Icons.Default.ArrowDropDown, contentDescription = null, tint = Ui.Muted)
            }
            if (wedding != null) {
                SupportingText(Formatting.dateAndTime(wedding.date))
                SupportingText(listOf(wedding.venueName, wedding.city).filter { it.isNotBlank() }.joinToString(", "))
            }
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { onExpandedChange(false) }) {
            Column(modifier = Modifier.exposeTestTags().widthIn(min = 260.dp)) {
                DropdownMenuItem(
                    text = { Text("${grant.weddingTitle} (open)", fontSize = 16.sp) },
                    onClick = { onExpandedChange(false) },
                    leadingIcon = { Icon(Icons.Default.Check, contentDescription = null) },
                    modifier = Modifier.heightIn(min = MinTouchTarget).testTag("planner-client-${grant.weddingId}")
                )
                Text(
                    "Only weddings you are authorized for are listed.",
                    color = Ui.Muted,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                )
            }
        }
    }
}

private fun currentRowIds(model: PlannerWorkspaceModel): List<String> {
    val d = model.data ?: return emptyList()
    val mode = model.arrangeMode()
    return when (model.worksheet) {
        PlannerWorksheet.OVERVIEW -> emptyList()
        PlannerWorksheet.TASKS -> WorksheetArrangement.tasks(d.tasks, mode).map { it.id }
        PlannerWorksheet.BUDGET -> WorksheetArrangement.budget(d.budgetLines, mode).map { it.id }
        PlannerWorksheet.GUESTS -> filteredGuests(model).map { it.id }
        PlannerWorksheet.VENDORS -> d.vendors.map { it.id }
        PlannerWorksheet.CONTRIBUTIONS -> d.contributions.map { it.id }
        PlannerWorksheet.SEATING -> d.seating.map { it.id }
        PlannerWorksheet.TIMELINE -> d.timeline.map { it.id }
        PlannerWorksheet.DOCUMENTS -> d.documents.map { it.id }
    }
}

private fun filteredGuests(model: PlannerWorkspaceModel): List<pro.wewed.app.models.Guest> {
    val d = model.data ?: return emptyList()
    val query = model.guestQuery.trim()
    val arranged = WorksheetArrangement.guests(d.guests, model.arrangeMode(PlannerWorksheet.GUESTS))
    if (query.isEmpty()) return arranged
    return arranged.filter {
        it.name.contains(query, ignoreCase = true) || (it.tableName?.contains(query, ignoreCase = true) == true)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SelectionBar(
    model: PlannerWorkspaceModel,
    allIds: List<String>,
    onMarkDone: () -> Unit,
    onMarkToDo: () -> Unit,
    onExport: () -> Unit,
    onPrint: () -> Unit
) {
    val count = model.selectedIds.size
    InfoCard(modifier = Modifier.testTag("planner-selection-bar")) {
        Text("$count selected", fontSize = 17.sp, fontWeight = FontWeight.SemiBold, color = Ui.Ink, modifier = Modifier.testTag("planner-selection-count"))
        SupportingText("Tap rows to select them.")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            SecondaryButton("Select all", onClick = { model.selectAll(allIds) }, modifier = Modifier.testTag("planner-select-all"))
            SecondaryButton("Clear", onClick = { model.clearSelection() }, enabled = count > 0, modifier = Modifier.testTag("planner-select-clear"))
            if (model.worksheet == PlannerWorksheet.TASKS) {
                SecondaryButton("Mark done", onClick = onMarkDone, enabled = count > 0, modifier = Modifier.testTag("planner-bulk-mark-done"))
                SecondaryButton("Mark to do", onClick = onMarkToDo, enabled = count > 0, modifier = Modifier.testTag("planner-bulk-mark-todo"))
            }
            SecondaryButton("Export selected", onClick = onExport, enabled = count > 0, modifier = Modifier.testTag("planner-export-selected"))
            SecondaryButton("Print selected", onClick = onPrint, enabled = count > 0, modifier = Modifier.testTag("planner-print-selected"))
            PrimaryButton("Done", onClick = { model.stopSelecting() }, modifier = Modifier.testTag("planner-select-done"))
        }
    }
}

@Composable
private fun ActionRow(
    label: String,
    icon: ImageVector,
    tag: String,
    enabled: Boolean = true,
    note: String? = null,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 56.dp)
            .clip(RoundedCornerShape(12.dp))
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .testTag(tag)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Icon(icon, contentDescription = null, tint = if (enabled) Ui.Accent else Ui.Muted, modifier = Modifier.size(24.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(label, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, color = if (enabled) Ui.Ink else Ui.Muted)
            if (!note.isNullOrBlank()) Text(note, fontSize = 14.sp, color = Ui.Muted, lineHeight = 19.sp)
        }
    }
}

@Composable
private fun ActionsSheetContent(
    model: PlannerWorkspaceModel,
    onRefresh: () -> Unit,
    onSwitch: () -> Unit,
    onPrint: () -> Unit,
    onArrange: () -> Unit,
    onSelect: () -> Unit,
    onTemplate: () -> Unit,
    onExport: () -> Unit,
    onImport: () -> Unit,
    onRecentImports: () -> Unit,
    onEditWedding: () -> Unit
) {
    val ws = model.worksheet
    val hasData = model.data != null
    val isOverview = ws == PlannerWorksheet.OVERVIEW
    Column(
        modifier = Modifier
            .exposeTestTags()
            .testTag("planner-actions-sheet")
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 12.dp)
            .padding(bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        ScreenHeading("Actions for ${ws.title}", Modifier.padding(horizontal = 12.dp, vertical = 4.dp))
        ActionRow("Refresh data", Icons.Default.Refresh, "planner-action-refresh", onClick = onRefresh)
        ActionRow("Switch worksheet", Icons.Default.SwapHoriz, "planner-action-switch", onClick = onSwitch)
        ActionRow(
            "Print",
            Icons.Default.Print,
            "planner-action-print",
            enabled = hasData,
            note = "Opens the system print dialog for this worksheet.",
            onClick = onPrint
        )
        ActionRow(
            "Arrange (this device)",
            Icons.Default.Sort,
            "planner-action-arrange",
            enabled = hasData && !isOverview,
            note = if (isOverview) "Overview has no rows to arrange." else "Order rows on this device. The order is not synced.",
            onClick = onArrange
        )
        ActionRow(
            "Select",
            Icons.Default.Checklist,
            "planner-action-select",
            enabled = hasData && !isOverview,
            note = if (isOverview) "Overview has no rows to select." else "Choose rows for bulk actions.",
            onClick = onSelect
        )
        ActionRow(
            "Template",
            Icons.Default.Description,
            "planner-action-template",
            enabled = !isOverview,
            note = if (isOverview) "Overview has no template." else "Share an empty ${ws.title} file (${ws.templateFileName}).",
            onClick = onTemplate
        )
        ActionRow(
            "Export",
            Icons.Default.IosShare,
            "planner-action-export",
            enabled = hasData && !isOverview,
            note = if (isOverview) "Choose a worksheet to export. Overview has no rows." else "Share this worksheet as ${ws.exportFileName}.",
            onClick = onExport
        )
        ActionRow(
            "Import",
            Icons.Default.FileOpen,
            "planner-action-import",
            enabled = ws.supportsImport,
            note = if (ws.supportsImport) "Add tasks from a CSV file. You'll see a preview first." else IMPORT_ELSEWHERE,
            onClick = onImport
        )
        ActionRow(
            "Recent imports",
            Icons.Default.History,
            "planner-action-recent-imports",
            note = "Imports on this device",
            onClick = onRecentImports
        )
        ActionRow(
            "Edit wedding details",
            Icons.Default.Edit,
            "planner-action-edit-wedding",
            onClick = onEditWedding
        )
    }
}

@Composable
private fun ArrangeDialog(model: PlannerWorkspaceModel, onDismiss: () -> Unit) {
    val ws = model.worksheet
    AlertDialog(
        onDismissRequest = onDismiss,
        modifier = Modifier.exposeTestTags().testTag("planner-arrange-dialog"),
        title = { Text("Arrange (this device)") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                SupportingText("This order is kept on this device only. It is not synced.")
                ArrangeMode.entries.forEach { mode ->
                    val applies = mode.appliesTo(ws)
                    val selected = model.arrangeMode() == mode
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = MinTouchTarget)
                            .selectable(selected = selected, enabled = applies, role = Role.RadioButton) {
                                model.arrangement[ws] = mode
                                onDismiss()
                            }
                            .testTag("planner-arrange-${mode.tagSuffix}"),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(selected = selected, onClick = null, enabled = applies)
                        Spacer(Modifier.width(8.dp))
                        Column {
                            Text(mode.label, fontSize = 17.sp, color = if (applies) Ui.Ink else Ui.Muted)
                            if (!applies) Text("Not available for ${ws.title}", fontSize = 13.sp, color = Ui.Muted)
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss, modifier = Modifier.heightIn(min = MinTouchTarget)) { Text("Close", fontSize = 16.sp, color = Ui.Positive) }
        }
    )
}

@Composable
private fun BulkMarkDialog(model: PlannerWorkspaceModel, markDone: Boolean, onDismiss: () -> Unit) {
    val selected = model.selectedIds
    val targets = model.tasksToChange(selected, markDone)
    val unchanged = selected.size - targets.size
    val label = if (markDone) "done" else "to do"
    AlertDialog(
        onDismissRequest = onDismiss,
        modifier = Modifier.exposeTestTags().testTag("planner-bulk-confirm"),
        title = {
            Text(
                if (targets.isEmpty()) "Nothing to change"
                else "Mark ${targets.size} ${if (targets.size == 1) "task" else "tasks"} as $label?"
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                if (targets.isEmpty()) {
                    BodyText(if (markDone) "All selected tasks are already done." else "None of the selected tasks are done, so none change to to do.")
                } else {
                    BodyText("${targets.size} of ${selected.size} selected ${if (selected.size == 1) "task" else "tasks"} will change.")
                    if (unchanged > 0) {
                        SupportingText(
                            when {
                                markDone && unchanged == 1 -> "1 is already done and stays as it is."
                                markDone -> "$unchanged are already done and stay as they are."
                                unchanged == 1 -> "1 isn't done and stays as it is."
                                else -> "$unchanged aren't done and stay as they are."
                            }
                        )
                    }
                }
            }
        },
        confirmButton = {
            if (targets.isNotEmpty()) {
                TextButton(
                    onClick = { model.bulkMark(selected, markDone); onDismiss() },
                    modifier = Modifier.heightIn(min = MinTouchTarget).testTag("planner-bulk-confirm-yes")
                ) { Text(if (markDone) "Mark done" else "Mark to do", fontSize = 16.sp, color = Ui.Positive) }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, modifier = Modifier.heightIn(min = MinTouchTarget).testTag("planner-bulk-confirm-cancel")) {
                Text(if (targets.isEmpty()) "Close" else "Cancel", fontSize = 16.sp)
            }
        }
    )
}

private fun LazyListScope.worksheetBody(model: PlannerWorkspaceModel, data: PlannerWorkspaceData) {
    val mode = model.arrangeMode()
    val selecting = model.selectionMode
    val selected = model.selectedIds
    fun onSelect(id: String): (Boolean) -> Unit = { model.setSelected(id, it) }

    when (model.worksheet) {
        PlannerWorksheet.OVERVIEW -> item { OverviewBody(data) }
        PlannerWorksheet.TASKS -> {
            val rows = WorksheetArrangement.tasks(data.tasks, mode)
            item { SupportingText("${data.tasks.count { it.status == pro.wewed.app.models.TaskStatus.DONE }} of ${data.tasks.size} tasks done") }
            if (rows.isEmpty()) item { EmptyStateText("No tasks are recorded for this wedding.", "planner-worksheet-empty") }
            items(rows, key = { it.id }) { task ->
                TaskRow(
                    task = task,
                    onToggleDone = { model.toggleTask(task.id) },
                    busy = task.id in model.busyTaskIds,
                    selectionMode = selecting,
                    selected = task.id in selected,
                    onSelectedChange = onSelect(task.id)
                )
            }
        }
        PlannerWorksheet.BUDGET -> {
            val rows = WorksheetArrangement.budget(data.budgetLines, mode)
            item {
                InfoCard {
                    SectionTitle("Totals")
                    BodyText("Estimated ${Formatting.money(rows.sumOf { it.estimated }, data.currency)}")
                    BodyText("Actual ${Formatting.money(rows.sumOf { it.actual }, data.currency)}")
                    BodyText("Paid ${Formatting.money(rows.sumOf { it.paid }, data.currency)}")
                }
            }
            if (rows.isEmpty()) item { EmptyStateText("No budget lines are recorded for this wedding.", "planner-worksheet-empty") }
            items(rows, key = { it.id }) { line ->
                BudgetLineRow(line, data.currency, selecting, line.id in selected, onSelect(line.id))
            }
        }
        PlannerWorksheet.GUESTS -> {
            item {
                OutlinedTextField(
                    value = model.guestQuery,
                    onValueChange = { model.guestQuery = it },
                    label = { Text("Search guests by name or table", fontSize = 16.sp) },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                    singleLine = true,
                    textStyle = LocalTextStyle.current.copy(fontSize = 17.sp),
                    modifier = Modifier.fillMaxWidth().testTag("planner-guests-search")
                )
            }
            val rows = filteredGuests(model)
            item {
                val yes = data.guests.count { it.rsvpStatus == pro.wewed.app.models.RSVPStatus.ATTENDING }
                val no = data.guests.count { it.rsvpStatus == pro.wewed.app.models.RSVPStatus.DECLINED }
                val pending = data.guests.count { it.rsvpStatus == pro.wewed.app.models.RSVPStatus.PENDING }
                SupportingText("Showing ${rows.size} of ${data.guests.size} guests · Replied yes $yes · Replied no $no · Not replied $pending")
            }
            if (rows.isEmpty()) item { EmptyStateText("No guests match your search.", "planner-worksheet-empty") }
            items(rows, key = { it.id }) { guest ->
                GuestRow(guest, selecting, guest.id in selected, onSelect(guest.id))
            }
        }
        PlannerWorksheet.VENDORS -> {
            val rows = WorksheetArrangement.vendors(data.vendors, mode)
            if (rows.isEmpty()) item { EmptyStateText("No vendors are recorded for this wedding.", "planner-worksheet-empty") }
            items(rows, key = { it.id }) { vendor ->
                VendorEngagementRow(vendor, selecting, vendor.id in selected, onSelect(vendor.id))
            }
        }
        PlannerWorksheet.CONTRIBUTIONS -> {
            val rows = WorksheetArrangement.contributions(data.contributions, mode)
            item { SupportingText(Formatting.plural(rows.size, "contribution") + " recorded") }
            if (rows.isEmpty()) item { EmptyStateText("No contributions are recorded for this wedding.", "planner-worksheet-empty") }
            items(rows, key = { it.id }) { record ->
                ContributionRow(record, selecting, record.id in selected, onSelect(record.id))
            }
        }
        PlannerWorksheet.SEATING -> {
            val rows = WorksheetArrangement.seating(data.seating, mode)
            item {
                val capacity = rows.sumOf { it.capacity }
                val assigned = rows.sumOf { it.assigned }
                SupportingText("${Formatting.plural(rows.size, "table")} · $capacity seats · $assigned assigned · ${(capacity - assigned).coerceAtLeast(0)} free")
            }
            if (rows.isEmpty()) item { EmptyStateText("No tables are recorded for this wedding.", "planner-worksheet-empty") }
            items(rows, key = { it.id }) { table ->
                SeatingRow(table, selecting, table.id in selected, onSelect(table.id))
            }
        }
        PlannerWorksheet.TIMELINE -> {
            val rows = WorksheetArrangement.timeline(data.timeline, mode)
            if (rows.isEmpty()) item { EmptyStateText("No programme is recorded for this wedding.", "planner-worksheet-empty") }
            items(rows, key = { it.id }) { entry ->
                ProgrammeRow(entry, selecting, entry.id in selected, onSelect(entry.id))
            }
        }
        PlannerWorksheet.DOCUMENTS -> {
            val rows = WorksheetArrangement.documents(data.documents, mode)
            if (rows.isEmpty()) item { EmptyStateText("No contracts or documents recorded for this wedding.", "planner-documents-empty") }
            items(rows, key = { it.id }) { record ->
                DocumentRow(record, selecting, record.id in selected, onSelect(record.id))
            }
        }
    }
}

@Composable
private fun OverviewBody(data: PlannerWorkspaceData) {
    val d = data.dashboard
    Column(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.testTag("planner-overview")) {
        InfoCard {
            LabeledValue("Couple", d.coupleNames)
            LabeledValue("Wedding date", Formatting.dateAndTime(d.weddingDateLabel))
            LabeledValue("Stage", Formatting.lifecycle(d.lifecycle))
            LabeledValue("Tasks done", d.taskCompletionLabel)
            d.readinessScore?.let { LabeledValue("Readiness", "$it%") }
        }
        if (d.modules.isNotEmpty()) {
            SectionTitle("At a glance")
            d.modules.forEach { module ->
                InfoCard(modifier = Modifier.testTag("planner-overview-${module.id}")) {
                    Text(module.title, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, color = Ui.Ink)
                    BodyText(module.value)
                    module.attention?.takeIf { it.isNotBlank() }?.let { SupportingText(it) }
                }
            }
        }
        if (d.attentionItems.isNotEmpty()) {
            SectionTitle("Needs attention")
            d.attentionItems.forEach { item ->
                InfoCard {
                    StatusText(
                        when (item.severity) {
                            pro.wewed.app.models.PlannerAttentionSeverity.URGENT -> "Urgent"
                            pro.wewed.app.models.PlannerAttentionSeverity.WARNING -> "Needs attention"
                            pro.wewed.app.models.PlannerAttentionSeverity.INFO -> "For information"
                        }
                    )
                    Text(item.title, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, color = Ui.Ink)
                    SupportingText(item.detail)
                }
            }
        }
    }
}
