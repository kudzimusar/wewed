import SwiftUI

/// IA V2 Level-2 workspace content.
///
/// Every section here reads through the canonical repositories on `AppState`, scoped by the active
/// wedding carried in `NavigationContext`. Loads are keyed on `activeWeddingId`, so a wedding
/// switch re-resolves the graph rather than leaving a sibling workspace stale (IA V2 §13.2/§13.5).
/// Sections with no repository contract yet render an explicit unsupported state naming the gap —
/// never invented values (playbook §16).

/// Task due-date semantics (P0-14).
///
/// "Overdue" means a due date in the past, not "urgent and unfinished". Tasks without a due date
/// are deliberately excluded from both overdue and upcoming views: an undated task has no deadline
/// to be late for, and counting it as either would overstate what the graph records.
public enum TaskDeadlines {
    public static func dueEpochDay(_ task: PlannerTask) -> Int? {
        guard let raw = task.dueDate, raw.count >= 10 else { return nil }
        let parts = raw.prefix(10).split(separator: "-")
        guard parts.count == 3,
              let y = Int(parts[0]), let m = Int(parts[1]), let d = Int(parts[2]) else { return nil }
        var components = DateComponents()
        components.year = y; components.month = m; components.day = d
        guard let date = Calendar(identifier: .gregorian).date(from: components) else { return nil }
        return Int(date.timeIntervalSince1970 / 86_400)
    }

    public static func today() -> Int { Int(Date().timeIntervalSince1970 / 86_400) }

    public static func overdue(_ tasks: [PlannerTask], today: Int = TaskDeadlines.today()) -> [PlannerTask] {
        tasks.filter { $0.status != .done }.filter { task in
            guard let due = dueEpochDay(task) else { return false }
            return due < today
        }
    }

    /// Open, dated tasks falling inside the next `windowDays` days, in date order.
    public static func upcoming(
        _ tasks: [PlannerTask],
        today: Int = TaskDeadlines.today(),
        windowDays: Int = 30
    ) -> [PlannerTask] {
        tasks.filter { $0.status != .done }
            .compactMap { task -> (PlannerTask, Int)? in
                guard let due = dueEpochDay(task) else { return nil }
                return (task, due)
            }
            .filter { $0.1 >= today && $0.1 <= today + windowDays }
            .sorted { $0.1 < $1.1 }
            .map(\.0)
    }

    public static func undated(_ tasks: [PlannerTask]) -> [PlannerTask] {
        tasks.filter { $0.status != .done && dueEpochDay($0) == nil }
    }
}

/// Canonical wedding graph slice, loaded once per workspace and shared by its sections.
@MainActor
public final class WeddingGraphState: ObservableObject {
    @Published public var wedding: Wedding?
    @Published public var tasks: [PlannerTask] = []
    @Published public var guests: [Guest] = []
    @Published public var budget: BudgetSummary?
    @Published public var vendors: [VendorPresence] = []
    @Published public var announcements: [WeddingAnnouncement] = []
    @Published public var auditRecords: [CheckInAuditRecord] = []
    @Published public var loading = true
    @Published public var error: String?

    /// The wedding this graph was actually loaded for; nil until a scoped load succeeds.
    @Published public private(set) var scopedWeddingId: String?

    public init() {}

    /// Drops every row so a failed scope can never keep rendering the previous wedding.
    private func clearGraph() {
        wedding = nil
        tasks = []
        guests = []
        budget = nil
        vendors = []
        announcements = []
        auditRecords = []
        scopedWeddingId = nil
    }

    public func load(source: WeddingRepositoryProtocol, weddingId: String) async {
        loading = true
        error = nil
        scopedWeddingId = nil
        do {
            // P0-1: the graph is read through a repository bound to THIS wedding. If the source
            // cannot serve it, forWedding throws rather than returning another wedding's rows.
            let scoped = try await source.forWedding(weddingId)
            wedding = try await scoped.getWedding()
            tasks = try await scoped.getTasks()
            guests = try await scoped.getGuests()
            budget = try await scoped.getBudget()
            vendors = try await scoped.getVendors()
            announcements = try await scoped.getAnnouncements()
            auditRecords = try await scoped.getAuditRecords()
            scopedWeddingId = scoped.weddingId
        } catch is WeddingScopeMismatch {
            clearGraph()
            error = "This workspace is not available for the selected wedding."
        } catch {
            clearGraph()
            self.error = error.localizedDescription
        }
        loading = false
    }
}

