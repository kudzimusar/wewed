package pro.wewed.app.ui.planner

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import pro.wewed.app.models.RSVPStatus
import pro.wewed.app.models.WeddingDetailsUpdate
import pro.wewed.app.services.PlannerWorksheet
import pro.wewed.app.services.RoleScopedAccess
import pro.wewed.app.services.WorksheetCsv
import pro.wewed.app.state.SessionViewModel
import pro.wewed.app.ui.pass.WeddingPassCard
import pro.wewed.app.ui.roles.GateScannerScreen
import pro.wewed.app.ui.roles.RoleShellScaffold
import pro.wewed.app.ui.roles.ShellTab
import pro.wewed.app.ui.roles.rememberOperatorId
import pro.wewed.app.ui.shared.*

private val plannerTabs = listOf(
    ShellTab("workspace", "Workspace", Icons.Default.Dashboard),
    ShellTab("daily-ops", "Daily Ops", Icons.Default.Today),
    ShellTab("wedding-day", "Wedding Day", Icons.Default.Celebration),
    ShellTab("more", "More", Icons.Default.Menu)
)

/**
 * Planner Workspace: the professional planner's tools for one authorized client wedding.
 * Receives only the planner's RoleScopedAccess, never the app's repositories.
 */
@Composable
fun PlannerShell(access: RoleScopedAccess, sessionViewModel: SessionViewModel) {
    val scope = rememberCoroutineScope()
    val model = remember(access) { PlannerWorkspaceModel(access, scope) }
    var tab by rememberSaveable { mutableIntStateOf(0) }
    val operatorId = rememberOperatorId(sessionViewModel, access)

    LaunchedEffect(model) { model.load() }

    val route = model.routes.lastOrNull()
    if (route != null) {
        PlannerRouteScreen(route, model, sessionViewModel, operatorId)
        return
    }

    RoleShellScaffold(access.grant, "planner-workspace-root", plannerTabs, tab, { tab = it }) {
        when (tab) {
            0 -> PlannerWorkspaceTab(model)
            1 -> PlannerDailyOpsTab(model)
            2 -> PlannerWeddingDayTab(model)
            else -> PlannerMoreTab(model)
        }
    }
}

@Composable
private fun PlannerRouteScreen(
    route: PlannerRoute,
    model: PlannerWorkspaceModel,
    sessionViewModel: SessionViewModel,
    operatorId: String
) {
    val back = { model.pop() }
    when (route) {
        is PlannerRoute.ImportPreview -> ImportPreviewScreen(model, route.draft, back)
        is PlannerRoute.ImportResult -> ImportResultScreen(route, back)
        PlannerRoute.RecentImports -> RecentImportsScreen(model, back)
        PlannerRoute.ClientProfile -> ClientProfileScreen(model, back)
        PlannerRoute.ClientProfileEditor -> ClientProfileEditor(model, back)
        PlannerRoute.TeamHub -> TeamHubScreen(model, back)
        PlannerRoute.Invitations -> InvitationsScreen(model, back)
        is PlannerRoute.PassPreview -> SubScreen("Pass preview", back, Modifier.testTag("planner-pass-preview-root")) {
            Column(
                modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                SupportingText("This is the pass this guest shows at the entrance.")
                WeddingPassCard(pass = route.pass, fallbackVenue = model.data?.wedding?.venueLocation, guestNameTag = "planner-pass-preview-guest-name")
            }
        }
        PlannerRoute.Intelligence -> IntelligenceScreen(model, back)
        PlannerRoute.Account -> AccountScreen(sessionViewModel, model.access.grant, back)
        PlannerRoute.Support -> HelpSupportScreen(back)
        PlannerRoute.Scanner -> GateScannerScreen(
            access = model.access,
            operatorId = operatorId,
            onClose = back,
            onAdmissionRecorded = { model.refresh() }
        )
    }
}

// MARK: - Daily Ops

