import SwiftUI

public struct WeddingReferencePlannerView: View {
    @EnvironmentObject private var appState: AppState
    @State private var dashboard: PlannerDashboardSnapshot?
    @State private var tasks: [PlannerTask] = []
    @State private var isLoading = true

    /// Receives an IA V2 Level-2 section label (for example "Tasks", "Budget").
    ///
    /// IA V2 is the sole owner of Level-2 navigation, so this view no longer carries its own
    /// Overview/Tasks/Budget/Vendors picker or internal routing — that produced a second, nested
    /// taxonomy stacked underneath the IA V2 chips.
    private let onOpenSection: ((String) -> Void)?

    public init(onOpenSection: ((String) -> Void)? = nil) {
        self.onOpenSection = onOpenSection
    }

    public var body: some View {
        NavigationStack {
            ZStack {
                WeddingFloralBackground(opacity: 0.018)

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 14) {
                        header

                        if isLoading {
                            ProgressView("Loading planner…")
                                .frame(maxWidth: .infinity)
                                .padding(.top, 80)
                        } else {
                            overview
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.top, 12)
                    .padding(.bottom, 24)
                }
            }
            #if os(iOS)
            .toolbar(.hidden, for: .navigationBar)
            #endif
            .task { await load() }
        }
        .accessibilityIdentifier("planner-root")
    }

    private var header: some View {
        HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                Text("Our Wedding Plan")
                    .font(.system(size: 28, weight: .semibold, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.ink)
                Text("Plan with clarity. Celebrate with confidence.")
                    .font(.system(size: 12))
                    .foregroundStyle(WeddingIdentityPalette.muted)
            }
                Spacer()
            if let coupleNames = dashboard?.coupleNames {
                WeddingMonogramBadge(names: coupleNames, size: 58)
            }
        }
        .accessibilityIdentifier("planner-identity-card")
    }

    @ViewBuilder
    private var overview: some View {
        if let dashboard {
            WeddingSectionCard {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Planning Progress")
                                .font(.system(size: 16, weight: .semibold, design: .serif))
                                .foregroundStyle(WeddingIdentityPalette.ink)
                            Text("\(completionPercent)% complete • " + dashboard.taskCompletionLabel + " tasks")
                                .font(.system(size: 12))
                                .foregroundStyle(WeddingIdentityPalette.muted)
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .foregroundStyle(WeddingIdentityPalette.muted)
                    }
                    ProgressView(value: completionRatio)
                        .tint(WeddingIdentityPalette.forest)
                }
            }

            VStack(spacing: 8) {
                plannerRow(title: "Tasks", subtitle: taskSubtitle, icon: "checklist", identifier: "planner-module-tasks") {
                    onOpenSection?("Tasks")
                }
                plannerRow(title: "Budget", subtitle: moduleSubtitle("budget"), icon: "wallet.pass", identifier: "planner-module-budget") {
                    onOpenSection?("Budget")
                }

                plannerRow(title: "Contributions", subtitle: moduleSubtitle("contributions"), icon: "gift", identifier: "planner-module-contributions") { onOpenSection?("Contributions") }

                plannerRow(title: "Vendors", subtitle: moduleSubtitle("vendors"), icon: "storefront", identifier: "planner-module-vendors") {
                    onOpenSection?("Vendors")
                }

                plannerRow(title: "Seating", subtitle: moduleSubtitle("seating"), icon: "table.furniture", identifier: "planner-module-seating") { onOpenSection?("Seating") }

                plannerRow(title: "Timeline", subtitle: moduleSubtitle("timeline"), icon: "calendar", identifier: "planner-module-timeline") { onOpenSection?("Timeline") }

                plannerRow(title: "Documents", subtitle: "Contracts, notes, files", icon: "doc.text", identifier: "planner-module-documents") { onOpenSection?("Documents") }
            }
        } else {
            ContentUnavailableView(
                "Planner unavailable",
                systemImage: "exclamationmark.triangle",
                description: Text("The planner repository did not return a dashboard.")
            )
        }
    }

    private func plannerRow(
        title: String,
        subtitle: String,
        icon: String,
        identifier: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            referenceRow(title: title, subtitle: subtitle, icon: icon)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
    }

    private func referenceRow(title: String, subtitle: String, icon: String) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(WeddingIdentityPalette.champagne.opacity(0.14))
                    .frame(width: 42, height: 42)
                Image(systemName: icon)
                    .foregroundStyle(WeddingIdentityPalette.champagneDeep)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 15, weight: .semibold, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.ink)
                Text(subtitle)
                    .font(.system(size: 12))
                    .foregroundStyle(WeddingIdentityPalette.muted)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(WeddingIdentityPalette.muted)
        }
        .padding(14)
        .background(WeddingIdentityPalette.ivorySoft)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(WeddingIdentityPalette.hairline, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private var completionRatio: Double {
        guard !tasks.isEmpty else { return 0 }
        return Double(tasks.filter { $0.status == .done }.count) / Double(tasks.count)
    }

    private var completionPercent: Int {
        Int((completionRatio * 100).rounded())
    }

    private var taskSubtitle: String {
        "\(tasks.filter { $0.status != .done }.count) remaining"
    }

    private func moduleSubtitle(_ id: String) -> String {
        guard let module = dashboard?.modules.first(where: { $0.id == id }) else {
            return "No data recorded"
        }
        if let attention = module.attention, !attention.isEmpty {
            return "\(module.value) • \(attention)"
        }
        return module.value
    }

    private func load() async {
        do {
            async let d = appState.plannerRepository.getDashboard()
            async let t = appState.scopedRepository().getTasks()
            dashboard = try await d
            tasks = try await t
        } catch {
            dashboard = nil
        }
        isLoading = false
    }
}

private enum PlannerReferenceSection: String, CaseIterable, Identifiable {
    case overview
    case tasks
    case budget
    case vendors

    var id: String { rawValue }

    var title: String {
        switch self {
        case .overview: return "Overview"
        case .tasks: return "Tasks"
        case .budget: return "Budget"
        case .vendors: return "Vendors"
        }
    }
}

private struct ReferenceDocumentsEmptyState: View {
    var body: some View {
        ZStack {
            WeddingFloralBackground()
            VStack(spacing: 12) {
                Image(systemName: "doc.text")
                    .font(.system(size: 36))
                    .foregroundStyle(WeddingIdentityPalette.champagneDeep)
                Text("Documents")
                    .font(.title2)
                    .fontWeight(.semibold)
                Text("No contracts or documents recorded for this wedding.")
                    .font(.subheadline)
                    .foregroundStyle(WeddingIdentityPalette.muted)
            }
            .padding(30)
        }
        .navigationTitle("Documents")
    }
}
