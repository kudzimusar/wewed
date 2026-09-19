import SwiftUI

// Non-couple shells. Each receives only a RoleScopedAccess for its grant (plus SessionStore for Account),
// so a screen cannot read data outside the grant even by mistake.

extension View {
    func ivoryTabBar() -> some View {
        #if os(iOS)
        self
            .toolbarBackground(WeddingIdentityPalette.ivorySoft, for: .tabBar)
            .toolbarBackground(.visible, for: .tabBar)
            .toolbarColorScheme(.light, for: .tabBar)
        #else
        self
        #endif
    }
}

func gateOperatorId(_ grant: RoleGrant) -> String {
    "\(grant.role.roleId):\(grant.weddingId)"
}

/// Account tab content with its own navigation stack.
struct AccountTab: View {
    let grant: RoleGrant

    var body: some View {
        NavigationStack {
            AccountView(grant: grant)
        }
    }
}

// MARK: - Wedding information shared by guest and vendor shells

struct WeddingFactsCard: View {
    let wedding: Wedding
    let mapsIdentifier: String

    var body: some View {
        PlainCard {
            VStack(alignment: .leading, spacing: 12) {
                InfoLine("Couple", wedding.coupleNames, identifier: "wedding-info-couple")
                InfoLine("Date", WeddingDateText.longWithTime(wedding.date), identifier: "wedding-info-date")
                InfoLine("Venue", [wedding.venueName, wedding.city, wedding.country].filter { !$0.isEmpty }.joined(separator: ", "), identifier: "wedding-info-venue")
                OpenInMapsButton(venue: wedding.venueLocation, identifier: mapsIdentifier)
            }
        }
    }
}

struct ProgrammeList: View {
    let entries: [PlannerTimelineEntry]
    let emptyIdentifier: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if entries.isEmpty {
                EmptyStateText("No programme recorded for this wedding.", identifier: emptyIdentifier)
            }
            ForEach(WeddingPlanSnapshot(programme: entries).programmeByTime) { entry in
                ProgrammeRowContent(entry: entry)
                    .worksheetRowCard()
            }
        }
    }
}

// MARK: - Guest ("My Invitation")

@MainActor
final class GuestShellModel: ObservableObject {
    let access: RoleScopedAccess
    @Published private(set) var invitation: InvitationContext?
    @Published private(set) var pass: WeddingPass?
    @Published private(set) var wedding: Wedding?
    @Published private(set) var programme: [PlannerTimelineEntry] = []
    @Published private(set) var loaded = false
    @Published private(set) var invitationFailed = false

    init(access: RoleScopedAccess) {
        self.access = access
    }

    func load() async {
        do {
            invitation = try await access.ownInvitation()
            invitationFailed = false
        } catch {
            invitationFailed = true
        }
        pass = try? await access.ownPass()
        wedding = try? await access.weddingSummary()
        programme = (try? await access.programme()) ?? []
        loaded = true
    }

    func refreshPass() async {
        pass = try? await access.ownPass()
    }

    /// Sends the guest's own reply; the invitation and pass are then re-read for the same guest.
    func respond(attending: Bool) async throws {
        _ = try await access.respondToOwnInvitation(attending: attending)
        invitation = try? await access.ownInvitation()
        pass = try? await access.ownPass()
    }
}

public struct GuestShellView: View {
    enum Tab: Hashable { case invitation, pass, info, account }

    @StateObject private var model: GuestShellModel
    @State private var tab: Tab = .invitation
    private let grant: RoleGrant

    public init(access: RoleScopedAccess) {
        grant = access.grant
        _model = StateObject(wrappedValue: GuestShellModel(access: access))
    }

    public var body: some View {
        ShellFrame(grant: grant, identifier: "guest-shell-root") {
            TabView(selection: $tab) {
                invitationTab
                    .tabItem { Label("Invitation", systemImage: "envelope.open") }
                    .tag(Tab.invitation)
                passTab
                    .tabItem { Label("My Pass", systemImage: "qrcode") }
                    .tag(Tab.pass)
                infoTab
                    .tabItem { Label("Wedding Info", systemImage: "info.circle") }
                    .tag(Tab.info)
                AccountTab(grant: grant)
                    .tabItem { Label("Account", systemImage: "person.crop.circle") }
                    .tag(Tab.account)
            }
            .ivoryTabBar()
        }
        .task { await model.load() }
    }

