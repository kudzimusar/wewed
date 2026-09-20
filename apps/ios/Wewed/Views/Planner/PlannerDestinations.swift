import SwiftUI

// MARK: - Core Planning Module Views

public struct PlannerTasksView: View {
    @EnvironmentObject private var appState: AppState
    @State private var tasks: [PlannerTask] = []
    @State private var selectedFilter = "All"

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: WewedSpacing.base) {
                Picker("Filter", selection: $selectedFilter) {
                    Text("All").tag("All")
                    Text("To Do").tag("To Do")
                    Text("In Progress").tag("In Progress")
                    Text("Blocked").tag("Blocked")
                    Text("Done").tag("Done")
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)

                VStack(spacing: WewedSpacing.sm) {
                    ForEach(filteredTasks) { task in
                        HStack {
                            Image(systemName: task.status == .done ? "checkmark.circle.fill" : "circle")
                                .foregroundColor(task.status == .done ? WewedColors.success : WewedColors.gold)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(task.title)
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                                Text("\(task.category) • Priority: \(task.priority.title)")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                        }
                        .padding()
                        .background(Color.white)
                        .cornerRadius(WewedRadius.md)
                    }
                }
                .padding(.horizontal)
            }
            .padding(.vertical)
        }
        .background(WewedColors.ivory)
        .navigationTitle("Tasks Checklist")
        .task {
            if let items = try? await appState.scopedRepository().getTasks() {
                tasks = items
            }
        }
    }

    private var filteredTasks: [PlannerTask] {
        switch selectedFilter {
        case "To Do": return tasks.filter { $0.status == .todo }
        case "In Progress": return tasks.filter { $0.status == .inProgress }
        case "Blocked": return tasks.filter { $0.status == .blocked }
        case "Done": return tasks.filter { $0.status == .done }
        default: return tasks
        }
    }
}

public struct PlannerBudgetView: View {
    @EnvironmentObject private var appState: AppState
    @State private var budget: BudgetSummary? = nil
    @State private var budgetLines: [PlannerBudgetLine] = []

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: WewedSpacing.lg) {
                if let budget {
                    VStack(spacing: 8) {
                        Text("Total Estimated Budget")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                        Text("$\(Int(budget.totalBudget).formattedWithSeparator)")
                            .font(.system(size: 36, weight: .bold))
                            .foregroundColor(WewedColors.gold)
                        ProgressView(value: budget.totalPaid, total: max(1, budget.totalAllocated > 0 ? budget.totalAllocated : budget.totalBudget))
                            .tint(WewedColors.emerald)
                            .padding(.horizontal, 40)
                        Text("$\(Int(budget.totalPaid).formattedWithSeparator) Paid • $\(Int(budget.totalAllocated).formattedWithSeparator) Actual Expenses")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(Color.white)
                    .cornerRadius(WewedRadius.lg)

                    VStack(alignment: .leading, spacing: 12) {
                        Text("Budget Categories")
                            .font(.headline)
                        ForEach(budget.categories) { cat in
                            BudgetItemRow(
                                category: cat.name,
                                allocated: "$\(Int(cat.allocated).formattedWithSeparator)",
                                paid: "$\(Int(cat.spent).formattedWithSeparator)",
                                status: cat.spent >= cat.allocated && cat.allocated > 0 ? "Paid" : (cat.spent > 0 ? "Deposit Paid" : "Allocated")
                            )
                        }
                    }
                    .padding()
                    .background(Color.white)
                    .cornerRadius(WewedRadius.lg)
                }

                if !budgetLines.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Line Items (\(budgetLines.count))")
                            .font(.headline)
                        ForEach(budgetLines) { line in
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(line.vendorName ?? line.category)
                                        .font(.subheadline).fontWeight(.semibold)
                                    Text("\(line.category) • Actual: $\(Int(line.actual).formattedWithSeparator)")
                                        .font(.caption).foregroundColor(.secondary)
                                }
                                Spacer()
                                VStack(alignment: .trailing, spacing: 2) {
                                    Text("$\(Int(line.paid).formattedWithSeparator) paid")
                                        .font(.caption).fontWeight(.bold).foregroundColor(WewedColors.emerald)
                                    Text(line.statusLabel)
                                        .font(.caption2).foregroundColor(.secondary)
                                }
                            }
                            .padding(.vertical, 4)
                            Divider()
                        }
                    }
                    .padding()
                    .background(Color.white)
                    .cornerRadius(WewedRadius.lg)
                }
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Budget Allocation")
        .task {
            if let b = try? await appState.scopedRepository().getBudget() {
                budget = b
            }
            if let lines = try? await appState.plannerRepository.getBudgetLines() {
                budgetLines = lines
            }
        }
    }
}

