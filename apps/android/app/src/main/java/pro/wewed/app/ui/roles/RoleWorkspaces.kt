package pro.wewed.app.ui.roles

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.models.AppRole
import pro.wewed.app.models.NativeDeepLink
import pro.wewed.app.models.NativeDataEnvironment
import kotlinx.coroutines.launch
import pro.wewed.app.navigation.IANavigationContract
import pro.wewed.app.navigation.NavigationContext
import pro.wewed.app.services.AdminSystemRepository
import pro.wewed.app.services.ShadowAdminSystemRepository
import pro.wewed.app.services.forWedding
import pro.wewed.app.navigation.PrimaryDestination
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.state.SessionViewModel
import pro.wewed.app.theme.WeddingIdentityPalette
import pro.wewed.app.ui.guests.WeddingReferenceGuestsScreen
import pro.wewed.app.ui.home.WeddingReferenceHomeScreen
import pro.wewed.app.ui.live.LiveWallScreen
import pro.wewed.app.ui.more.WeddingReferenceMoreScreen
import pro.wewed.app.ui.pass.UsherScannerScreen
import pro.wewed.app.ui.pass.WeddingReferencePassScreen
import pro.wewed.app.ui.planner.*
import pro.wewed.app.ui.shared.*

/**
 * IA V2 role shells.
 *
 * Each shell is now a thin binding of the shared navigation contract to this role's existing
 * screens; the bottom bar itself lives in [RoleShellScaffold]. Screens are reused, not rebuilt —
 * IA V2 §21 is explicit that this is an upgrade of the existing product, not a reset.
 */

// MARK: - Planner Shell — Workspace | Clients | Daily Ops | Wedding Day | More
@Composable
fun PlannerShell(
    sessionViewModel: SessionViewModel,
    appViewModel: AppViewModel,
    context: NavigationContext,
    pendingDeepLink: NativeDeepLink? = null,
    onDeepLinkHandled: (() -> Unit)? = null,
    onOpenPersonaPicker: (() -> Unit)? = null
) {
    val sectionMemory = rememberWorkspaceSectionMemory()
    RoleShellScaffold(
        context = context,
        onSwitchPersona = onOpenPersonaPicker,
        pendingDeepLink = pendingDeepLink,
        sectionMemory = sectionMemory,
        onDeepLinkHandled = onDeepLinkHandled
    ) { destination, ctx ->
        val graph = rememberWeddingGraph(appViewModel, ctx)
        when (destination.id) {
            "workspace" -> WorkspaceSurface(destination, "planner", ctx, sectionMemory) { section ->
                PlannerWorkspaceSection(section, appViewModel, graph, ctx, sectionMemory)
            }
            "clients" -> WorkspaceSurface(destination, "planner", ctx, sectionMemory) { section ->
                PlannerClientsSection(section, appViewModel, ctx)
            }
            "daily_ops" -> WorkspaceSurface(destination, "planner", ctx, sectionMemory) { section ->
                PlannerDailyOpsSection(section, appViewModel, graph, ctx)
            }
            "wedding_day" -> WorkspaceSurface(destination, "planner", ctx, sectionMemory) { section ->
                PlannerWeddingDaySection(section, graph, ctx)
            }
            "more" -> WorkspaceSurface(destination, "planner", ctx, sectionMemory) { section ->
                PlannerMoreSection(section, sessionViewModel, appViewModel, sectionMemory, ctx)
            }
            else -> IAUnsupportedSection(destination.label, "Unknown destination.", ctx.environment)
        }
    }
}

@Composable
private fun PlannerWorkspaceSection(
    section: String,
    appViewModel: AppViewModel,
    graph: WeddingGraphState,
    context: NavigationContext,
    sectionMemory: WorkspaceSectionMemory
) {
    // Each worksheet reads the same selected wedding graph (IA V2 §5 Workspace).
    when (section) {
        // IA V2 owns Level-2 here too; the Overview surface only reports the target section.
        "Overview" -> WeddingReferencePlannerScreen(appViewModel) { target ->
            sectionMemory.select(context, "workspace", target)
        }
        "Tasks" -> TasksDestination(appViewModel) {}
        "Budget" -> ShadowBudgetDestination(appViewModel) {}
        "Guests" -> GuestsBridgeDestination(appViewModel) {}
        "Vendors" -> ShadowVendorsDestination(appViewModel) {}
        "Contributions" -> if (context.environment == NativeDataEnvironment.PRODUCTION) {
            IAUnsupportedSection("Contributions", "The mature contributions/funding-attribution domain is not connected to native production yet. No empty contribution ledger is inferred.", context.environment)
        } else ShadowContributionsDestination(appViewModel) {}
        "Seating" -> ShadowSeatingDestination(appViewModel) {}
        "Timeline" -> ShadowTimelineDestination(appViewModel) {}
        "Documents" -> if (context.environment == NativeDataEnvironment.PRODUCTION) {
            IAUnsupportedSection("Documents", "The mature contracts/vault document domain is not connected to native production yet. No empty document vault is inferred.", context.environment)
        } else ShadowDocumentsDestination(appViewModel) {}
        else -> IAUnsupportedSection(section, "This worksheet is not wired yet.", context.environment)
    }
}