/// Level-2 host: documented section chips above repository-backed section content.
public struct WorkspaceSurface<SectionContent: View>: View {
    private let destination: PrimaryDestination
    private let testIdPrefix: String
    private let context: NavigationContext
    @ObservedObject private var sectionMemory: WorkspaceSectionMemory
    private let sectionContent: (String) -> SectionContent

    public init(
        destination: PrimaryDestination,
        testIdPrefix: String,
        context: NavigationContext,
        sectionMemory: WorkspaceSectionMemory,
        @ViewBuilder sectionContent: @escaping (String) -> SectionContent
    ) {
        self.destination = destination
        self.testIdPrefix = testIdPrefix
        self.context = context
        self.sectionMemory = sectionMemory
        self.sectionContent = sectionContent
    }

    private var selectedSection: String {
        sectionMemory.selected(context, destination.id, default: destination.sections.first ?? destination.label)
    }

    public var body: some View {
        VStack(spacing: 0) {
            WorkspaceSectionChips(
                sections: destination.sections,
                selected: selectedSection,
                testIdPrefix: "\(testIdPrefix)-\(destination.id)"
            ) { sectionMemory.select(context, destination.id, $0) }

            sectionContent(selectedSection)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(WeddingIdentityPalette.ivory)
        .accessibilityIdentifier("\(testIdPrefix)-\(destination.id)")
    }
}

// MARK: - Shared presentation primitives (approved Wewed visual language)

public struct IASectionList<Content: View>: View {
    let title: String
    var subtitle: String?
    @ViewBuilder let content: () -> Content

    public init(_ title: String, _ subtitle: String? = nil, @ViewBuilder content: @escaping () -> Content) {
        self.title = title
        self.subtitle = subtitle
        self.content = content
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Text(title)
                    .font(.system(size: 19, weight: .semibold, design: .serif))
                    .foregroundColor(WeddingIdentityPalette.ink)
                if let subtitle {
                    Text(subtitle)
                        .font(.system(size: 12))
                        .foregroundColor(WeddingIdentityPalette.muted)
                }
                content()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
        }
        .background(WeddingIdentityPalette.ivory)
    }
}

public struct IACard: View {
    let title: String
    var subtitle: String?
    var trailing: String?
    var status: String?
    var testId: String?

    public init(
        _ title: String,
        _ subtitle: String? = nil,
        trailing: String? = nil,
        status: String? = nil,
        testId: String? = nil
    ) {
        self.title = title
        self.subtitle = subtitle
        self.trailing = trailing
        self.status = status
        self.testId = testId
    }

    public var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(WeddingIdentityPalette.ink)
                if let subtitle {
                    Text(subtitle)
                        .font(.system(size: 11))
                        .foregroundColor(WeddingIdentityPalette.muted)
                }
                // Status is carried as text, never colour alone (IA V2 §19).
                if let status {
                    Text(status)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(WeddingIdentityPalette.forest)
                }
            }
            Spacer()
            if let trailing {
                Text(trailing)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(WeddingIdentityPalette.champagneDeep)
            }
        }
        .padding(.horizontal, 13)
        .padding(.vertical, 11)
        .frame(maxWidth: .infinity)
        .background(WeddingIdentityPalette.ivorySoft)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(WeddingIdentityPalette.hairline, lineWidth: 1)
        )
        .accessibilityIdentifier(testId ?? "ia-card")
    }
}

/// Honest unsupported state. Names the section and why it has no data in this environment,
/// so an empty workspace is never mistaken for a wired one (playbook §8, §16).
public struct IAUnsupportedSection: View {
    let section: String
    let reason: String
    let environment: NativeDataEnvironment

    public init(_ section: String, _ reason: String, _ environment: NativeDataEnvironment) {
        self.section = section
        self.reason = reason
        self.environment = environment
    }

