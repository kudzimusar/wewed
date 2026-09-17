import SwiftUI

// MARK: - Planner Workspace Shell
public struct PlannerShellView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var selectedTab: Int = 0

    public init() {}

    public var body: some View {
        TabView(selection: $selectedTab) {
            PlannerView()
                .tabItem {
                    Label("Planning Suite", systemImage: "briefcase.fill")
                }
                .tag(0)

            GuestsView()
                .tabItem {
                    Label("Guest Master", systemImage: "person.3.fill")
                }
                .tag(1)

            LiveWallView()
                .tabItem {
                    Label("Operations", systemImage: "sparkles")
                }
                .tag(2)
        }
        .tint(WewedColors.gold)
    }
}

// MARK: - Coordinator Workspace Shell
public struct CoordinatorShellView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var selectedTab: Int = 0

    public init() {}

    public var body: some View {
        TabView(selection: $selectedTab) {
            PlannerTimelineView()
                .tabItem {
                    Label("Master Run of Show", systemImage: "clock.badge.checkmark.fill")
                }
                .tag(0)

            PlannerVendorsView()
                .tabItem {
                    Label("Vendor Readiness", systemImage: "person.crop.rectangle.stack.fill")
                }
                .tag(1)

            LiveWallView()
                .tabItem {
                    Label("Broadcast & Audio", systemImage: "antenna.radiowaves.left.and.right")
                }
                .tag(2)
        }
        .tint(WewedColors.gold)
    }
}

// MARK: - Vendor Workspace Shell
public struct VendorShellView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var selectedTab: Int = 0

    public init() {}

    public var body: some View {
        TabView(selection: $selectedTab) {
            ContractGovernanceView()
                .tabItem {
                    Label("Deal Room & Scope", systemImage: "signature")
                }
                .tag(0)

            LiveWallView()
                .tabItem {
                    Label("Crew Live Feed", systemImage: "sparkles")
                }
                .tag(1)
        }
        .tint(WewedColors.gold)
    }
}

// MARK: - Usher Workspace Shell
public struct UsherShellView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var selectedTab: Int = 0

    public init() {}

    public var body: some View {
        TabView(selection: $selectedTab) {
            PassView()
                .tabItem {
                    Label("Gate Verification", systemImage: "qrcode.viewfinder")
                }
                .tag(0)

            GuestsView()
                .tabItem {
                    Label("Roster & Seating", systemImage: "person.text.rectangle.fill")
                }
                .tag(1)
        }
        .tint(WewedColors.gold)
    }
}

// MARK: - Guest Workspace Shell
public struct GuestShellView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var selectedTab: Int = 0

    public init() {}

    public var body: some View {
        TabView(selection: $selectedTab) {
            PassView()
                .tabItem {
                    Label("Wedding Pass", systemImage: "ticket.fill")
                }
                .tag(0)

            LiveWallView()
                .tabItem {
                    Label("Moments & Live Wall", systemImage: "photo.on.rectangle.angled")
                }
                .tag(1)
        }
        .tint(WewedColors.gold)
    }
}

// MARK: - Admin Workspace Shell
public struct AdminShellView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var selectedTab: Int = 0

    public init() {}

    public var body: some View {
        TabView(selection: $selectedTab) {
            PlannerOperationsView()
                .tabItem {
                    Label("Platform Console", systemImage: "shield.checkered")
                }
                .tag(0)

            LiveWallView()
                .tabItem {
                    Label("Global Live Stream", systemImage: "globe.americas.fill")
                }
                .tag(1)
        }
        .tint(WewedColors.gold)
    }
}