@Composable
private fun PlannerClientsSection(
    section: String,
    appViewModel: AppViewModel,
    context: NavigationContext
) {
    // The native contract exposes exactly one planner engagement: the active wedding. Other client
    // states are not invented (playbook §8 — "Never fabricate a PlannerEngagement").
    when (section) {
        "Active Weddings" -> IASectionList("Active Weddings", "Weddings in your planner scope") {
            if (context.environment == NativeDataEnvironment.PRODUCTION) {
                // Production authority already proves this exact wedding relationship. Do not
                // carry Shadow-specific enquiry/profile claims into the live workspace.
                IACard(
                    title = context.activeWeddingTitle,
                    subtitle = "Current authorized wedding workspace",
                    status = "Live Wewed authority",
                    testTag = "planner-active-client"
                )
            } else {
                // P0-13: the Private Real Shadow snapshot contains no PlannerEngagement. The
                // Shadow qualification relationship is deliberately described as test evidence.
                IACard(
                    title = context.activeWeddingTitle,
                    subtitle = "Accepted enquiry — no planner engagement record exists",
                    trailing = if (context.assignment?.isShadowTestAccess == true) "Test access only" else null,
                    status = "Shadow test authorization",
                    testTag = "planner-active-client"
                )
                IACard(
                    title = "Engagement record",
                    subtitle = "No PlannerEngagement or WeddingMembership exists for this wedding",
                    trailing = "Absent"
                )
            }
        }
        "Upcoming Weddings", "Enquiries", "Archived Weddings", "Team Assignment" -> IAUnsupportedSection(
            section,
            if (context.environment == NativeDataEnvironment.PRODUCTION)
                "The planner client-portfolio domain for $section is not connected to native production yet. No absence is inferred."
            else
                "The native qualification contract exposes only the active engagement. No $section records are fabricated.",
            context.environment
        )
        // One concept must have one route. This pointed at a static legacy screen whose
        // hard-coded "174 guest records" was already stale — the real count is 175 — while a
        // repository-backed Client Profile existed in Planner -> More. Static product copy does
        // not stay true; it only stays unnoticed.
        "Client Profiles" -> PlannerClientProfileSection(rememberWeddingGraph(appViewModel, context))
        else -> IAUnsupportedSection(section, "This clients section is not wired yet.", context.environment)
    }
}

@Composable
private fun PlannerDailyOpsSection(
    section: String,
    appViewModel: AppViewModel,
    graph: WeddingGraphState,
    context: NavigationContext
) {
    if (graph.loading) return IALoading()
    if (context.environment == NativeDataEnvironment.PRODUCTION) {
        val unsupportedReason = when (section) {
            "Today" -> "The planner attention/readiness aggregation is not connected to native production yet. Tasks and deadline views remain live."
            "Vendor Follow-ups" -> "Planning-side vendors are live in Workspace, but vendor follow-up/arrival state is a separate domain and is not connected here."
            "Team Activity" -> "The planner activity stream is not connected to native production yet. No empty activity history is inferred."
            else -> null
        }
        if (unsupportedReason != null) {
            IAUnsupportedSection(section, unsupportedReason, context.environment)
            return
        }
    }
    // Daily Ops is an attention projection over canonical entities — it never copies them
    // into a second model (playbook §15).
    var dashboard by remember(context.activeWeddingId) {
        mutableStateOf<pro.wewed.app.models.PlannerDashboardSnapshot?>(null)
    }
    LaunchedEffect(context.activeWeddingId) {
        dashboard = runCatching { appViewModel.plannerRepository.getDashboard() }.getOrNull()
    }

    when (section) {
        "Today" -> IASectionList("Today", context.activeWeddingTitle) {
            dashboard?.attentionItems.orEmpty().forEach { item ->
                IACard(title = item.title, subtitle = item.detail, status = item.severity.name)
            }
            if (dashboard?.attentionItems.isNullOrEmpty()) {
                IACard("Nothing needs attention", "No attention items are recorded for this wedding.")
            }
        }
        // P0-14: overdue means a due date in the past — not "urgent and unfinished".
        "Overdue" -> {
            val overdue = TaskDeadlines.overdue(graph.tasks)
            val undated = TaskDeadlines.undated(graph.tasks)
            IASectionList("Overdue", "${overdue.size} tasks past their due date") {
                overdue.forEach { IACard(it.title, it.category, it.dueDate, it.priority.title) }
                if (overdue.isEmpty()) IACard("Nothing overdue", "No task has passed its due date.")
                if (undated.isNotEmpty()) {
                    IACard(
                        "${undated.size} open tasks have no due date",
                        "Undated tasks cannot be overdue and are not counted here."
                    )
                }
            }
        }
        // P0-14: a date-windowed view, not simply "every open task".
        "Upcoming Deadlines" -> {
            val upcoming = TaskDeadlines.upcoming(graph.tasks)
            IASectionList("Upcoming Deadlines", "${upcoming.size} tasks due in the next 30 days") {
                upcoming.forEach { IACard(it.title, it.category, it.dueDate, it.priority.title) }
                if (upcoming.isEmpty()) {
                    IACard(
                        "No deadlines in the next 30 days",
                        "Only tasks with a recorded due date appear here."
                    )
                }
            }
        }
        "Vendor Follow-ups" -> IASectionList("Vendor Follow-ups", "${graph.vendors.size} vendors") {
            graph.vendors.forEach { IACard(it.vendorName, it.serviceCategory, it.expectedTime, it.state.title) }
        }
        "Guest Issues" -> {
            val pending = graph.guests.filter {
                it.rsvpStatus == pro.wewed.app.models.RSVPStatus.PENDING
            }
            IASectionList("Guest Issues", "${pending.size} households awaiting RSVP") {
                pending.forEach { IACard(it.name, it.householdName ?: "—", "Party ${it.partySize}", it.rsvpStatus.title) }
                if (pending.isEmpty()) IACard("No outstanding guest issues", "Every household has responded.")
            }
        }
        "Team Activity" -> IASectionList("Team Activity", "Recent changes on this wedding") {
            dashboard?.recentActivity.orEmpty().forEach { activity ->
                IACard(activity.title, activity.detail, activity.relativeTime)
            }
            if (dashboard?.recentActivity.isNullOrEmpty()) {
                IACard("No recorded activity", "No planner activity has been recorded.")
            }
        }
        "Approvals", "Payments Requiring Attention" -> IAUnsupportedSection(
            section,
            "No native approval or payment-action contract exists yet. Budget and contribution state is readable in Workspace; no approval queue is fabricated.",
            context.environment
        )
        "Messages" -> MessagesInboxScreen()
        else -> IAUnsupportedSection(section, "This Daily Ops section is not wired yet.", context.environment)
    }
}

