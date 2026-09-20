import SwiftUI

/// IA V2 role shells.
///
/// Each shell is now a thin binding of the shared navigation contract to this role's existing
/// views; the tab bar itself lives in `RoleShellScaffold`. Views are reused, not rebuilt —
/// IA V2 §21 is explicit that this is an upgrade of the existing product, not a reset.

/// Owns the canonical wedding graph for a role shell and reloads it when the active wedding
/// changes, so no workspace can keep rendering a previous wedding's rows (IA V2 §13.2).
struct RoleWorkspaceHost<Content: View>: View {
    @EnvironmentObject private var appState: AppState
    let context: NavigationContext
    @StateObject private var graph = WeddingGraphState()
    @ViewBuilder let content: (WeddingGraphState) -> Content

    var body: some View {
        content(graph)
            .task(id: context.activeWeddingId) {
                appState.bindActiveWedding(context.activeWeddingId)
                await graph.load(source: appState.repository, weddingId: context.activeWeddingId)
            }
    }
}

// MARK: - Planner Shell — Workspace | Clients | Daily Ops | Wedding Day | More
public struct PlannerShellView: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var appState: AppState
    let context: NavigationContext
    var onSwitchPersona: (() -> Void)?
    var pendingDeepLink: NativeDeepLink?
    var onDeepLinkHandled: (() -> Void)?
    @StateObject private var sectionMemory = WorkspaceSectionMemory()

    public init(
        context: NavigationContext,
        onSwitchPersona: (() -> Void)? = nil,
        pendingDeepLink: NativeDeepLink? = nil,
        onDeepLinkHandled: (() -> Void)? = nil
    ) {
        self.context = context
        self.onSwitchPersona = onSwitchPersona
        self.pendingDeepLink = pendingDeepLink
        self.onDeepLinkHandled = onDeepLinkHandled
    }

    public var body: some View {
        RoleShellScaffold(
            context: context,
            onSwitchPersona: onSwitchPersona,
            pendingDeepLink: pendingDeepLink,
            sectionMemory: sectionMemory,
            onDeepLinkHandled: onDeepLinkHandled
        ) { destination, ctx in
            RoleWorkspaceHost(context: ctx) { graph in
                switch destination.id {
                case "workspace":
                    WorkspaceSurface(destination: destination, testIdPrefix: "planner", context: ctx, sectionMemory: sectionMemory) { section in
                        PlannerWorkspaceSection(section: section, context: ctx, sectionMemory: sectionMemory)
                    }
                case "clients":
                    WorkspaceSurface(destination: destination, testIdPrefix: "planner", context: ctx, sectionMemory: sectionMemory) { section in
                        PlannerClientsSection(section: section, context: ctx, graph: graph)
                    }
                case "daily_ops":
                    WorkspaceSurface(destination: destination, testIdPrefix: "planner", context: ctx, sectionMemory: sectionMemory) { section in
                        PlannerDailyOpsSection(section: section, graph: graph, context: ctx)
                    }
                case "wedding_day":
                    WorkspaceSurface(destination: destination, testIdPrefix: "planner", context: ctx, sectionMemory: sectionMemory) { section in
                        PlannerWeddingDaySection(section: section, graph: graph, context: ctx)
                    }
                case "more":
                    WorkspaceSurface(destination: destination, testIdPrefix: "planner", context: ctx, sectionMemory: sectionMemory) { section in
                        PlannerMoreSection(section: section, context: ctx, sectionMemory: sectionMemory, graph: graph)
                    }
                default:
                    IAUnsupportedSection(destination.label, "Unknown destination.", ctx.environment)
                }
            }
        }
    }
}

struct PlannerWorkspaceSection: View {
    let section: String
    let context: NavigationContext
    @ObservedObject var sectionMemory: WorkspaceSectionMemory

    var body: some View {
        // Each worksheet reads the same selected wedding graph (IA V2 §5 Workspace).
        switch section {
        // IA V2 owns Level-2 here too; the Overview surface only reports the target section.
        case "Overview":
            WeddingReferencePlannerView { target in
                sectionMemory.select(context, "workspace", target)
            }
        case "Tasks": PlannerTasksView()
        case "Budget": ShadowPlannerBudgetView()
        case "Guests": PlannerGuestsBridgeView()
        case "Vendors": ShadowPlannerVendorsView()
        case "Contributions": ShadowPlannerContributionsView()
        case "Seating": ShadowPlannerSeatingView()
        case "Timeline": ShadowPlannerTimelineView()
        case "Documents": ShadowPlannerDocumentsView()
        default: IAUnsupportedSection(section, "This worksheet is not wired yet.", context.environment)
        }
    }
}

struct PlannerClientsSection: View {
    let section: String
    let context: NavigationContext
    @ObservedObject var graph: WeddingGraphState

    var body: some View {
        // The native contract exposes exactly one planner engagement: the active wedding. Other
        // client states are not invented (playbook §8 — "Never fabricate a PlannerEngagement").
        switch section {
        case "Active Weddings":
            // P0-13: the Private Real Shadow snapshot contains no PlannerEngagement. The planner
            // relationship is an accepted enquiry against a profile whose status is suspended, so
            // calling it an "active engagement" would invent a production relationship.
            IASectionList("Active Weddings", "Weddings in your planner scope") {
                IACard(
                    context.activeWeddingTitle,
                    "Accepted enquiry — no planner engagement record exists",
                    trailing: context.assignment?.isShadowTestAccess == true ? "Test access only" : nil,
                    status: "Shadow test authorization",
                    testId: "planner-active-client"
                )
                IACard(
                    "Engagement record",
                    "No PlannerEngagement or WeddingMembership exists for this wedding",
                    trailing: "Absent"
                )
            }
        // One concept must have one route. This pointed at a static legacy screen while a
        // repository-backed Client Profile existed in Planner -> More.
        case "Client Profiles":
            PlannerClientProfileSection(graph: graph)
        default:
            IAUnsupportedSection(
                section,
                "The native planner contract exposes only the active engagement. No \(section) records exist to read, and none are fabricated.",
                context.environment
            )
        }
    }
}

