import SwiftUI

public struct WeddingReferenceHomeView: View {
    @EnvironmentObject private var appState: AppState
    @State private var wedding: Wedding?
    @State private var tasks: [PlannerTask] = []
    @State private var guests: [Guest] = []
    @State private var budget: BudgetSummary?
    @State private var vendors: [VendorPresence] = []
    @State private var invitation: InvitationContext?
    @State private var showingInvitation = false
    @State private var isLoading = true

    @ScaledMetric(relativeTo: .largeTitle) private var namesSize: CGFloat = 39
    @ScaledMetric(relativeTo: .title3) private var dateSize: CGFloat = 20
    @ScaledMetric(relativeTo: .title2) private var countdownSize: CGFloat = 24
    @ScaledMetric(relativeTo: .body) private var heroHeight: CGFloat = 390

    public init() {}

    public var body: some View {
        NavigationStack {
            ZStack {
                WeddingFloralBackground(opacity: 0.035)
                    .accessibilityHidden(true)

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
                    } else {
                        LoadFailureText("your wedding")
                            .padding(16)
                    }
                }
            }
            #if os(iOS)
            .toolbar(.hidden, for: .navigationBar)
            #endif
            .task { await load() }
            .sheet(isPresented: $showingInvitation) {
                if let invitation {
                    IvoryInvitationView(
                        invitation: invitation,
                        mode: .preview,
                        fallbackVenue: wedding?.venueLocation,
                        allowsClose: true
                    )
                } else {
                    VStack(spacing: 16) {
                        EmptyStateText("There is no guest invitation to preview yet.", identifier: "invitation-preview-unavailable")
                        Button("Close") { showingInvitation = false }
                            .buttonStyle(WeddingActionButtonStyle(.secondary))
                    }
                    .padding(24)
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("home-root")
    }

    private func hero(_ wedding: Wedding) -> some View {
        heroContent(wedding)
            .padding(16)
            .padding(.top, 64)
            .frame(maxWidth: .infinity, minHeight: heroHeight, alignment: .bottomLeading)
            .overlay(alignment: .top) {
                HStack(alignment: .top) {
                    WeddingBrandMark()
                    Spacer()
                    Button {
                        showingInvitation = true
                    } label: {
                        Label("Preview invitation", systemImage: "envelope.open")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 12)
                            .frame(minHeight: 44)
                            .background(.black.opacity(0.35), in: Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("Shows the invitation the way your guests see it")
                    .accessibilityIdentifier("home-open-invitation")
                }
                .padding(16)
            }
            .background {
                ZStack {
                    Image("hero-wedding", bundle: .module)
                        .resizable()
                        .scaledToFill()
                    LinearGradient(
                        colors: [
                            .clear,
                            Color.black.opacity(0.12),
                            Color.black.opacity(0.78)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                }
                .accessibilityHidden(true)
            }
            .clipShape(RoundedRectangle(cornerRadius: 23))
            .overlay(
                RoundedRectangle(cornerRadius: 23)
                    .stroke(WeddingIdentityPalette.champagne.opacity(0.35), lineWidth: 1)
            )
    }

    private func heroContent(_ wedding: Wedding) -> some View {
            VStack(alignment: .leading, spacing: 9) {
                Text(wedding.coupleNames)
                    .font(.system(size: namesSize, weight: .regular, design: .serif))
                    .italic()
                    .foregroundStyle(.white)
                    .fixedSize(horizontal: false, vertical: true)

                Text("OUR WEDDING JOURNEY")
                    .font(.caption.weight(.semibold))
                    .tracking(3)
                    .foregroundStyle(.white.opacity(0.90))

                Text(WeddingDateText.short(wedding.date).uppercased())
                    .font(.system(size: dateSize, weight: .semibold))
                    .tracking(2.2)
                    .foregroundStyle(.white)
                    .accessibilityLabel(WeddingDateText.long(wedding.date))

                if let countdown = countdown(from: wedding.date) {
                    ViewThatFits(in: .horizontal) {
                        HStack(spacing: 7) { countdownTiles(countdown) }
                        Text("\(countdown.days) days to go")
                            .font(.headline)
                            .foregroundStyle(.white)
                    }
                    .padding(.top, 5)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(countdown.days) days, \(countdown.hours) hours and \(countdown.minutes) minutes to go")
                }

                Text("“Two hearts, one beautiful tomorrow.”")
                    .font(.system(.callout, design: .serif))
                    .italic()
                    .foregroundStyle(.white.opacity(0.92))
                    .padding(.top, 3)
            }
    }

    @ViewBuilder
    private func countdownTiles(_ countdown: (days: Int, hours: Int, minutes: Int, seconds: Int)) -> some View {
        countdownTile(countdown.days, "Days")
        countdownTile(countdown.hours, "Hours")
        countdownTile(countdown.minutes, "Mins")
        countdownTile(countdown.seconds, "Secs")
    }

    private func countdownTile(_ value: Int, _ label: String) -> some View {
        VStack(spacing: 1) {
            Text("\(value)")
                .font(.system(size: countdownSize, weight: .medium, design: .serif))
            Text(label)
                .font(.caption2)
        }
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(.black.opacity(0.46), in: RoundedRectangle(cornerRadius: 10))
    }

    private var continuePlanning: some View {
        WeddingSectionCard {
            Button {
                appState.selectedTab = .plan
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "checklist")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(WeddingIdentityPalette.champagneDeep)
                        .frame(width: 52, height: 52)
                        .background(WeddingIdentityPalette.champagne.opacity(0.15), in: RoundedRectangle(cornerRadius: 13))
                        .accessibilityHidden(true)

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Continue Planning")
                            .font(.system(.headline, design: .serif))
                            .foregroundStyle(WeddingIdentityPalette.ink)
                        Text("\(taskCompletionPercent)% of tasks done")
                            .font(.footnote)
                            .foregroundStyle(WeddingIdentityPalette.muted)
                        ProgressView(value: taskCompletionRatio)
                            .tint(WeddingIdentityPalette.forest)
                            .accessibilityHidden(true)
                    }

                    Spacer()

                    Image(systemName: "chevron.right")
                        .foregroundStyle(WeddingIdentityPalette.champagneDeep)
                        .accessibilityHidden(true)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("home-continue-planning")
        }
    }

    private var metrics: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 8) { metricButtons }
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) { metricButtons }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("home-metrics")
    }