    @ViewBuilder
    private var invitationTab: some View {
        if let invitation = model.invitation {
            IvoryInvitationView(
                invitation: invitation,
                mode: .guest,
                fallbackVenue: model.wedding?.venueLocation,
                allowsClose: false,
                respond: { attending in try await model.respond(attending: attending) },
                onViewPass: { tab = .pass }
            )
        } else if model.invitationFailed {
            VStack {
                EmptyStateText("We couldn't open your invitation. Please try again later.", identifier: "guest-invitation-unavailable")
            }
            .padding(16)
        } else {
            ProgressView("Opening your invitation…")
        }
    }

    private var passTab: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    if let pass = model.pass {
                        WeddingPassCard(pass: pass, fallbackVenue: model.wedding?.venueLocation)
                    } else if model.loaded {
                        EmptyStateText("Your pass appears here after you accept your invitation.", identifier: "guest-pass-unavailable")
                    } else {
                        ProgressView()
                    }
                }
                .padding(16)
            }
            .background(WeddingIdentityPalette.ivory.ignoresSafeArea())
            .navigationTitle("My Pass")
            .task { await model.refreshPass() }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("guest-pass-root")
    }

    private var infoTab: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let wedding = model.wedding {
                        WeddingFactsCard(wedding: wedding, mapsIdentifier: "wedding-info-open-maps")
                    } else if model.loaded {
                        LoadFailureText("the wedding details")
                    }
                    SectionHeading("Programme")
                    ProgrammeList(entries: model.programme, emptyIdentifier: "wedding-info-programme-empty")
                }
                .padding(16)
            }
            .background(WeddingIdentityPalette.ivory.ignoresSafeArea())
            .navigationTitle("Wedding Info")
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("guest-wedding-info-root")
    }
}

// MARK: - Vendor ("My Vendor Work")

public struct VendorShellView: View {
    private let access: RoleScopedAccess

    public init(access: RoleScopedAccess) {
        self.access = access
    }

    public var body: some View {
        ShellFrame(grant: access.grant, identifier: "vendor-shell-root") {
            TabView {
                VendorWorkView(access: access)
                    .tabItem { Label("My Work", systemImage: "briefcase") }
                VendorScheduleView(access: access)
                    .tabItem { Label("Schedule", systemImage: "calendar") }
                AccountTab(grant: access.grant)
                    .tabItem { Label("Account", systemImage: "person.crop.circle") }
            }
            .ivoryTabBar()
        }
    }
}

struct VendorWorkView: View {
    let access: RoleScopedAccess
    @State private var engagements: [PlannerVendorEngagement] = []
    @State private var presence: VendorPresence?
    @State private var loaded = false
    @State private var failed = false
    @State private var updating: VendorPresenceState?
    @State private var message: String?
    @State private var messageIsError = false

    private let updatableStates: [VendorPresenceState] = [.scheduled, .enRoute, .arrived, .serviceActive, .completed]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if failed {
                        LoadFailureText("your vendor work")
                    }
                    SectionHeading("My booking")
                    if engagements.isEmpty && loaded {
                        EmptyStateText("No vendor engagement is recorded for you on this wedding.", identifier: "vendor-engagement-empty")
                    }
                    ForEach(engagements) { engagement in
                        PlainCard {
                            VStack(alignment: .leading, spacing: 10) {
                                Text(engagement.vendorName)
                                    .font(.system(.title3, design: .serif).weight(.semibold))
                                    .foregroundStyle(WeddingIdentityPalette.ink)
                                InfoLine("Service", PlainStatus.label(engagement.category))
                                InfoLine("Booking status", engagement.bookingStatus)
                                InfoLine("Contract status", engagement.contractStatus)
                                InfoLine("Payment status", engagement.paymentStatus)
                            }
                        }
                        .accessibilityIdentifier("vendor-engagement-\(engagement.id)")
                    }

