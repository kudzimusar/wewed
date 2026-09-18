import SwiftUI

public struct WeddingReferenceHomeView: View {
    @EnvironmentObject private var appState: AppState
    @State private var wedding: Wedding?
    @State private var dashboard: PlannerDashboardSnapshot?
    @State private var tasks: [PlannerTask] = []
    @State private var guests: [Guest] = []
    @State private var budget: BudgetSummary?
    @State private var vendors: [VendorPresence] = []
    @State private var invitation: InvitationContext?
    @State private var showingInvitation = false
    @State private var isLoading = true

    public init() {}

    public var body: some View {
        NavigationStack {
            ZStack {
                WeddingFloralBackground(opacity: 0.035)

                ScrollView(showsIndicators: false) {
                    if let wedding {
                        VStack(spacing: 14) {
                            hero(wedding)
                            continuePlanning
                            metrics
                        }
                        .padding(.horizontal, 14)
                        .padding(.top, 8)
                        .padding(.bottom, 22)
                    } else if isLoading {
                        ProgressView("Loading wedding…")
                            .padding(.top, 120)
                    }
                }
            }
            #if os(iOS)
            .toolbar(.hidden, for: .navigationBar)
            #endif
            .task { await load() }
            .sheet(isPresented: $showingInvitation) {
                if let invitation {
                    GuestInvitationJourneyView(
                        reference: GuestJourneyReference(
                            invitation: invitation,
                            initialStage: .splash
                        )
                    )
                } else {
                    ProgressView("Preparing invitation…")
                        .padding(40)
                }
            }
        }
        .accessibilityIdentifier("home-root")
    }

    private func hero(_ wedding: Wedding) -> some View {
        ZStack(alignment: .bottomLeading) {
            Image("hero-wedding", bundle: .module)
                .resizable()
                .scaledToFill()
                .frame(height: 390)
                .clipped()

            LinearGradient(
                colors: [
                    .clear,
                    Color.black.opacity(0.12),
                    Color.black.opacity(0.78)
                ],
                startPoint: .top,
                endPoint: .bottom
            )

            VStack(alignment: .leading, spacing: 9) {
                HStack {
                    WeddingMonogram(names: wedding.coupleNames, size: 28)
                        .foregroundStyle(.white)
                    Spacer()
                    Button {
                        showingInvitation = true
                    } label: {
                        Image(systemName: "bell")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(.white)
                            .padding(10)
                            .background(.black.opacity(0.20))
                            .clipShape(Circle())
                    }
                    .accessibilityIdentifier("home-open-invitation")
                }

                Spacer()

                Text(wedding.coupleNames)
                    .font(.system(size: 39, weight: .regular, design: .serif))
                    .italic()
                    .foregroundStyle(.white)

                Text("OUR WEDDING JOURNEY")
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(3)
                    .foregroundStyle(.white.opacity(0.90))

                Text(displayWeddingDate(wedding.date))
                    .font(.system(size: 20, weight: .semibold))
                    .tracking(2.2)
                    .foregroundStyle(.white)

                Text("\(wedding.city.uppercased()), \(wedding.country.uppercased())")
                    .font(.system(size: 10, weight: .medium))
                    .tracking(1.8)
                    .foregroundStyle(.white.opacity(0.86))

                Text("“Two hearts, one beautiful tomorrow.”")
                    .font(.system(size: 16, design: .serif))
                    .italic()
                    .foregroundStyle(.white.opacity(0.92))
                    .padding(.top, 3)

                if let countdown = countdown(from: wedding.date) {
                    HStack(spacing: 7) {
                        countdownTile(countdown.days, "Days")
                        countdownTile(countdown.hours, "Hours")
                        countdownTile(countdown.minutes, "Mins")
                        countdownTile(countdown.seconds, "Secs")
                    }
                    .padding(.top, 5)
                }
            }
            .padding(16)
        }
        .frame(height: 390)
        .clipShape(RoundedRectangle(cornerRadius: 23))
        .overlay(
            RoundedRectangle(cornerRadius: 23)
                .stroke(WeddingIdentityPalette.champagne.opacity(0.35), lineWidth: 1)
        )
    }