@Composable
private fun PlannerDailyOpsTab(model: PlannerWorkspaceModel) {
    val data = model.data
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("planner-daily-ops-root"),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        if (data == null) {
            item { model.loadProblem?.let { ProblemText(it) } ?: LoadingIndicator() }
            return@LazyColumn
        }
        val today = Formatting.todayIso()
        val ops = PlannerInsights.dailyOps(data.tasks, data.guests, today, Formatting.isoDayPlus(7))
        item { SupportingText("Worked out from this wedding's tasks and guests for today, ${Formatting.longDate(today)}.") }

        item { SectionTitle("Overdue tasks (${ops.overdue.size})") }
        if (ops.overdue.isEmpty()) item { EmptyStateText("No open tasks are past their due date.", "planner-ops-overdue-empty") }
        items(ops.overdue, key = { "overdue-${it.id}" }) { task ->
            TaskRow(task, onToggleDone = { model.toggleTask(task.id) }, busy = task.id in model.busyTaskIds)
        }

        item { SectionTitle("Due in the next 7 days (${ops.dueSoon.size})") }
        if (ops.dueSoon.isEmpty()) item { EmptyStateText("No open tasks are due in the next 7 days.", "planner-ops-due-soon-empty") }
        items(ops.dueSoon, key = { "soon-${it.id}" }) { task ->
            TaskRow(task, onToggleDone = { model.toggleTask(task.id) }, busy = task.id in model.busyTaskIds)
        }

        item { SectionTitle("High-priority tasks still open (${ops.highPriorityOpen.size})") }
        if (ops.highPriorityOpen.isEmpty()) item { EmptyStateText("No high-priority tasks are open.", "planner-ops-high-empty") }
        items(ops.highPriorityOpen, key = { "high-${it.id}" }) { task ->
            TaskRow(task, onToggleDone = { model.toggleTask(task.id) }, busy = task.id in model.busyTaskIds)
        }

        item { SectionTitle("Guests who have not replied") }
        item {
            InfoCard(modifier = Modifier.testTag("planner-ops-not-replied")) {
                BodyText("${ops.notReplied} of ${ops.totalGuests} guests have not replied.")
            }
        }

        item { SectionTitle("Vendor presence") }
        if (data.presence.isEmpty()) item { EmptyStateText("No vendors are recorded for this wedding.", "planner-ops-presence-empty") }
        items(data.presence, key = { "presence-${it.id}" }) { VendorPresenceRow(it) }
    }
}

// MARK: - Wedding Day

@Composable
private fun PlannerWeddingDayTab(model: PlannerWorkspaceModel) {
    val data = model.data
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("planner-wedding-day-root"),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        if (data == null) {
            item { model.loadProblem?.let { ProblemText(it) } ?: LoadingIndicator() }
            return@LazyColumn
        }
        item {
            InfoCard(modifier = Modifier.testTag("planner-check-in-summary")) {
                SectionTitle("Check-in")
                val a = data.admission
                BodyText("${a.admittedGuests} of ${a.expectedGuests} expected guests admitted")
                SupportingText("${Formatting.plural(a.attendingParties, "attending party", "attending parties")} · ${(a.expectedGuests - a.admittedGuests).coerceAtLeast(0)} still to arrive")
                PrimaryButton(
                    text = "Scan pass",
                    icon = Icons.Default.QrCodeScanner,
                    onClick = { model.push(PlannerRoute.Scanner) },
                    modifier = Modifier.fillMaxWidth().testTag("planner-scan-pass")
                )
            }
        }
        item { SectionTitle("Run sheet") }
        val runSheet = data.timeline.sortedBy { it.time }
        if (runSheet.isEmpty()) item { EmptyStateText("No programme is recorded for this wedding.", "planner-run-sheet-empty") }
        items(runSheet, key = { "run-${it.id}" }) { ProgrammeRow(it) }

        item { SectionTitle("Tables") }
        item {
            val capacity = data.seating.sumOf { it.capacity }
            val assigned = data.seating.sumOf { it.assigned }
            InfoCard(modifier = Modifier.testTag("planner-tables-summary")) {
                BodyText("${Formatting.plural(data.seating.size, "table")} · $capacity seats")
                SupportingText("$assigned assigned · ${(capacity - assigned).coerceAtLeast(0)} free")
            }
        }
        items(data.seating, key = { "table-${it.id}" }) { SeatingRow(it) }
    }
}

// MARK: - More

