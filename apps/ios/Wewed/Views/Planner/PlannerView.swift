import SwiftUI

public struct PlannerView: View {
    @EnvironmentObject private var appState: AppState
    @State private var tasks: [PlannerTask] = []
    @State private var budget: BudgetSummary? = nil
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
                    // Budget Summary Header
                    if let budget = budget {
                        VStack(spacing: WewedSpacing.sm) {
                            Text("Budget Overview")
                                .font(.headline)
                                .frame(maxWidth: .infinity, alignment: .leading)

                            HStack(spacing: WewedSpacing.md) {
                                BudgetCard(title: "Total", amount: "$\(Int(budget.totalBudget))", color: WewedColors.gold)
                                BudgetCard(title: "Allocated", amount: "$\(Int(budget.totalAllocated))", color: WewedColors.emerald)
                                BudgetCard(title: "Paid", amount: "$\(Int(budget.totalPaid))", color: WewedColors.burgundy)
                            }
                        }
                        .padding()
                        .background(Color.white)
                        .cornerRadius(WewedRadius.lg)
                        .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 2)
                    }

                    // Task Segmented Filter
                    Picker("Filter", selection: $selectedFilter) {
                        ForEach(TaskFilter.allCases, id: \.self) { filter in
                            Text(filter.rawValue).tag(filter)
                        }
                    }
                    .pickerStyle(.segmented)

                    // Task List
                    VStack(spacing: WewedSpacing.sm) {
                        ForEach(filteredTasks) { task in
                            HStack(spacing: WewedSpacing.md) {
                                Button {
                                    toggleTask(task.id)
                                } label: {
                                    Image(systemName: task.status == .done ? "checkmark.circle.fill" : "circle")
                                        .font(.title3)
                                        .foregroundColor(task.status == .done ? WewedColors.success : WewedColors.gold)
                                }

                                VStack(alignment: .leading, spacing: 2) {
                                    Text(task.title)
                                        .font(.subheadline)
                                        .strikethrough(task.status == .done)
                                        .foregroundColor(task.status == .done ? .secondary : .primary)

                                    HStack(spacing: 8) {
                                        Text(task.category)
                                            .font(.caption2)
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 2)
                                            .background(WewedColors.goldLight.opacity(0.4))
                                            .cornerRadius(4)

                                        Text(task.priority.title)
                                            .font(.caption2)
                                            .fontWeight(.bold)
                                            .foregroundColor(priorityColor(task.priority))

                                        if let due = task.dueDate {
                                            Text("Due \(due)")
                                                .font(.caption2)
                                                .foregroundColor(.secondary)
                                        }
                                    }
                                }

                                Spacer()
                            }
                            .padding()
                            .background(Color.white)
                            .cornerRadius(WewedRadius.md)
                            .shadow(color: Color.black.opacity(0.02), radius: 4, x: 0, y: 1)
                        }
                    }
                }
                .padding(.horizontal, WewedSpacing.base)
                .padding(.bottom, WewedSpacing.xl)
            }
            .background(WewedColors.ivory)
            .navigationTitle("Wedding Planner")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showingCreateSheet = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .foregroundColor(WewedColors.gold)
                    }
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
                do {
                    tasks = try await appState.repository.getTasks()
                    budget = try await appState.repository.getBudget()
                    isLoading = false
                } catch {
                    isLoading = false
                }
            }
        }
    }

    private func toggleTask(_ taskId: String) {
        Task {
            if let updated = try? await appState.repository.toggleTask(taskId: taskId) {
                if let idx = tasks.firstIndex(where: { $0.id == taskId }) {
                    tasks[idx] = updated
                }
            }
        }
    }

    private func priorityColor(_ priority: TaskPriority) -> Color {
        switch priority {
        case .low: return .secondary
        case .medium: return WewedColors.emerald
        case .high: return WewedColors.warning
        case .urgent: return WewedColors.error
        }
    }
}

private struct BudgetCard: View {
    let title: String
    let amount: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
            Text(amount)
                .font(.subheadline)
                .fontWeight(.bold)
                .foregroundColor(color)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(color.opacity(0.1))
        .cornerRadius(WewedRadius.sm)
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