struct PlannerDailyOpsSection: View {
    let section: String
    @ObservedObject var graph: WeddingGraphState
    let context: NavigationContext
    @EnvironmentObject private var appState: AppState
    @State private var dashboard: PlannerDashboardSnapshot?

    var body: some View {
        // Daily Ops is an attention projection over canonical entities — it never copies them
        // into a second model (playbook §15).
        Group {
            if graph.loading {
                IALoading()
            } else {
                switch section {
                case "Today":
                    IASectionList("Today", context.activeWeddingTitle) {
                        ForEach(dashboard?.attentionItems ?? []) { item in
                            IACard(item.title, item.detail, status: "\(item.severity)")
                        }
                        if (dashboard?.attentionItems ?? []).isEmpty {
                            IACard("Nothing needs attention", "No attention items are recorded for this wedding.")
                        }
                    }
                // P0-14: overdue means a due date in the past — not "urgent and unfinished".
                case "Overdue":
                    let overdue = TaskDeadlines.overdue(graph.tasks)
                    let undated = TaskDeadlines.undated(graph.tasks)
                    IASectionList("Overdue", "\(overdue.count) tasks past their due date") {
                        ForEach(overdue) { IACard($0.title, $0.category, trailing: $0.dueDate, status: $0.priority.title) }
                        if overdue.isEmpty { IACard("Nothing overdue", "No task has passed its due date.") }
                        if !undated.isEmpty {
                            IACard(
                                "\(undated.count) open tasks have no due date",
                                "Undated tasks cannot be overdue and are not counted here."
                            )
                        }
                    }
                // P0-14: a date-windowed view, not simply "every open task".
                case "Upcoming Deadlines":
                    let upcoming = TaskDeadlines.upcoming(graph.tasks)
                    IASectionList("Upcoming Deadlines", "\(upcoming.count) tasks due in the next 30 days") {
                        ForEach(upcoming) { IACard($0.title, $0.category, trailing: $0.dueDate, status: $0.priority.title) }
                        if upcoming.isEmpty {
                            IACard("No deadlines in the next 30 days", "Only tasks with a recorded due date appear here.")
                        }
                    }
                case "Vendor Follow-ups":
                    IASectionList("Vendor Follow-ups", "\(graph.vendors.count) vendors") {
                        ForEach(graph.vendors) { IACard($0.vendorName, $0.serviceCategory, trailing: $0.expectedTime, status: $0.state.title) }
                    }
                case "Guest Issues":
                    let pending = graph.guests.filter { $0.rsvpStatus == .pending }
                    IASectionList("Guest Issues", "\(pending.count) households awaiting RSVP") {
                        ForEach(pending) { IACard($0.name, $0.householdName ?? "—", trailing: "Party \($0.partySize)", status: $0.rsvpStatus.title) }
                        if pending.isEmpty { IACard("No outstanding guest issues", "Every household has responded.") }
                    }
                case "Team Activity":
                    IASectionList("Team Activity", "Recent changes on this wedding") {
                        ForEach(dashboard?.recentActivity ?? []) { IACard($0.title, $0.detail, trailing: $0.relativeTime) }
                        if (dashboard?.recentActivity ?? []).isEmpty {
                            IACard("No recorded activity", "No planner activity has been recorded.")
                        }
                    }
                case "Messages":
                    MessagesInboxView()
                default:
                    IAUnsupportedSection(
                        section,
                        "No native approval or payment-action contract exists yet. Budget and contribution state is readable in Workspace; no approval queue is fabricated.",
                        context.environment
                    )
                }
            }
        }
        .task(id: context.activeWeddingId) {
            dashboard = try? await appState.plannerRepository.getDashboard()
        }
    }
}

struct PlannerWeddingDaySection: View {
    let section: String
    @ObservedObject var graph: WeddingGraphState
    let context: NavigationContext

    var body: some View {
        switch section {
        case "Run Sheet":
            WeddingDaySection(section: "Programme", graph: graph, environment: context.environment)
        case "Gate / Admissions":
            GateAdmissionsSection(section: "Checked In", graph: graph, environment: context.environment)
        case "Coordinator Tasks":
            WeddingDaySection(section: "Wedding-day Checklist", graph: graph, environment: context.environment)
        case "Guest Issues":
            GateAdmissionsSection(section: "Not Arrived", graph: graph, environment: context.environment)
        case "Incidents", "Live Notes":
            IAUnsupportedSection(
                section,
                "No native incident or live-note contract exists yet. Nothing is recorded, so nothing is displayed.",
                context.environment
            )
        default:
            WeddingDaySection(section: section, graph: graph, environment: context.environment)
        }
    }
}

struct PlannerMoreSection: View {
    let section: String
    let context: NavigationContext
    @ObservedObject var sectionMemory: WorkspaceSectionMemory
    // Every route below reads the wedding graph. The six legacy fixture destinations
    // (Client Profile, Team Hub, Invitations & QR, Intelligence, Media Archive, Vendor Catalog)
    // used to render static copy here — insurance lines, rate sheets, "AI active" claims — which
    // is why Private Real UAT could show a real wedding alongside invented operational facts.
    @ObservedObject var graph: WeddingGraphState