@Composable
private fun PlannerMoreTab(model: PlannerWorkspaceModel) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .testTag("planner-more-root")
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        NavigationRow("Client Profile", "Couple, date, venue and your access", "planner-more-client-profile", { model.push(PlannerRoute.ClientProfile) }, icon = Icons.Default.Favorite)
        NavigationRow("Team Hub", "People working on this wedding", "planner-more-team-hub", { model.push(PlannerRoute.TeamHub) }, icon = Icons.Default.Groups)
        NavigationRow("Invitations & QR", "Replies and guest pass previews", "planner-more-invitations", { model.push(PlannerRoute.Invitations) }, icon = Icons.Default.QrCode)
        NavigationRow("Intelligence", "Suggestions worked out from this wedding's records", "planner-more-intelligence", { model.push(PlannerRoute.Intelligence) }, icon = Icons.Default.Lightbulb)
        NavigationRow("Account", "Who is signed in, switch role, sign out", "planner-more-account", { model.push(PlannerRoute.Account) }, icon = Icons.Default.AccountCircle)
        NavigationRow("Help & Support", "Contact Wewed support", "planner-more-support", { model.push(PlannerRoute.Support) }, icon = Icons.Default.HelpOutline)
    }
}

@Composable
private fun ClientProfileScreen(model: PlannerWorkspaceModel, onBack: () -> Unit) {
    val wedding = model.data?.wedding
    SubScreen("Client Profile", onBack, Modifier.testTag("planner-client-profile-root")) {
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            model.profileMessage?.let {
                Text(it, fontSize = 16.sp, color = Ui.Ink, modifier = Modifier.testTag("planner-client-profile-message").semantics { liveRegion = LiveRegionMode.Polite })
            }
            if (wedding == null) {
                model.loadProblem?.let { ProblemText(it) } ?: LoadingIndicator()
            } else {
                InfoCard {
                    LabeledValue("Couple", wedding.coupleNames)
                    LabeledValue("Wedding date", Formatting.dateAndTime(wedding.date))
                    LabeledValue("Venue", wedding.venueName.ifBlank { "Not recorded" })
                    LabeledValue("City", wedding.city.ifBlank { "Not recorded" })
                    LabeledValue("Country", wedding.country.ifBlank { "Not recorded" })
                    LabeledValue("Stage", Formatting.lifecycle(wedding.lifecycle))
                    OpenInMapsButton(venue = wedding.venueLocation, tag = "planner-client-profile-open-maps")
                }
                InfoCard {
                    SectionTitle("Your access")
                    BodyText(model.access.grant.provenanceNote)
                }
                PrimaryButton(
                    text = "Edit wedding details",
                    icon = Icons.Default.Edit,
                    onClick = { model.push(PlannerRoute.ClientProfileEditor) },
                    modifier = Modifier.fillMaxWidth().testTag("planner-client-profile-edit")
                )
            }
        }
    }
}