    public var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "info.circle")
                .font(.system(size: 26))
                .foregroundColor(WeddingIdentityPalette.muted)
            Text(section)
                .font(.system(size: 17, weight: .semibold, design: .serif))
                .foregroundColor(WeddingIdentityPalette.ink)
            Text(reason)
                .font(.system(size: 12))
                .foregroundColor(WeddingIdentityPalette.muted)
                .multilineTextAlignment(.center)
            Text("Environment: \(environment.title)")
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(WeddingIdentityPalette.muted)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(WeddingIdentityPalette.ivory)
        .accessibilityIdentifier("unsupported-section")
    }
}

public struct IALoading: View {
    public init() {}
    public var body: some View {
        ProgressView()
            .tint(WeddingIdentityPalette.champagneDeep)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(WeddingIdentityPalette.ivory)
    }
}

// MARK: - Guests workspace (Couple) — IA V2 §4

public struct CoupleGuestsSection: View {
    let section: String
    @ObservedObject var graph: WeddingGraphState
    let environment: NativeDataEnvironment

    public init(section: String, graph: WeddingGraphState, environment: NativeDataEnvironment) {
        self.section = section
        self.graph = graph
        self.environment = environment
    }

    public var body: some View {
        if graph.loading {
            IALoading()
        } else {
            switch section {
            case "Guest List":
                IASectionList("Guest List", "\(graph.guests.count) households • \(graph.guests.reduce(0) { $0 + $1.partySize }) guests") {
                    ForEach(graph.guests) { guest in
                        IACard(
                            guest.name,
                            "\(guest.householdName ?? "—") • party of \(guest.partySize)",
                            trailing: guest.rsvpStatus.title,
                            testId: "guest-row-\(guest.id)"
                        )
                    }
                }
            case "RSVP":
                let attending = graph.guests.filter { $0.rsvpStatus == .attending }.count
                let pending = graph.guests.filter { $0.rsvpStatus == .pending }.count
                let declined = graph.guests.filter { $0.rsvpStatus == .declined }.count
                IASectionList("RSVP", "\(attending) attending • \(pending) pending • \(declined) declined") {
                    ForEach(graph.guests) { guest in
                        IACard(guest.name, "Party of \(guest.partySize)", trailing: guest.rsvpStatus.title)
                    }
                }
            // P0-14: a Wedding Pass serial is not proof that an invitation was delivered, and no
            // invitation entity exists in the wedding graph, so delivery state cannot be claimed.
            case "Invitations":
                IAUnsupportedSection(
                    "Invitations",
                    "Invitation delivery is not recorded in the wedding graph. A Wedding Pass serial only shows that a pass exists, which is not evidence that an invitation was sent or received.",
                    environment
                )
            case "Groups / Households":
                let households = Dictionary(grouping: graph.guests) { $0.householdName ?? "Unassigned" }
                IASectionList("Groups / Households", "\(households.count) groups") {
                    ForEach(households.keys.sorted(), id: \.self) { household in
                        let members = households[household] ?? []
                        IACard(
                            household,
                            members.map(\.name).joined(separator: ", "),
                            trailing: "\(members.reduce(0) { $0 + $1.partySize })"
                        )
                    }
                }
            case "Seating":
                let seated = graph.guests.filter { $0.tableName != nil }.count
                IASectionList("Seating", "\(seated) of \(graph.guests.count) households seated") {
                    ForEach(graph.guests) { guest in
                        IACard(
                            guest.name,
                            guest.tableName ?? "Not yet assigned",
                            trailing: guest.tableNumber.map(String.init)
                        )
                    }
                }
            case "Passes / QR":
                IASectionList("Passes / QR", "Wedding Pass issuance by household") {
                    ForEach(graph.guests) { guest in
                        IACard(
                            guest.name,
                            guest.passSerial ?? "No pass serial recorded",
                            trailing: guest.checkedIn ? "Admitted" : nil,
                            status: guest.checkedIn ? "\(guest.checkedInCount)/\(guest.partySize) admitted" : nil
                        )
                    }
                }
            case "Messages":
                IAUnsupportedSection(
                    "Messages",
                    "Guest messaging has no native message contract in this environment yet. No conversation data is fabricated.",
                    environment
                )
            default:
                IAUnsupportedSection(section, "This section is not wired to a repository yet.", environment)
            }
        }
    }
}

