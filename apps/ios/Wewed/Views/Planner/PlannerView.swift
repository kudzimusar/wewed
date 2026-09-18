import SwiftUI

public struct PlannerView: View {
    @EnvironmentObject private var appState: AppState
    @State private var dashboard: PlannerDashboardSnapshot? = nil
    @State private var tasks: [PlannerTask] = []
    @State private var selectedFilter: TaskFilter = .all
    @State private var showingCreateSheet: Bool = false
    @State private var isLoading: Bool = true

    enum TaskFilter: String, CaseIterable {
        case all = "All"
        case todo = "To Do"
        case inProgress = "In Progress"
        case done = "Done"
    }

    public init() {}

    private var filteredTasks: [PlannerTask] {
        switch selectedFilter {
        case .all: return tasks
        case .todo: return tasks.filter { $0.status == .todo }
        case .inProgress: return tasks.filter { $0.status == .inProgress }
        case .done: return tasks.filter { $0.status == .done }
        }
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: WewedSpacing.lg) {
                    if let dashboard {
                        plannerIdentityCard(dashboard)
                        readinessCard(dashboard)
                        attentionCard(dashboard)
                        planningModules(dashboard)
                        priorityTasks
                        recentActivity(dashboard)
                        sourceCard(dashboard)
                    } else if isLoading {
                        ProgressView("Loading planning workspace...")
                            .padding(.top, 60)
                    } else {
                        ContentUnavailableView(
                            "Planner unavailable",
                            systemImage: "exclamationmark.triangle",
                            description: Text("The isolated planner repository could not load this workspace.")
                        )
                    }
                }
                .padding(.horizontal, WewedSpacing.base)
                .padding(.bottom, WewedSpacing.xl)
            }
            .background(WewedColors.ivory)
            .navigationTitle("Wedding Planner")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Text(appState.dataEnvironment.title.uppercased())
                        .font(.caption2)
                        .fontWeight(.bold)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(WewedColors.emerald.opacity(0.12))
                        .foregroundColor(WewedColors.emerald)
                        .clipShape(Capsule())
                }
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showingCreateSheet = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .foregroundColor(WewedColors.gold)
                    }
                    .accessibilityLabel("Add planner task")
                }
            }
            .sheet(isPresented: $showingCreateSheet) {
                CreateTaskSheet { title, priority, category in
                    Task {
                        if let created = try? await appState.repository.createTask(title: title, priority: priority, category: category) {
                            tasks.append(created)
                        }
                    }
                }
            }
            .task {
                await loadWorkspace()
            }
        }
    }

    private func plannerIdentityCard(_ dashboard: PlannerDashboardSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(dashboard.plannerContext.uppercased())
                .font(.caption2)
                .fontWeight(.bold)
                .tracking(1.2)
                .foregroundColor(WewedColors.goldDark)
            Text(dashboard.coupleNames)
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(WewedColors.textPrimaryLight)
            Text(dashboard.weddingDateLabel)
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color.white)
        .cornerRadius(WewedRadius.lg)
        .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 2)
    }

    private func readinessCard(_ dashboard: PlannerDashboardSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("PLANNING HEALTH")
                        .font(.caption2)
                        .fontWeight(.bold)
                        .tracking(1.4)
                        .foregroundColor(WewedColors.goldDark)
                    Text("Ready for the next planning milestone")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
                Text("\(dashboard.readinessScore)%")
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(WewedColors.emerald)
            }

            ProgressView(value: Double(dashboard.readinessScore), total: 100)
                .tint(WewedColors.emerald)
        }
        .padding()
        .background(Color.white)
        .cornerRadius(WewedRadius.lg)
    }

    private func attentionCard(_ dashboard: PlannerDashboardSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Needs Attention")
                .font(.headline)

            ForEach(dashboard.attentionItems.prefix(5)) { item in
                HStack(alignment: .top, spacing: 10) {
                    Circle()
                        .fill(attentionColor(item.severity))
                        .frame(width: 8, height: 8)
                        .padding(.top, 5)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.title)
                            .font(.subheadline)
                            .fontWeight(.semibold)
                        Text(item.detail)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                }
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(WewedRadius.lg)
    }

    private func planningModules(_ dashboard: PlannerDashboardSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Planning Areas")
                .font(.headline)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                ForEach(dashboard.modules) { module in
                    NavigationLink {
                        moduleDestination(module.id)
                    } label: {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Image(systemName: module.systemImage)
                                    .foregroundColor(WewedColors.gold)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            Text(module.title)
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .foregroundColor(WewedColors.textPrimaryLight)
                            Text(module.value)
                                .font(.headline)
                                .foregroundColor(WewedColors.emerald)
                            if let attention = module.attention {
                                Text(attention)
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                                    .lineLimit(2)
                            }
                        }
                        .frame(maxWidth: .infinity, minHeight: 118, alignment: .leading)
                        .padding()
                        .background(Color.white)
                        .cornerRadius(WewedRadius.lg)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var priorityTasks: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Priority Tasks")
                    .font(.headline)
                Spacer()
                Text("\(tasks.filter { $0.status != .done }.count) open")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Picker("Filter", selection: $selectedFilter) {
                ForEach(TaskFilter.allCases, id: \.self) { filter in
                    Text(filter.rawValue).tag(filter)
                }
            }
            .pickerStyle(.segmented)

            ForEach(filteredTasks.prefix(4)) { task in
                HStack(spacing: 10) {
                    Button {
                        toggleTask(task.id)
                    } label: {
                        Image(systemName: task.status == .done ? "checkmark.circle.fill" : "circle")
                            .foregroundColor(task.status == .done ? WewedColors.success : WewedColors.gold)
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text(task.title)
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .strikethrough(task.status == .done)
                        Text("\(task.category) • \(task.priority.title)")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                }
                .padding()
                .background(Color.white)
                .cornerRadius(WewedRadius.md)
            }

            NavigationLink {
                PlannerTasksView()
            } label: {
                Text("Open full task workspace")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(WewedColors.emerald)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
            }
        }
    }

    private func recentActivity(_ dashboard: PlannerDashboardSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Recent Activity")
                .font(.headline)

            ForEach(dashboard.recentActivity) { item in
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "clock.arrow.circlepath")
                        .foregroundColor(WewedColors.gold)
                        .padding(.top, 2)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.title)
                            .font(.subheadline)
                            .fontWeight(.semibold)
                        Text(item.detail)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                    Text(item.relativeTime)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(WewedRadius.lg)
    }

    private func sourceCard(_ dashboard: PlannerDashboardSnapshot) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "shield.lefthalf.filled")
                .foregroundColor(WewedColors.emerald)
            VStack(alignment: .leading, spacing: 2) {
                Text("Isolated native data")
                    .font(.caption)
                    .fontWeight(.semibold)
                Text(dashboard.sourceLabel)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            Spacer()
        }
        .padding()
        .background(WewedColors.emerald.opacity(0.08))
        .cornerRadius(WewedRadius.md)
    }

    @ViewBuilder
    private func moduleDestination(_ id: String) -> some View {
        switch id {
        case "tasks": PlannerTasksView()
        case "budget": PlannerBudgetView()
        case "contributions": PlannerContributionsView()
        case "vendors": PlannerVendorsView()
        case "guests": PlannerGuestsBridgeView()
        case "seating": PlannerSeatingView()
        case "timeline": PlannerTimelineView()
        default:
            Text("Planning module unavailable")
        }
    }

    private func attentionColor(_ severity: PlannerAttentionSeverity) -> Color {
        switch severity {
        case .info: return WewedColors.emerald
        case .warning: return WewedColors.warning
        case .urgent: return WewedColors.error
        }
    }

    private func loadWorkspace() async {
        do {
            async let dashboardTask = appState.plannerRepository.getDashboard()
            async let tasksTask = appState.repository.getTasks()
            dashboard = try await dashboardTask
            tasks = try await tasksTask
            isLoading = false
        } catch {
            isLoading = false
        }
    }

    private func toggleTask(_ taskId: String) {
        Task {
            if let updated = try? await appState.repository.toggleTask(taskId: taskId),
               let idx = tasks.firstIndex(where: { $0.id == taskId }) {
                tasks[idx] = updated
            }
        }
    }
}

public struct CreateTaskSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var title: String = ""
    @State private var priority: TaskPriority = .medium
    @State private var category: String = "Logistics"
    let onSave: (String, TaskPriority, String) -> Void

    public var body: some View {
        NavigationStack {
            Form {
                TextField("Task Title", text: $title)
                Picker("Priority", selection: $priority) {
                    ForEach(TaskPriority.allCases, id: \.self) { p in
                        Text(p.title).tag(p)
                    }
                }
                TextField("Category", text: $category)
            }
            .navigationTitle("New Planner Task")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        if !title.isEmpty {
                            onSave(title, priority, category)
                            dismiss()
                        }
                    }
                    .disabled(title.isEmpty)
                }
            }
        }
    }
}