    var body: some View {
        switch section {
        case "Client Profile": PlannerClientProfileSection(graph: graph)
        case "Invitations & QR": InvitationsQrSection(destinations: graph.qrDestinations)
        case "Intelligence": PlannerIntelligenceSection(graph: graph)
        case "Team Hub": PlannerTeamHubSection(graph: graph)
        case "Files / Documents": PlannerMediaArchiveSection(graph: graph)
        case "Planner Actions": PlannerActionsSection(context: context, sectionMemory: sectionMemory, graph: graph)
        case "Settings": SettingsView()
        case "Account": AccountPrivacyView()
        case "Help & Support":
            IASectionList("Help & Support", "Wewed planner support") {
                IACard("Contact support", "support@wewed.pro")
            }
        default:
            IAUnsupportedSection(section, "This section is not wired yet.", context.environment)
        }
    }
}

/// IA V2 §5 — Planner Actions are contextual operations, deliberately not bottom tabs.
///
/// P0-11: an action either performs a real native operation or states plainly that it is not
/// connected. Rendering an inert card that looks tappable claims a capability the app does not have.
struct PlannerActionsSection: View {
    let context: NavigationContext
    @ObservedObject var sectionMemory: WorkspaceSectionMemory
    @ObservedObject var graph: WeddingGraphState
    @EnvironmentObject private var appState: AppState
    @State private var lastResult: String?
    @State private var busy = false
    @State private var showImports = false

    private static let unsupported: [(String, String)] = [
        ("Print / Arrange / Select", "Printable guest, seating and programme output has no native contract yet."),
        ("Templates", "Planning templates are not exposed to the native client yet."),
        ("Export", "No native export contract exists for the wedding graph."),
        ("Import", "Guest and task import is not available natively; no import endpoint is wired."),
        ("Edit Wedding Details", "Wedding identity is read-only during Shadow qualification; no native write path exists.")
    ]

    private var worksheets: [String] {
        IANavigationContract.forRole(context.activeRole).sections("workspace")
    }

    var body: some View {
        IASectionList("Planner Actions", "Contextual operations for \(context.activeWeddingTitle)") {
            if let lastResult {
                IACard("Last action", lastResult, testId: "planner-action-result")
            }

            // --- Implemented natively ---
            IAActionRow(
                title: "Refresh",
                subtitle: "Re-read the active wedding graph from the repository",
                enabled: !busy,
                testId: "planner-action-refresh"
            ) {
                busy = true
                Task {
                    do {
                        let scoped = try await appState.repository.forWedding(context.activeWeddingId)
                        let tasks = try await scoped.getTasks().count
                        let guests = try await scoped.getGuests().count
                        lastResult = "\(tasks) tasks, \(guests) guest records reloaded"
                    } catch {
                        lastResult = "Refresh failed: \(error.localizedDescription)"
                    }
                    busy = false
                }
            }

            IAActionRow(
                title: "Switch Worksheet",
                subtitle: "Jump straight to a Workspace worksheet",
                enabled: !worksheets.isEmpty,
                testId: "planner-action-switch-worksheet"
            ) {
                // Real navigation: selects the next worksheet in the Workspace section memory.
                guard let first = worksheets.first else { return }
                let current = sectionMemory.selected(context, "workspace", default: first)
                let index = worksheets.firstIndex(of: current) ?? 0
                let next = worksheets[(index + 1) % worksheets.count]
                sectionMemory.select(context, "workspace", next)
                lastResult = "Workspace worksheet set to \(next)"
            }

            // Recent Imports is no longer "not connected": production holds a real ImportJob
            // history for this wedding, and it is rendered from that history rather than declared
            // absent.
            IAActionRow(
                title: "Recent Imports",
                subtitle: graph.importJobs.isEmpty
                    ? "No imports are recorded for this wedding"
                    : "\(graph.importJobs.count) imports recorded",
                enabled: !graph.importJobs.isEmpty,
                testId: "planner-action-recent-imports"
            ) {
                showImports.toggle()
            }

            if showImports {
                RecentImportsSection(jobs: graph.importJobs)
            }

            // --- Honestly unsupported ---
            ForEach(Self.unsupported, id: \.0) { action in
                IAUnsupportedActionRow(
                    title: action.0,
                    reason: action.1,
                    testId: "planner-action-\(action.0.iaSlug)"
                )
            }
        }
    }
}

// MARK: - Coordinator Shell — Today | Run Sheet | Team | Wedding Day | More
public struct CoordinatorShellView: View {
    @EnvironmentObject private var session: SessionStore
    let context: NavigationContext
    var onSwitchPersona: (() -> Void)?
    var pendingDeepLink: NativeDeepLink?
    var onDeepLinkHandled: (() -> Void)?
    @StateObject private var sectionMemory = WorkspaceSectionMemory()

    public init(
        context: NavigationContext,
        onSwitchPersona: (() -> Void)? = nil,
        pendingDeepLink: NativeDeepLink? = nil,
        onDeepLinkHandled: (() -> Void)? = nil
    ) {
        self.context = context
        self.onSwitchPersona = onSwitchPersona
        self.pendingDeepLink = pendingDeepLink
        self.onDeepLinkHandled = onDeepLinkHandled
    }