private struct BudgetItemRow: View {
    let category: String
    let allocated: String
    let paid: String
    let status: String

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(category).font(.subheadline).fontWeight(.semibold)
                Text("Paid: \(paid) of \(allocated)").font(.caption).foregroundColor(.secondary)
            }
            Spacer()
            Text(status)
                .font(.caption2)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(WewedColors.emerald.opacity(0.1))
                .foregroundColor(WewedColors.emerald)
                .cornerRadius(WewedRadius.pill)
        }
        .padding(.vertical, 4)
    }
}

public struct PlannerContributionsView: View {
    @EnvironmentObject private var appState: AppState
    @State private var contributions: [PlannerContributionRecord] = []

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: WewedSpacing.base) {
                VStack(spacing: 6) {
                    Text("Guest Stories & Blessings")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    Text("\(contributions.count) Non-Monetary Messages")
                        .font(.system(size: 24, weight: .bold))
                        .foregroundColor(WewedColors.emerald)
                    Text("Recorded guest memories, wishes, and blessings")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding()
                .frame(maxWidth: .infinity)
                .background(Color.white)
                .cornerRadius(WewedRadius.lg)

                VStack(alignment: .leading, spacing: 10) {
                    Text("Recorded Contributions")
                        .font(.headline)
                    if contributions.isEmpty {
                        Text("No guest contributions recorded yet.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .padding(.vertical, 8)
                    } else {
                        ForEach(contributions) { item in
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(item.contributorLabel)
                                        .font(.subheadline).fontWeight(.semibold)
                                    Text("\(item.typeLabel) • \(item.allocationLabel)")
                                        .font(.caption).foregroundColor(.secondary)
                                }
                                Spacer()
                                Text(item.statusLabel)
                                    .font(.caption2)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(WewedColors.emerald.opacity(0.1))
                                    .foregroundColor(WewedColors.emerald)
                                    .cornerRadius(WewedRadius.pill)
                            }
                            .padding(.vertical, 6)
                            Divider()
                        }
                    }
                }
                .padding()
                .background(Color.white)
                .cornerRadius(WewedRadius.lg)
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Contributions")
        .task {
            if let list = try? await appState.plannerRepository.getContributions() {
                contributions = list
            }
        }
    }
}

public struct PlannerVendorsView: View {
    @EnvironmentObject private var appState: AppState
    @State private var vendors: [VendorPresence] = []
    @State private var vendorEngagements: [PlannerVendorEngagement] = []

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: WewedSpacing.sm) {
                if !vendorEngagements.isEmpty {
                    ForEach(vendorEngagements) { v in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(v.vendorName).font(.subheadline).fontWeight(.semibold)
                                Text("\(v.category) • \(v.nextAction)").font(.caption).foregroundColor(.secondary)
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 2) {
                                Text(v.paymentStatus)
                                    .font(.caption2)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(WewedColors.gold.opacity(0.15))
                                    .foregroundColor(WewedColors.gold)
                                    .cornerRadius(WewedRadius.pill)
                                Text(v.bookingStatus)
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                        .padding()
                        .background(Color.white)
                        .cornerRadius(WewedRadius.md)
                    }
                } else {
                    ForEach(vendors) { v in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(v.vendorName).font(.subheadline).fontWeight(.semibold)
                                Text("\(v.serviceCategory) • \(v.serviceArea)").font(.caption).foregroundColor(.secondary)
                            }
                            Spacer()
                            Text(v.state.title)
                                .font(.caption2)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(WewedColors.gold.opacity(0.15))
                                .foregroundColor(WewedColors.gold)
                                .cornerRadius(WewedRadius.pill)
                        }
                        .padding()
                        .background(Color.white)
                        .cornerRadius(WewedRadius.md)
                    }
                }
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Vendors")
        .task {
            if let list = try? await appState.scopedRepository().getVendors() {
                vendors = list
            }
            if let engs = try? await appState.plannerRepository.getVendorEngagements() {
                vendorEngagements = engs
            }
        }
    }
}