@Composable
private fun PlannerWeddingDaySection(
    section: String,
    graph: WeddingGraphState,
    context: NavigationContext
) {
    if (context.environment == NativeDataEnvironment.PRODUCTION &&
        section in setOf("Gate / Admissions", "Vendor Arrivals", "Guest Issues", "Incidents", "Live Notes", "Emergency Contacts", "Offline Status")
    ) {
        IAUnsupportedSection(
            section,
            "Wedding-Day operational authority/data for this section is not connected in Phase 8. No empty gate, arrival, incident or sync state is inferred.",
            context.environment
        )
        return
    }
    when (section) {
        "Run Sheet" -> WeddingDaySection("Programme", graph, context.environment)
        "Gate / Admissions" -> GateAdmissionsSection("Checked In", graph, context.environment)
        "Coordinator Tasks" -> WeddingDaySection("Wedding-day Checklist", graph, context.environment)
        "Guest Issues" -> GateAdmissionsSection("Not Arrived", graph, context.environment)
        "Incidents", "Live Notes" -> IAUnsupportedSection(
            section,
            "No native incident or live-note contract exists yet. Nothing is recorded, so nothing is displayed.",
            context.environment
        )
        else -> WeddingDaySection(section, graph, context.environment)
    }
}

@Composable
private fun PlannerMoreSection(
    section: String,
    sessionViewModel: SessionViewModel,
    appViewModel: AppViewModel,
    sectionMemory: WorkspaceSectionMemory,
    context: NavigationContext
) {
    // Every route below reads the wedding graph. The six legacy fixture destinations
    // (Client Profile, Team Hub, Invitations & QR, Intelligence, Media Archive, Vendor Catalog)
    // used to render static copy here — insurance lines, rate sheets, "AI active" claims — which
    // is why Private Real UAT could show a real wedding alongside invented operational facts.
    val graph = rememberWeddingGraph(appViewModel, context)

    when (section) {
        "Client Profile" -> PlannerClientProfileSection(graph)
        "Invitations & QR" -> InvitationsQrSection(
            destinations = graph.qrDestinations,
            invitationCardStyle = null
        )
        "Intelligence" -> PlannerIntelligenceSection(graph)
        "Team Hub" -> PlannerTeamHubSection(graph)
        "Files / Documents" -> PlannerMediaArchiveSection(graph)
        "Planner Actions" -> PlannerActionsSection(appViewModel, context, sectionMemory, graph) {}
        "Settings" -> SettingsScreen(sessionViewModel = sessionViewModel)
        "Account" -> AccountPrivacyScreen()
        "Help & Support" -> IASectionList("Help & Support", "Wewed planner support") {
            IACard("Contact support", "support@wewed.pro")
        }
        else -> IAUnsupportedSection(section, "This section is not wired yet.", context.environment)
    }
}

/**
 * IA V2 §5 — Planner Actions are contextual operations, deliberately not bottom tabs.
 *
 * P0-11: an action either performs a real native operation or states plainly that it is not
 * connected. Rendering an inert card that looks tappable claims a capability the app does not have.
 */
@Composable
private fun PlannerActionsSection(
    appViewModel: AppViewModel,
    context: NavigationContext,
    sectionMemory: WorkspaceSectionMemory,
    graph: WeddingGraphState,
    onRefreshed: () -> Unit
) {
    var lastResult by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val worksheets = IANavigationContract.forRole(context.activeRole).sections("workspace")

    IASectionList("Planner Actions", "Contextual operations for ${context.activeWeddingTitle}") {
        lastResult?.let {
            IACard(title = "Last action", subtitle = it, testTag = "planner-action-result")
        }

        // --- Implemented natively ---
        IAActionRow(
            title = "Refresh",
            subtitle = "Re-read the active wedding graph from the repository",
            enabled = !busy,
            testTag = "planner-action-refresh"
        ) {
            busy = true
            scope.launch {
                val outcome = runCatching {
                    val scoped = appViewModel.repository.forWedding(context.activeWeddingId)
                    "${scoped.getTasks().size} tasks, ${scoped.getGuests().size} guest records reloaded"
                }
                lastResult = outcome.getOrElse { "Refresh failed: ${it.message}" }
                busy = false
                onRefreshed()
            }
        }

        IAActionRow(
            title = "Switch Worksheet",
            subtitle = "Jump straight to a Workspace worksheet",
            enabled = worksheets.isNotEmpty(),
            testTag = "planner-action-switch-worksheet"
        ) {
            // Real navigation: selects the next worksheet in the Workspace section memory.
            val current = sectionMemory.selected(context, "workspace", worksheets.first())
            val next = worksheets[(worksheets.indexOf(current).coerceAtLeast(0) + 1) % worksheets.size]
            sectionMemory.select(context, "workspace", next)
            lastResult = "Workspace worksheet set to $next"
        }

        // Recent Imports is no longer "not connected": production holds a real ImportJob history
        // for this wedding, and it is rendered from that history rather than declared absent.
        var showImports by remember { mutableStateOf(false) }
        IAActionRow(
            title = "Recent Imports",
            subtitle = if (graph.importJobs.isEmpty()) {
                "No imports are recorded for this wedding"
            } else {
                "${graph.importJobs.size} imports recorded"
            },
            enabled = graph.importJobs.isNotEmpty(),
            testTag = "planner-action-recent-imports"
        ) { showImports = !showImports }

        if (showImports) {
            RecentImportsSection(graph.importJobs)
        }

        // --- Honestly unsupported ---
        listOf(
            "Print / Arrange / Select" to "Printable guest, seating and programme output has no native contract yet.",
            "Templates" to "Planning templates are not exposed to the native client yet.",
            "Export" to "No native export contract exists for the wedding graph.",
            "Import" to "Guest and task import is not available natively; no import endpoint is wired.",
            "Edit Wedding Details" to "Wedding identity is read-only during Shadow qualification; no native write path exists."
        ).forEach { (title, why) ->
            IAUnsupportedActionRow(
                title = title,
                reason = why,
                testTag = "planner-action-${title.slug()}"
            )
        }
    }
}

