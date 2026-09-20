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
    var requestedDestinationId: String?
    var onRequestedDestinationHandled: (() -> Void)?

    public init(
        context: NavigationContext,
        onSwitchPersona: (() -> Void)? = nil,
        requestedDestinationId: String? = nil,
        onRequestedDestinationHandled: (() -> Void)? = nil
    ) {
        self.context = context
        self.onSwitchPersona = onSwitchPersona
        self.requestedDestinationId = requestedDestinationId
        self.onRequestedDestinationHandled = onRequestedDestinationHandled
    }

    public var body: some View {
        RoleShellScaffold(
            context: context,
            onSwitchPersona: onSwitchPersona,
            requestedDestinationId: requestedDestinationId,
            onRequestedDestinationHandled: onRequestedDestinationHandled
        ) { destination, ctx in
            RoleWorkspaceHost(context: ctx) { graph in
                switch destination.id {
                case "workspace":
                    WorkspaceSurface(destination: destination, testIdPrefix: "planner") { section in
                        PlannerWorkspaceSection(section: section, context: ctx)
                    }
                case "clients":
                    WorkspaceSurface(destination: destination, testIdPrefix: "planner") { section in
                        PlannerClientsSection(section: section, context: ctx)
                    }
                case "daily_ops":
                    WorkspaceSurface(destination: destination, testIdPrefix: "planner") { section in
                        PlannerDailyOpsSection(section: section, graph: graph, context: ctx)
                    }
                case "wedding_day":
                    WorkspaceSurface(destination: destination, testIdPrefix: "planner") { section in
                        PlannerWeddingDaySection(section: section, graph: graph, context: ctx)
                    }
                case "more":
                    WorkspaceSurface(destination: destination, testIdPrefix: "planner") { section in
                        PlannerMoreSection(section: section, context: ctx)
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

    var body: some View {
        // Each worksheet reads the same selected wedding graph (IA V2 §5 Workspace).
        switch section {
        case "Overview": WeddingReferencePlannerView()
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

    var body: some View {
        // The native contract exposes exactly one planner engagement: the active wedding. Other
        // client states are not invented (playbook §8 — "Never fabricate a PlannerEngagement").
        switch section {
        case "Active Weddings":
            IASectionList("Active Weddings", "Weddings in your planner scope") {
                IACard(
                    context.activeWeddingTitle,
                    "Active planner engagement",
                    trailing: "Selected",
                    testId: "planner-active-client"
                )
            }
        case "Client Profiles":
            ClientProfileView()
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
                case "Overdue":
                    let overdue = graph.tasks.filter { $0.status != .done && $0.priority == .urgent }
                    IASectionList("Overdue", "\(overdue.count) urgent open tasks") {
                        ForEach(overdue) { IACard($0.title, $0.category, trailing: $0.dueDate, status: $0.status.title) }
                        if overdue.isEmpty { IACard("Nothing overdue", "No urgent task is outstanding.") }
                    }
                case "Upcoming Deadlines":
                    let open = graph.tasks.filter { $0.status != .done }
                    IASectionList("Upcoming Deadlines", "\(open.count) open tasks") {
                        ForEach(open) { IACard($0.title, $0.category, trailing: $0.dueDate, status: $0.priority.title) }
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

    var body: some View {
        switch section {
        case "Client Profile": ClientProfileView()
        case "Invitations & QR": PlannerInvitationToolsView()
        case "Intelligence": WewedAIWorkspaceView()
        case "Team Hub": CollaborationHubView()
        case "Files / Documents": MediaArchiveView()
        case "Planner Actions": PlannerActionsSection(context: context)
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
struct PlannerActionsSection: View {
    let context: NavigationContext

    private static let actions: [(String, String)] = [
        ("Print / Arrange / Select", "Produce printable guest, seating and programme output"),
        ("Refresh", "Re-read the active wedding graph"),
        ("Switch Worksheet", "Jump between Workspace worksheets"),
        ("Templates", "Apply a planning template"),
        ("Export", "Export the active wedding data"),
        ("Import", "Import guests or tasks"),
        ("Recent Imports", "Review the last import batches"),
        ("Edit Wedding Details", "Amend core wedding identity")
    ]

    var body: some View {
        IASectionList("Planner Actions", "Contextual operations for \(context.activeWeddingTitle)") {
            ForEach(Self.actions, id: \.0) { action in
                IACard(action.0, action.1, testId: "planner-action-\(action.0.iaSlug)")
            }
        }
    }
}

// MARK: - Coordinator Shell — Today | Run Sheet | Team | Wedding Day | More
public struct CoordinatorShellView: View {
    @EnvironmentObject private var session: SessionStore
    let context: NavigationContext
    var onSwitchPersona: (() -> Void)?
    var requestedDestinationId: String?
    var onRequestedDestinationHandled: (() -> Void)?

    public init(
        context: NavigationContext,
        onSwitchPersona: (() -> Void)? = nil,
        requestedDestinationId: String? = nil,
        onRequestedDestinationHandled: (() -> Void)? = nil
    ) {
        self.context = context
        self.onSwitchPersona = onSwitchPersona
        self.requestedDestinationId = requestedDestinationId
        self.onRequestedDestinationHandled = onRequestedDestinationHandled
    }

    public var body: some View {
        RoleShellScaffold(
            context: context,
            onSwitchPersona: onSwitchPersona,
            requestedDestinationId: requestedDestinationId,
            onRequestedDestinationHandled: onRequestedDestinationHandled
        ) { destination, ctx in
            RoleWorkspaceHost(context: ctx) { graph in
                switch destination.id {
                case "today":
                    CoordinatorTodayContent(graph: graph, context: ctx)
                case "run_sheet":
                    WeddingDaySection(section: "Programme", graph: graph, environment: ctx.environment)
                case "team":
                    WorkspaceSurface(destination: destination, testIdPrefix: "coordinator") { section in
                        CoordinatorTeamSection(section: section, graph: graph, context: ctx)
                    }
                case "wedding_day":
                    WorkspaceSurface(destination: destination, testIdPrefix: "coordinator") { section in
                        CoordinatorWeddingDaySection(section: section, graph: graph, context: ctx)
                    }
                case "more":
                    WorkspaceSurface(destination: destination, testIdPrefix: "coordinator") { section in
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
    var requestedDestinationId: String?
    var onRequestedDestinationHandled: (() -> Void)?

    public init(
        context: NavigationContext,
        onSwitchPersona: (() -> Void)? = nil,
        requestedDestinationId: String? = nil,
        onRequestedDestinationHandled: (() -> Void)? = nil
    ) {
        self.context = context
        self.onSwitchPersona = onSwitchPersona
        self.requestedDestinationId = requestedDestinationId
        self.onRequestedDestinationHandled = onRequestedDestinationHandled
    }

    public var body: some View {
        RoleShellScaffold(
            context: context,
            onSwitchPersona: onSwitchPersona,
            requestedDestinationId: requestedDestinationId,
            onRequestedDestinationHandled: onRequestedDestinationHandled
        ) { destination, ctx in
            RoleWorkspaceHost(context: ctx) { graph in
                switch destination.id {
                case "home":
                    VendorHomeContent(graph: graph, context: ctx)
                case "jobs":
                    WorkspaceSurface(destination: destination, testIdPrefix: "vendor") { section in
                        VendorJobsSection(section: section, graph: graph, context: ctx)
                    }
                case "schedule":
                    WorkspaceSurface(destination: destination, testIdPrefix: "vendor") { section in
                        VendorScheduleSection(section: section, graph: graph, context: ctx)
                    }
                case "messages":
                    MessagesInboxView()
                case "more":
                    WorkspaceSurface(destination: destination, testIdPrefix: "vendor") { section in
                        VendorMoreSection(section: section, context: ctx)
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
            let engagement = graph.vendors.first { $0.id == context.activeEngagementId } ?? graph.vendors.first
            IASectionList("Home", engagement?.vendorName ?? "No assigned engagement") {
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
                    IACard("No engagement assigned", "This vendor has no recorded engagement for the active wedding.")
                }
            }
        }
    }
}

struct VendorMoreSection: View {
    let section: String
    let context: NavigationContext

    var body: some View {
        switch section {
        case "Services", "Company Profile": VendorCatalogView()
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
    var requestedDestinationId: String?
    var onRequestedDestinationHandled: (() -> Void)?
    @State private var showingScanner = false

    public init(
        context: NavigationContext,
        onSwitchPersona: (() -> Void)? = nil,
        requestedDestinationId: String? = nil,
        onRequestedDestinationHandled: (() -> Void)? = nil
    ) {
        self.context = context
        self.onSwitchPersona = onSwitchPersona
        self.requestedDestinationId = requestedDestinationId
        self.onRequestedDestinationHandled = onRequestedDestinationHandled
    }

    public var body: some View {
        RoleShellScaffold(
            context: context,
            onSwitchPersona: onSwitchPersona,
            requestedDestinationId: requestedDestinationId,
            onRequestedDestinationHandled: onRequestedDestinationHandled
        ) { destination, ctx in
            RoleWorkspaceHost(context: ctx) { graph in
                switch destination.id {
                case "scan":
                    GateScanContent(context: ctx) { showingScanner = true }
                case "admissions":
                    WorkspaceSurface(destination: destination, testIdPrefix: "gate") { section in
                        GateAdmissionsSection(section: section, graph: graph, environment: ctx.environment)
                    }
                case "guests":
                    GateGuestLookup(graph: graph)
                case "incidents":
                    WorkspaceSurface(destination: destination, testIdPrefix: "gate") { section in
                        // Incidents have no native contract yet; the taxonomy is present so the
                        // workspace is navigable, but no incident record is invented (playbook §11).
                        IAUnsupportedSection(
                            section,
                            "No incident has been recorded under \"\(section)\" for this gate. Incident capture has no native contract yet.",
                            ctx.environment
                        )
                    }
                case "more":
                    WorkspaceSurface(destination: destination, testIdPrefix: "gate") { section in
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
    var requestedDestinationId: String?
    var onRequestedDestinationHandled: (() -> Void)?

    public init(
        context: NavigationContext,
        onSwitchPersona: (() -> Void)? = nil,
        requestedDestinationId: String? = nil,
        onRequestedDestinationHandled: (() -> Void)? = nil
    ) {
        self.context = context
        self.onSwitchPersona = onSwitchPersona
        self.requestedDestinationId = requestedDestinationId
        self.onRequestedDestinationHandled = onRequestedDestinationHandled
    }

    public var body: some View {
        RoleShellScaffold(
            context: context,
            onSwitchPersona: onSwitchPersona,
            requestedDestinationId: requestedDestinationId,
            onRequestedDestinationHandled: onRequestedDestinationHandled
        ) { destination, ctx in
            RoleWorkspaceHost(context: ctx) { graph in
                switch destination.id {
                case "home":
                    GuestHomeContent(graph: graph, context: ctx)
                case "invitation":
                    WorkspaceSurface(destination: destination, testIdPrefix: "guest") { section in
                        GuestInvitationSection(section: section, graph: graph, context: ctx)
                    }
                case "pass":
                    WorkspaceSurface(destination: destination, testIdPrefix: "guest") { section in
                        GuestPassSection(section: section, graph: graph, context: ctx)
                    }
                case "wedding_day":
                    WorkspaceSurface(destination: destination, testIdPrefix: "guest") { section in
                        GuestWeddingDaySection(section: section, graph: graph, context: ctx)
                    }
                case "more":
                    WorkspaceSurface(destination: destination, testIdPrefix: "guest") { section in
                        GuestMoreSection(section: section, context: ctx)
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
        } else {
            // A guest resolves only their own record — never the roster (IA V2 §6).
            let mine = graph.guests.first
            switch section {
            case "Invitation":
                IASectionList("Invitation", graph.wedding?.coupleNames) {
                    if let wedding = graph.wedding {
                        IACard(wedding.coupleNames, "\(wedding.venueName) • \(wedding.city)", trailing: wedding.date)
                    }
                    if let mine {
                        IACard("Invited", mine.name, trailing: "Party of \(mine.partySize)")
                    }
                }
            case "RSVP":
                IASectionList("RSVP", "Your response") {
                    if let mine {
                        IACard("Your RSVP", mine.name, trailing: mine.rsvpStatus.title, testId: "guest-rsvp-state")
                    } else {
                        IACard("No invitation resolved", "No guest record is bound to this session.")
                    }
                }
            case "Party Members":
                IASectionList("Party Members", mine?.householdName) {
                    if let mine {
                        IACard(mine.householdName ?? mine.name, "Party of \(mine.partySize)")
                    }
                }
            default:
                IAUnsupportedSection(
                    section,
                    "No native contract exists for \(section) yet. Nothing is recorded against your invitation.",
                    context.environment
                )
            }
        }
    }
}

struct GuestPassSection: View {
    let section: String
    @ObservedObject var graph: WeddingGraphState
    let context: NavigationContext

    var body: some View {
        switch section {
        case "Wedding Pass", "QR":
            WeddingReferencePassView()
        case "Party Size", "Table", "Admission State":
            if graph.loading {
                IALoading()
            } else {
                let mine = graph.guests.first
                IASectionList(section, mine?.name) {
                    switch section {
                    case "Party Size":
                        IACard("Party size", mine?.householdName ?? "—", trailing: "\(mine?.partySize ?? 0)")
                    case "Table":
                        IACard("Table", mine?.tableName ?? "Not yet assigned", trailing: mine?.tableNumber.map(String.init))
                    default:
                        IACard(
                            "Admission",
                            (mine?.checkedIn ?? false) ? "Admitted at the gate" : "Not yet admitted",
                            trailing: "\(mine?.checkedInCount ?? 0)/\(mine?.partySize ?? 0)"
                        )
                    }
                }
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
            LiveWallView()
        case "Contacts":
            IAUnsupportedSection(
                "Contacts",
                "No guest-visible contact directory exists in the native contract.",
                context.environment
            )
        default:
            WeddingDaySection(section: section, graph: graph, environment: context.environment)
        }
    }
}

struct GuestMoreSection: View {
    let section: String
    let context: NavigationContext

    var body: some View {
        switch section {
        case "Gallery": LiveWallView()
        case "Account", "Privacy": AccountPrivacyView()
        case "Help":
            IASectionList("Help", "Guest support") {
                IACard("Contact the wedding team", "support@wewed.pro")
            }
        default:
            IAUnsupportedSection(
                section,
                "The couple has not published \(section) for this wedding.",
                context.environment
            )
        }
    }
}

// MARK: - Admin Shell — Dashboard | Cases | Accounts | Audit | More
public struct AdminShellView: View {
    @EnvironmentObject private var session: SessionStore
    let context: NavigationContext
    var onSwitchPersona: (() -> Void)?
    var requestedDestinationId: String?
    var onRequestedDestinationHandled: (() -> Void)?

    public init(
        context: NavigationContext,
        onSwitchPersona: (() -> Void)? = nil,
        requestedDestinationId: String? = nil,
        onRequestedDestinationHandled: (() -> Void)? = nil
    ) {
        self.context = context
        self.onSwitchPersona = onSwitchPersona
        self.requestedDestinationId = requestedDestinationId
        self.onRequestedDestinationHandled = onRequestedDestinationHandled
    }

    public var body: some View {
        RoleShellScaffold(
            context: context,
            onSwitchPersona: onSwitchPersona,
            requestedDestinationId: requestedDestinationId,
            onRequestedDestinationHandled: onRequestedDestinationHandled
        ) { destination, ctx in
            RoleWorkspaceHost(context: ctx) { graph in
                switch destination.id {
                case "dashboard":
                    AdminDashboardContent(graph: graph, context: ctx)
                case "cases":
                    IAUnsupportedSection(
                        "Cases",
                        "No native support-case contract exists yet. No cases are fabricated.",
                        ctx.environment
                    )
                case "accounts":
                    WorkspaceSurface(destination: destination, testIdPrefix: "admin") { section in
                        // Account administration has no native contract; showing invented account
                        // rows here would be a privileged data fabrication (playbook §13).
                        IAUnsupportedSection(
                            section,
                            "Account administration has no native contract yet. No \(section) records are read or fabricated in this environment.",
                            ctx.environment
                        )
                    }
                case "audit":
                    WorkspaceSurface(destination: destination, testIdPrefix: "admin") { section in
                        AdminAuditSection(section: section, graph: graph, environment: ctx.environment)
                    }
                case "more":
                    WorkspaceSurface(destination: destination, testIdPrefix: "admin") { section in
                        AdminMoreSection(section: section, graph: graph, context: ctx)
                    }
                default:
                    IAUnsupportedSection(destination.label, "Unknown destination.", ctx.environment)
                }
            }
        }
    }
}

struct AdminMoreSection: View {
    let section: String
    @ObservedObject var graph: WeddingGraphState
    let context: NavigationContext

    var body: some View {
        switch section {
        case "System Health": AdminDashboardContent(graph: graph, context: context)
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
    var requestedDestinationId: String?
    var onRequestedDestinationHandled: (() -> Void)?

    public init(
        context: NavigationContext,
        onSwitchPersona: (() -> Void)? = nil,
        requestedDestinationId: String? = nil,
        onRequestedDestinationHandled: (() -> Void)? = nil
    ) {
        self.context = context
        self.onSwitchPersona = onSwitchPersona
        self.requestedDestinationId = requestedDestinationId
        self.onRequestedDestinationHandled = onRequestedDestinationHandled
    }

    public var body: some View {
        RoleShellScaffold(
            context: context,
            onSwitchPersona: onSwitchPersona,
            requestedDestinationId: requestedDestinationId,
            onRequestedDestinationHandled: onRequestedDestinationHandled
        ) { destination, ctx in
            RoleWorkspaceHost(context: ctx) { graph in
                switch destination.id {
                case "home":
                    WeddingReferenceHomeView()
                case "plan":
                    WorkspaceSurface(destination: destination, testIdPrefix: "couple") { section in
                        CouplePlanSection(section: section, context: ctx)
                    }
                case "guests":
                    WorkspaceSurface(destination: destination, testIdPrefix: "couple") { section in
                        if section == "Guest List" {
                            WeddingReferenceGuestsView()
                        } else {
                            CoupleGuestsSection(section: section, graph: graph, environment: ctx.environment)
                        }
                    }
                case "wedding_day":
                    WorkspaceSurface(destination: destination, testIdPrefix: "couple") { section in
                        WeddingDaySection(section: section, graph: graph, environment: ctx.environment) {
                            WeddingReferencePassView()
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

    var body: some View {
        // The couple's Plan worksheets read the same repositories as the planner Workspace —
        // one canonical pipeline, two role presentations (IA V2 §13.3).
        switch section {
        case "Overview": WeddingReferencePlannerView()
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
