package pro.wewed.app.ui.roles

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import pro.wewed.app.models.*
import pro.wewed.app.services.RoleScopedAccess
import pro.wewed.app.state.SessionViewModel
import pro.wewed.app.ui.shared.*

/** Who is recorded as operating the gate: the signed-in account, never a made-up device name. */
@Composable
fun rememberOperatorId(sessionViewModel: SessionViewModel, access: RoleScopedAccess): String {
    val session by sessionViewModel.session.collectAsState()
    return session?.accountId ?: access.grant.role.roleId
}

// MARK: - Vendor ("My Vendor Work")

private val vendorTabs = listOf(
    ShellTab("work", "My Work", Icons.Default.Storefront),
    ShellTab("schedule", "Schedule", Icons.Default.Event),
    ShellTab("account", "Account", Icons.Default.AccountCircle)
)

@Composable
fun VendorShell(access: RoleScopedAccess, sessionViewModel: SessionViewModel) {
    var tab by rememberSaveable { mutableIntStateOf(0) }
    RoleShellScaffold(access.grant, "vendor-shell-root", vendorTabs, tab, { tab = it }) {
        when (tab) {
            0 -> VendorWorkTab(access)
            1 -> WeddingScheduleContent(access, rootTag = "vendor-schedule-root")
            else -> AccountContent(sessionViewModel, access.grant)
        }
    }
}

private val presenceChoices = VendorPresenceState.entries.filter { it != VendorPresenceState.NOT_RECORDED }

@Composable
private fun VendorWorkTab(access: RoleScopedAccess) {
    val scope = rememberCoroutineScope()
    val engagements = rememberLoad(Unit) { access.vendorEngagements() }
    var presenceVersion by remember { mutableIntStateOf(0) }
    val presence = rememberLoad(presenceVersion) { access.vendorPresence() }
    var busy by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }

    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("vendor-engagement-root"),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item { SectionTitle("My booking") }
        when (engagements) {
            is Load.Ready -> {
                if (engagements.value.isEmpty()) {
                    item { EmptyStateText("No vendor booking is recorded for your account on this wedding.", "vendor-engagement-empty") }
                }
                items(engagements.value, key = { it.id }) { engagement ->
                    InfoCard(modifier = Modifier.testTag("vendor-engagement-${engagement.id}")) {
                        Text(engagement.vendorName, fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = Ui.Ink)
                        LabeledValue("Service", Formatting.humanize(engagement.category))
                        LabeledValue("Booking status", engagement.bookingStatus)
                        LabeledValue("Contract status", engagement.contractStatus)
                        LabeledValue("Payment status", engagement.paymentStatus)
                    }
                }
            }
            is Load.Failed -> item { ProblemText(engagements.message) }
            Load.Loading -> item { LoadingIndicator() }
        }

        item { SectionTitle("My status on the day") }
        when (presence) {
            is Load.Ready -> {
                val own = presence.value.firstOrNull()
                if (own == null) {
                    item { EmptyStateText("No wedding-day status is recorded for your account.", "vendor-presence-empty") }
                } else {
                    item {
                        InfoCard(modifier = Modifier.testTag("vendor-presence-current")) {
                            LabeledValue("Current status", own.state.title)
                        }
                    }
                    item { SupportingText("Update my status") }
                    items(presenceChoices, key = { "presence-${it.name}" }) { state ->
                        val isCurrent = own.state == state
                        SecondaryButton(
                            text = if (isCurrent) "${state.title} (current)" else state.title,
                            enabled = !busy && !isCurrent,
                            onClick = {
                                busy = true
                                message = null
                                scope.launch {
                                    message = try {
                                        val updated = access.updateOwnVendorPresence(state)
                                        presenceVersion++
                                        "Your status is now: ${updated.state.title}."
                                    } catch (error: Exception) {
                                        "Your status couldn't be updated. Please try again."
                                    } finally {
                                        busy = false
                                    }
                                }
                            },
                            modifier = Modifier.fillMaxWidth().testTag("vendor-status-${state.name.lowercase()}")
                        )
                    }
                }
            }
            is Load.Failed -> item { ProblemText(presence.message) }
            Load.Loading -> item { LoadingIndicator() }
        }
        message?.let { text ->
            item {
                Text(
                    text,
                    color = Ui.Ink,
                    fontSize = 16.sp,
                    modifier = Modifier.testTag("vendor-status-message").semantics { liveRegion = LiveRegionMode.Polite }
                )
            }
        }
    }
}