@Composable
private fun ClientProfileEditor(model: PlannerWorkspaceModel, onBack: () -> Unit) {
    val scope = rememberCoroutineScope()
    val wedding = model.data?.wedding
    var couple by rememberSaveable { mutableStateOf(wedding?.coupleNames.orEmpty()) }
    var date by rememberSaveable { mutableStateOf(wedding?.date.orEmpty()) }
    var venue by rememberSaveable { mutableStateOf(wedding?.venueName.orEmpty()) }
    var city by rememberSaveable { mutableStateOf(wedding?.city.orEmpty()) }
    var country by rememberSaveable { mutableStateOf(wedding?.country.orEmpty()) }
    var confirming by remember { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }
    var problem by remember { mutableStateOf<String?>(null) }

    val changes = if (wedding == null) emptyList() else listOfNotNull(
        ("Couple" to (wedding.coupleNames to couple)).takeIf { wedding.coupleNames != couple.trim() },
        ("Wedding date" to (wedding.date to date)).takeIf { wedding.date != date.trim() },
        ("Venue" to (wedding.venueName to venue)).takeIf { wedding.venueName != venue.trim() },
        ("City" to (wedding.city to city)).takeIf { wedding.city != city.trim() },
        ("Country" to (wedding.country to country)).takeIf { wedding.country != country.trim() }
    )
    val dateLooksValid = Regex("""\d{4}-\d{2}-\d{2}.*""").matches(date.trim())

    SubScreen("Edit wedding details", onBack, Modifier.testTag("planner-client-profile-editor")) {
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (wedding == null) {
                LoadingIndicator()
                return@Column
            }
            @Composable
            fun field(label: String, value: String, tag: String, onChange: (String) -> Unit, supporting: String? = null) {
                OutlinedTextField(
                    value = value,
                    onValueChange = onChange,
                    label = { Text(label, fontSize = 16.sp) },
                    supportingText = supporting?.let { { Text(it, fontSize = 14.sp) } },
                    textStyle = LocalTextStyle.current.copy(fontSize = 17.sp),
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words),
                    modifier = Modifier.fillMaxWidth().testTag(tag)
                )
            }
            field("Couple names", couple, "planner-edit-couple", { couple = it })
            field("Wedding date", date, "planner-edit-date", { date = it }, "Year-month-day first, for example 2026-12-23 14:00:00")
            field("Venue", venue, "planner-edit-venue", { venue = it })
            field("City", city, "planner-edit-city", { city = it })
            field("Country", country, "planner-edit-country", { country = it })

            if (!dateLooksValid) ProblemText("Enter the date as year-month-day, for example 2026-12-23.")
            problem?.let { ProblemText(it) }
            PrimaryButton(
                text = if (saving) "Saving…" else "Save",
                icon = Icons.Default.Save,
                onClick = { confirming = true },
                enabled = changes.isNotEmpty() && dateLooksValid && !saving,
                modifier = Modifier.fillMaxWidth().testTag("planner-edit-save")
            )
            if (changes.isEmpty()) SupportingText("No changes to save.")
            SecondaryButton("Cancel", onClick = onBack, modifier = Modifier.fillMaxWidth().testTag("planner-edit-cancel"))
        }
    }

    if (confirming) {
        AlertDialog(
            onDismissRequest = { confirming = false },
            modifier = Modifier.exposeTestTags().testTag("planner-edit-confirm"),
            title = { Text("Save these changes?") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    changes.forEach { (label, values) ->
                        BodyText("$label: ${values.first.ifBlank { "(blank)" }} → ${values.second.trim().ifBlank { "(blank)" }}")
                    }
                    SupportingText("This changes the wedding record for everyone working on this wedding.")
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        confirming = false
                        saving = true
                        problem = null
                        scope.launch {
                            try {
                                model.access.updateWeddingDetails(WeddingDetailsUpdate(couple, date, venue, city, country))
                                model.load()
                                model.profileMessage = "Wedding details saved."
                                model.message = "Wedding details saved."
                                onBack()
                            } catch (error: IllegalArgumentException) {
                                problem = error.message ?: "The details couldn't be saved."
                            } catch (_: Exception) {
                                problem = "The details couldn't be saved. Please try again."
                            } finally {
                                saving = false
                            }
                        }
                    },
                    modifier = Modifier.heightIn(min = MinTouchTarget).testTag("planner-edit-confirm-save")
                ) { Text("Save", fontSize = 16.sp, color = Ui.Positive) }
            },
            dismissButton = {
                TextButton(onClick = { confirming = false }, modifier = Modifier.heightIn(min = MinTouchTarget)) { Text("Keep editing", fontSize = 16.sp, color = Ui.Positive) }
            }
        )
    }
}

@Composable
private fun TeamHubScreen(model: PlannerWorkspaceModel, onBack: () -> Unit) {
    SubScreen("Team Hub", onBack, Modifier.testTag("planner-team-hub-root")) {
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            EmptyStateText("No team members have been added to this wedding.", "planner-team-hub-empty")
            InfoCard {
                SectionTitle("Your access")
                BodyText(model.access.grant.provenanceNote)
            }
        }
    }
}