// MARK: - Wedding Day workspace — shared by Couple / Guest / Planner / Coordinator

public struct WeddingDaySection<PassContent: View>: View {
    let section: String
    @ObservedObject var graph: WeddingGraphState
    let environment: NativeDataEnvironment
    /// The guest whose table may be shown. Nil means no guest identity is bound (P0-4).
    let boundGuestId: String?
    let passContent: (() -> PassContent)?

    public init(
        section: String,
        graph: WeddingGraphState,
        environment: NativeDataEnvironment,
        boundGuestId: String? = nil,
        passContent: (() -> PassContent)? = nil
    ) {
        self.section = section
        self.graph = graph
        self.environment = environment
        self.boundGuestId = boundGuestId
        self.passContent = passContent
    }

    public var body: some View {
        if graph.loading {
            IALoading()
        } else {
            switch section {
            case "My Pass", "Wedding Pass":
                if let passContent {
                    passContent()
                } else {
                    IAUnsupportedSection(section, "No Wedding Pass is issued for this actor in the active wedding.", environment)
                }
            case "Programme", "Programme Status":
                IASectionList("Programme", graph.wedding?.venueName) {
                    ForEach(graph.wedding?.programme ?? []) { item in
                        IACard(
                            item.title,
                            "\(item.location) • \(item.description)",
                            trailing: item.time,
                            testId: "programme-\(item.id)"
                        )
                    }
                }
            case "Venue & Maps", "Venue", "Maps", "Venue Map":
                IASectionList("Venue", graph.wedding?.venueName) {
                    if let wedding = graph.wedding {
                        IACard(wedding.venueName, wedding.venueAddress)
                        IACard("City", "\(wedding.city), \(wedding.country)")
                    }
                }
            case "Vendor Status", "Vendor Arrivals":
                IASectionList("Vendor Status", "\(graph.vendors.count) vendors on site plan") {
                    ForEach(graph.vendors) { vendor in
                        IACard(
                            vendor.vendorName,
                            "\(vendor.serviceCategory) • \(vendor.serviceArea)",
                            trailing: vendor.expectedTime,
                            status: vendor.state.title,
                            testId: "vendor-\(vendor.id)"
                        )
                    }
                }
            case "Announcements":
                IASectionList("Announcements", "\(graph.announcements.count) posted") {
                    ForEach(graph.announcements) { announcement in
                        IACard(announcement.title, announcement.message, status: "\(announcement.urgency)")
                    }
                }
            case "Table":
                // P0-4: only the bound guest's own table may be shown here. Falling back to the
                // first seated guest would show another household's name and table.
                let mine = boundGuestId.flatMap { id in graph.guests.first { $0.id == id } }
                IASectionList("Table", "Your seating assignment") {
                    if let mine, let table = mine.tableName {
                        IACard(table, mine.name, testId: "wedding-day-table-\(mine.id)")
                    } else if mine == nil {
                        IACard("No invitation bound", "No guest identity is bound to this session.")
                    } else {
                        IACard("Not yet assigned", "Seating has not been published.")
                    }
                }
            case "Key Contacts", "Contacts", "Emergency Contacts":
                IAUnsupportedSection(
                    section,
                    "No wedding contact directory contract exists natively yet. Contacts are not invented.",
                    environment
                )
            // P0-14: the graph has no wedding-day flag on tasks, so this cannot claim to be
            // "tasks due on the day". It is named for what it actually is: every open task.
            case "Wedding-day Checklist":
                let openTasks = graph.tasks.filter { $0.status != .done }
                IASectionList(
                    "Open planning tasks",
                    "All incomplete tasks. The wedding graph does not mark tasks as wedding-day specific."
                ) {
                    if openTasks.isEmpty {
                        IACard("Nothing outstanding", "All planning tasks are complete.")
                    }
                    ForEach(openTasks) { task in
                        IACard(task.title, task.category, trailing: task.dueDate ?? "No due date", status: task.priority.title)
                    }
                }
            case "Offline Status", "Offline", "Sync Status":
                let unsynced = graph.auditRecords.filter { !$0.isSynced }.count
                IASectionList("Offline & sync", "Local gate manifest state") {
                    IACard("Recorded admissions", "Local audit records", trailing: "\(graph.auditRecords.count)")
                    IACard("Awaiting sync", "Unsynced local scans", trailing: "\(unsynced)")
                }
            default:
                IAUnsupportedSection(section, "This wedding-day section is not wired to a repository yet.", environment)
            }
        }
    }
}