// MARK: - Coordinator Shell — Today | Run Sheet | Team | Wedding Day | More
@Composable
fun CoordinatorShell(
    sessionViewModel: SessionViewModel,
    appViewModel: AppViewModel,
    context: NavigationContext,
    pendingDeepLink: NativeDeepLink? = null,
    onDeepLinkHandled: (() -> Unit)? = null,
    onOpenPersonaPicker: (() -> Unit)? = null
) {
    val sectionMemory = rememberWorkspaceSectionMemory()
    RoleShellScaffold(
        context = context,
        onSwitchPersona = onOpenPersonaPicker,
        pendingDeepLink = pendingDeepLink,
        sectionMemory = sectionMemory,
        onDeepLinkHandled = onDeepLinkHandled
    ) { destination, ctx ->
        val graph = rememberWeddingGraph(appViewModel, ctx)
        when (destination.id) {
            "today" -> CoordinatorTodayContent(graph, ctx)
            "run_sheet" -> WeddingDaySection("Programme", graph, ctx.environment)
            "team" -> WorkspaceSurface(destination, "coordinator", ctx, sectionMemory) { section ->
                CoordinatorTeamSection(section, graph, ctx)
            }
            "wedding_day" -> WorkspaceSurface(destination, "coordinator", ctx, sectionMemory) { section ->
                CoordinatorWeddingDaySection(section, graph, ctx)
            }
            "more" -> WorkspaceSurface(destination, "coordinator", ctx, sectionMemory) { section ->
                CoordinatorMoreSection(section, sessionViewModel, graph, ctx)
            }
            else -> IAUnsupportedSection(destination.label, "Unknown destination.", ctx.environment)
        }
    }
}

@Composable
private fun CoordinatorTodayContent(graph: WeddingGraphState, context: NavigationContext) {
    if (graph.loading) return IALoading()
    IASectionList("Today", context.activeWeddingTitle) {
        graph.wedding?.programme?.firstOrNull()?.let { next ->
            IACard("Next milestone", "${next.title} • ${next.location}", next.time, testTag = "coordinator-next-milestone")
        }
        val openTasks = graph.tasks.filter { it.status != pro.wewed.app.models.TaskStatus.DONE }
        IACard("Open tasks", "Outstanding wedding tasks", "${openTasks.size}")
        if (context.environment == NativeDataEnvironment.PRODUCTION) {
            IACard(
                "Wedding-Day operations",
                "Vendor-arrival and gate-admission state is not connected to native production in Phase 8.",
                status = "Unsupported"
            )
        } else {
            val lateVendors = graph.vendors.filter {
                it.state == pro.wewed.app.models.VendorPresenceState.NOT_RECORDED ||
                    it.state == pro.wewed.app.models.VendorPresenceState.SCHEDULED
            }
            IACard("Vendors not yet on site", "Awaiting arrival", "${lateVendors.size}")
            val notArrived = graph.guests.count { it.checkedInCount == 0 }
            IACard("Households not arrived", "Gate admission state", "$notArrived")
        }
    }
}

@Composable
private fun CoordinatorTeamSection(
    section: String,
    graph: WeddingGraphState,
    context: NavigationContext
) {
    if (graph.loading) return IALoading()
    when (section) {
        "Tasks" -> IASectionList("Team Tasks", "${graph.tasks.size} tasks on this wedding") {
            graph.tasks.forEach { IACard(it.title, it.category, it.dueDate, it.status.title) }
        }
        "Vendors" -> if (context.environment == NativeDataEnvironment.PRODUCTION) {
            IAUnsupportedSection("Vendors", "Coordinator vendor-arrival/presence data is not connected to native production yet. No zero-vendor state is inferred.", context.environment)
        } else IASectionList("Vendors", "${graph.vendors.size} vendors") {
            graph.vendors.forEach { IACard(it.vendorName, it.serviceCategory, it.expectedTime, it.state.title) }
        }
        "Ushers", "Staff", "Assignments", "Contacts" -> IAUnsupportedSection(
            section,
            "No native team-roster contract exists yet. Assignments are not invented (playbook §12).",
            context.environment
        )
        else -> IAUnsupportedSection(section, "This team section is not wired yet.", context.environment)
    }
}

@Composable
private fun CoordinatorWeddingDaySection(
    section: String,
    graph: WeddingGraphState,
    context: NavigationContext
) {
    if (context.environment == NativeDataEnvironment.PRODUCTION &&
        section in setOf("Gate", "Admissions", "Vendor Arrivals", "Incidents", "Announcements")
    ) {
        IAUnsupportedSection(
            section,
            "Wedding-Day operational authority/data for this section is not connected in Phase 8. No empty operational state is inferred.",
            context.environment
        )
        return
    }
    when (section) {
        "Gate", "Admissions" -> GateAdmissionsSection("Checked In", graph, context.environment)
        "Venue Zones" -> WeddingDaySection("Venue", graph, context.environment)
        "Incidents" -> IAUnsupportedSection(
            "Incidents",
            "No native incident contract exists yet. No incident records are fabricated.",
            context.environment
        )
        else -> WeddingDaySection(section, graph, context.environment)
    }
}

@Composable
private fun CoordinatorMoreSection(
    section: String,
    sessionViewModel: SessionViewModel,
    graph: WeddingGraphState,
    context: NavigationContext
) {
    when (section) {
        "Maps" -> WeddingDaySection("Venue", graph, context.environment)
        "Offline" -> WeddingDaySection("Offline Status", graph, context.environment)
        "Account" -> AccountPrivacyScreen()
        "Support" -> IASectionList("Support", "Coordinator support") {
            IACard("Contact support", "support@wewed.pro")
        }
        "Documents", "Notes" -> IAUnsupportedSection(
            section,
            "No native coordinator $section contract exists yet.",
            context.environment
        )
        else -> IAUnsupportedSection(section, "This section is not wired yet.", context.environment)
    }
}

// MARK: - Vendor Shell — Home | Jobs | Schedule | Messages | More
@Composable
fun VendorShell(
    sessionViewModel: SessionViewModel,
    appViewModel: AppViewModel,
    context: NavigationContext,
    pendingDeepLink: NativeDeepLink? = null,
    onDeepLinkHandled: (() -> Unit)? = null,
    onOpenPersonaPicker: (() -> Unit)? = null
) {
    val sectionMemory = rememberWorkspaceSectionMemory()
    RoleShellScaffold(
        context = context,
        onSwitchPersona = onOpenPersonaPicker,
        pendingDeepLink = pendingDeepLink,
        sectionMemory = sectionMemory,
        onDeepLinkHandled = onDeepLinkHandled
    ) { destination, ctx ->
        val graph = rememberWeddingGraph(appViewModel, ctx)
        when (destination.id) {
            "home" -> VendorHomeContent(graph, ctx)
            "jobs" -> WorkspaceSurface(destination, "vendor", ctx, sectionMemory) { section ->
                VendorJobsSection(section, graph, ctx)
            }
            "schedule" -> WorkspaceSurface(destination, "vendor", ctx, sectionMemory) { section ->
                VendorScheduleSection(section, graph, ctx)
            }
            "messages" -> MessagesInboxScreen()
            "more" -> WorkspaceSurface(destination, "vendor", ctx, sectionMemory) { section ->
                VendorMoreSection(section, sessionViewModel, appViewModel, ctx)
            }
            else -> IAUnsupportedSection(destination.label, "Unknown destination.", ctx.environment)
        }
    }
}