public struct PlannerTimelineView: View {
    @EnvironmentObject private var appState: AppState
    @State private var timeline: [PlannerTimelineEntry] = []

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                if timeline.isEmpty {
                    Text("No timeline items recorded.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .padding()
                } else {
                    ForEach(timeline) { item in
                        HStack(alignment: .top, spacing: 12) {
                            Text(item.time)
                                .font(.subheadline)
                                .fontWeight(.bold)
                                .foregroundColor(WewedColors.gold)
                                .frame(width: 50, alignment: .leading)

                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.title).font(.subheadline).fontWeight(.medium)
                                Text(item.location).font(.caption).foregroundColor(.secondary)
                            }
                            Spacer()
                            Text(item.statusLabel)
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                        .padding()
                        .background(Color.white)
                        .cornerRadius(WewedRadius.md)
                    }
                }
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Timeline & Run-Sheet")
        .task {
            if let items = try? await appState.plannerRepository.getTimelineEntries() {
                timeline = items
            }
        }
    }
}

public struct PlannerSeatingView: View {
    @EnvironmentObject private var appState: AppState
    @State private var tables: [PlannerSeatingTable] = []

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                if tables.isEmpty {
                    Text("No seating tables recorded.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .padding()
                } else {
                    ForEach(tables) { tbl in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(tbl.name).font(.subheadline).fontWeight(.semibold)
                                Text("\(tbl.assigned) of \(tbl.capacity) Seats Allocated • \(tbl.zone)").font(.caption).foregroundColor(.secondary)
                            }
                            Spacer()
                            if let attention = tbl.attentionLabel {
                                Text(attention)
                                    .font(.caption2)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color.gray.opacity(0.1))
                                    .cornerRadius(WewedRadius.pill)
                            }
                        }
                        .padding()
                        .background(Color.white)
                        .cornerRadius(WewedRadius.md)
                    }
                }
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Seating & Floor Plan")
        .task {
            if let list = try? await appState.plannerRepository.getSeatingTables() {
                tables = list
            }
        }
    }
}

public struct PlannerGuestsBridgeView: View {
    @EnvironmentObject private var appState: AppState
    @State private var guests: [Guest] = []

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: WewedSpacing.sm) {
                ForEach(guests) { g in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(g.name)
                                .font(.subheadline)
                                .fontWeight(.medium)
                            Text("\(g.tableName ?? "Unseated") • Party of \(g.partySize)")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        Spacer()
                        Text(g.rsvpStatus.rawValue.capitalized)
                            .font(.caption2)
                            .foregroundColor(g.rsvpStatus == .attending ? WewedColors.success : .secondary)
                    }
                    .padding()
                    .background(Color.white)
                    .cornerRadius(WewedRadius.md)
                }
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Guest List Bridge")
        .task {
            if let list = try? await appState.scopedRepository().getGuests() {
                guests = list
            }
        }
    }
}

// MARK: - Planner Tools & Operational Destinations

public struct ClientProfileView: View {
    @EnvironmentObject private var appState: AppState
    @State private var wedding: Wedding? = nil
    @State private var guestCount: Int = 0

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let wedding {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(wedding.coupleNames)
                            .font(.title2).fontWeight(.bold)
                        Text("Wedding Date: \(wedding.date) • \(wedding.venueName), \(wedding.city)")
                            .font(.subheadline).foregroundColor(.secondary)
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.white)
                    .cornerRadius(WewedRadius.lg)

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Wedding Details").font(.headline)
                        Text("Venue: \(wedding.venueName), \(wedding.city), \(wedding.country)").font(.subheadline)
                        Text("Guest Records: \(guestCount) guests on manifest").font(.subheadline)
                        Text("Account Contact: Managed via Planner Workspace").font(.subheadline).foregroundColor(.secondary)
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.white)
                    .cornerRadius(WewedRadius.lg)
                } else {
                    ProgressView("Loading profile...")
                        .padding()
                }
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Client Profile")
        .task {
            if let w = try? await appState.scopedRepository().getWedding() {
                wedding = w
            }
            if let g = try? await appState.scopedRepository().getGuests() {
                guestCount = g.count
            }
        }
    }
}

