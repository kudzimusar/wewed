package pro.wewed.app.ui.roles

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.models.*
import pro.wewed.app.navigation.NavigationContext
import pro.wewed.app.navigation.PrimaryDestination
import pro.wewed.app.services.WeddingScopeMismatch
import pro.wewed.app.services.forWedding
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.state.SessionViewModel
import pro.wewed.app.theme.WeddingIdentityPalette

/**
 * IA V2 Level-2 workspace content.
 *
 * Every section here reads through the canonical repositories on [AppViewModel], scoped by the
 * active wedding carried in [NavigationContext]. Loads are keyed on `activeWeddingId`, so a wedding
 * switch re-resolves the graph rather than leaving a sibling workspace stale (IA V2 §13.2/§13.5).
 * Sections with no repository contract yet render an explicit unsupported state naming the gap —
 * never invented values (playbook §16).
 */

/**
 * Task due-date semantics (P0-14).
 *
 * "Overdue" means a due date in the past, not "urgent and unfinished". Tasks without a due date
 * are deliberately excluded from both overdue and upcoming views: an undated task has no deadline
 * to be late for, and counting it as either would overstate what the graph records.
 */
object TaskDeadlines {
    private val isoDate = Regex("""^(\d{4})-(\d{2})-(\d{2})""")

    fun dueEpochDay(task: PlannerTask): Long? {
        val match = isoDate.find(task.dueDate.orEmpty()) ?: return null
        val (y, m, d) = match.destructured
        return runCatching { java.time.LocalDate.of(y.toInt(), m.toInt(), d.toInt()).toEpochDay() }
            .getOrNull()
    }

    fun overdue(tasks: List<PlannerTask>, today: Long = java.time.LocalDate.now().toEpochDay()): List<PlannerTask> =
        tasks.filter { it.status != TaskStatus.DONE }
            .filter { task -> dueEpochDay(task)?.let { it < today } == true }

    /** Open, dated tasks falling inside the next [windowDays] days, in date order. */
    fun upcoming(
        tasks: List<PlannerTask>,
        today: Long = java.time.LocalDate.now().toEpochDay(),
        windowDays: Long = 30
    ): List<PlannerTask> =
        tasks.filter { it.status != TaskStatus.DONE }
            .mapNotNull { task -> dueEpochDay(task)?.let { due -> task to due } }
            .filter { (_, due) -> due >= today && due <= today + windowDays }
            .sortedBy { it.second }
            .map { it.first }

    fun undated(tasks: List<PlannerTask>): List<PlannerTask> =
        tasks.filter { it.status != TaskStatus.DONE && dueEpochDay(it) == null }
}

/** Canonical wedding graph slice, loaded once per workspace and shared by its sections. */
class WeddingGraphState {
    var wedding by mutableStateOf<Wedding?>(null)
    var tasks by mutableStateOf<List<PlannerTask>>(emptyList())
    var guests by mutableStateOf<List<Guest>>(emptyList())
    var budget by mutableStateOf<BudgetSummary?>(null)
    var vendors by mutableStateOf<List<VendorPresence>>(emptyList())
    var announcements by mutableStateOf<List<WeddingAnnouncement>>(emptyList())
    var auditRecords by mutableStateOf<List<CheckInAuditRecord>>(emptyList())
    var loading by mutableStateOf(true)
    var error by mutableStateOf<String?>(null)

    /** The wedding this graph was actually loaded for; null until a scoped load succeeds. */
    var scopedWeddingId by mutableStateOf<String?>(null)

    /** Drops every row so a failed scope can never keep rendering the previous wedding. */
    fun clearGraph() {
        wedding = null
        tasks = emptyList()
        guests = emptyList()
        budget = null
        vendors = emptyList()
        announcements = emptyList()
        auditRecords = emptyList()
        scopedWeddingId = null
    }
}

