import SwiftUI

public struct HomeView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var session: SessionStore
    @State private var wedding: Wedding? = nil
    @State private var announcements: [WeddingAnnouncement] = []
    @State private var plannerDashboard: PlannerDashboardSnapshot? = nil
    @State private var invitationContext: InvitationContext? = nil
    @State private var quickPass: WeddingPass? = nil
    @State private var isLoading: Bool = true
    @State private var showingInvitationSheet: Bool = false
    @State private var showingVendorSheet: Bool = false
    @State private var showingDirectionsAlert: Bool = false

    public init() {}

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: WewedSpacing.base) {
                    if let wedding = wedding {
                        // 1. Hero / Monogram Card
                        heroCard(wedding: wedding)

                        // 2. Planning pulse — before Wedding Day becomes the dominant lifecycle mode.
                        if let plannerDashboard {
                            planningPulseCard(plannerDashboard)
                        }

                        // 3. Next Programme Milestone
                        nextMilestoneCard(wedding: wedding)

                        // 4. My Wedding Pass Quick Card
                        quickPassCard

                        // 4. Day-Of Announcements Banner
                        announcementsCard

                        // 5. Quick Actions Launcher
                        quickActionGrid

                        // 6. Full Day's Programme
                        programmeCard(wedding: wedding)
                    } else if isLoading {
                        ProgressView("Loading wedding details...")
                            .padding(.top, 60)
                    }
                }
                .padding(.horizontal, WewedSpacing.base)
                .padding(.bottom, WewedSpacing.xl)
            }
            .background(WewedColors.ivory)
            .navigationTitle(wedding?.lifecycle == "day" ? "Wedding Day" : "Wedding Command Centre")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button {
                            showingInvitationSheet = true
                        } label: {
                            Label("Open Ivory Invitation", systemImage: "envelope.fill")
                        }

                        Button {
                            showingVendorSheet = true
                        } label: {
                            Label("Vendor Operations", systemImage: "truck.box.fill")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .foregroundColor(WewedColors.gold)
                    }
                }
            }
            .task {
                loadData()
            }
            .sheet(isPresented: $showingInvitationSheet) {
                if let invitationContext {
                    GuestInvitationJourneyView(
                        reference: GuestJourneyReference(
                            invitation: invitationContext,
                            initialStage: .splash
                        )
                    )
                } else {
                    ProgressView("Preparing invitation...")
                        .padding(40)
                }
            }
            .sheet(isPresented: $showingVendorSheet) {
                VendorPresenceView()
            }
            .alert("Directions to \(wedding?.venueName ?? "Wedding Venue")", isPresented: $showingDirectionsAlert) {
                Button("Open in Apple Maps") {}
                Button("Open in Google Maps") {}
                Button("Cancel", role: .cancel) {}
            } message: {
                if let wedding {
                    Text("\(wedding.venueName), \(wedding.venueAddress), \(wedding.city), \(wedding.country)")
                } else {
                    Text("Venue details are still loading.")
                }
            }
        }
    }

    // MARK: - Components

    private func heroCard(wedding: Wedding) -> some View {
        VStack(spacing: WewedSpacing.sm) {
            Text(coupleInitials(wedding.coupleNames))
                .font(.system(size: 34, weight: .bold, design: .serif))
                .foregroundColor(WewedColors.gold)
                .padding(.top, 6)

            Text(wedding.coupleNames)
                .font(.system(size: 24, weight: .semibold, design: .serif))
                .foregroundColor(WewedColors.textPrimaryLight)

            Text("\(plannerDashboard?.weddingDateLabel ?? displayDateLabel(wedding.date)) • \(wedding.city), \(wedding.country)")
                .font(.subheadline)
                .foregroundColor(WewedColors.textSecondaryLight)

            if let countdown = countdownComponents(from: wedding.date) {
                HStack(spacing: WewedSpacing.md) {
                    CountdownUnit(value: countdown.days, label: "Days")
                    CountdownUnit(value: countdown.hours, label: "Hours")
                    CountdownUnit(value: countdown.minutes, label: "Mins")
                }
                .padding(.top, 4)
            } else {
                Text("Planning timeline active")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(WewedColors.emerald)
                    .padding(.top, 4)
            }
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color.white)
        .cornerRadius(WewedRadius.lg)
        .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 2)
    }

    private func coupleInitials(_ names: String) -> String {
        names
            .components(separatedBy: "&")
            .compactMap { part in
                part.trimmingCharacters(in: .whitespacesAndNewlines).first.map(String.init)
            }
            .joined(separator: " & ")
            .uppercased()
    }

    private func planningPulseCard(_ dashboard: PlannerDashboardSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("PLANNING PULSE")
                        .font(.caption2)
                        .fontWeight(.bold)
                        .tracking(1.4)
                        .foregroundColor(WewedColors.goldDark)
                    Text("What needs attention before Wedding Day")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
                Text("\(dashboard.readinessScore)%")
                    .font(.title3)
                    .fontWeight(.bold)
                    .foregroundColor(WewedColors.emerald)
            }

            ProgressView(value: Double(dashboard.readinessScore), total: 100)
                .tint(WewedColors.emerald)

            HStack(spacing: 8) {
                ForEach(dashboard.modules.prefix(3)) { module in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(module.title)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                        Text(module.value)
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundColor(WewedColors.textPrimaryLight)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }

            if let first = dashboard.attentionItems.first {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "exclamationmark.circle.fill")
                        .foregroundColor(WewedColors.warning)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(first.title)
                            .font(.caption)
                            .fontWeight(.semibold)
                        Text(first.detail)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }

            Button {
                appState.selectedTab = .plan
            } label: {
                HStack {
                    Text("Open Wedding Planner")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                    Spacer()
                    Image(systemName: "chevron.right")
                }
                .foregroundColor(WewedColors.emerald)
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(WewedRadius.lg)
        .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 2)
    }

    private func nextMilestoneCard(wedding: Wedding) -> some View {
        let next = wedding.programme.first
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("NEXT UP")
                    .font(.caption2)
                    .fontWeight(.bold)
                    .tracking(1.5)
                    .foregroundColor(WewedColors.goldDark)
                Spacer()
                if let next {
                    Text(next.time)
                        .font(.caption2)
                        .fontWeight(.bold)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(WewedColors.gold.opacity(0.2))
                        .foregroundColor(WewedColors.goldDark)
                        .cornerRadius(WewedRadius.pill)
                }
            }

            Text(next?.title ?? "Programme preparing")
                .font(.title3)
                .fontWeight(.bold)
                .foregroundColor(WewedColors.textPrimaryLight)

            HStack(spacing: 4) {
                Image(systemName: "mappin.and.ellipse")
                    .font(.caption)
                Text(next?.location ?? wedding.venueName)
                    .font(.caption)
            }
            .foregroundColor(WewedColors.emerald)
        }
        .padding()
        .background(Color.white)
        .cornerRadius(WewedRadius.lg)
        .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 2)
    }

    private var quickPassCard: some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: WewedRadius.md)
                    .fill(Color(red: 0.98, green: 0.96, blue: 0.91))
                    .frame(width: 58, height: 58)
                Image(systemName: "qrcode")
                    .font(.title)
                    .foregroundColor(WewedColors.gold)
            }

            VStack(alignment: .leading, spacing: 3) {
                Text("YOUR WEDDING PASS")
                    .font(.caption2)
                    .fontWeight(.bold)
                    .tracking(1)
                    .foregroundColor(WewedColors.goldDark)

                Text("Table: \(quickPass?.tableName ?? "To be assigned")")
                    .font(.subheadline)
                    .fontWeight(.bold)
                    .foregroundColor(WewedColors.textPrimaryLight)

                Text("\(quickPass?.guestName ?? invitationContext?.guestName ?? "Guest") • \(quickPass?.partySize ?? invitationContext?.partySize ?? 1) seat(s)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Button {
                appState.selectedTab = .pass
            } label: {
                Text("View")
                    .font(.caption)
                    .fontWeight(.bold)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(WewedColors.gold)
                    .foregroundColor(.black)
                    .cornerRadius(WewedRadius.pill)
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(WewedRadius.lg)
        .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 2)
    }

    private var announcementsCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "megaphone.fill")
                    .foregroundColor(WewedColors.gold)
                Text("Announcements")
                    .font(.subheadline)
                    .fontWeight(.bold)
                Spacer()
            }

            if announcements.isEmpty {
                Text("No new announcements right now.")
                    .font(.caption)
                    .foregroundColor(.secondary)
            } else {
                ForEach(announcements.prefix(2)) { ann in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(ann.title)
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundColor(WewedColors.textPrimaryLight)
                        Text(ann.message)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    if ann.id != announcements.prefix(2).last?.id {
                        Divider()
                    }
                }
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(WewedRadius.lg)
        .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 2)
    }

    private var quickActionGrid: some View {
        HStack(spacing: 10) {
            quickActionButton(title: "Invitation", icon: "envelope.fill") {
                showingInvitationSheet = true
            }

            quickActionButton(title: "Directions", icon: "map.fill") {
                showingDirectionsAlert = true
            }

            quickActionButton(title: "Live Wall", icon: "photo.stack.fill") {
                appState.selectedTab = .live
            }

            quickActionButton(title: "Vendors", icon: "truck.box.fill") {
                showingVendorSheet = true
            }
        }
    }

    private func quickActionButton(title: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.headline)
                    .foregroundColor(WewedColors.gold)
                Text(title)
                    .font(.caption2)
                    .fontWeight(.medium)
                    .foregroundColor(WewedColors.textPrimaryLight)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(Color.white)
            .cornerRadius(WewedRadius.md)
            .shadow(color: Color.black.opacity(0.03), radius: 4, x: 0, y: 1)
        }
    }

    private func programmeCard(wedding: Wedding) -> some View {
        VStack(alignment: .leading, spacing: WewedSpacing.md) {
            Text("Day-Of Programme")
                .font(.headline)
                .foregroundColor(WewedColors.textPrimaryLight)

            ForEach(wedding.programme) { item in
                HStack(alignment: .top, spacing: WewedSpacing.md) {
                    Text(item.time)
                        .font(.subheadline)
                        .fontWeight(.bold)
                        .foregroundColor(WewedColors.gold)
                        .frame(width: 50, alignment: .leading)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.title)
                            .font(.subheadline)
                            .fontWeight(.semibold)
                        Text(item.location)
                            .font(.caption)
                            .foregroundColor(WewedColors.emerald)
                        Text(item.description)
                            .font(.caption)
                            .foregroundColor(WewedColors.textSecondaryLight)
                    }
                }
                .padding(.vertical, 4)
                if item.id != wedding.programme.last?.id {
                    Divider()
                }
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(WewedRadius.lg)
        .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 2)
    }

    private func displayDateLabel(_ raw: String) -> String {
        guard raw != "pending-production-discovery" else { return "Upcoming wedding" }
        let parser = ISO8601DateFormatter()
        guard let date = parser.date(from: raw) else { return raw }
        return date.formatted(date: .long, time: .omitted)
    }

    private func countdownComponents(from raw: String) -> (days: String, hours: String, minutes: String)? {
        let parser = ISO8601DateFormatter()
        guard let date = parser.date(from: raw) else { return nil }
        let interval = max(0, date.timeIntervalSinceNow)
        let totalMinutes = Int(interval / 60)
        let days = totalMinutes / (24 * 60)
        let hours = (totalMinutes % (24 * 60)) / 60
        let minutes = totalMinutes % 60
        return (
            String(format: "%02d", days),
            String(format: "%02d", hours),
            String(format: "%02d", minutes)
        )
    }

    private func loadData() {
        Task {
            do {
                async let weddingTask = appState.repository.getWedding()
                async let announcementsTask = appState.repository.getAnnouncements()
                async let plannerTask = appState.plannerRepository.getDashboard()

                let loadedWedding = try await weddingTask
                wedding = loadedWedding
                announcements = try await announcementsTask
                plannerDashboard = try await plannerTask

                invitationContext = try? await appState.repository.resolveInvitation(
                    weddingSlug: loadedWedding.id,
                    token: "shadow-pending-guest"
                )
                quickPass = try? await appState.repository.getWeddingPass(token: "shadow-attending-guest")
                isLoading = false
            } catch {
                isLoading = false
            }
        }
    }
}

public struct CountdownUnit: View {
    public let value: String
    public let label: String

    public init(value: String, label: String) {
        self.value = value
        self.label = label
    }

    public var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.title3)
                .fontWeight(.bold)
                .foregroundColor(WewedColors.goldDark)
            Text(label)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(minWidth: 54)
        .padding(.vertical, 6)
        .padding(.horizontal, 8)
        .background(WewedColors.gold.opacity(0.12))
        .cornerRadius(WewedRadius.md)
    }
}