extension WeddingDaySection where PassContent == EmptyView {
    public init(
        section: String,
        graph: WeddingGraphState,
        environment: NativeDataEnvironment,
        boundGuestId: String? = nil
    ) {
        self.init(
            section: section, graph: graph, environment: environment,
            boundGuestId: boundGuestId, passContent: nil
        )
    }
}

public extension NavigationContext {
    /// The guest record this context is bound to (P0-4). Nil means unbound, and callers must
    /// render an honest state rather than falling back to an arbitrary row.
    @MainActor
    func boundGuest(_ graph: WeddingGraphState) -> Guest? {
        guard let guestId = activeGuestId else { return nil }
        return graph.guests.first { $0.id == guestId }
    }
}

// MARK: - Gate Team workspace — IA V2 §8

public struct GateAdmissionsSection: View {
    let section: String
    @ObservedObject var graph: WeddingGraphState
    let environment: NativeDataEnvironment

    public init(section: String, graph: WeddingGraphState, environment: NativeDataEnvironment) {
        self.section = section
        self.graph = graph
        self.environment = environment
    }

    public var body: some View {
        if graph.loading {
            IALoading()
        } else {
            switch section {
            case "Checked In":
                let admitted = graph.guests.filter { $0.checkedInCount > 0 }
                IASectionList("Checked In", "\(admitted.reduce(0) { $0 + $1.checkedInCount }) guests admitted") {
                    ForEach(admitted) { AdmissionRow(guest: $0) }
                    if admitted.isEmpty {
                        IACard("No admissions recorded", "No guest has been scanned yet.")
                    }
                }
            case "Not Arrived":
                let notArrived = graph.guests.filter { $0.checkedInCount == 0 }
                IASectionList("Not Arrived", "\(notArrived.count) households outstanding") {
                    ForEach(notArrived) { AdmissionRow(guest: $0) }
                    if notArrived.isEmpty {
                        IACard("All arrived", "Every expected household has been admitted.")
                    }
                }
            case "Partial Parties":
                let partial = graph.guests.filter { $0.checkedInCount > 0 && $0.checkedInCount < $0.partySize }
                IASectionList("Partial Parties", "\(partial.count) parties partially admitted") {
                    ForEach(partial) { AdmissionRow(guest: $0) }
                    if partial.isEmpty {
                        IACard("No partial parties", "No household is partially admitted.")
                    }
                }
            // P0-14: multiple audit rows for one serial are normal — a household of four can be
            // admitted in several partial scans. A genuine duplicate is an admission beyond the
            // recorded party size, which is what is reported here.
            case "Duplicate Scans":
                let admittedBySerial = Dictionary(grouping: graph.auditRecords) { $0.passSerial }
                    .mapValues { $0.reduce(0) { $0 + $1.countAdmitted } }
                let overAdmitted = graph.guests.filter { guest in
                    guard let serial = guest.passSerial else { return false }
                    return (admittedBySerial[serial] ?? 0) > guest.partySize
                }
                IASectionList("Duplicate Scans", "Admissions beyond the recorded party size") {
                    ForEach(overAdmitted) { guest in
                        IACard(
                            guest.name,
                            "Party of \(guest.partySize)",
                            trailing: "\(admittedBySerial[guest.passSerial ?? ""] ?? 0) admitted"
                        )
                    }
                    if overAdmitted.isEmpty {
                        IACard(
                            "No over-admissions",
                            "No pass has admitted more guests than its recorded party size. Rejected duplicate attempts are not stored in the audit log, so they cannot be listed here."
                        )
                    }
                }
            case "Exceptions":
                let over = graph.guests.filter { $0.checkedInCount > $0.partySize }
                IASectionList("Exceptions", "Capacity and manifest exceptions") {
                    ForEach(over) { AdmissionRow(guest: $0) }
                    if over.isEmpty {
                        IACard("No exceptions", "No admission exceeded its recorded party size.")
                    }
                }
            case "Manual Admission":
                IAUnsupportedSection(
                    "Manual Admission",
                    "Manual admission is an action performed from Scan, not a browsable list. Open Scan to admit without a readable code.",
                    environment
                )
            default:
                IAUnsupportedSection(section, "This admissions section is not wired yet.", environment)
            }
        }
    }
}

