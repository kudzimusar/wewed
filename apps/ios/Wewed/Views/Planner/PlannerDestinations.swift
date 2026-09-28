import SwiftUI

// MARK: - Core Planning Module Views
//
// Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 closure §10 (P1-N4 remainder).
//
// This file used to also define 20 additional views (PlannerBudgetView, PlannerContributionsView,
// PlannerVendorsView, PlannerTimelineView, PlannerSeatingView, ClientProfileView,
// CollaborationHubView, PlannerOperationsView, PlannerInvitationToolsView, EventCommandView,
// ReleaseCenterView, WeddingBriefView, NotebookView, MediaArchiveView, WewedAIWorkspaceView,
// PlannerPortfolioView, PlannerBookingsView, ContractGovernanceView, ContractIntelligenceView,
// MarketplaceProfileView), none of which had a single caller anywhere in the app (confirmed by grep,
// individually, before deletion — the Android sibling commit deleted the same 20 destinations from
// its own `PlannerDestinations.kt`). Several hardcoded a "Charity & Kudzie" wedding, an "Eleven Eleven
// Testing" planner, and invented guest/table/contract counts, exactly the production-reachable-
// fabrication hazard master plan §8.13/P1-N4 exists to close. `BudgetItemRow` and
// `Int.formattedWithSeparator` (private helpers `PlannerBudgetView` alone used) became dead in turn
// once it was removed, and are deleted with it. `PlannerTasksView` and `PlannerGuestsBridgeView` are
// real, reachable destinations (`Views/Roles/RoleWorkspaces.swift`) and are unchanged.

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