public struct CollaborationHubView: View {
    public init() {}

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("Planning Team Access & Roles").font(.headline)
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Eleven Eleven Testing").font(.subheadline).fontWeight(.semibold)
                        Text("Lead Planner / Accepted Interest").font(.caption).foregroundColor(.secondary)
                    }
                    Spacer()
                    Text("Verified").font(.caption2).foregroundColor(WewedColors.success)
                }
                .padding()
                .background(Color.white)
                .cornerRadius(WewedRadius.md)

                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Charity & Kudzie").font(.subheadline).fontWeight(.semibold)
                        Text("Couple / Owner").font(.caption).foregroundColor(.secondary)
                    }
                    Spacer()
                    Text("Owner").font(.caption2).foregroundColor(WewedColors.success)
                }
                .padding()
                .background(Color.white)
                .cornerRadius(WewedRadius.md)
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Collaboration Hub")
    }
}

public struct PlannerOperationsView: View {
    @EnvironmentObject private var appState: AppState
    @State private var dashboard: PlannerDashboardSnapshot? = nil

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                Text("Operational Status").font(.headline).frame(maxWidth: .infinity, alignment: .leading)
                if let dashboard {
                    ForEach(dashboard.attentionItems) { item in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(item.title).font(.subheadline).fontWeight(.semibold)
                                Spacer()
                                Text(item.severity.rawValue.capitalized).font(.caption2).foregroundColor(WewedColors.gold)
                            }
                            Text(item.detail).font(.caption).foregroundColor(.secondary)
                        }
                        .padding()
                        .background(Color.white)
                        .cornerRadius(WewedRadius.md)
                    }
                }
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Day-Of Operations")
        .task {
            if let d = try? await appState.plannerRepository.getDashboard() {
                dashboard = d
            }
        }
    }
}

public struct PlannerInvitationToolsView: View {
    @EnvironmentObject private var appState: AppState
    @State private var guests: [Guest] = []

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                Text("Invitations & Pass Status").font(.headline).frame(maxWidth: .infinity, alignment: .leading)
                let attending = guests.filter { $0.rsvpStatus == .attending }.count
                let pending = guests.filter { $0.rsvpStatus == .pending }.count
                let checkedIn = guests.filter { $0.checkedIn }.count

                VStack(alignment: .leading, spacing: 6) {
                    Text("Guest Manifest Summary").font(.subheadline).fontWeight(.semibold)
                    Text("Total Guests: \(guests.count)").font(.caption).foregroundColor(.secondary)
                    Text("Attending: \(attending) • Pending: \(pending) • Checked In: \(checkedIn)").font(.caption).foregroundColor(.secondary)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.white)
                .cornerRadius(WewedRadius.md)
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Invitations & QR Tools")
        .task {
            if let list = try? await appState.scopedRepository().getGuests() {
                guests = list
            }
        }
    }
}

public struct EventCommandView: View {
    @EnvironmentObject private var appState: AppState
    @State private var wedding: Wedding? = nil

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                Text("Event Command Center").font(.headline).frame(maxWidth: .infinity, alignment: .leading)
                if let wedding {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(wedding.coupleNames).font(.subheadline).fontWeight(.semibold)
                        Text("\(wedding.date) • \(wedding.venueName), \(wedding.city)").font(.caption).foregroundColor(.secondary)
                        Text("Lifecycle: \(wedding.lifecycle)").font(.caption2).foregroundColor(WewedColors.gold)
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.white)
                    .cornerRadius(WewedRadius.md)
                }
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Event Command")
        .task {
            if let w = try? await appState.scopedRepository().getWedding() {
                wedding = w
            }
        }
    }
}

public struct ReleaseCenterView: View {
    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                Text("Deliverable Release").font(.headline).frame(maxWidth: .infinity, alignment: .leading)
                Text("No releases queued.")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding()
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Release Centre")
    }
}

public struct WeddingBriefView: View {
    @EnvironmentObject private var appState: AppState
    @State private var wedding: Wedding? = nil

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("Wedding Brief").font(.headline)
                if let wedding {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(wedding.coupleNames).font(.subheadline).fontWeight(.semibold)
                        Text("Date: \(wedding.date)").font(.caption).foregroundColor(.secondary)
                        Text("Venue: \(wedding.venueName), \(wedding.city), \(wedding.country)").font(.caption).foregroundColor(.secondary)
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.white)
                    .cornerRadius(WewedRadius.md)
                }
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Wedding Brief")
        .task {
            if let w = try? await appState.scopedRepository().getWedding() {
                wedding = w
            }
        }
    }
}