    @ViewBuilder
    private var metricButtons: some View {
        metricButton(
            title: "Tasks",
            value: "\(tasks.filter { $0.status != .done }.count) left",
            icon: "checklist",
            tab: .plan,
            identifier: "home-metric-tasks"
        )
        metricButton(
            title: "Budget",
            value: budget.map { WeddingMoney.format($0.totalBudget, currency: $0.currency) } ?? "Not recorded",
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
            VStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(WeddingIdentityPalette.champagneDeep)
                    .frame(width: 44, height: 44)
                    .background(WeddingIdentityPalette.champagne.opacity(0.14), in: RoundedRectangle(cornerRadius: 12))
                    .accessibilityHidden(true)
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(WeddingIdentityPalette.ink)
                Text(value)
                    .font(.footnote)
                    .foregroundStyle(WeddingIdentityPalette.muted)
                    .multilineTextAlignment(.center)
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
            }
            .frame(maxWidth: .infinity, minHeight: 44)
            .padding(.vertical, 12)
            .background(WeddingIdentityPalette.ivorySoft, in: RoundedRectangle(cornerRadius: 15))
            .overlay(RoundedRectangle(cornerRadius: 15).stroke(WeddingIdentityPalette.hairline, lineWidth: 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
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
        defer { isLoading = false }
        guard let loadedWedding = try? await appState.repository.getWedding() else { return }
        wedding = loadedWedding
        tasks = (try? await appState.repository.getTasks()) ?? []
        guests = (try? await appState.repository.getGuests()) ?? []
        budget = try? await appState.repository.getBudget()
        vendors = (try? await appState.repository.getVendors()) ?? []
        // Preview the invitation of a real guest record; resolving it never changes the guest.
        if let guest = guests.first(where: { $0.rsvpStatus == .pending }) ?? guests.first {
            invitation = try? await appState.repository.resolveInvitation(weddingSlug: loadedWedding.id, token: guest.id)
        } else {
            invitation = nil
        }
    }

    private func countdown(from raw: String) -> (days: Int, hours: Int, minutes: Int, seconds: Int)? {
        guard let date = WeddingDateText.parse(raw) else { return nil }
        let interval = max(0, Int(date.timeIntervalSinceNow))
        return (
            interval / 86_400,
            (interval % 86_400) / 3_600,
            (interval % 3_600) / 60,
            interval % 60
        )
    }
}