@Composable
private fun InvitationsScreen(model: PlannerWorkspaceModel, onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val data = model.data
    var problem by remember { mutableStateOf<String?>(null) }
    var opening by remember { mutableStateOf<String?>(null) }

    SubScreen("Invitations & QR", onBack, Modifier.testTag("planner-invitations-root")) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            if (data == null) {
                item { LoadingIndicator() }
                return@LazyColumn
            }
            val yes = data.guests.count { it.rsvpStatus == RSVPStatus.ATTENDING }
            val no = data.guests.count { it.rsvpStatus == RSVPStatus.DECLINED }
            val pending = data.guests.count { it.rsvpStatus == RSVPStatus.PENDING }
            item {
                InfoCard(modifier = Modifier.testTag("planner-rsvp-counts")) {
                    SectionTitle("Replies")
                    BodyText("Replied yes: $yes")
                    BodyText("Replied no: $no")
                    BodyText("Not replied: $pending")
                }
            }
            item {
                SecondaryButton(
                    text = "Export guest list",
                    icon = Icons.Default.IosShare,
                    onClick = {
                        WorksheetFileActions.shareCsv(context, PlannerWorksheet.GUESTS.exportFileName, WorksheetCsv.guests(data.guests))
                            ?.let { problem = it }
                    },
                    modifier = Modifier.fillMaxWidth().testTag("planner-invitations-export")
                )
            }
            problem?.let { item { ProblemText(it) } }
            item { SectionTitle("Guests attending ($yes)") }
            val attending = data.guests.filter { it.rsvpStatus == RSVPStatus.ATTENDING }
            if (attending.isEmpty()) item { EmptyStateText("No guests have replied yes yet.", "planner-attending-empty") }
            items(attending, key = { it.id }) { guest ->
                GuestRow(guest, trailing = {
                    TextButton(
                        onClick = {
                            opening = guest.id
                            problem = null
                            scope.launch {
                                try {
                                    model.push(PlannerRoute.PassPreview(model.access.previewGuestPass(guest.id)))
                                } catch (_: Exception) {
                                    problem = "This guest's pass couldn't be opened."
                                } finally {
                                    opening = null
                                }
                            }
                        },
                        enabled = opening == null,
                        modifier = Modifier.heightIn(min = MinTouchTarget).testTag("planner-preview-pass-${guest.id}")
                    ) { Text("Preview pass", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Ui.Positive) }
                })
            }
        }
    }
}

@Composable
private fun IntelligenceScreen(model: PlannerWorkspaceModel, onBack: () -> Unit) {
    val data = model.data
    SubScreen("Intelligence", onBack, Modifier.testTag("planner-intelligence-root")) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            if (data == null) {
                item { LoadingIndicator() }
                return@LazyColumn
            }
            val recommendations = PlannerInsights.recommendations(data, Formatting.todayIso())
            item { SupportingText("Worked out on this device from this wedding's tasks, guests, seating, budget and vendors.") }
            model.intelligenceProblem?.let { item { ProblemText(it) } }
            if (recommendations.isEmpty()) item { EmptyStateText("No suggestions right now.", "planner-intelligence-empty") }
            items(recommendations, key = { it.id }) { rec ->
                val created = model.createdRecommendations[rec.id]
                InfoCard(modifier = Modifier.testTag("planner-recommendation-${rec.id}")) {
                    Text(rec.title, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, color = Ui.Ink)
                    SupportingText(rec.evidence)
                    SupportingText("Evidence count: ${rec.evidenceCount}")
                    if (created != null) {
                        Text(
                            "Task created: $created",
                            fontSize = 16.sp,
                            color = Ui.Positive,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.testTag("planner-recommendation-created-${rec.id}").semantics { liveRegion = LiveRegionMode.Polite }
                        )
                    } else {
                        SecondaryButton(
                            text = "Create task",
                            icon = Icons.Default.AddTask,
                            onClick = { model.createRecommendedTask(rec) },
                            modifier = Modifier.fillMaxWidth().testTag("planner-recommendation-create-${rec.id}")
                        )
                        SupportingText("Adds \"${rec.taskTitle}\" to the task list.")
                    }
                }
            }
        }
    }
}

// MARK: - Import