@Composable
private fun VendorHomeContent(graph: WeddingGraphState, context: NavigationContext) {
    if (graph.loading) return IALoading()
    // P0-10: resolve the authorized vendor only. Falling back to the first vendor would show
    // another company's job to make the page look populated.
    val engagement = context.authorizedVendor(graph)
    IASectionList("Home", engagement?.vendorName ?: "No vendor assigned") {
        if (engagement == null) {
            IACard(
                "No vendor assigned",
                "This account is not linked to a vendor on the active wedding, so no job can be shown."
            )
        } else {
            IACard("Today's job", "${engagement.serviceCategory} • ${engagement.serviceArea}", engagement.expectedTime, engagement.state.title)
            graph.wedding?.let { IACard("Wedding", it.coupleNames, it.venueName) }
            IACard(
                "Outstanding documents",
                "Contract and payment state are not exposed by the native contract yet",
                "Not recorded"
            )
        }
    }
}

@Composable
private fun VendorMoreSection(
    section: String,
    sessionViewModel: SessionViewModel,
    appViewModel: AppViewModel,
    context: NavigationContext
) {
    val graph = rememberWeddingGraph(appViewModel, context)
    when (section) {
        // The vendor catalog previously listed an invented public-liability policy, an invented
        // tax clearance certificate and an invented rate sheet, all marked "Verified". Against a
        // real wedding those read as facts about a real business. Replaced with the vendor and
        // service-engagement rows the graph actually holds.
        "Services", "Company Profile" -> VendorServicesSection(graph, context)
        "Settings" -> SettingsScreen(sessionViewModel = sessionViewModel)
        "Account" -> AccountPrivacyScreen()
        "Support" -> IASectionList("Support", "Vendor support") {
            IACard("Contact support", "support@wewed.pro")
        }
        "Contracts", "Payments", "Files" -> IAUnsupportedSection(
            section,
            "No native vendor $section contract exists yet. Recorded state is shown only where the repository provides it.",
            context.environment
        )
        else -> IAUnsupportedSection(section, "This section is not wired yet.", context.environment)
    }
}

// MARK: - Gate Team Shell — Scan | Admissions | Guests | Incidents | More
@Composable
fun UsherShell(
    sessionViewModel: SessionViewModel,
    appViewModel: AppViewModel,
    context: NavigationContext,
    pendingDeepLink: NativeDeepLink? = null,
    onDeepLinkHandled: (() -> Unit)? = null,
    onOpenPersonaPicker: (() -> Unit)? = null
) {
    var isScannerOpen by remember { mutableStateOf(false) }
    if (isScannerOpen) {
        UsherScannerScreen(appViewModel = appViewModel, onClose = { isScannerOpen = false })
        return
    }

    val sectionMemory = rememberWorkspaceSectionMemory()
    RoleShellScaffold(
        context = context,
        onSwitchPersona = onOpenPersonaPicker,
        pendingDeepLink = pendingDeepLink,
        sectionMemory = sectionMemory,
        onDeepLinkHandled = onDeepLinkHandled
    ) { destination, ctx ->
        val graph = rememberWeddingGraph(appViewModel, ctx)
        when (destination.id) {
            "scan" -> GateScanContent(ctx) { isScannerOpen = true }
            "admissions" -> WorkspaceSurface(destination, "gate", ctx, sectionMemory) { section ->
                GateAdmissionsSection(section, graph, ctx.environment)
            }
            "guests" -> GateGuestLookup(graph)
            "incidents" -> WorkspaceSurface(destination, "gate", ctx, sectionMemory) { section ->
                GateIncidentsSection(section, ctx)
            }
            "more" -> WorkspaceSurface(destination, "gate", ctx, sectionMemory) { section ->
                GateMoreSection(section, graph, ctx)
            }
            else -> IAUnsupportedSection(destination.label, "Unknown destination.", ctx.environment)
        }
    }
}

@Composable
private fun GateScanContent(context: NavigationContext, onOpenScanner: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(WeddingIdentityPalette.Ivory)
            .padding(24.dp)
            .testTag("gate-scan-surface"),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally
    ) {
        Text(
            "Gate scanning",
            color = WeddingIdentityPalette.Ink,
            fontSize = 20.sp
        )
        Spacer(Modifier.height(6.dp))
        Text(
            context.activeGateId ?: "Gate assignment not set",
            color = WeddingIdentityPalette.Muted,
            fontSize = 12.sp
        )
        Spacer(Modifier.height(18.dp))
        Button(
            onClick = onOpenScanner,
            modifier = Modifier.testTag("gate-open-scanner"),
            colors = ButtonDefaults.buttonColors(containerColor = WeddingIdentityPalette.ChampagneDeep)
        ) {
            Text("Open scanner")
        }
    }
}

@Composable
private fun GateIncidentsSection(section: String, context: NavigationContext) {
    // Incidents have no native contract yet; the taxonomy is present so the workspace is
    // navigable, but no incident record is invented (playbook §11).
    IAUnsupportedSection(
        section,
        "No incident has been recorded under \"$section\" for this gate. Incident capture has no native contract yet.",
        context.environment
    )
}