    public var body: some View {
        RoleShellScaffold(
            context: context,
            onSwitchPersona: onSwitchPersona,
            pendingDeepLink: pendingDeepLink,
            sectionMemory: sectionMemory,
            onDeepLinkHandled: onDeepLinkHandled
        ) { destination, ctx in
            RoleWorkspaceHost(context: ctx) { graph in
                switch destination.id {
                case "today":
                    CoordinatorTodayContent(graph: graph, context: ctx)
                case "run_sheet":
                    WeddingDaySection(section: "Programme", graph: graph, environment: ctx.environment)
                case "team":
                    WorkspaceSurface(destination: destination, testIdPrefix: "coordinator", context: ctx, sectionMemory: sectionMemory) { section in
                        CoordinatorTeamSection(section: section, graph: graph, context: ctx)
                    }
                case "wedding_day":
                    WorkspaceSurface(destination: destination, testIdPrefix: "coordinator", context: ctx, sectionMemory: sectionMemory) { section in
                        CoordinatorWeddingDaySection(section: section, graph: graph, context: ctx)
                    }
                case "more":
                    WorkspaceSurface(destination: destination, testIdPrefix: "coordinator", context: ctx, sectionMemory: sectionMemory) { section in
                        CoordinatorMoreSection(section: section, graph: graph, context: ctx)
                    }
                default:
                    IAUnsupportedSection(destination.label, "Unknown destination.", ctx.environment)
                }
            }
        }
    }
}

struct CoordinatorTodayContent: View {
    @ObservedObject var graph: WeddingGraphState
    let context: NavigationContext

    var body: some View {
        if graph.loading {
            IALoading()
        } else {
            IASectionList("Today", context.activeWeddingTitle) {
                if let next = graph.wedding?.programme.first {
                    IACard("Next milestone", "\(next.title) • \(next.location)", trailing: next.time, testId: "coordinator-next-milestone")
                }
                IACard("Open tasks", "Outstanding wedding tasks", trailing: "\(graph.tasks.filter { $0.status != .done }.count)")
                let lateVendors = graph.vendors.filter { $0.state == .notRecorded || $0.state == .scheduled }
                IACard("Vendors not yet on site", "Awaiting arrival", trailing: "\(lateVendors.count)")
                IACard("Households not arrived", "Gate admission state", trailing: "\(graph.guests.filter { $0.checkedInCount == 0 }.count)")
            }
        }
    }
}

struct CoordinatorTeamSection: View {
    let section: String
    @ObservedObject var graph: WeddingGraphState
    let context: NavigationContext

    var body: some View {
        if graph.loading {
            IALoading()
        } else {
            switch section {
            case "Tasks":
                IASectionList("Team Tasks", "\(graph.tasks.count) tasks on this wedding") {
                    ForEach(graph.tasks) { IACard($0.title, $0.category, trailing: $0.dueDate, status: $0.status.title) }
                }
            case "Vendors":
                IASectionList("Vendors", "\(graph.vendors.count) vendors") {
                    ForEach(graph.vendors) { IACard($0.vendorName, $0.serviceCategory, trailing: $0.expectedTime, status: $0.state.title) }
                }
            default:
                IAUnsupportedSection(
                    section,
                    "No native team-roster contract exists yet. Assignments are not invented (playbook §12).",
                    context.environment
                )
            }
        }
    }
}

struct CoordinatorWeddingDaySection: View {
    let section: String
    @ObservedObject var graph: WeddingGraphState
    let context: NavigationContext

    var body: some View {
        switch section {
        case "Gate", "Admissions":
            GateAdmissionsSection(section: "Checked In", graph: graph, environment: context.environment)
        case "Venue Zones":
            WeddingDaySection(section: "Venue", graph: graph, environment: context.environment)
        case "Incidents":
            IAUnsupportedSection(
                "Incidents",
                "No native incident contract exists yet. No incident records are fabricated.",
                context.environment
            )
        default:
            WeddingDaySection(section: section, graph: graph, environment: context.environment)
        }
    }
}

struct CoordinatorMoreSection: View {
    let section: String
    @ObservedObject var graph: WeddingGraphState
    let context: NavigationContext

    var body: some View {
        switch section {
        case "Maps": WeddingDaySection(section: "Venue", graph: graph, environment: context.environment)
        case "Offline": WeddingDaySection(section: "Offline Status", graph: graph, environment: context.environment)
        case "Account": AccountPrivacyView()
        case "Support":
            IASectionList("Support", "Coordinator support") {
                IACard("Contact support", "support@wewed.pro")
            }
        default:
            IAUnsupportedSection(section, "No native coordinator \(section) contract exists yet.", context.environment)
        }
    }
}

// MARK: - Vendor Shell — Home | Jobs | Schedule | Messages | More
public struct VendorShellView: View {
    @EnvironmentObject private var session: SessionStore
    let context: NavigationContext
    var onSwitchPersona: (() -> Void)?
    var pendingDeepLink: NativeDeepLink?
    var onDeepLinkHandled: (() -> Void)?
    @StateObject private var sectionMemory = WorkspaceSectionMemory()

    public init(
        context: NavigationContext,
        onSwitchPersona: (() -> Void)? = nil,
        pendingDeepLink: NativeDeepLink? = nil,
        onDeepLinkHandled: (() -> Void)? = nil
    ) {
        self.context = context
        self.onSwitchPersona = onSwitchPersona
        self.pendingDeepLink = pendingDeepLink
        self.onDeepLinkHandled = onDeepLinkHandled
    }

    public var body: some View {
        RoleShellScaffold(
            context: context,
            onSwitchPersona: onSwitchPersona,
            pendingDeepLink: pendingDeepLink,
            sectionMemory: sectionMemory,
            onDeepLinkHandled: onDeepLinkHandled
        ) { destination, ctx in
            RoleWorkspaceHost(context: ctx) { graph in
                switch destination.id {
                case "home":
                    VendorHomeContent(graph: graph, context: ctx)
                case "jobs":
                    WorkspaceSurface(destination: destination, testIdPrefix: "vendor", context: ctx, sectionMemory: sectionMemory) { section in
                        VendorJobsSection(section: section, graph: graph, context: ctx)
                    }
                case "schedule":
                    WorkspaceSurface(destination: destination, testIdPrefix: "vendor", context: ctx, sectionMemory: sectionMemory) { section in
                        VendorScheduleSection(section: section, graph: graph, context: ctx)
                    }
                case "messages":
                    MessagesInboxView()
                case "more":
                    WorkspaceSurface(destination: destination, testIdPrefix: "vendor", context: ctx, sectionMemory: sectionMemory) { section in
                        VendorMoreSection(section: section, context: ctx, graph: graph)
                    }
                default:
                    IAUnsupportedSection(destination.label, "Unknown destination.", ctx.environment)
                }
            }
        }
    }
}

