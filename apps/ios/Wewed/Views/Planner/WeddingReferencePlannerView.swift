import SwiftUI

/// Couple "Plan" tab ("Our Wedding Plan"). Reads through the couple's own RoleScopedAccess.
public struct WeddingReferencePlannerView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var session: SessionStore

    public init() {}

    public var body: some View {
        if let grant = session.activeGrant {
            CouplePlanContent(access: appState.access(for: grant))
        }
    }
}

private enum CouplePlanSection: String, CaseIterable, Identifiable {
    case overview, tasks, budget, vendors

    var id: String { rawValue }

    var title: String {
        switch self {
        case .overview: return "Overview"
        case .tasks: return "Tasks"
        case .budget: return "Budget"
        case .vendors: return "Vendors"
        }
    }

    var worksheet: PlannerWorksheet {
        switch self {
        case .overview: return .overview
        case .tasks: return .tasks
        case .budget: return .budget
        case .vendors: return .vendors
        }
    }
}

private struct CouplePlanContent: View {
    @StateObject private var model: WeddingPlanModel
    @State private var selectedSection: CouplePlanSection = .overview
    @ScaledMetric(relativeTo: .largeTitle) private var titleSize: CGFloat = 28

    init(access: RoleScopedAccess) {
        _model = StateObject(wrappedValue: WeddingPlanModel(access: access))
    }

    var body: some View {
        NavigationStack {
            ZStack {
                WeddingFloralBackground(opacity: 0.018)
                    .accessibilityHidden(true)

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 14) {
                        header
                        sectionPicker

                        if !model.hasLoaded {
                            ProgressView("Loading your plan…")
                                .frame(maxWidth: .infinity)
                                .padding(.top, 80)
                        } else {
                            switch selectedSection {
                            case .overview:
                                overview
                            case .tasks, .budget, .vendors:
                                WorksheetRowsView(model: model, worksheet: selectedSection.worksheet)
                                    .accessibilityElement(children: .contain)
                                    .accessibilityIdentifier("planner-\(selectedSection.rawValue)-root")
                            }
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.top, 12)
                    .padding(.bottom, 24)
                }
                .refreshable { await model.load() }
            }
            #if os(iOS)
            .toolbar(.hidden, for: .navigationBar)
            #endif
            .task { await model.load() }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planner-root")
    }

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 3) {
                Text("Our Wedding Plan")
                    .font(.system(size: titleSize, weight: .semibold, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.ink)
                    .accessibilityAddTraits(.isHeader)
                Text("Plan with clarity. Celebrate with confidence.")
                    .font(.caption)
                    .foregroundStyle(WeddingIdentityPalette.muted)
            }
            Spacer()
            if let coupleNames = model.data.wedding?.coupleNames {
                WeddingMonogramBadge(names: coupleNames, size: 58)
                    .accessibilityHidden(true)
            }
        }
        .accessibilityIdentifier("planner-identity-card")
    }

    private var sectionPicker: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 7) { sectionButtons }
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 7) { sectionButtons }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private var sectionButtons: some View {
        ForEach(CouplePlanSection.allCases) { section in
            Button {
                selectedSection = section
            } label: {
                Text(section.title)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(selectedSection == section ? .white : WeddingIdentityPalette.ink)
                    .padding(.horizontal, 14)
                    .frame(minHeight: 44)
                    .background(selectedSection == section ? WeddingIdentityPalette.forest : WeddingIdentityPalette.ivorySoft, in: Capsule())
                    .overlay(Capsule().stroke(WeddingIdentityPalette.hairline, lineWidth: selectedSection == section ? 0 : 1))
            }
            .buttonStyle(.plain)
            .accessibilityAddTraits(selectedSection == section ? .isSelected : [])
            .accessibilityIdentifier("plan-section-\(section.rawValue)")
        }
    }

    @ViewBuilder
    private var overview: some View {
        if model.data.dashboard != nil || !model.data.tasks.isEmpty {
            WeddingSectionCard {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Planning progress")
                        .font(.system(.headline, design: .serif))
                        .foregroundStyle(WeddingIdentityPalette.ink)
                    Text("\(completionPercent)% of tasks done · \(doneCount) of \(model.data.tasks.count)")
                        .font(.subheadline)
                        .foregroundStyle(WeddingIdentityPalette.muted)
                    ProgressView(value: completionRatio)
                        .tint(WeddingIdentityPalette.forest)
                        .accessibilityHidden(true)
                }
                .accessibilityElement(children: .combine)
            }
        } else if model.failures.contains(.dashboard) {
            LoadFailureText("your plan")
        }

        VStack(spacing: 8) {
            sectionRow("Tasks", subtitle: "\(model.data.tasks.count - doneCount) remaining", icon: "checklist", id: "planner-module-tasks") {
                selectedSection = .tasks
            }
            sectionRow("Budget", subtitle: moduleSubtitle("budget"), icon: "wallet.pass", id: "planner-module-budget") {
                selectedSection = .budget
            }
            link("Contributions", subtitle: moduleSubtitle("contributions"), icon: "gift", id: "planner-module-contributions", worksheet: .contributions)
            sectionRow("Vendors", subtitle: moduleSubtitle("vendors"), icon: "storefront", id: "planner-module-vendors") {
                selectedSection = .vendors
            }
            link("Seating", subtitle: moduleSubtitle("seating"), icon: "table.furniture", id: "planner-module-seating", worksheet: .seating)
            link("Timeline", subtitle: moduleSubtitle("timeline"), icon: "calendar", id: "planner-module-timeline", worksheet: .timeline)
            link("Documents", subtitle: documentsSubtitle, icon: "doc.text", id: "planner-module-documents", worksheet: .documents)
        }
    }

    private func sectionRow(_ title: String, subtitle: String, icon: String, id: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            MenuRowLabel(title, subtitle: subtitle, systemImage: icon)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(id)
    }

    private func link(_ title: String, subtitle: String, icon: String, id: String, worksheet: PlannerWorksheet) -> some View {
        NavigationLink {
            WorksheetScreen(model: model, worksheet: worksheet, identifier: "planner-\(worksheet.slug)-root")
        } label: {
            MenuRowLabel(title, subtitle: subtitle, systemImage: icon)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(id)
    }

    private var doneCount: Int { model.data.tasks.filter { $0.status == .done }.count }

    private var completionRatio: Double {
        model.data.tasks.isEmpty ? 0 : Double(doneCount) / Double(model.data.tasks.count)
    }

    private var completionPercent: Int { Int((completionRatio * 100).rounded()) }

    private var documentsSubtitle: String {
        model.data.documents.isEmpty ? "No contracts or documents recorded" : PlainStatus.plural(model.data.documents.count, "document")
    }

    private func moduleSubtitle(_ id: String) -> String {
        guard let module = model.data.dashboard?.modules.first(where: { $0.id == id }) else {
            return "No figures recorded"
        }
        if let attention = module.attention, !attention.isEmpty {
            return "\(module.value) · \(attention)"
        }
        return module.value
    }
}