struct AdmissionRow: View {
    let guest: Guest
    var body: some View {
        IACard(
            guest.name,
            guest.tableName ?? "No table assigned",
            trailing: "\(guest.checkedInCount)/\(guest.partySize)",
            status: guest.rsvpStatus.title,
            testId: "admission-\(guest.id)"
        )
    }
}

/// Gate guest lookup is operational only: name, party, table, RSVP, admission. No financial data.
public struct GateGuestLookup: View {
    @ObservedObject var graph: WeddingGraphState
    @State private var query = ""

    public init(graph: WeddingGraphState) {
        self.graph = graph
    }

    public var body: some View {
        if graph.loading {
            IALoading()
        } else {
            VStack(spacing: 10) {
                TextField("Search name, household or table", text: $query)
                    .textFieldStyle(.roundedBorder)
                    .accessibilityIdentifier("gate-guest-search")

                ScrollView {
                    VStack(spacing: 8) {
                        ForEach(filtered) { guest in
                            IACard(
                                guest.name,
                                "Party \(guest.partySize) • \(guest.tableName ?? "No table")",
                                trailing: "\(guest.checkedInCount)/\(guest.partySize)",
                                status: guest.rsvpStatus.title
                            )
                        }
                    }
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(WeddingIdentityPalette.ivory)
        }
    }

    private var filtered: [Guest] {
        guard !query.isEmpty else { return graph.guests }
        let needle = query.lowercased()
        return graph.guests.filter {
            $0.name.lowercased().contains(needle)
                || ($0.householdName?.lowercased().contains(needle) ?? false)
                || ($0.tableName?.lowercased().contains(needle) ?? false)
        }
    }
}

// MARK: - Admin workspace — IA V2 §10

public struct AdminAuditSection: View {
    let section: String
    @ObservedObject var graph: WeddingGraphState
    let environment: NativeDataEnvironment

    public init(section: String, graph: WeddingGraphState, environment: NativeDataEnvironment) {
        self.section = section
        self.graph = graph
        self.environment = environment
    }

    public var body: some View {
        if graph.loading {
            IALoading()
        } else {
            switch section {
            case "Check-ins":
                IASectionList("Check-ins", "\(graph.auditRecords.count) admission records") {
                    ForEach(graph.auditRecords) { record in
                        IACard(
                            record.guestName,
                            "\(record.gateName) • usher \(record.usherId)",
                            trailing: "+\(record.countAdmitted)",
                            status: record.isSynced ? "Synced" : "Pending sync"
                        )
                    }
                    if graph.auditRecords.isEmpty {
                        IACard("No check-in records", "No admissions have been recorded for this wedding.")
                    }
                }
            case "Data Changes", "Access Events", "Payments", "Contracts", "Admin Actions":
                IAUnsupportedSection(
                    section,
                    "This audit stream has no native contract yet. Only check-in audit records are available natively, and no audit entries are fabricated.",
                    environment
                )
            default:
                IAUnsupportedSection(section, "This audit section is not wired yet.", environment)
            }
        }
    }
}

/// System health reads real local state rather than hard-coded counters.
public struct AdminDashboardContent: View {
    @ObservedObject var graph: WeddingGraphState
    let context: NavigationContext

    public init(graph: WeddingGraphState, context: NavigationContext) {
        self.graph = graph
        self.context = context
    }

    public var body: some View {
        if graph.loading {
            IALoading()
        } else {
            IASectionList("Dashboard", "Administrative overview for the active scope") {
                IACard("Active wedding in scope", context.activeWeddingTitle, testId: "admin-active-wedding")
                IACard("Data environment", "Native client is bound to this environment", trailing: context.environment.title)
                IACard("Admission records", "Recorded check-ins in scope", trailing: "\(graph.auditRecords.count)")
                IACard("Unsynced admissions", "Awaiting reconciliation", trailing: "\(graph.auditRecords.filter { !$0.isSynced }.count)")
                IACard("Guest households in scope", "From the canonical wedding graph", trailing: "\(graph.guests.count)")
            }
        }
    }
}

// MARK: - Vendor workspace — IA V2 §7

/// Vendor sees only its own engagement, resolved by `NavigationContext.activeEngagementId`.
public struct VendorJobsSection: View {
    let section: String
    @ObservedObject var graph: WeddingGraphState
    let context: NavigationContext

    public init(section: String, graph: WeddingGraphState, context: NavigationContext) {
        self.section = section
        self.graph = graph
        self.context = context
    }

    /// P0-6: only the engagement this vendor is authorized for. There is no "first vendor"
    /// fallback — that would show another company's engagement.
    private var engagement: VendorPresence? {
        guard let engagementId = context.activeEngagementId else { return nil }
        return graph.vendors.first { $0.id == engagementId }
    }

    public var body: some View {
        if graph.loading {
            IALoading()
        } else if let engagement {
            switch section {
            case "Service Details":
                IASectionList(engagement.vendorName, engagement.serviceCategory) {
                    IACard("Service area", engagement.serviceArea)
                    IACard("Expected on site", "Scheduled arrival", trailing: engagement.expectedTime)
                    IACard("Presence", "Current recorded state", status: engagement.state.title)
                }
            case "Venue":
                IASectionList("Venue", graph.wedding?.venueName) {
                    if let wedding = graph.wedding {
                        IACard(wedding.venueName, wedding.venueAddress)
                        IACard("Service area", engagement.serviceArea)
                    }
                }
            case "Tasks":
                IAUnsupportedSection(
                    "Tasks",
                    "Vendor-scoped tasks are not exposed by the native contract. Wedding planning tasks belong to the couple and planner and are deliberately not shown here.",
                    context.environment
                )
            default:
                IAUnsupportedSection(
                    section,
                    "No native contract exists for vendor \(section) yet. Recorded state is shown only where the repository provides it.",
                    context.environment
                )
            }
        } else {
            IAUnsupportedSection(
                section,
                "No service engagement is assigned to this vendor for the active wedding.",
                context.environment
            )
        }
    }
}

public struct VendorScheduleSection: View {
    let section: String
    @ObservedObject var graph: WeddingGraphState
    let context: NavigationContext

    public init(section: String, graph: WeddingGraphState, context: NavigationContext) {
        self.section = section
        self.graph = graph
        self.context = context
    }

    private var engagement: VendorPresence? {
        guard let engagementId = context.activeEngagementId else { return nil }
        return graph.vendors.first { $0.id == engagementId }
    }

    public var body: some View {
        if graph.loading {
            IALoading()
        } else {
            switch section {
            case "Calendar":
                IASectionList("Calendar", graph.wedding?.date) {
                    ForEach(graph.wedding?.programme ?? []) { item in
                        IACard(item.title, item.location, trailing: item.time)
                    }
                }
            case "Arrival Time":
                IASectionList("Arrival Time", engagement?.vendorName) {
                    if let engagement {
                        IACard("Expected arrival", engagement.serviceArea, trailing: engagement.expectedTime)
                        IACard("Recorded presence", "Updated by the wedding-day team", status: engagement.state.title)
                    } else {
                        IACard("No engagement", "No assigned engagement for this wedding.")
                    }
                }
            default:
                IAUnsupportedSection(
                    section,
                    "The native vendor contract records arrival and presence only. \(section) has no recorded value and is not inferred.",
                    context.environment
                )
            }
        }
    }
}