struct VendorHomeContent: View {
    @ObservedObject var graph: WeddingGraphState
    let context: NavigationContext

    var body: some View {
        if graph.loading {
            IALoading()
        } else {
            // P0-10: resolve the authorized vendor only. Falling back to the first vendor would
            // show another company's job to make the page look populated.
            let engagement = context.authorizedVendor(graph)
            IASectionList("Home", engagement?.vendorName ?? "No vendor assigned") {
                if let engagement {
                    IACard(
                        "Today's job",
                        "\(engagement.serviceCategory) • \(engagement.serviceArea)",
                        trailing: engagement.expectedTime,
                        status: engagement.state.title
                    )
                    if let wedding = graph.wedding {
                        IACard("Wedding", wedding.coupleNames, trailing: wedding.venueName)
                    }
                    IACard(
                        "Outstanding documents",
                        "Contract and payment state are not exposed by the native contract yet",
                        trailing: "Not recorded"
                    )
                } else {
                    IACard(
                        "No vendor assigned",
                        "This account is not linked to a vendor on the active wedding, so no job can be shown."
                    )
                }
            }
        }
    }
}

struct VendorMoreSection: View {
    let section: String
    let context: NavigationContext
    @ObservedObject var graph: WeddingGraphState

    var body: some View {
        switch section {
        // The vendor catalog previously listed an invented public-liability policy, an invented
        // tax clearance certificate and an invented rate sheet, all marked "Verified". Against a
        // real wedding those read as facts about a real business. Replaced with the vendor and
        // service-engagement rows the graph actually holds.
        case "Services", "Company Profile": VendorServicesSection(graph: graph, context: context)
        case "Settings": SettingsView()
        case "Account": AccountPrivacyView()
        case "Support":
            IASectionList("Support", "Vendor support") {
                IACard("Contact support", "support@wewed.pro")
            }
        default:
            IAUnsupportedSection(
                section,
                "No native vendor \(section) contract exists yet. Recorded state is shown only where the repository provides it.",
                context.environment
            )
        }
    }
}

// MARK: - Gate Team Shell — Scan | Admissions | Guests | Incidents | More
public struct UsherShellView: View {
    @EnvironmentObject private var session: SessionStore
    let context: NavigationContext
    var onSwitchPersona: (() -> Void)?
    var pendingDeepLink: NativeDeepLink?
    var onDeepLinkHandled: (() -> Void)?
    @StateObject private var sectionMemory = WorkspaceSectionMemory()
    @State private var showingScanner = false

    public init(
        context: NavigationContext,
        onSwitchPersona: (() -> Void)? = nil,
        pendingDeepLink: NativeDeepLink? = nil,
        onDeepLinkHandled: (() -> Void)? = nil
    ) {
        self.context = context
        self.onSwitchPersona = onSwitchPersona
        self.pendingDeepLink = pendingDeepLink
        self.onDeepLinkHandled = onDeepLinkHandled
    }

    public var body: some View {
        RoleShellScaffold(
            context: context,
            onSwitchPersona: onSwitchPersona,
            pendingDeepLink: pendingDeepLink,
            sectionMemory: sectionMemory,
            onDeepLinkHandled: onDeepLinkHandled
        ) { destination, ctx in
            RoleWorkspaceHost(context: ctx) { graph in
                switch destination.id {
                case "scan":
                    GateScanContent(context: ctx) { showingScanner = true }
                case "admissions":
                    WorkspaceSurface(destination: destination, testIdPrefix: "gate", context: ctx, sectionMemory: sectionMemory) { section in
                        GateAdmissionsSection(section: section, graph: graph, environment: ctx.environment)
                    }
                case "guests":
                    GateGuestLookup(graph: graph)
                case "incidents":
                    WorkspaceSurface(destination: destination, testIdPrefix: "gate", context: ctx, sectionMemory: sectionMemory) { section in
                        // Incidents have no native contract yet; the taxonomy is present so the
                        // workspace is navigable, but no incident record is invented (playbook §11).
                        IAUnsupportedSection(
                            section,
                            "No incident has been recorded under \"\(section)\" for this gate. Incident capture has no native contract yet.",
                            ctx.environment
                        )
                    }
                case "more":
                    WorkspaceSurface(destination: destination, testIdPrefix: "gate", context: ctx, sectionMemory: sectionMemory) { section in
                        GateMoreSection(section: section, graph: graph, context: ctx)
                    }
                default:
                    IAUnsupportedSection(destination.label, "Unknown destination.", ctx.environment)
                }
            }
        }
        .sheet(isPresented: $showingScanner) {
            UsherScannerView()
        }
    }
}

struct GateScanContent: View {
    let context: NavigationContext
    let onOpenScanner: () -> Void

    var body: some View {
        VStack(spacing: 6) {
            Text("Gate scanning")
                .font(.system(size: 20, design: .serif))
                .foregroundColor(WeddingIdentityPalette.ink)
            Text(context.activeGateId ?? "Gate assignment not set")
                .font(.system(size: 12))
                .foregroundColor(WeddingIdentityPalette.muted)
            Button("Open scanner", action: onOpenScanner)
                .buttonStyle(.borderedProminent)
                .tint(WeddingIdentityPalette.champagneDeep)
                .padding(.top, 12)
                .accessibilityIdentifier("gate-open-scanner")
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(WeddingIdentityPalette.ivory)
        .accessibilityIdentifier("gate-scan-surface")
    }
}

struct GateMoreSection: View {
    let section: String
    @ObservedObject var graph: WeddingGraphState
    let context: NavigationContext