public struct NotebookView: View {
    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                Text("No planner notes recorded.")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .padding()
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Notebook")
    }
}

public struct MediaArchiveView: View {
    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                Text("Media Archive").font(.headline).frame(maxWidth: .infinity, alignment: .leading)
                Text("No media assets indexed for this wedding.")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding()
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Media Archive")
    }
}

public struct WewedAIWorkspaceView: View {
    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                Text("Wewed AI Workspace").font(.headline).frame(maxWidth: .infinity, alignment: .leading)
                Text("AI recommendations are active for task scheduling and manifest verification.")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding()
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Wewed AI Workspace")
    }
}

// MARK: - Professional Planner Workspace Destinations

public struct PlannerPortfolioView: View {
    @EnvironmentObject private var appState: AppState
    @State private var wedding: Wedding? = nil
    @State private var doneTasks: Int = 0
    @State private var totalTasks: Int = 0

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                if let wedding {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(wedding.coupleNames).font(.headline)
                            Spacer()
                            Text("Active • \(doneTasks) / \(totalTasks) Tasks").font(.caption2).foregroundColor(WewedColors.gold)
                        }
                        Text(wedding.date).font(.caption).foregroundColor(.secondary)
                        let ratio = totalTasks > 0 ? Double(doneTasks) / Double(totalTasks) : 0.0
                        ProgressView(value: ratio)
                            .tint(WewedColors.emerald)
                        Text("\(Int(ratio * 100))% Complete").font(.caption2).foregroundColor(.secondary)
                    }
                    .padding()
                    .background(Color.white)
                    .cornerRadius(WewedRadius.md)
                }
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Planner Portfolio")
        .task {
            if let w = try? await appState.scopedRepository().getWedding() {
                wedding = w
            }
            if let t = try? await appState.scopedRepository().getTasks() {
                totalTasks = t.count
                doneTasks = t.filter { $0.status == .done }.count
            }
        }
    }
}

public struct PlannerBookingsView: View {
    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                Text("No external consultations queued.")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .padding()
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Consultations & Bookings")
    }
}

public struct ContractGovernanceView: View {
    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                Text("Contract Governance").font(.headline).frame(maxWidth: .infinity, alignment: .leading)
                VStack(alignment: .leading, spacing: 6) {
                    Text("No contracts recorded for this wedding.")
                        .font(.subheadline).fontWeight(.semibold)
                    Text("0 active contracts or formal legal documents recorded on ledger.")
                        .font(.caption).foregroundColor(.secondary)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.white)
                .cornerRadius(WewedRadius.md)
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Contract Governance")
    }
}

public struct ContractIntelligenceView: View {
    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                Text("Contract Intelligence").font(.headline).frame(maxWidth: .infinity, alignment: .leading)
                VStack(alignment: .leading, spacing: 6) {
                    Text("No contracts recorded for this wedding.")
                        .font(.subheadline).fontWeight(.semibold)
                    Text("Contract risk analysis will activate upon contract execution.")
                        .font(.caption).foregroundColor(.secondary)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.white)
                .cornerRadius(WewedRadius.md)
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Contract Intelligence")
    }
}

public struct MarketplaceProfileView: View {
    @EnvironmentObject private var appState: AppState
    @State private var plannerDashboard: PlannerDashboardSnapshot? = nil

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(plannerDashboard?.plannerContext ?? "Eleven Eleven Testing")
                        .font(.title2).fontWeight(.bold)
                    Text("Professional Wedding Planner • Accepted Interest").font(.subheadline).foregroundColor(.secondary)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.white)
                .cornerRadius(WewedRadius.lg)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Active Engagements").font(.headline)
                    Text("• Lead Planning for Charity & Kudzie (23 Dec 2026)").font(.subheadline)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.white)
                .cornerRadius(WewedRadius.lg)
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Marketplace Profile")
        .task {
            if let d = try? await appState.plannerRepository.getDashboard() {
                plannerDashboard = d
            }
        }
    }
}

private extension Int {
    var formattedWithSeparator: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        return formatter.string(from: NSNumber(value: self)) ?? "\(self)"
    }
}