/** Date, venue with Open in Maps, and the programme. Used by the vendor Schedule and coordinator Run Sheet. */
@Composable
fun WeddingScheduleContent(
    access: RoleScopedAccess,
    rootTag: String,
    showWeddingCard: Boolean = true
) {
    val wedding = rememberLoad(Unit) { access.weddingSummary() }
    val programme = rememberLoad(Unit) { access.programme() }
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag(rootTag),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (showWeddingCard) {
            item {
                LoadContent(wedding) { w ->
                    InfoCard {
                        LabeledValue("Wedding date", Formatting.dateAndTime(w.date))
                        LabeledValue("Venue", listOf(w.venueName, w.city, w.country).filter { it.isNotBlank() }.joinToString(", "))
                        OpenInMapsButton(venue = w.venueLocation, tag = "schedule-open-maps")
                    }
                }
            }
        }
        item { SectionTitle("Programme") }
        when (programme) {
            is Load.Ready -> {
                if (programme.value.isEmpty()) {
                    item { EmptyStateText("No programme is recorded for this wedding.", "schedule-programme-empty") }
                }
                items(programme.value.sortedBy { it.time }, key = { it.id }) { ProgrammeRow(it) }
            }
            is Load.Failed -> item { ProblemText(programme.message) }
            Load.Loading -> item { LoadingIndicator() }
        }
    }
}

// MARK: - Gate team ("Gate Check-In")

private val usherTabs = listOf(
    ShellTab("scan", "Scan", Icons.Default.QrCodeScanner),
    ShellTab("admissions", "Admissions", Icons.Default.Groups),
    ShellTab("account", "Account", Icons.Default.AccountCircle)
)

@Composable
fun UsherShell(access: RoleScopedAccess, sessionViewModel: SessionViewModel) {
    var tab by rememberSaveable { mutableIntStateOf(0) }
    var scannerOpen by rememberSaveable { mutableStateOf(false) }
    var refreshKey by remember { mutableIntStateOf(0) }
    val operatorId = rememberOperatorId(sessionViewModel, access)

    if (scannerOpen) {
        GateScannerScreen(
            access = access,
            operatorId = operatorId,
            onClose = { scannerOpen = false },
            onAdmissionRecorded = { refreshKey++ }
        )
        return
    }

    RoleShellScaffold(access.grant, "usher-shell-root", usherTabs, tab, { tab = it }) {
        when (tab) {
            0 -> GateScanTab(
                access = access,
                operatorId = operatorId,
                onOpenScanner = { scannerOpen = true },
                refreshKey = refreshKey,
                onAdmissionRecorded = { refreshKey++ }
            )
            1 -> GateAdmissionsContent(access, refreshKey)
            else -> AccountContent(sessionViewModel, access.grant)
        }
    }
}

// MARK: - Coordinator ("Wedding-Day Coordination")

private val coordinatorTabs = listOf(
    ShellTab("run-sheet", "Run Sheet", Icons.Default.Schedule),
    ShellTab("tasks", "Tasks", Icons.Default.Checklist),
    ShellTab("vendors", "Vendors", Icons.Default.Storefront),
    ShellTab("gate", "Gate", Icons.Default.QrCodeScanner),
    ShellTab("account", "Account", Icons.Default.AccountCircle)
)