    var body: some View {
        switch section {
        case "Gate Assignment":
            IASectionList("Gate Assignment", context.activeWeddingTitle) {
                IACard(
                    "Assigned gate",
                    "Current gate for this actor",
                    trailing: context.activeGateId ?? "Not assigned",
                    testId: "gate-assignment"
                )
            }
        case "Offline Status", "Sync Status":
            WeddingDaySection(section: "Offline Status", graph: graph, environment: context.environment)
        case "Venue Map":
            WeddingDaySection(section: "Venue", graph: graph, environment: context.environment)
        case "Account":
            AccountPrivacyView()
        case "Help":
            IASectionList("Help", "Gate team support") {
                IACard("Contact coordinator", "Escalate from Incidents")
            }
        default:
            IAUnsupportedSection(section, "This section is not wired yet.", context.environment)
        }
    }
}

// MARK: - Guest Shell — Home | Invitation | Pass | Wedding Day | More
public struct GuestShellView: View {
    @EnvironmentObject private var session: SessionStore
    let context: NavigationContext
    var onSwitchPersona: (() -> Void)?
    var pendingDeepLink: NativeDeepLink?
    var onDeepLinkHandled: (() -> Void)?
    @StateObject private var sectionMemory = WorkspaceSectionMemory()

    public init(
        context: NavigationContext,
        onSwitchPersona: (() -> Void)? = nil,
        pendingDeepLink: NativeDeepLink? = nil,
        onDeepLinkHandled: (() -> Void)? = nil
    ) {
        self.context = context
        self.onSwitchPersona = onSwitchPersona
        self.pendingDeepLink = pendingDeepLink
        self.onDeepLinkHandled = onDeepLinkHandled
    }

    public var body: some View {
        RoleShellScaffold(
            context: context,
            onSwitchPersona: onSwitchPersona,
            pendingDeepLink: pendingDeepLink,
            sectionMemory: sectionMemory,
            onDeepLinkHandled: onDeepLinkHandled
        ) { destination, ctx in
            RoleWorkspaceHost(context: ctx) { graph in
                switch destination.id {
                case "home":
                    GuestHomeContent(graph: graph, context: ctx)
                case "invitation":
                    WorkspaceSurface(destination: destination, testIdPrefix: "guest", context: ctx, sectionMemory: sectionMemory) { section in
                        GuestInvitationSection(section: section, graph: graph, context: ctx)
                    }
                case "pass":
                    WorkspaceSurface(destination: destination, testIdPrefix: "guest", context: ctx, sectionMemory: sectionMemory) { section in
                        GuestPassSection(section: section, graph: graph, context: ctx)
                    }
                case "wedding_day":
                    WorkspaceSurface(destination: destination, testIdPrefix: "guest", context: ctx, sectionMemory: sectionMemory) { section in
                        GuestWeddingDaySection(section: section, graph: graph, context: ctx)
                    }
                case "more":
                    WorkspaceSurface(destination: destination, testIdPrefix: "guest", context: ctx, sectionMemory: sectionMemory) { section in
                        GuestMoreSection(section: section, context: ctx, graph: graph)
                    }
                default:
                    IAUnsupportedSection(destination.label, "Unknown destination.", ctx.environment)
                }
            }
        }
    }
}

struct GuestHomeContent: View {
    @ObservedObject var graph: WeddingGraphState
    let context: NavigationContext

    var body: some View {
        if graph.loading {
            IALoading()
        } else {
            IASectionList(graph.wedding?.coupleNames ?? context.activeWeddingTitle, graph.wedding?.date) {
                if let wedding = graph.wedding {
                    IACard("Venue", wedding.venueName, testId: "guest-home-venue")
                    IACard("Where", "\(wedding.city), \(wedding.country)")
                }
                if let announcement = graph.announcements.first {
                    IACard("Announcement", announcement.message, status: "\(announcement.urgency)")
                }
                if let mine = context.boundGuest(graph) {
                    IACard("Your invitation", mine.name, trailing: "Party of \(mine.partySize)", testId: "guest-home-identity-\(mine.id)")
                }
                IACard("Your pass", "Open the Pass workspace for your QR and table")
            }
        }
    }
}

struct GuestInvitationSection: View {
    let section: String
    @ObservedObject var graph: WeddingGraphState
    let context: NavigationContext

    var body: some View {
        if graph.loading {
            IALoading()
        } else if let mine = context.boundGuest(graph) {
            // P0-4: "me" is the guest the credential resolved to, not the first row in the roster.
            switch section {
            case "Invitation":
                IASectionList("Invitation", graph.wedding?.coupleNames) {
                    if let wedding = graph.wedding {
                        IACard(wedding.coupleNames, "\(wedding.venueName) • \(wedding.city)", trailing: wedding.date)
                    }
                    IACard("Invited", mine.name, trailing: "Party of \(mine.partySize)", testId: "guest-identity-\(mine.id)")
                }
            case "RSVP":
                IASectionList("RSVP", "Your response") {
                    IACard("Your RSVP", mine.name, trailing: mine.rsvpStatus.title, testId: "guest-rsvp-state")
                }
            case "Party Members":
                IASectionList("Party Members", mine.householdName) {
                    IACard(mine.householdName ?? mine.name, "Party of \(mine.partySize)")
                }
            default:
                IAUnsupportedSection(
                    section,
                    "No native contract exists for \(section) yet. Nothing is recorded against your invitation.",
                    context.environment
                )
            }
        } else {
            IAUnsupportedSection(
                section,
                "No guest invitation is bound to this session, so no invitation details can be shown.",
                context.environment
            )
        }
    }
}

struct GuestPassSection: View {
    let section: String
    @ObservedObject var graph: WeddingGraphState
    let context: NavigationContext