                    SectionHeading("My status on the day")
                    if let presence {
                        PlainCard {
                            VStack(alignment: .leading, spacing: 8) {
                                InfoLine("Current status", presence.state.title, identifier: "vendor-current-status")
                                InfoLine("Expected arrival", presence.expectedTime)
                            }
                        }
                        Text("Update my status")
                            .font(.headline)
                            .foregroundStyle(WeddingIdentityPalette.ink)
                        ForEach(updatableStates, id: \.self) { state in
                            Button {
                                update(state)
                            } label: {
                                HStack {
                                    if updating == state { ProgressView() }
                                    Text(state.title)
                                    if presence.state == state {
                                        Text("(current)")
                                            .font(.subheadline)
                                    }
                                }
                            }
                            .buttonStyle(WeddingActionButtonStyle(presence.state == state ? .primary : .secondary))
                            .disabled(updating != nil)
                            .accessibilityAddTraits(presence.state == state ? .isSelected : [])
                            .accessibilityIdentifier("vendor-status-\(state.rawValue.lowercased().replacingOccurrences(of: "_", with: "-"))")
                        }
                    } else if loaded {
                        EmptyStateText("No day-of status is recorded for you on this wedding.", identifier: "vendor-presence-empty")
                    }
                    if let message {
                        StatusText(message, systemImage: messageIsError ? "exclamationmark.triangle.fill" : "checkmark.circle.fill", tone: messageIsError ? .negative : .positive)
                            .accessibilityIdentifier("vendor-status-message")
                    }
                }
                .padding(16)
            }
            .background(WeddingIdentityPalette.ivory.ignoresSafeArea())
            .navigationTitle("My Work")
            .refreshable { await load() }
            .task { await load() }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("vendor-engagement-root")
    }

    private func load() async {
        do {
            engagements = try await access.vendorEngagements()
            presence = try await access.vendorPresence().first
            failed = false
        } catch {
            failed = true
        }
        loaded = true
    }

    private func update(_ state: VendorPresenceState) {
        updating = state
        message = nil
        Task {
            do {
                presence = try await access.updateOwnVendorPresence(state)
                message = "Your status is now \(state.title)."
                messageIsError = false
            } catch {
                message = "Your status couldn't be updated. Please try again."
                messageIsError = true
            }
            updating = nil
        }
    }
}

struct VendorScheduleView: View {
    let access: RoleScopedAccess
    @State private var wedding: Wedding?
    @State private var programme: [PlannerTimelineEntry] = []
    @State private var loaded = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let wedding {
                        WeddingFactsCard(wedding: wedding, mapsIdentifier: "vendor-open-maps")
                    } else if loaded {
                        LoadFailureText("the wedding details")
                    }
                    SectionHeading("Programme")
                    ProgrammeList(entries: programme, emptyIdentifier: "vendor-programme-empty")
                }
                .padding(16)
            }
            .background(WeddingIdentityPalette.ivory.ignoresSafeArea())
            .navigationTitle("Schedule")
            .task {
                wedding = try? await access.weddingSummary()
                programme = (try? await access.programme()) ?? []
                loaded = true
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("vendor-schedule-root")
    }
}

// MARK: - Gate team ("Gate Check-In")

public struct UsherShellView: View {
    @StateObject private var gate: GateModel
    private let grant: RoleGrant

    public init(access: RoleScopedAccess) {
        grant = access.grant
        _gate = StateObject(wrappedValue: GateModel(access: access, operatorId: gateOperatorId(access.grant)))
    }

    public var body: some View {
        ShellFrame(grant: grant, identifier: "usher-shell-root") {
            TabView {
                GateTabView(model: gate, content: .scan, title: "Scan")
                    .tabItem { Label("Scan", systemImage: "qrcode.viewfinder") }
                GateTabView(model: gate, content: .admissions, title: "Admissions")
                    .tabItem { Label("Admissions", systemImage: "person.2") }
                AccountTab(grant: grant)
                    .tabItem { Label("Account", systemImage: "person.crop.circle") }
            }
            .ivoryTabBar()
        }
    }
}

// MARK: - Coordinator ("Wedding-Day Coordination")

public struct CoordinatorShellView: View {
    @StateObject private var model: WeddingPlanModel
    @StateObject private var gate: GateModel
    private let grant: RoleGrant

    public init(access: RoleScopedAccess) {
        grant = access.grant
        _model = StateObject(wrappedValue: WeddingPlanModel(access: access))
        _gate = StateObject(wrappedValue: GateModel(access: access, operatorId: gateOperatorId(access.grant)))
    }

    public var body: some View {
        ShellFrame(grant: grant, identifier: "coordinator-shell-root") {
            TabView {
                runSheet
                    .tabItem { Label("Run Sheet", systemImage: "list.bullet.clipboard") }
                tasks
                    .tabItem { Label("Tasks", systemImage: "checklist") }
                vendors
                    .tabItem { Label("Vendors", systemImage: "person.3") }
                GateTabView(model: gate, content: .both, title: "Gate", identifier: "coordinator-gate-root")
                    .tabItem { Label("Gate", systemImage: "qrcode.viewfinder") }
                AccountTab(grant: grant)
                    .tabItem { Label("Account", systemImage: "person.crop.circle") }
            }
            .ivoryTabBar()
        }
        .task { await model.loadIfNeeded() }
    }