/**
 * Loads the wedding graph for the active wedding. Keyed on the wedding id so that navigating
 * between workspaces never silently rebinds to a different wedding.
 */
@Composable
fun rememberWeddingGraph(
    appViewModel: AppViewModel,
    context: NavigationContext
): WeddingGraphState {
    val state = remember(context.activeWeddingId) { WeddingGraphState() }
    LaunchedEffect(context.activeWeddingId) {
        state.loading = true
        state.error = null
        state.scopedWeddingId = null
        try {
            // P0-1: the graph is read through a repository bound to THIS wedding. If the source
            // cannot serve it, forWedding throws rather than returning another wedding's rows.
            val scoped = appViewModel.repository.forWedding(context.activeWeddingId)
            state.wedding = scoped.getWedding()
            state.tasks = scoped.getTasks()
            state.guests = scoped.getGuests()
            state.budget = scoped.getBudget()
            state.vendors = scoped.getVendors()
            state.announcements = scoped.getAnnouncements()
            state.auditRecords = scoped.getAuditRecords()
            state.scopedWeddingId = scoped.weddingId
        } catch (mismatch: WeddingScopeMismatch) {
            state.clearGraph()
            state.error = "This workspace is not available for the selected wedding."
        } catch (failure: Exception) {
            state.clearGraph()
            state.error = failure.message ?: "Unable to load this wedding."
        }
        state.loading = false
    }
    return state
}

/** Level-2 host: documented section chips above repository-backed section content. */
@Composable
fun WorkspaceSurface(
    destination: PrimaryDestination,
    testTagPrefix: String,
    context: NavigationContext,
    sectionMemory: WorkspaceSectionMemory,
    sectionContent: @Composable (String) -> Unit
) {
    val default = destination.sections.firstOrNull() ?: destination.label
    val selectedSection = sectionMemory.selected(context, destination.id, default)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(WeddingIdentityPalette.Ivory)
            .testTag("$testTagPrefix-${destination.id}")
    ) {
        WorkspaceSectionChips(
            sections = destination.sections,
            selected = selectedSection,
            testTagPrefix = "$testTagPrefix-${destination.id}"
        ) { sectionMemory.select(context, destination.id, it) }

        Box(modifier = Modifier.weight(1f)) {
            sectionContent(selectedSection)
        }
    }
}

// ---------------------------------------------------------------------------
// Shared presentation primitives (approved Wewed visual language)
// ---------------------------------------------------------------------------

@Composable
fun IASectionList(
    title: String,
    subtitle: String? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(
            title,
            color = WeddingIdentityPalette.Ink,
            fontFamily = FontFamily.Serif,
            fontWeight = FontWeight.SemiBold,
            fontSize = 19.sp
        )
        subtitle?.let {
            Text(it, color = WeddingIdentityPalette.Muted, fontSize = 12.sp)
        }
        content()
    }
}