    var body: some View {
        switch section {
        // P0-5: the pass is fetched with THIS actor's credential; there is no default guest.
        case "Wedding Pass", "QR":
            WeddingReferencePassView(passToken: context.activePassToken)
        case "Party Size", "Table", "Admission State":
            if graph.loading {
                IALoading()
            } else if let mine = context.boundGuest(graph) {
                IASectionList(section, mine.name) {
                    switch section {
                    case "Party Size":
                        IACard("Party size", mine.householdName ?? "—", trailing: "\(mine.partySize)", testId: "guest-party-\(mine.id)")
                    case "Table":
                        IACard("Table", mine.tableName ?? "Not yet assigned", trailing: mine.tableNumber.map(String.init), testId: "guest-table-\(mine.id)")
                    default:
                        IACard(
                            "Admission",
                            mine.checkedIn ? "Admitted at the gate" : "Not yet admitted",
                            trailing: "\(mine.checkedInCount)/\(mine.partySize)",
                            testId: "guest-admission-\(mine.id)"
                        )
                    }
                }
            } else {
                IAUnsupportedSection(section, "No guest invitation is bound to this session.", context.environment)
            }
        case "Open in Maps":
            IASectionList("Open in Maps", graph.wedding?.venueName) {
                if let wedding = graph.wedding {
                    IACard(wedding.venueName, wedding.venueAddress, trailing: "Open")
                }
            }
        default:
            IAUnsupportedSection(section, "This pass section is not wired yet.", context.environment)
        }
    }
}

struct GuestWeddingDaySection: View {
    let section: String
    @ObservedObject var graph: WeddingGraphState
    let context: NavigationContext

    var body: some View {
        switch section {
        case "Gallery / Live Wall":
            LiveWallView(realMessages: graph.wallMessages)
        case "Contacts":
            IAUnsupportedSection(
                "Contacts",
                "No guest-visible contact directory exists in the native contract.",
                context.environment
            )
        default:
            WeddingDaySection(section: section, graph: graph, environment: context.environment, boundGuestId: context.activeGuestId)
        }
    }
}

struct GuestMoreSection: View {
    let section: String
    let context: NavigationContext
    @ObservedObject var graph: WeddingGraphState

    var body: some View {
        switch section {
        // Our Story and Gallery are published content, and this wedding has published both. The
        // guest surface previously declared them unpublished without ever reading the graph.
        case "Our Story":
            WeddingContentSectionView(section: graph.section("story"), testIdPrefix: "guest-more-story")
        case "Gallery":
            GalleryContentSection(section: graph.section("gallery"), testIdPrefix: "guest-more-gallery")
        case "Account", "Privacy": AccountPrivacyView()
        case "Help":
            IASectionList("Help", "Guest support") {
                IACard("Contact the wedding team", "support@wewed.pro")
            }
        // Contributions are guest blessings, wishes, stories and memories — not monetary gifts.
        // No gift or honeymoon-fund contract exists in this wedding's graph, so the section says
        // that rather than presenting memories as gift information.
        case "Contribution / Gift Info":
            IAUnsupportedSection(
                section,
                "No gift or contribution fund is configured for this wedding.",
                context.environment
            )
        default:
            IAUnsupportedSection(section, "This section is not wired yet.", context.environment)
        }
    }
}

// MARK: - Admin Shell — Dashboard | Cases | Accounts | Audit | More
public struct AdminShellView: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var appState: AppState
    let context: NavigationContext
    var onSwitchPersona: (() -> Void)?
    var pendingDeepLink: NativeDeepLink?
    var onDeepLinkHandled: (() -> Void)?
    @StateObject private var sectionMemory = WorkspaceSectionMemory()
    /// Admin is system-scoped, so its access context is read from the source directly rather than
    /// through a wedding-bound graph that a global administrative session never loads.
    @State private var adminAccess: AdminAccessContext?

    public init(
        context: NavigationContext,
        onSwitchPersona: (() -> Void)? = nil,
        pendingDeepLink: NativeDeepLink? = nil,
        onDeepLinkHandled: (() -> Void)? = nil
    ) {
        self.context = context
        self.onSwitchPersona = onSwitchPersona
        self.pendingDeepLink = pendingDeepLink
        self.onDeepLinkHandled = onDeepLinkHandled
    }

    /// P0-13: Admin reads a system projection. The wedding graph is only consulted for surfaces
    /// that genuinely drill into a wedding.
    private var adminRepository: AdminSystemRepositoryProtocol {
        ShadowAdminSystemRepository(
            weddingRepository: appState.repository,
            environment: appState.dataEnvironment
        )
    }
    public var body: some View {
        RoleShellScaffold(
            context: context,
            onSwitchPersona: onSwitchPersona,
            pendingDeepLink: pendingDeepLink,
            sectionMemory: sectionMemory,
            onDeepLinkHandled: onDeepLinkHandled
        ) { destination, ctx in
            RoleWorkspaceHost(context: ctx) { graph in
                switch destination.id {
                case "dashboard":
                    AdminDashboardContent(adminRepository: adminRepository, context: ctx)
                case "cases":
                    IAUnsupportedSection(
                        "Cases",
                        "No native support-case contract exists yet. No cases are fabricated.",
                        ctx.environment
                    )
                case "accounts":
                    WorkspaceSurface(destination: destination, testIdPrefix: "admin", context: ctx, sectionMemory: sectionMemory) { section in
                        // Account administration has no native contract; showing invented account
                        // rows here would be a privileged data fabrication (playbook §13).
                        IAUnsupportedSection(
                            section,
                            "Account administration has no native contract yet. No \(section) records are read or fabricated in this environment.",
                            ctx.environment
                        )
                    }
                case "audit":
                    WorkspaceSurface(destination: destination, testIdPrefix: "admin", context: ctx, sectionMemory: sectionMemory) { section in
                        AdminAuditSection(section: section, graph: graph, environment: ctx.environment, adminAccess: adminAccess)
                    }
                case "more":
                    WorkspaceSurface(destination: destination, testIdPrefix: "admin", context: ctx, sectionMemory: sectionMemory) { section in
                        AdminMoreSection(section: section, adminRepository: adminRepository, graph: graph, context: ctx)
                    }
                default:
                    IAUnsupportedSection(destination.label, "Unknown destination.", ctx.environment)
                }
            }
        }
        .task {
            adminAccess = try? await appState.repository.adminAccessContext()
        }
    }
}