@Composable
private fun GateMoreSection(
    section: String,
    graph: WeddingGraphState,
    context: NavigationContext
) {
    when (section) {
        "Gate Assignment" -> IASectionList("Gate Assignment", context.activeWeddingTitle) {
            IACard(
                "Assigned gate",
                "Current gate for this actor",
                context.activeGateId ?: "Not assigned",
                testTag = "gate-assignment"
            )
        }
        "Offline Status", "Sync Status" -> WeddingDaySection("Offline Status", graph, context.environment)
        "Venue Map" -> WeddingDaySection("Venue", graph, context.environment)
        "Account" -> AccountPrivacyScreen()
        "Help" -> IASectionList("Help", "Gate team support") {
            IACard("Contact coordinator", "Escalate from Incidents")
        }
        else -> IAUnsupportedSection(section, "This section is not wired yet.", context.environment)
    }
}

// MARK: - Guest Shell — Home | Invitation | Pass | Wedding Day | More
@Composable
fun GuestShell(
    sessionViewModel: SessionViewModel,
    appViewModel: AppViewModel,
    context: NavigationContext,
    pendingDeepLink: NativeDeepLink? = null,
    onDeepLinkHandled: (() -> Unit)? = null,
    onOpenPersonaPicker: (() -> Unit)? = null
) {
    val sectionMemory = rememberWorkspaceSectionMemory()
    RoleShellScaffold(
        context = context,
        onSwitchPersona = onOpenPersonaPicker,
        pendingDeepLink = pendingDeepLink,
        sectionMemory = sectionMemory,
        onDeepLinkHandled = onDeepLinkHandled
    ) { destination, ctx ->
        val graph = rememberWeddingGraph(appViewModel, ctx)
        when (destination.id) {
            "home" -> GuestHomeContent(graph, ctx)
            "invitation" -> WorkspaceSurface(destination, "guest", ctx, sectionMemory) { section ->
                GuestInvitationSection(section, appViewModel, graph, ctx)
            }
            "pass" -> WorkspaceSurface(destination, "guest", ctx, sectionMemory) { section ->
                GuestPassSection(section, appViewModel, graph, ctx)
            }
            "wedding_day" -> WorkspaceSurface(destination, "guest", ctx, sectionMemory) { section ->
                GuestWeddingDaySection(section, graph, ctx)
            }
            "more" -> WorkspaceSurface(destination, "guest", ctx, sectionMemory) { section ->
                GuestMoreSection(section, graph, ctx)
            }
            else -> IAUnsupportedSection(destination.label, "Unknown destination.", ctx.environment)
        }
    }
}

@Composable
private fun GuestHomeContent(graph: WeddingGraphState, context: NavigationContext) {
    if (graph.loading) return IALoading()
    IASectionList(graph.wedding?.coupleNames ?: context.activeWeddingTitle, graph.wedding?.date) {
        graph.wedding?.let {
            IACard("Venue", it.venueName, null, testTag = "guest-home-venue")
            IACard("Where", "${it.city}, ${it.country}")
        }
        graph.announcements.firstOrNull()?.let {
            IACard("Announcement", it.message, null, it.urgency.name)
        }
        context.boundGuest(graph)?.let {
            IACard("Your invitation", it.name, "Party of ${it.partySize}", testTag = "guest-home-identity-${it.id}")
        }
        IACard("Your pass", "Open the Pass workspace for your QR and table", null)
    }
}

@Composable
private fun GuestInvitationSection(
    section: String,
    appViewModel: AppViewModel,
    graph: WeddingGraphState,
    context: NavigationContext
) {
    if (graph.loading) return IALoading()
    // P0-4: "me" is the guest the credential resolved to, not the first row in the roster.
    val self = context.boundGuest(graph)
    if (self == null) {
        return IAUnsupportedSection(
            section,
            "No guest invitation is bound to this session, so no invitation details can be shown.",
            context.environment
        )
    }
    when (section) {
        "Invitation" -> IASectionList("Invitation", graph.wedding?.coupleNames) {
            graph.wedding?.let {
                IACard(it.coupleNames, "${it.venueName} • ${it.city}", it.date)
            }
            IACard("Invited", self.name, "Party of ${self.partySize}", testTag = "guest-identity-${self.id}")
        }
        // A guest's OWN RSVP record. The repository already held every one of these fields — the
        // Couple's worksheet was rendering them while the guest's own invitation said
        // "unsupported" about their own answer. Data existed, native knew about it, one surface
        // used it and the other showed a shell.
        //
        // canSeePrivateDetail is true here because this is the guest's own record, reached
        // through their own credential. It is not the roster.
        "RSVP" -> GuestRsvpDetailSection(
            guest = self,
            rsvp = graph.rsvpDetails[self.id],
            contact = graph.guestContacts[self.id],
            canSeePrivateDetail = true,
            testTagPrefix = "guest-rsvp"
        )
        "Party Members" -> IASectionList("Party Members", self.householdName) {
            val detail = graph.rsvpDetails[self.id]
            IACard(self.householdName ?: self.name, "Party of ${self.partySize}")
            if (detail?.plusOne == true) {
                IACard(
                    title = "Plus one",
                    subtitle = detail.plusOneName ?: "Confirmed, no name recorded",
                    status = detail.plusOneMeal?.replaceFirstChar { it.uppercase() },
                    testTag = "guest-party-plus-one"
                )
            }
            if ((detail?.kidsCount ?: 0) > 0) {
                IACard(
                    title = "Children",
                    subtitle = "${detail?.kidsCount} attending",
                    testTag = "guest-party-kids"
                )
            }
        }
        "Dietary / Accessibility" -> {
            val detail = graph.rsvpDetails[self.id]
            IASectionList("Dietary / Accessibility", "Your requirements") {
                if (detail?.hasDietaryRequirement == true) {
                    IACard(
                        title = "Dietary and accessibility",
                        subtitle = detail.dietaryNotes,
                        testTag = "guest-dietary-notes"
                    )
                } else {
                    IACard(
                        title = "Nothing recorded",
                        subtitle = "You haven't told the couple about any dietary or accessibility needs.",
                        testTag = "guest-dietary-empty"
                    )
                }
                detail?.mealChoice?.takeIf { it.isNotBlank() }?.let {
                    IACard("Meal choice", it.replaceFirstChar { c -> c.uppercase() }, testTag = "guest-meal")
                }
            }
        }
        "Message to Couple" -> {
            val detail = graph.rsvpDetails[self.id]
            IASectionList("Message to Couple", "What you sent with your RSVP") {
                if (detail?.hasMessage == true) {
                    IACard("Your message", detail.message, testTag = "guest-rsvp-message")
                } else {
                    IACard(
                        title = "No message sent",
                        subtitle = "You didn't leave a message with your RSVP.",
                        testTag = "guest-rsvp-message-empty"
                    )
                }
                if (detail?.hasSongRequest == true) {
                    IACard("Your song request", detail.songRequests, testTag = "guest-song-request")
                }
            }
        }
        // Contributions ARE a real Wewed capability with a real API; mobile has no guest-facing
        // contract for submitting or viewing one's own. Named rather than called unsupported.
        "Contribution / Memory" -> IACapabilityNotConnected(
            capability = "Contribution / Memory",
            webSource = "/api/weddings/[slug]/contributions (guest contribution submission)",
            detail = "Guests can leave a blessing, memory or song on Wewed web. Mobile has no " +
                "guest-facing contribution contract yet.",
            testTagPrefix = "guest-contribution"
        )
        else -> IAUnsupportedSection(section, "This invitation section is not wired yet.", context.environment)
    }
}