    private func countdownTile(_ value: Int, _ label: String) -> some View {
        VStack(spacing: 1) {
            Text("\(value)")
                .font(.system(size: 24, weight: .medium, design: .serif))
            Text(label)
                .font(.system(size: 10))
        }
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(.black.opacity(0.46))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private var continuePlanning: some View {
        WeddingSectionCard {
            Button {
                appState.selectedTab = .plan
            } label: {
                HStack(spacing: 12) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 13)
                            .fill(WeddingIdentityPalette.champagne.opacity(0.15))
                            .frame(width: 52, height: 52)
                        Image(systemName: "checklist")
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundStyle(WeddingIdentityPalette.champagneDeep)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Continue Planning")
                            .font(.system(size: 17, weight: .semibold, design: .serif))
                            .foregroundStyle(WeddingIdentityPalette.ink)
                        Text("You’re \(taskCompletionPercent)% there")
                            .font(.system(size: 13))
                            .foregroundStyle(WeddingIdentityPalette.muted)
                        ProgressView(value: taskCompletionRatio)
                            .tint(WeddingIdentityPalette.forest)
                    }

                    Spacer()

                    Image(systemName: "chevron.right")
                        .foregroundStyle(WeddingIdentityPalette.champagneDeep)
                }
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("home-continue-planning")
        }
    }

    private var metrics: some View {
        HStack(spacing: 8) {
            WeddingMetricTile(
                title: "Tasks",
                value: "\(tasks.filter { $0.status != .done }.count) left",
                icon: "checklist"
            )
            WeddingMetricTile(
                title: "Budget",
                value: currencyShort(budget?.totalBudget ?? 0),
                icon: "wallet.pass"
            )
            WeddingMetricTile(
                title: "Guests",
                value: "\(guests.count)",
                icon: "person.2"
            )
            WeddingMetricTile(
                title: "Vendors",
                value: "\(vendors.count)",
                icon: "storefront"
            )
        }
        .accessibilityIdentifier("home-metrics")
    }

    private var focus: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Today’s Focus")
                    .font(.system(size: 22, weight: .semibold, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.ink)
                Spacer()
                Button("View All") {
                    appState.selectedTab = .plan
                }
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(WeddingIdentityPalette.muted)
            }

            WeddingSectionCard {
                VStack(spacing: 0) {
                    ForEach(Array(focusTasks.prefix(3).enumerated()), id: \.element.id) { index, task in
                        HStack(spacing: 11) {
                            Image(systemName: task.status == .done ? "checkmark.circle.fill" : "circle")
                                .font(.system(size: 20))
                                .foregroundStyle(task.status == .done ? WeddingIdentityPalette.forest : Color.gray.opacity(0.55))

                            VStack(alignment: .leading, spacing: 2) {
                                Text(task.title)
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundStyle(WeddingIdentityPalette.ink)
                                    .lineLimit(2)
                                Text(task.status == .done ? "Completed" : task.priority.title)
                                    .font(.system(size: 11))
                                    .foregroundStyle(task.status == .done ? WeddingIdentityPalette.forest : priorityColor(task.priority))
                            }

                            Spacer()

                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundStyle(WeddingIdentityPalette.muted)
                        }
                        .padding(.vertical, 11)

                        if index < min(focusTasks.count, 3) - 1 {
                            Divider()
                        }
                    }

                    if focusTasks.isEmpty {
                        Text("No planning tasks recorded.")
                            .font(.subheadline)
                            .foregroundStyle(WeddingIdentityPalette.muted)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }
        }
        .accessibilityIdentifier("home-today-focus")
    }

    private var focusTasks: [PlannerTask] {
        tasks.sorted {
            if $0.status == .done && $1.status != .done { return false }
            if $0.status != .done && $1.status == .done { return true }
            return priorityRank($0.priority) > priorityRank($1.priority)
        }
    }

    private var taskCompletionPercent: Int {
        guard !tasks.isEmpty else { return 0 }
        return Int((taskCompletionRatio * 100).rounded())
    }

    private var taskCompletionRatio: Double {
        guard !tasks.isEmpty else { return 0 }
        return Double(tasks.filter { $0.status == .done }.count) / Double(tasks.count)
    }

    private func load() async {
        do {
            async let w = appState.repository.getWedding()
            async let d = appState.plannerRepository.getDashboard()
            async let t = appState.repository.getTasks()
            async let g = appState.repository.getGuests()
            async let b = appState.repository.getBudget()
            async let v = appState.repository.getVendors()

            let loadedWedding = try await w
            wedding = loadedWedding
            dashboard = try await d
            tasks = try await t
            guests = try await g
            budget = try await b
            vendors = try await v
            invitation = try? await appState.repository.resolveInvitation(
                weddingSlug: loadedWedding.id,
                token: "shadow-pending-guest"
            )
            isLoading = false
        } catch {
            isLoading = false
        }
    }

    private func priorityRank(_ priority: TaskPriority) -> Int {
        switch priority {
        case .urgent: return 4
        case .high: return 3
        case .medium: return 2
        case .low: return 1
        }
    }

    private func priorityColor(_ priority: TaskPriority) -> Color {
        switch priority {
        case .urgent: return .red
        case .high: return .red
        case .medium: return WeddingIdentityPalette.champagneDeep
        case .low: return WeddingIdentityPalette.muted
        }
    }

    private func currencyShort(_ amount: Double) -> String {
        if amount >= 1000 {
            return String(format: "$%.1fk", amount / 1000)
        }
        return String(format: "$%.0f", amount)
    }

    private func displayWeddingDate(_ raw: String) -> String {
        let input = DateFormatter()
        input.locale = Locale(identifier: "en_US_POSIX")
        input.dateFormat = "yyyy-MM-dd HH:mm:ss"
        guard let date = input.date(from: raw) else { return raw.uppercased() }

        let output = DateFormatter()
        output.locale = Locale(identifier: "en_US_POSIX")
        output.dateFormat = "dd MMM yyyy"
        return output.string(from: date).uppercased()
    }

    private func countdown(from raw: String) -> (days: Int, hours: Int, minutes: Int, seconds: Int)? {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        guard let date = formatter.date(from: raw) else { return nil }

        let interval = max(0, Int(date.timeIntervalSinceNow))
        return (
            interval / 86_400,
            (interval % 86_400) / 3_600,
            (interval % 3_600) / 60,
            interval % 60
        )
    }
}