@Composable
private fun ImportPreviewScreen(model: PlannerWorkspaceModel, draft: ImportDraft, onBack: () -> Unit) {
    val scope = rememberCoroutineScope()
    var importing by remember { mutableStateOf(false) }
    val preview = draft.preview
    val carriesUnsavedFields = preview.validRows.any { it.dueDate != null || it.status != pro.wewed.app.models.TaskStatus.TODO }

    SubScreen("Import tasks", onBack, Modifier.testTag("planner-import-preview-root")) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            item {
                InfoCard {
                    LabeledValue("File", draft.fileName)
                    LabeledValue("Rows ready to import", preview.validRows.size.toString())
                    LabeledValue("Rows with problems", preview.rowErrors.size.toString())
                }
            }
            if (preview.headerErrors.isNotEmpty()) {
                item { SectionTitle("The file can't be imported") }
                items(preview.headerErrors) { ProblemText(it) }
            }
            if (carriesUnsavedFields) {
                item {
                    SupportingText("The app saves each task's title, category and priority. Due dates and statuses in the file aren't saved by the app yet; new tasks start as to do.")
                }
            }
            if (preview.validRows.isNotEmpty()) {
                item { SectionTitle("Tasks to add (${preview.validRows.size})") }
                items(preview.validRows, key = { "valid-${it.rowNumber}" }) { row ->
                    InfoCard {
                        Text(row.title, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Ui.Ink)
                        SupportingText("Row ${row.rowNumber} · ${Formatting.humanize(row.category)} · ${row.priority.title} priority")
                    }
                }
            }
            if (preview.rowErrors.isNotEmpty()) {
                item { SectionTitle("Rows that will be skipped (${preview.rowErrors.size})") }
                items(preview.rowErrors, key = { "error-${it.rowNumber}" }) { error ->
                    InfoCard(modifier = Modifier.testTag("planner-import-row-error")) {
                        Text("Row ${error.rowNumber}", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Ui.Ink)
                        SupportingText(error.message)
                    }
                }
            }
            item {
                PrimaryButton(
                    text = when {
                        importing -> "Importing…"
                        preview.canImport -> "Import ${Formatting.plural(preview.validRows.size, "task")}"
                        else -> "Nothing to import"
                    },
                    icon = Icons.Default.FileDownload,
                    enabled = preview.canImport && !importing,
                    onClick = {
                        importing = true
                        scope.launch {
                            val record = model.runImport(draft)
                            importing = false
                            model.pop()
                            model.push(PlannerRoute.ImportResult(record))
                        }
                    },
                    modifier = Modifier.fillMaxWidth().testTag("planner-import-confirm")
                )
            }
            item {
                SecondaryButton("Cancel", onClick = onBack, enabled = !importing, modifier = Modifier.fillMaxWidth().testTag("planner-import-cancel"))
            }
        }
    }
}

@Composable
private fun ImportResultScreen(route: PlannerRoute.ImportResult, onBack: () -> Unit) {
    val record = route.record
    SubScreen("Import finished", onBack, Modifier.testTag("planner-import-result-root")) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            item {
                InfoCard(modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }) {
                    BodyText("${Formatting.plural(record.created, "task")} created.")
                    BodyText("${Formatting.plural(record.skipped, "row")} skipped.")
                    SupportingText("Finished ${Formatting.dateTime(record.importedAtMillis)}")
                }
            }
            if (record.errors.isNotEmpty()) {
                item { SectionTitle("Skipped rows") }
                items(record.errors, key = { "result-error-${it.rowNumber}-${it.message.hashCode()}" }) { error ->
                    InfoCard {
                        Text("Row ${error.rowNumber}", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Ui.Ink)
                        SupportingText(error.message)
                    }
                }
            }
            item { PrimaryButton("Done", onClick = onBack, modifier = Modifier.fillMaxWidth().testTag("planner-import-done")) }
        }
    }
}

@Composable
private fun RecentImportsScreen(model: PlannerWorkspaceModel, onBack: () -> Unit) {
    SubScreen("Imports on this device", onBack, Modifier.testTag("planner-recent-imports-root")) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            item { SupportingText("Imports made in this app session on this device. They are not synced.") }
            if (model.imports.isEmpty()) {
                item { EmptyStateText("No imports have been made on this device yet.", "planner-recent-imports-empty") }
            }
            items(model.imports) { record ->
                InfoCard(modifier = Modifier.testTag("planner-recent-import-row")) {
                    Text(record.worksheet.title, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, color = Ui.Ink)
                    SupportingText(Formatting.dateTime(record.importedAtMillis))
                    BodyText("Created ${record.created} · Skipped ${record.skipped} · ${Formatting.plural(record.errors.size, "error")}")
                    record.errors.take(5).forEach { SupportingText("Row ${it.rowNumber}: ${it.message}") }
                    if (record.errors.size > 5) SupportingText("And ${record.errors.size - 5} more.")
                }
            }
        }
    }
}