struct AdminMoreSection: View {
    let section: String
    let adminRepository: AdminSystemRepositoryProtocol
    @ObservedObject var graph: WeddingGraphState
    let context: NavigationContext

    var body: some View {
        switch section {
        case "System Health": AdminDashboardContent(adminRepository: adminRepository, context: context)
        case "Announcements": WeddingDaySection(section: "Announcements", graph: graph, environment: context.environment)
        case "Admin Profile": AccountPrivacyView()
        case "Help":
            IASectionList("Help", "Administrator support") {
                IACard("Internal escalation", "Use Cases to record an escalation")
            }
        default:
            IAUnsupportedSection(section, "No native administrative \(section) contract exists yet.", context.environment)
        }
    }
}

// MARK: - Couple Shell — Home | Plan | Guests | Wedding Day | More
public struct CoupleShellView: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var appState: AppState
    let context: NavigationContext
    var onSwitchPersona: (() -> Void)?
    var pendingDeepLink: NativeDeepLink?
    var onDeepLinkHandled: (() -> Void)?
    @StateObject private var sectionMemory = WorkspaceSectionMemory()
    /// Internal navigation requests travel the same gated path as an external deep link, so an
    /// in-app jump is authorized exactly like a link (IA V2 §13.4).
    @State private var internalRequest: NativeDeepLink?

    public init(
        context: NavigationContext,
        onSwitchPersona: (() -> Void)? = nil,
        pendingDeepLink: NativeDeepLink? = nil,
        onDeepLinkHandled: (() -> Void)? = nil
    ) {
        self.context = context
        self.onSwitchPersona = onSwitchPersona
        self.pendingDeepLink = pendingDeepLink
        self.onDeepLinkHandled = onDeepLinkHandled
    }

    public var body: some View {
        RoleShellScaffold(
            context: context,
            onSwitchPersona: onSwitchPersona,
            pendingDeepLink: pendingDeepLink ?? internalRequest,
            sectionMemory: sectionMemory,
            onDeepLinkHandled: {
                internalRequest = nil
                onDeepLinkHandled?()
            }
        ) { destination, ctx in
            RoleWorkspaceHost(context: ctx) { graph in
                switch destination.id {
                case "home":
                    WeddingReferenceHomeView {
                        // P0-11: the notifications control opens the couple's own pending-RSVP
                        // list, never a specific guest's invitation.
                        internalRequest = .workspace(
                            WorkspaceDeepLink(
                                weddingId: ctx.activeWeddingId,
                                destinationId: "guests",
                                section: "RSVP"
                            )
                        )
                    }
                case "plan":
                    WorkspaceSurface(destination: destination, testIdPrefix: "couple", context: ctx, sectionMemory: sectionMemory) { section in
                        CouplePlanSection(section: section, context: ctx, sectionMemory: sectionMemory)
                    }
                case "guests":
                    WorkspaceSurface(destination: destination, testIdPrefix: "couple", context: ctx, sectionMemory: sectionMemory) { section in
                        if section == "Guest List" {
                            WeddingReferenceGuestsView()
                        } else {
                            CoupleGuestsSection(section: section, graph: graph, environment: ctx.environment)
                        }
                    }
                case "wedding_day":
                    WorkspaceSurface(destination: destination, testIdPrefix: "couple", context: ctx, sectionMemory: sectionMemory) { section in
                        WeddingDaySection(
                            section: section, graph: graph, environment: ctx.environment,
                            boundGuestId: ctx.activeGuestId
                        ) {
                            WeddingReferencePassView(passToken: ctx.activePassToken)
                        }
                    }
                case "more":
                    WeddingReferenceMoreView()
                default:
                    IAUnsupportedSection(destination.label, "Unknown destination.", ctx.environment)
                }
            }
        }
    }
}

struct CouplePlanSection: View {
    let section: String
    let context: NavigationContext
    @ObservedObject var sectionMemory: WorkspaceSectionMemory

    var body: some View {
        // The couple's Plan worksheets read the same repositories as the planner Workspace —
        // one canonical pipeline, two role presentations (IA V2 §13.3).
        switch section {
        // IA V2 owns Level-2: the Overview surface reports which section a module represents and
        // the shell moves the selection, rather than the view navigating internally.
        case "Overview":
            WeddingReferencePlannerView { target in
                sectionMemory.select(context, "plan", target)
            }
        case "Tasks": PlannerTasksView()
        case "Budget": ShadowPlannerBudgetView()
        case "Contributions": ShadowPlannerContributionsView()
        case "Vendors": ShadowPlannerVendorsView()
        case "Seating": ShadowPlannerSeatingView()
        case "Timeline": ShadowPlannerTimelineView()
        case "Documents": ShadowPlannerDocumentsView()
        default: IAUnsupportedSection(section, "This worksheet is not wired yet.", context.environment)
        }
    }
}