    private var runSheet: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let wedding = model.data.wedding {
                        Text("\(wedding.coupleNames) · \(WeddingDateText.long(wedding.date))")
                            .font(.subheadline)
                            .foregroundStyle(WeddingIdentityPalette.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    if model.failures.contains(.programme) {
                        LoadFailureText("the run sheet")
                    }
                    ProgrammeList(entries: model.data.programme, emptyIdentifier: "coordinator-run-sheet-empty")
                }
                .padding(16)
            }
            .background(WeddingIdentityPalette.ivory.ignoresSafeArea())
            .navigationTitle("Run Sheet")
            .refreshable { await model.load() }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("coordinator-run-sheet-root")
    }

    private var tasks: some View {
        NavigationStack {
            ScrollView {
                WorksheetRowsView(model: model, worksheet: .tasks, allowsTaskChanges: false)
                    .padding(16)
            }
            .background(WeddingIdentityPalette.ivory.ignoresSafeArea())
            .navigationTitle("Tasks")
            .refreshable { await model.load() }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("coordinator-tasks-root")
    }

    private var vendors: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    if model.failures.contains(.presence) {
                        LoadFailureText("vendor status")
                    }
                    if model.data.presence.isEmpty && model.hasLoaded {
                        EmptyStateText("No vendors recorded for this wedding.", identifier: "coordinator-vendors-empty")
                    }
                    ForEach(model.data.presence) { vendor in
                        PresenceRow(vendor: vendor)
                    }
                }
                .padding(16)
            }
            .background(WeddingIdentityPalette.ivory.ignoresSafeArea())
            .navigationTitle("Vendors")
            .refreshable { await model.load() }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("coordinator-vendors-root")
    }
}

/// A vendor's name and day-of state. No money, no contract detail.
struct PresenceRow: View {
    let vendor: VendorPresence

    var body: some View {
        HStack(alignment: .top) {
            Text(vendor.vendorName)
                .font(.body.weight(.semibold))
                .foregroundStyle(WeddingIdentityPalette.ink)
            Spacer(minLength: 8)
            StatusText(
                vendor.state.title,
                tone: vendor.state == .notRecorded ? .neutral : (vendor.state == .completed || vendor.state == .serviceActive || vendor.state == .arrived ? .positive : .attention)
            )
            .multilineTextAlignment(.trailing)
        }
        .worksheetRowCard()
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("presence-\(vendor.id)")
    }
}

// MARK: - Wewed Support ("Wewed Support")

public struct AdminShellView: View {
    private let access: RoleScopedAccess

    public init(access: RoleScopedAccess) {
        self.access = access
    }

    public var body: some View {
        ShellFrame(grant: access.grant, identifier: "admin-shell-root") {
            TabView {
                AdminSupportView(access: access)
                    .tabItem { Label("Support", systemImage: "lifepreserver") }
                AdminAuditView(access: access)
                    .tabItem { Label("Audit log", systemImage: "list.bullet.rectangle") }
                AccountTab(grant: access.grant)
                    .tabItem { Label("Account", systemImage: "person.crop.circle") }
            }
            .ivoryTabBar()
        }
    }
}

enum SupportSection: String, CaseIterable, Identifiable {
    case guests, tasks, vendors

    var id: String { rawValue }

    var buttonTitle: String {
        switch self {
        case .guests: return "Open guest list (recorded)"
        case .tasks: return "Open tasks (recorded)"
        case .vendors: return "Open vendors (recorded)"
        }
    }

    var title: String {
        switch self {
        case .guests: return "Guest list"
        case .tasks: return "Tasks"
        case .vendors: return "Vendors"
        }
    }

    static func title(forRecorded section: String) -> String {
        SupportSection(rawValue: section)?.title ?? PlainStatus.label(section)
    }
}