@Composable
private fun GuestPassSection(
    section: String,
    appViewModel: AppViewModel,
    graph: WeddingGraphState,
    context: NavigationContext
) {
    when (section) {
        // P0-5: the pass is fetched with THIS actor's credential; there is no default guest.
        "Wedding Pass", "QR" -> WeddingReferencePassScreen(
            appViewModel = appViewModel,
            onOpenScanner = {},
            passToken = context.activePassToken
        )
        "Party Size", "Table", "Admission State" -> {
            if (graph.loading) return IALoading()
            val self = context.boundGuest(graph)
                ?: return IAUnsupportedSection(
                    section,
                    "No guest invitation is bound to this session.",
                    context.environment
                )
            IASectionList(section, self.name) {
                when (section) {
                    "Party Size" -> IACard("Party size", self.householdName ?: "—", "${self.partySize}", testTag = "guest-party-${self.id}")
                    "Table" -> IACard("Table", self.tableName ?: "Not yet assigned", self.tableNumber?.toString(), testTag = "guest-table-${self.id}")
                    else -> IACard(
                        "Admission",
                        if (self.checkedIn) "Admitted at the gate" else "Not yet admitted",
                        "${self.checkedInCount}/${self.partySize}",
                        testTag = "guest-admission-${self.id}"
                    )
                }
            }
        }
        "Open in Maps" -> IASectionList("Open in Maps", graph.wedding?.venueName) {
            graph.wedding?.let { IACard(it.venueName, it.venueAddress, "Open") }
        }
        else -> IAUnsupportedSection(section, "This pass section is not wired yet.", context.environment)
    }
}

@Composable
private fun GuestWeddingDaySection(
    section: String,
    graph: WeddingGraphState,
    context: NavigationContext
) {
    when (section) {
        "Gallery / Live Wall" -> LiveWallScreen(graph.wallMessages)
        "Contacts" -> IAUnsupportedSection(
            "Contacts",
            "No guest-visible contact directory exists in the native contract.",
            context.environment
        )
        else -> WeddingDaySection(section, graph, context.environment, boundGuestId = context.activeGuestId)
    }
}

@Composable
private fun GuestMoreSection(
    section: String,
    graph: WeddingGraphState,
    context: NavigationContext
) {
    when (section) {
        // Our Story and Gallery are published content, and this wedding has published both. The
        // guest surface previously declared them unpublished without ever reading the graph.
        "Our Story" -> WeddingContentSectionView(graph.section("story"), "guest-more-story")
        "Gallery" -> GalleryContentSection(
            section = graph.section("gallery"),
            bundledMedia = BundledWeddingMedia.names,
            testTagPrefix = "guest-more-gallery"
        )
        "Account", "Privacy" -> AccountPrivacyScreen()
        "Help" -> IASectionList("Help", "Guest support") {
            IACard("Contact the wedding team", "support@wewed.pro")
        }
        // Contributions are guest blessings, wishes, stories and memories — not monetary gifts.
        // No gift or honeymoon-fund contract exists in this wedding's graph, so the section says
        // that rather than presenting memories as gift information.
        "Contribution / Gift Info" -> IAUnsupportedSection(
            section,
            "No gift or contribution fund is configured for this wedding.",
            context.environment
        )
        else -> IAUnsupportedSection(section, "This section is not wired yet.", context.environment)
    }
}

// MARK: - Admin Shell — Dashboard | Cases | Accounts | Audit | More
@Composable
fun AdminShell(
    sessionViewModel: SessionViewModel,
    appViewModel: AppViewModel,
    context: NavigationContext,
    pendingDeepLink: NativeDeepLink? = null,
    onDeepLinkHandled: (() -> Unit)? = null,
    onOpenPersonaPicker: (() -> Unit)? = null
) {
    // P0-13: Admin reads a system projection. The wedding graph is only consulted for surfaces
    // that genuinely drill into a wedding.
    val adminRepository = remember(appViewModel) {
        ShadowAdminSystemRepository(appViewModel.repository, appViewModel.dataEnvironment)
    }
    val sectionMemory = rememberWorkspaceSectionMemory()
    // Admin is system-scoped, so its access context is read from the source directly rather than
    // through a wedding-bound graph that a global administrative session never loads. Without
    // this, the audit stream reported "Nothing recorded" — the one thing that is certainly untrue,
    // because production holds a real wedding-scoped trail that this reader is not yet authorized
    // to read as an administrator.
    var adminAccess by remember(appViewModel) {
        mutableStateOf<pro.wewed.app.models.AdminAccessContext?>(null)
    }
    LaunchedEffect(appViewModel) {
        adminAccess = runCatching { appViewModel.repository.adminAccessContext() }.getOrNull()
    }
    RoleShellScaffold(
        context = context,
        onSwitchPersona = onOpenPersonaPicker,
        pendingDeepLink = pendingDeepLink,
        sectionMemory = sectionMemory,
        onDeepLinkHandled = onDeepLinkHandled
    ) { destination, ctx ->
        val graph = rememberWeddingGraph(appViewModel, ctx)
        when (destination.id) {
            "dashboard" -> AdminDashboardContent(adminRepository, ctx)
            "cases" -> IAUnsupportedSection(
                "Cases",
                "No native support-case contract exists yet. No cases are fabricated.",
                ctx.environment
            )
            "accounts" -> WorkspaceSurface(destination, "admin", ctx, sectionMemory) { section ->
                AdminAccountsSection(section, ctx)
            }
            "audit" -> WorkspaceSurface(destination, "admin", ctx, sectionMemory) { section ->
                AdminAuditSection(section, graph, ctx.environment, adminAccess)
            }
            "more" -> WorkspaceSurface(destination, "admin", ctx, sectionMemory) { section ->
                AdminMoreSection(section, sessionViewModel, adminRepository, graph, ctx)
            }
            else -> IAUnsupportedSection(destination.label, "Unknown destination.", ctx.environment)
        }
    }
}

