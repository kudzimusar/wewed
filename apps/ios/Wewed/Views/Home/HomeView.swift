import SwiftUI

public struct HomeView: View {
    @EnvironmentObject private var appState: AppState
    @State private var wedding: Wedding? = nil
    @State private var announcements: [WeddingAnnouncement] = []
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

                        // 2. Next Programme Milestone (Native Guest Mode)
                        nextMilestoneCard

                        // 3. My Wedding Pass Quick Card
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
            .navigationTitle("Wedding Day")
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
                let dummyContext = InvitationContext(
                    weddingSlug: "tariro-shadreck-2026",
                    guestToken: "tok_jane_doe_2026",
                    coupleNames: "Tariro & Shadreck",
                    guestName: "Jane & Michael Doe",
                    householdName: "Doe Household",
                    partySize: 2,
                    weddingDate: "Saturday, 24 October 2026",
                    venueName: "Imba Manor Estate",
                    venueCity: "Harare, Zimbabwe",
                    cardStyle: "ivory-floral-gold"
                )
                IvoryInvitationView(invitation: dummyContext) { _ in
                    appState.selectedTab = .pass
                }
            }
            .sheet(isPresented: $showingVendorSheet) {
                VendorPresenceView()
            }
            .alert("Directions to Imba Manor", isPresented: $showingDirectionsAlert) {
                Button("Open in Apple Maps") {}
                Button("Open in Google Maps") {}
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Imba Manor Estate, Glen Lorne, Harare, Zimbabwe. Estimated 25 minutes from Harare CBD.")
            }
        }
    }

    // MARK: - Components

    private func heroCard(wedding: Wedding) -> some View {
        VStack(spacing: WewedSpacing.sm) {
            Text("T & S")
                .font(.system(size: 34, weight: .bold, design: .serif))
                .foregroundColor(WewedColors.gold)
                .padding(.top, 6)

            Text(wedding.coupleNames)
                .font(.system(size: 24, weight: .semibold, design: .serif))
                .foregroundColor(WewedColors.textPrimaryLight)

            Text("24 October 2026 • Harare, Zimbabwe")
                .font(.subheadline)
                .foregroundColor(WewedColors.textSecondaryLight)

            HStack(spacing: WewedSpacing.md) {
                CountdownUnit(value: "37", label: "Days")
                CountdownUnit(value: "04", label: "Hours")
                CountdownUnit(value: "22", label: "Mins")
            }
            .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color.white)
        .cornerRadius(WewedRadius.lg)
        .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 2)
    }

    private var nextMilestoneCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("NEXT UP")
                    .font(.caption2)
                    .fontWeight(.bold)
                    .tracking(1.5)
                    .foregroundColor(WewedColors.goldDark)
                Spacer()
                Text("Doors Open 13:15")
                    .font(.caption2)
                    .fontWeight(.bold)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(WewedColors.gold.opacity(0.2))
                    .foregroundColor(WewedColors.goldDark)
                    .cornerRadius(WewedRadius.pill)
            }

            Text("Ceremony & Vows — 14:00")
                .font(.title3)
                .fontWeight(.bold)
                .foregroundColor(WewedColors.textPrimaryLight)

            HStack(spacing: 4) {
                Image(systemName: "mappin.and.ellipse")
                    .font(.caption)
                Text("Chapel on the Hill • Imba Manor Gardens")
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

                Text("Table: Jacaranda — 8")
                    .font(.subheadline)
                    .fontWeight(.bold)
                    .foregroundColor(WewedColors.textPrimaryLight)

                Text("Jane & Michael Doe • 2 Seats Reserved")
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

    private func loadData() {
        Task {
            do {
                wedding = try await appState.repository.getWedding()
                announcements = try await appState.repository.getAnnouncements()
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