@Composable
fun CoordinatorShell(access: RoleScopedAccess, sessionViewModel: SessionViewModel) {
    var tab by rememberSaveable { mutableIntStateOf(0) }
    var scannerOpen by rememberSaveable { mutableStateOf(false) }
    var refreshKey by remember { mutableIntStateOf(0) }
    val operatorId = rememberOperatorId(sessionViewModel, access)

    if (scannerOpen) {
        GateScannerScreen(
            access = access,
            operatorId = operatorId,
            onClose = { scannerOpen = false },
            onAdmissionRecorded = { refreshKey++ }
        )
        return
    }

    RoleShellScaffold(access.grant, "coordinator-shell-root", coordinatorTabs, tab, { tab = it }) {
        when (tab) {
            0 -> WeddingScheduleContent(access, rootTag = "coordinator-run-sheet-root")
            1 -> CoordinatorTasksTab(access)
            2 -> CoordinatorVendorsTab(access)
            3 -> GateAdmissionsContent(
                access = access,
                refreshKey = refreshKey,
                rootTag = "coordinator-gate-root",
                header = {
                    PrimaryButton(
                        text = "Scan pass",
                        icon = Icons.Default.QrCodeScanner,
                        onClick = { scannerOpen = true },
                        modifier = Modifier.fillMaxWidth().heightIn(min = 64.dp).testTag("usher-scanner-open")
                    )
                }
            )
            else -> AccountContent(sessionViewModel, access.grant)
        }
    }
}

@Composable
private fun CoordinatorTasksTab(access: RoleScopedAccess) {
    val tasks = rememberLoad(Unit) { access.tasks() }
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("coordinator-tasks-root"),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item { SupportingText("Tasks are shown read-only. The couple and planner manage them.") }
        when (tasks) {
            is Load.Ready -> {
                if (tasks.value.isEmpty()) item { EmptyStateText("No tasks are recorded for this wedding.", "coordinator-tasks-empty") }
                items(tasks.value, key = { it.id }) { TaskRow(it, onToggleDone = null) }
            }
            is Load.Failed -> item { ProblemText(tasks.message) }
            Load.Loading -> item { LoadingIndicator() }
        }
    }
}

@Composable
private fun CoordinatorVendorsTab(access: RoleScopedAccess) {
    val presence = rememberLoad(Unit) { access.vendorPresence() }
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("coordinator-vendors-root"),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item { SectionTitle("Vendors on the day") }
        when (presence) {
            is Load.Ready -> {
                if (presence.value.isEmpty()) item { EmptyStateText("No vendors are recorded for this wedding.", "coordinator-vendors-empty") }
                items(presence.value, key = { it.id }) { VendorPresenceRow(it, showService = false) }
            }
            is Load.Failed -> item { ProblemText(presence.message) }
            Load.Loading -> item { LoadingIndicator() }
        }
    }
}

// MARK: - Wewed Support ("Wewed Support")

private val adminTabs = listOf(
    ShellTab("support", "Support", Icons.Default.SupportAgent),
    ShellTab("audit", "Audit log", Icons.Default.History),
    ShellTab("account", "Account", Icons.Default.AccountCircle)
)

private enum class SupportSection(val auditName: String, val buttonLabel: String, val tag: String) {
    GUESTS("Guest list", "Open guest list (recorded)", "admin-open-guests"),
    TASKS("Tasks", "Open tasks (recorded)", "admin-open-tasks"),
    VENDORS("Vendors", "Open vendors (recorded)", "admin-open-vendors")
}

private sealed interface SupportResult {
    data class Guests(val rows: List<Guest>) : SupportResult
    data class Tasks(val rows: List<PlannerTask>) : SupportResult
    data class Vendors(val rows: List<PlannerVendorEngagement>) : SupportResult
}

@Composable
fun AdminShell(access: RoleScopedAccess, sessionViewModel: SessionViewModel) {
    var tab by rememberSaveable { mutableIntStateOf(0) }
    var openSection by remember { mutableStateOf<SupportSection?>(null) }
    // Each opening is a separate recorded read.
    var openCount by remember { mutableIntStateOf(0) }

    openSection?.let { section ->
        SupportReadScreen(access, section, openCount) { openSection = null }
        return
    }

    RoleShellScaffold(access.grant, "admin-shell-root", adminTabs, tab, { tab = it }) {
        when (tab) {
            0 -> AdminSupportTab(access) { section ->
                openCount++
                openSection = section
            }
            1 -> AdminAuditTab(access)
            else -> AccountContent(sessionViewModel, access.grant)
        }
    }
}