struct AdminSupportView: View {
    let access: RoleScopedAccess
    @State private var wedding: Wedding?
    @State private var loaded = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if let wedding {
                        PlainCard {
                            VStack(alignment: .leading, spacing: 12) {
                                InfoLine("Wedding", wedding.coupleNames)
                                InfoLine("Date", WeddingDateText.longWithTime(wedding.date))
                                InfoLine("Venue", [wedding.venueName, wedding.city, wedding.country].filter { !$0.isEmpty }.joined(separator: ", "))
                            }
                        }
                        .accessibilityIdentifier("admin-wedding-card")
                    } else if loaded {
                        LoadFailureText("the wedding")
                    }
                    Text("Support views are read-only. Opening one is recorded in the audit log.")
                        .font(.subheadline)
                        .foregroundStyle(WeddingIdentityPalette.muted)
                        .fixedSize(horizontal: false, vertical: true)
                    ForEach(SupportSection.allCases) { section in
                        NavigationLink {
                            AdminRecordedView(access: access, section: section)
                        } label: {
                            MenuRowLabel(section.buttonTitle, systemImage: "lock.doc")
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("admin-open-\(section.rawValue)")
                    }
                }
                .padding(16)
            }
            .background(WeddingIdentityPalette.ivory.ignoresSafeArea())
            .navigationTitle("Support")
            .task {
                wedding = try? await access.weddingSummary()
                loaded = true
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("admin-support-root")
    }
}

/// A read-only support view. Data is shown only after supportRead has recorded the view.
struct AdminRecordedView: View {
    let access: RoleScopedAccess
    let section: SupportSection

    private enum Result {
        case guests([Guest])
        case tasks([PlannerTask])
        case vendors([PlannerVendorEngagement])
    }

    @State private var result: Result?
    @State private var failed = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                if let result {
                    StatusText("This view was recorded in the audit log.", systemImage: "lock.shield", tone: .attention)
                        .accessibilityIdentifier("admin-recorded-notice")
                    switch result {
                    case .guests(let guests):
                        Text(PlainStatus.plural(guests.count, "guest"))
                            .font(.subheadline)
                            .foregroundStyle(WeddingIdentityPalette.muted)
                        ForEach(guests) { GuestRowContent(guest: $0).worksheetRowCard() }
                    case .tasks(let tasks):
                        Text(PlainStatus.plural(tasks.count, "task"))
                            .font(.subheadline)
                            .foregroundStyle(WeddingIdentityPalette.muted)
                        ForEach(tasks) { TaskRowContent(task: $0, showsToggle: false, busy: false, onToggle: {}).worksheetRowCard() }
                    case .vendors(let vendors):
                        Text(PlainStatus.plural(vendors.count, "vendor"))
                            .font(.subheadline)
                            .foregroundStyle(WeddingIdentityPalette.muted)
                        ForEach(vendors) { VendorEngagementRowContent(vendor: $0).worksheetRowCard() }
                    }
                } else if failed {
                    LoadFailureText(section.title.lowercased())
                } else {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                }
            }
            .padding(16)
        }
        .background(WeddingIdentityPalette.ivory.ignoresSafeArea())
        .navigationTitle(section.title)
        .task { await load() }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("admin-\(section.rawValue)-root")
    }

    private func load() async {
        do {
            switch section {
            case .guests:
                result = .guests(try await access.supportRead(section: section.rawValue) { wedding, _ in try await wedding.getGuests() })
            case .tasks:
                result = .tasks(try await access.supportRead(section: section.rawValue) { wedding, _ in try await wedding.getTasks() })
            case .vendors:
                result = .vendors(try await access.supportRead(section: section.rawValue) { _, planner in try await planner.getVendorEngagements() })
            }
            failed = false
        } catch {
            failed = true
        }
    }
}

struct AdminAuditView: View {
    let access: RoleScopedAccess
    @State private var entries: [AdminAuditEntry] = []
    @State private var loaded = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    if entries.isEmpty && loaded {
                        EmptyStateText("No support views have been recorded yet.", identifier: "admin-audit-empty")
                    }
                    ForEach(Array(entries.enumerated()), id: \.offset) { _, entry in
                        HStack(alignment: .top) {
                            Text(SupportSection.title(forRecorded: entry.section))
                                .font(.body.weight(.semibold))
                                .foregroundStyle(WeddingIdentityPalette.ink)
                            Spacer(minLength: 8)
                            Text(entry.recordedAt.formatted(date: .abbreviated, time: .shortened))
                                .font(.subheadline)
                                .foregroundStyle(WeddingIdentityPalette.muted)
                                .multilineTextAlignment(.trailing)
                        }
                        .worksheetRowCard()
                        .accessibilityElement(children: .combine)
                    }
                }
                .padding(16)
            }
            .background(WeddingIdentityPalette.ivory.ignoresSafeArea())
            .navigationTitle("Audit log")
            .refreshable { entries = (try? await access.auditEntries()) ?? [] }
            .task {
                entries = (try? await access.auditEntries()) ?? []
                loaded = true
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("admin-audit-root")
    }
}
