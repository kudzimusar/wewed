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

            MessagesInboxView()
                .tabItem {
                    Label("Messages", systemImage: "tray.full.fill")
                }
                .tag(2)

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gearshape.fill")
                }
                .tag(3)
        }
        .tint(WewedColors.gold)
    }
}

// MARK: - Coordinator Workspace Shell
public struct CoordinatorShellView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var selectedTab: Int = 0
    @State private var showingScanner: Bool = false

    public init() {}

    public var body: some View {
        TabView(selection: $selectedTab) {
            PlannerTimelineView()
                .tabItem {
                    Label("Master Run of Show", systemImage: "clock.badge.checkmark.fill")
                }
                .tag(0)

            PlannerOperationsView()
                .tabItem {
                    Label("Operations", systemImage: "bolt.fill")
                }
                .tag(1)

            PlannerVendorsView()
                .tabItem {
                    Label("Vendor Readiness", systemImage: "person.crop.rectangle.stack.fill")
                }
                .tag(2)

            Color.clear
                .tabItem {
                    Label("Gate Scanner", systemImage: "qrcode.viewfinder")
                }
                .tag(3)

            MessagesInboxView()
                .tabItem {
                    Label("Radio & Inbox", systemImage: "antenna.radiowaves.left.and.right")
                }
                .tag(4)
        }
        .tint(WewedColors.gold)
        .onChange(of: selectedTab) { oldVal, newVal in
            if newVal == 3 {
                showingScanner = true
                selectedTab = oldVal
            }
        }
        .sheet(isPresented: $showingScanner) {
            UsherScannerView()
        }
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

            VendorCatalogView()
                .tabItem {
                    Label("Catalog & Vault", systemImage: "doc.text.fill")
                }
                .tag(1)

            MessagesInboxView()
                .tabItem {
                    Label("Crew Inbox", systemImage: "tray.fill")
                }
                .tag(2)
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

            MessagesInboxView()
                .tabItem {
                    Label("Dispatch Messages", systemImage: "tray.fill")
                }
                .tag(2)
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

            MessagesInboxView()
                .tabItem {
                    Label("Messages", systemImage: "tray.fill")
                }
                .tag(2)

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gearshape.fill")
                }
                .tag(3)
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

            AdminGovernanceView()
                .tabItem {
                    Label("Governance Audit", systemImage: "lock.shield.fill")
                }
                .tag(1)

            LiveWallView()
                .tabItem {
                    Label("Global Live Stream", systemImage: "globe.americas.fill")
                }
                .tag(2)

            SettingsView()
                .tabItem {
                    Label("System Settings", systemImage: "gearshape.fill")
                }
                .tag(3)
        }
        .tint(WewedColors.gold)
    }
}
