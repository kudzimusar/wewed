import SwiftUI

public struct WeddingReferenceHomeView: View {
    @EnvironmentObject private var appState: AppState
    @State private var wedding: Wedding?
    @State private var tasks: [PlannerTask] = []
    @State private var guests: [Guest] = []
    @State private var budget: BudgetSummary?
    @State private var vendors: [VendorPresence] = []
    @State private var isLoading = true

    /// Invoked by the notifications control. P0-11: Couple Home must not open an arbitrary
    /// guest's invitation — a specific guest invitation may only open after the couple selects
    /// that guest, so this routes to the couple-facing Guests -> RSVP surface.
    private let onOpenPendingRsvps: (() -> Void)?

    public init(onOpenPendingRsvps: (() -> Void)? = nil) {
        self.onOpenPendingRsvps = onOpenPendingRsvps
    }

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
                        // Pin the screen body to the bounded content width so no single child
                        // can widen the page (P0 responsive contract).
                        .wewedBoundedWidth(horizontalInset: 28)
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
        }
        .accessibilityIdentifier("home-root")
    }

    private func hero(_ wedding: Wedding) -> some View {
        ZStack(alignment: .bottomLeading) {
            WewedMediaImage(WewedAsset.heroWedding)
                .scaledToFill()
                // Parent width controls media: the hero fills the measured container width
                // instead of reporting its own aspect-driven width to the layout.
                .wewedMedia(height: 390, horizontalInset: 28)

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
                ZStack {
                    WeddingBrandMark()

                    HStack {
                        Spacer()
                        Button {
                            onOpenPendingRsvps?()
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

                // Live countdown, matching the Android implementation which recomputes every
                // second. Previously this was evaluated once at render and never moved.
                TimelineView(.periodic(from: .now, by: 1)) { _ in
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

                Text("“Two hearts, one beautiful tomorrow.”")
                    .font(.system(size: 16, design: .serif))
                    .italic()
                    .foregroundStyle(.white.opacity(0.92))
                    .padding(.top, 3)
            }
            .padding(16)
        }
        .wewedMedia(height: 390, horizontalInset: 28)
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
            metricButton(
                title: "Tasks",
                value: "\(tasks.filter { $0.status != .done }.count) left",
                icon: "checklist",
                tab: .plan,
                identifier: "home-metric-tasks"
            )
            metricButton(
                title: "Budget",
                value: currencyShort(budget?.totalBudget ?? 0),
                icon: "wallet.pass",
                tab: .plan,
                identifier: "home-metric-budget"
            )
            metricButton(
                title: "Guests",
                value: "\(guests.count)",
                icon: "person.2",
                tab: .guests,
                identifier: "home-metric-guests"
            )
            metricButton(
                title: "Vendors",
                value: "\(vendors.count)",
                icon: "storefront",
                tab: .plan,
                identifier: "home-metric-vendors"
            )
        }
        .accessibilityIdentifier("home-metrics")
    }

    private func metricButton(
        title: String,
        value: String,
        icon: String,
        tab: AppTab,
        identifier: String
    ) -> some View {
        Button {
            appState.selectedTab = tab
        } label: {
            WeddingMetricTile(title: title, value: value, icon: icon)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
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
            async let w = appState.scopedRepository().getWedding()
            async let t = appState.scopedRepository().getTasks()
            async let g = appState.scopedRepository().getGuests()
            async let b = appState.scopedRepository().getBudget()
            async let v = appState.scopedRepository().getVendors()

            let loadedWedding = try await w
            wedding = loadedWedding
            tasks = try await t
            guests = try await g
            budget = try await b
            vendors = try await v
            isLoading = false
        } catch {
            isLoading = false
        }
    }

    private func currencyShort(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        formatter.maximumFractionDigits = 0
        formatter.minimumFractionDigits = 0
        return formatter.string(from: NSNumber(value: amount)) ?? String(format: "$%.0f", amount)
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