@Composable
private fun AdminAccountsSection(section: String, context: NavigationContext) {
    // Account administration has no native contract; showing invented account rows here would be
    // a privileged data fabrication, so the boundary is stated instead (playbook §13).
    IAUnsupportedSection(
        section,
        "Account administration has no native contract yet. No $section records are read or fabricated in this environment.",
        context.environment
    )
}

@Composable
private fun AdminMoreSection(
    section: String,
    sessionViewModel: SessionViewModel,
    adminRepository: AdminSystemRepository,
    graph: WeddingGraphState,
    context: NavigationContext
) {
    when (section) {
        "System Health" -> AdminDashboardContent(adminRepository, context)
        "Announcements" -> WeddingDaySection("Announcements", graph, context.environment)
        "Admin Profile" -> AccountPrivacyScreen()
        "Help" -> IASectionList("Help", "Administrator support") {
            IACard("Internal escalation", "Use Cases to record an escalation")
        }
        "Integrations", "Templates", "Configuration" -> IAUnsupportedSection(
            section,
            "No native administrative $section contract exists yet.",
            context.environment
        )
        else -> IAUnsupportedSection(section, "This section is not wired yet.", context.environment)
    }
}

// MARK: - Couple Shell — Home | Plan | Guests | Wedding Day | More
@Composable
fun CoupleShell(
    sessionViewModel: SessionViewModel,
    appViewModel: AppViewModel,
    context: NavigationContext,
    onOpenScanner: () -> Unit,
    pendingDeepLink: NativeDeepLink? = null,
    onDeepLinkHandled: (() -> Unit)? = null,
    onOpenPersonaPicker: (() -> Unit)? = null
) {
    val sectionMemory = rememberWorkspaceSectionMemory()
    // Internal navigation requests travel the same gated path as an external deep link, so an
    // in-app jump is authorized exactly like a link (IA V2 §13.4).
    var internalRequest by remember { mutableStateOf<NativeDeepLink?>(null) }

    RoleShellScaffold(
        context = context,
        onSwitchPersona = onOpenPersonaPicker,
        pendingDeepLink = pendingDeepLink ?: internalRequest,
        sectionMemory = sectionMemory,
        onDeepLinkHandled = {
            internalRequest = null
            onDeepLinkHandled?.invoke()
        }
    ) { destination, ctx ->
        val graph = rememberWeddingGraph(appViewModel, ctx)
        when (destination.id) {
            "home" -> WeddingReferenceHomeScreen(appViewModel) {
                // P0-11: the notifications control opens the couple's own pending-RSVP list,
                // never a specific guest's invitation.
                internalRequest = NativeDeepLink.Workspace(
                    weddingId = ctx.activeWeddingId,
                    destinationId = "guests",
                    section = "RSVP"
                )
            }
            "plan" -> WorkspaceSurface(destination, "couple", ctx, sectionMemory) { section ->
                CouplePlanSection(section, appViewModel, ctx, sectionMemory)
            }
            "guests" -> WorkspaceSurface(destination, "couple", ctx, sectionMemory) { section ->
                if (section == "Guest List") {
                    WeddingReferenceGuestsScreen(appViewModel)
                } else {
                    CoupleGuestsSection(section, graph, ctx.environment)
                }
            }
            "wedding_day" -> WorkspaceSurface(destination, "couple", ctx, sectionMemory) { section ->
                WeddingDaySection(section, graph, ctx.environment, boundGuestId = ctx.activeGuestId) {
                    WeddingReferencePassScreen(
                        appViewModel = appViewModel,
                        onOpenScanner = onOpenScanner,
                        passToken = ctx.activePassToken
                    )
                }
            }
            "more" -> WeddingReferenceMoreScreen(appViewModel)
            else -> IAUnsupportedSection(destination.label, "Unknown destination.", ctx.environment)
        }
    }
}

@Composable
private fun CouplePlanSection(
    section: String,
    appViewModel: AppViewModel,
    context: NavigationContext,
    sectionMemory: WorkspaceSectionMemory
) {
    // The couple's Plan worksheets read the same repositories as the planner Workspace —
    // one canonical pipeline, two role presentations (IA V2 §13.3).
    when (section) {
        // IA V2 owns Level-2: the Overview surface reports which section a module represents and
        // the shell moves the selection, rather than the screen navigating internally.
        "Overview" -> WeddingReferencePlannerScreen(appViewModel) { target ->
            sectionMemory.select(context, "plan", target)
        }
        "Tasks" -> TasksDestination(appViewModel) {}
        "Budget" -> ShadowBudgetDestination(appViewModel) {}
        "Contributions" -> if (context.environment == NativeDataEnvironment.PRODUCTION) {
            IAUnsupportedSection("Contributions", "The mature contributions/funding-attribution domain is not connected to native production yet. No empty contribution ledger is inferred.", context.environment)
        } else ShadowContributionsDestination(appViewModel) {}
        "Vendors" -> ShadowVendorsDestination(appViewModel) {}
        "Seating" -> ShadowSeatingDestination(appViewModel) {}
        "Timeline" -> ShadowTimelineDestination(appViewModel) {}
        "Documents" -> if (context.environment == NativeDataEnvironment.PRODUCTION) {
            IAUnsupportedSection("Documents", "The mature contracts/vault document domain is not connected to native production yet. No empty document vault is inferred.", context.environment)
        } else ShadowDocumentsDestination(appViewModel) {}
        else -> IAUnsupportedSection(section, "This worksheet is not wired yet.", context.environment)
    }
}