@Composable
private fun AdminSupportTab(access: RoleScopedAccess, onOpen: (SupportSection) -> Unit) {
    val wedding = rememberLoad(Unit) { access.weddingSummary() }
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("admin-support-root"),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            LoadContent(wedding) { w ->
                InfoCard(modifier = Modifier.testTag("admin-wedding-card")) {
                    Text(w.coupleNames, fontSize = 19.sp, fontWeight = FontWeight.SemiBold, color = Ui.Ink)
                    LabeledValue("Date", Formatting.dateAndTime(w.date))
                    LabeledValue("Venue", listOf(w.venueName, w.city, w.country).filter { it.isNotBlank() }.joinToString(", "))
                }
            }
        }
        item {
            SupportingText("Support views are read-only. Opening one records who looked, what and when in the audit log.")
        }
        items(SupportSection.entries, key = { it.name }) { section ->
            SecondaryButton(
                text = section.buttonLabel,
                onClick = { onOpen(section) },
                modifier = Modifier.fillMaxWidth().testTag(section.tag)
            )
        }
    }
}

@Composable
private fun SupportReadScreen(
    access: RoleScopedAccess,
    section: SupportSection,
    openCount: Int,
    onBack: () -> Unit
) {
    val result = rememberLoad(section, openCount) {
        access.supportRead(section.auditName) { wedding, planner ->
            when (section) {
                SupportSection.GUESTS -> SupportResult.Guests(wedding.getGuests())
                SupportSection.TASKS -> SupportResult.Tasks(wedding.getTasks())
                SupportSection.VENDORS -> SupportResult.Vendors(planner.getVendorEngagements())
            }
        }
    }
    SubScreen(title = section.auditName, onBack = onBack, modifier = Modifier.testTag("admin-support-result")) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            when (result) {
                Load.Loading -> item { LoadingIndicator() }
                is Load.Failed -> item { ProblemText(result.message) }
                is Load.Ready -> {
                    item {
                        InfoCard(modifier = Modifier.testTag("admin-recorded-notice")) {
                            BodyText("This view was recorded in the audit log.")
                            SupportingText("Read-only. Nothing here can be changed.")
                        }
                    }
                    when (val value = result.value) {
                        is SupportResult.Guests -> {
                            item { SupportingText(Formatting.plural(value.rows.size, "guest record")) }
                            items(value.rows, key = { it.id }) { GuestRow(it) }
                        }
                        is SupportResult.Tasks -> {
                            item { SupportingText(Formatting.plural(value.rows.size, "task")) }
                            items(value.rows, key = { it.id }) { TaskRow(it, onToggleDone = null) }
                        }
                        is SupportResult.Vendors -> {
                            item { SupportingText(Formatting.plural(value.rows.size, "vendor")) }
                            items(value.rows, key = { it.id }) { VendorEngagementRow(it) }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AdminAuditTab(access: RoleScopedAccess) {
    val entries = rememberLoad(Unit) { access.auditEntries() }
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("admin-audit-root"),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item { SupportingText("Support views recorded in this app session, newest first.") }
        when (entries) {
            is Load.Ready -> {
                if (entries.value.isEmpty()) {
                    item { EmptyStateText("No support views have been recorded yet.", "admin-audit-empty") }
                }
                items(entries.value) { entry ->
                    InfoCard(modifier = Modifier.testTag("admin-audit-row")) {
                        Text(entry.section, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, color = Ui.Ink)
                        SupportingText("Viewed ${Formatting.dateTime(entry.recordedAtMillis)}")
                    }
                }
            }
            is Load.Failed -> item { ProblemText(entries.message) }
            Load.Loading -> item { LoadingIndicator() }
        }
    }
}