@Composable
fun IACard(
    title: String,
    subtitle: String? = null,
    trailing: String? = null,
    status: String? = null,
    testTag: String? = null
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
        shape = RoundedCornerShape(12.dp),
        color = WeddingIdentityPalette.IvorySoft,
        border = androidx.compose.foundation.BorderStroke(1.dp, WeddingIdentityPalette.Hairline)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 13.dp, vertical = 11.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(title, color = WeddingIdentityPalette.Ink, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                subtitle?.let {
                    Text(it, color = WeddingIdentityPalette.Muted, fontSize = 11.sp)
                }
                // Status is carried as text, never colour alone (IA V2 §19).
                status?.let {
                    Text(it, color = WeddingIdentityPalette.Forest, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                }
            }
            trailing?.let {
                Text(it, color = WeddingIdentityPalette.ChampagneDeep, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

/**
 * Honest unsupported state. Names the section and why it has no data in this environment,
 * so an empty workspace is never mistaken for a wired one (playbook §8, §16).
 */
@Composable
fun IAUnsupportedSection(
    section: String,
    reason: String,
    environment: NativeDataEnvironment
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp)
            .testTag("unsupported-section"),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            Icons.Default.Info,
            contentDescription = null,
            tint = WeddingIdentityPalette.Muted,
            modifier = Modifier.size(28.dp)
        )
        Spacer(Modifier.height(10.dp))
        Text(
            section,
            color = WeddingIdentityPalette.Ink,
            fontFamily = FontFamily.Serif,
            fontWeight = FontWeight.SemiBold,
            fontSize = 17.sp
        )
        Spacer(Modifier.height(6.dp))
        Text(
            reason,
            color = WeddingIdentityPalette.Muted,
            fontSize = 12.sp,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center
        )
        Spacer(Modifier.height(10.dp))
        Text(
            "Environment: ${environment.title}",
            color = WeddingIdentityPalette.Muted,
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
fun IALoading() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = WeddingIdentityPalette.ChampagneDeep)
    }
}

// ---------------------------------------------------------------------------
// Guests workspace (Couple) — IA V2 §4
// ---------------------------------------------------------------------------

@Composable
fun CoupleGuestsSection(section: String, graph: WeddingGraphState, environment: NativeDataEnvironment) {
    if (graph.loading) return IALoading()
    val guests = graph.guests

    when (section) {
        "Guest List" -> IASectionList("Guest List", "${guests.size} households • ${guests.sumOf { it.partySize }} guests") {
            guests.forEach { guest ->
                IACard(
                    title = guest.name,
                    subtitle = "${guest.householdName ?: "—"} • party of ${guest.partySize}",
                    trailing = guest.rsvpStatus.title,
                    testTag = "guest-row-${guest.id}"
                )
            }
        }
        "RSVP" -> {
            val attending = guests.filter { it.rsvpStatus == RSVPStatus.ATTENDING }
            val pending = guests.filter { it.rsvpStatus == RSVPStatus.PENDING }
            val declined = guests.filter { it.rsvpStatus == RSVPStatus.DECLINED }
            IASectionList(
                "RSVP",
                "${attending.size} attending • ${pending.size} pending • ${declined.size} declined"
            ) {
                guests.forEach { guest ->
                    IACard(
                        title = guest.name,
                        subtitle = "Party of ${guest.partySize}",
                        trailing = guest.rsvpStatus.title
                    )
                }
            }
        }
        "Invitations" -> IASectionList("Invitations", "Invitation delivery state per household") {
            guests.forEach { guest ->
                IACard(
                    title = guest.name,
                    subtitle = guest.householdName ?: "—",
                    // Pass serial existence is the only invitation fact the repository exposes.
                    trailing = if (guest.passSerial != null) "Issued" else "Not issued"
                )
            }
        }
        "Groups / Households" -> {
            val households = guests.groupBy { it.householdName ?: guest_unassigned }
            IASectionList("Groups / Households", "${households.size} groups") {
                households.forEach { (household, members) ->
                    IACard(
                        title = household,
                        subtitle = members.joinToString { it.name },
                        trailing = "${members.sumOf { it.partySize }}"
                    )
                }
            }
        }
        "Seating" -> {
            val seated = guests.filter { it.tableName != null }
            IASectionList("Seating", "${seated.size} of ${guests.size} households seated") {
                guests.forEach { guest ->
                    IACard(
                        title = guest.name,
                        subtitle = guest.tableName ?: "Not yet assigned",
                        trailing = guest.tableNumber?.toString()
                    )
                }
            }
        }
        "Passes / QR" -> IASectionList("Passes / QR", "Wedding Pass issuance by household") {
            guests.forEach { guest ->
                IACard(
                    title = guest.name,
                    subtitle = guest.passSerial ?: "No pass serial recorded",
                    trailing = if (guest.checkedIn) "Admitted" else null,
                    status = if (guest.checkedIn) "${guest.checkedInCount}/${guest.partySize} admitted" else null
                )
            }
        }
        "Messages" -> IAUnsupportedSection(
            "Messages",
            "Guest messaging has no native message contract in this environment yet. No conversation data is fabricated.",
            environment
        )
        else -> IAUnsupportedSection(section, "This section is not wired to a repository yet.", environment)
    }
}

private const val guest_unassigned = "Unassigned"

// ---------------------------------------------------------------------------
// Wedding Day workspace — shared by Couple / Guest / Planner / Coordinator
// ---------------------------------------------------------------------------

@Composable
fun WeddingDaySection(
    section: String,
    graph: WeddingGraphState,
    environment: NativeDataEnvironment,
    /** The guest whose table may be shown. Null means no guest identity is bound (P0-4). */
    boundGuestId: String? = null,
    passContent: (@Composable () -> Unit)? = null
) {
    if (graph.loading) return IALoading()
    val wedding = graph.wedding

    when (section) {
        "My Pass", "Wedding Pass" -> passContent?.invoke() ?: IAUnsupportedSection(
            section, "No Wedding Pass is issued for this actor in the active wedding.", environment
        )
        "Programme", "Programme Status" -> IASectionList("Programme", wedding?.venueName) {
            wedding?.programme.orEmpty().forEach { item ->
                IACard(
                    title = item.title,
                    subtitle = "${item.location} • ${item.description}",
                    trailing = item.time,
                    testTag = "programme-${item.id}"
                )
            }
        }
        "Venue & Maps", "Venue", "Maps", "Venue Map" -> IASectionList("Venue", wedding?.venueName) {
            wedding?.let {
                IACard(title = it.venueName, subtitle = it.venueAddress, trailing = null)
                IACard(title = "City", subtitle = "${it.city}, ${it.country}")
            }
        }
        "Vendor Status", "Vendor Arrivals" -> IASectionList("Vendor Status", "${graph.vendors.size} vendors on site plan") {
            graph.vendors.forEach { vendor ->
                IACard(
                    title = vendor.vendorName,
                    subtitle = "${vendor.serviceCategory} • ${vendor.serviceArea}",
                    trailing = vendor.expectedTime,
                    status = vendor.state.title,
                    testTag = "vendor-${vendor.id}"
                )
            }
        }
        "Announcements" -> IASectionList("Announcements", "${graph.announcements.size} posted") {
            graph.announcements.forEach { announcement ->
                IACard(
                    title = announcement.title,
                    subtitle = announcement.message,
                    status = announcement.urgency.name
                )
            }
        }
        "Table" -> IASectionList("Table", "Your seating assignment") {
            // P0-4: only the bound guest's own table may be shown here. Falling back to the first
            // seated guest would show another household's name and table.
            val self = boundGuestId?.let { id -> graph.guests.firstOrNull { it.id == id } }
            when {
                self == null -> IACard(
                    title = "No invitation bound",
                    subtitle = "No guest identity is bound to this session."
                )
                self.tableName != null -> IACard(
                    title = self.tableName!!,
                    subtitle = self.name,
                    testTag = "wedding-day-table-${self.id}"
                )
                else -> IACard(title = "Not yet assigned", subtitle = "Seating has not been published.")
            }
        }
        "Key Contacts", "Contacts", "Emergency Contacts" -> IAUnsupportedSection(
            section,
            "No wedding contact directory contract exists natively yet. Contacts are not invented.",
            environment
        )
        // P0-14: the graph has no wedding-day flag on tasks, so this cannot claim to be "tasks
        // due on the day". It is named for what it actually is: every open planning task.
        "Wedding-day Checklist" -> IASectionList(
            "Open planning tasks",
            "All incomplete tasks. The wedding graph does not mark tasks as wedding-day specific."
        ) {
            val open = graph.tasks.filter { it.status != TaskStatus.DONE }
            if (open.isEmpty()) {
                IACard(title = "Nothing outstanding", subtitle = "All planning tasks are complete.")
            }
            open.forEach { task ->
                IACard(
                    title = task.title,
                    subtitle = task.category,
                    trailing = task.dueDate ?: "No due date",
                    status = task.priority.title
                )
            }
        }
        "Offline Status", "Offline", "Sync Status" -> IASectionList("Offline & sync", "Local gate manifest state") {
            val unsynced = graph.auditRecords.count { !it.isSynced }
            IACard(title = "Recorded admissions", subtitle = "Local audit records", trailing = "${graph.auditRecords.size}")
            IACard(title = "Awaiting sync", subtitle = "Unsynced local scans", trailing = "$unsynced")
        }
        else -> IAUnsupportedSection(section, "This wedding-day section is not wired to a repository yet.", environment)
    }
}

// ---------------------------------------------------------------------------
// Gate Team workspace — IA V2 §8
// ---------------------------------------------------------------------------

@Composable
fun GateAdmissionsSection(section: String, graph: WeddingGraphState, environment: NativeDataEnvironment) {
    if (graph.loading) return IALoading()
    val guests = graph.guests

    when (section) {
        "Checked In" -> {
            val admitted = guests.filter { it.checkedInCount > 0 }
            IASectionList("Checked In", "${admitted.sumOf { it.checkedInCount }} guests admitted") {
                admitted.forEach { AdmissionRow(it) }
                if (admitted.isEmpty()) IACard("No admissions recorded", "No guest has been scanned yet.")
            }
        }
        "Not Arrived" -> {
            val notArrived = guests.filter { it.checkedInCount == 0 }
            IASectionList("Not Arrived", "${notArrived.size} households outstanding") {
                notArrived.forEach { AdmissionRow(it) }
                if (notArrived.isEmpty()) IACard("All arrived", "Every expected household has been admitted.")
            }
        }
        "Partial Parties" -> {
            val partial = guests.filter { it.checkedInCount in 1 until it.partySize }
            IASectionList("Partial Parties", "${partial.size} parties partially admitted") {
                partial.forEach { AdmissionRow(it) }
                if (partial.isEmpty()) IACard("No partial parties", "No household is partially admitted.")
            }
        }
        "Duplicate Scans" -> {
            // P0-14: multiple audit rows for one serial are normal — a household of four can be
            // admitted in several partial scans. A genuine duplicate is an admission beyond the
            // recorded party size, which is what is reported here.
            val admittedBySerial = graph.auditRecords
                .groupBy { it.passSerial }
                .mapValues { (_, records) -> records.sumOf { it.countAdmitted } }
            val overAdmitted = graph.guests.filter { guest ->
                val serial = guest.passSerial ?: return@filter false
                (admittedBySerial[serial] ?: 0) > guest.partySize
            }
            IASectionList("Duplicate Scans", "Admissions beyond the recorded party size") {
                overAdmitted.forEach { guest ->
                    IACard(
                        title = guest.name,
                        subtitle = "Party of ${guest.partySize}",
                        trailing = "${admittedBySerial[guest.passSerial] ?: 0} admitted"
                    )
                }
                if (overAdmitted.isEmpty()) {
                    IACard(
                        "No over-admissions",
                        "No pass has admitted more guests than its recorded party size. Rejected duplicate attempts are not stored in the audit log, so they cannot be listed here."
                    )
                }
            }
        }
        "Exceptions" -> {
            val over = guests.filter { it.checkedInCount > it.partySize }
            IASectionList("Exceptions", "Capacity and manifest exceptions") {
                over.forEach { AdmissionRow(it) }
                if (over.isEmpty()) IACard("No exceptions", "No admission exceeded its recorded party size.")
            }
        }
        "Manual Admission" -> IAUnsupportedSection(
            "Manual Admission",
            "Manual admission is an action performed from Scan, not a browsable list. Open Scan to admit without a readable code.",
            environment
        )
        else -> IAUnsupportedSection(section, "This admissions section is not wired yet.", environment)
    }
}

@Composable
private fun AdmissionRow(guest: Guest) {
    IACard(
        title = guest.name,
        subtitle = guest.tableName ?: "No table assigned",
        trailing = "${guest.checkedInCount}/${guest.partySize}",
        status = guest.rsvpStatus.title,
        testTag = "admission-${guest.id}"
    )
}

/** Gate guest lookup is operational only: name, party, table, RSVP, admission. No financial data. */
@Composable
fun GateGuestLookup(graph: WeddingGraphState) {
    if (graph.loading) return IALoading()
    var query by remember { mutableStateOf("") }
    Column(modifier = Modifier.fillMaxSize().padding(horizontal = 14.dp, vertical = 10.dp)) {
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            modifier = Modifier.fillMaxWidth().testTag("gate-guest-search"),
            placeholder = { Text("Search name, household or table") },
            singleLine = true
        )
        Spacer(Modifier.height(10.dp))
        val filtered = graph.guests.filter {
            query.isBlank() ||
                it.name.contains(query, ignoreCase = true) ||
                it.householdName?.contains(query, ignoreCase = true) == true ||
                it.tableName?.contains(query, ignoreCase = true) == true
        }
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(filtered.size) { index ->
                val guest = filtered[index]
                IACard(
                    title = guest.name,
                    subtitle = "Party ${guest.partySize} • ${guest.tableName ?: "No table"}",
                    trailing = "${guest.checkedInCount}/${guest.partySize}",
                    status = guest.rsvpStatus.title
                )
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Admin workspace — IA V2 §10
// ---------------------------------------------------------------------------

@Composable
fun AdminAuditSection(section: String, graph: WeddingGraphState, environment: NativeDataEnvironment) {
    if (graph.loading) return IALoading()
    when (section) {
        "Check-ins" -> IASectionList("Check-ins", "${graph.auditRecords.size} admission records") {
            graph.auditRecords.forEach { record ->
                IACard(
                    title = record.guestName,
                    subtitle = "${record.gateName} • usher ${record.usherId}",
                    trailing = "+${record.countAdmitted}",
                    status = if (record.isSynced) "Synced" else "Pending sync"
                )
            }
            if (graph.auditRecords.isEmpty()) {
                IACard("No check-in records", "No admissions have been recorded for this wedding.")
            }
        }
        "Data Changes", "Access Events", "Payments", "Contracts", "Admin Actions" -> IAUnsupportedSection(
            section,
            "This audit stream has no native contract yet. Only check-in audit records are available natively, and no audit entries are fabricated.",
            environment
        )
        else -> IAUnsupportedSection(section, "This audit section is not wired yet.", environment)
    }
}

/** System health reads real local state rather than hard-coded counters. */
@Composable
fun AdminDashboardContent(graph: WeddingGraphState, context: NavigationContext) {
    if (graph.loading) return IALoading()
    IASectionList("Dashboard", "Administrative overview for the active scope") {
        IACard(
            title = "Active wedding in scope",
            subtitle = context.activeWeddingTitle,
            trailing = null,
            testTag = "admin-active-wedding"
        )
        IACard(
            title = "Data environment",
            subtitle = "Native client is bound to this environment",
            trailing = context.environment.title
        )
        IACard(
            title = "Admission records",
            subtitle = "Recorded check-ins in scope",
            trailing = "${graph.auditRecords.size}"
        )
        IACard(
            title = "Unsynced admissions",
            subtitle = "Awaiting reconciliation",
            trailing = "${graph.auditRecords.count { !it.isSynced }}"
        )
        IACard(
            title = "Guest households in scope",
            subtitle = "From the canonical wedding graph",
            trailing = "${graph.guests.size}"
        )
    }
}

// ---------------------------------------------------------------------------
// Vendor workspace — IA V2 §7
// ---------------------------------------------------------------------------

/**
 * Vendor sees only its own engagement. The native repository exposes vendor presence for the
 * wedding, so the engagement is resolved by [NavigationContext.activeEngagementId] and nothing
 * else is shown.
 */
@Composable
fun VendorJobsSection(
    section: String,
    graph: WeddingGraphState,
    context: NavigationContext
) {
    if (graph.loading) return IALoading()
    // P0-6: only the engagement this vendor is authorized for. There is no "first vendor"
    // fallback — that would show another company's engagement.
    val engagement = context.authorizedEngagement(graph)
        ?: return IAUnsupportedSection(
            section,
            "No service engagement is assigned to this vendor for the active wedding.",
            context.environment
        )

    when (section) {
        "Service Details" -> IASectionList(engagement.vendorName, engagement.serviceCategory) {
            IACard(title = "Service area", subtitle = engagement.serviceArea)
            IACard(title = "Expected on site", subtitle = "Scheduled arrival", trailing = engagement.expectedTime)
            IACard(title = "Presence", subtitle = "Current recorded state", status = engagement.state.title)
        }
        "Venue" -> IASectionList("Venue", graph.wedding?.venueName) {
            graph.wedding?.let {
                IACard(title = it.venueName, subtitle = it.venueAddress)
                IACard(title = "Service area", subtitle = engagement.serviceArea)
            }
        }
        "Tasks" -> IAUnsupportedSection(
            "Tasks",
            "Vendor-scoped tasks are not exposed by the native contract. Wedding planning tasks belong to the couple and planner and are deliberately not shown here.",
            context.environment
        )
        "Deliverables", "Contract", "Payment", "Files", "Notes", "Client / Planner Contacts" -> IAUnsupportedSection(
            section,
            "No native contract exists for vendor $section yet. Recorded state is shown only where the repository provides it.",
            context.environment
        )
        else -> IAUnsupportedSection(section, "This vendor section is not wired yet.", context.environment)
    }
}

@Composable
fun VendorScheduleSection(
    section: String,
    graph: WeddingGraphState,
    context: NavigationContext
) {
    if (graph.loading) return IALoading()
    val engagement = context.authorizedEngagement(graph)

    when (section) {
        "Calendar" -> IASectionList("Calendar", graph.wedding?.date) {
            graph.wedding?.programme.orEmpty().forEach { item ->
                IACard(title = item.title, subtitle = item.location, trailing = item.time)
            }
        }
        "Arrival Time" -> IASectionList("Arrival Time", engagement?.vendorName) {
            engagement?.let {
                IACard(title = "Expected arrival", subtitle = it.serviceArea, trailing = it.expectedTime)
                IACard(title = "Recorded presence", subtitle = "Updated by the wedding-day team", status = it.state.title)
            } ?: IACard("No engagement", "No assigned engagement for this wedding.")
        }
        "Setup", "Service Window", "Breakdown", "Dependencies" -> IAUnsupportedSection(
            section,
            "The native vendor contract records arrival and presence only. $section has no recorded value and is not inferred.",
            context.environment
        )
        else -> IAUnsupportedSection(section, "This schedule section is not wired yet.", context.environment)
    }
}

/**
 * The service engagement this vendor is authorized for (P0-6).
 *
 * Returns null when no engagement is bound, so the caller renders an honest empty state instead
 * of another vendor's engagement.
 */
fun NavigationContext.authorizedEngagement(graph: WeddingGraphState): VendorPresence? {
    val engagementId = activeEngagementId ?: return null
    return graph.vendors.firstOrNull { it.id == engagementId }
}

/**
 * The guest record this context is bound to (P0-4).
 *
 * Returns null when no guest identity was resolved from a credential — callers must render an
 * honest unbound state rather than falling back to an arbitrary row.
 */
fun NavigationContext.boundGuest(graph: WeddingGraphState): Guest? {
    val guestId = activeGuestId ?: return null
    return graph.guests.firstOrNull { it.id == guestId }
}
