import SwiftUI

public struct RootView: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var appState: AppState
    @State private var showingPersonaPicker = false

    public init() {}

    public var body: some View {
        Group {
            if session.isAuthenticated {
                VStack(spacing: 0) {
                    // Top developer / role persona banner
                    personaBanner

                    // Role-scoped workspace shells
                    switch session.currentRole {
                    case .couple:
                        coupleShell
                    case .planner:
                        PlannerShellView()
                    case .coordinator:
                        CoordinatorShellView()
                    case .vendor:
                        VendorShellView()
                    case .usher:
                        UsherShellView()
                    case .guest:
                        GuestShellView()
                    case .admin:
                        AdminShellView()
                    }
                }
                .sheet(isPresented: $showingPersonaPicker) {
                    PersonaPickerSheet()
                        .environmentObject(session)
                }
            } else {
                LoginView()
            }
        }
    }

    private var personaBanner: some View {
        HStack {
            HStack(spacing: 6) {
                Circle()
                    .fill(Color.green)
                    .frame(width: 8, height: 8)
                Text(session.currentUserName ?? "Charity & Kudzie")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .lineLimit(1)
                Text(session.currentRole.title)
                    .font(.caption2)
                    .foregroundColor(WewedColors.gold)
                    .lineLimit(1)

                Text(appState.dataEnvironment.title.uppercased())
                    .font(.system(size: 8, weight: .bold))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.white.opacity(0.12))
                    .foregroundColor(appState.dataEnvironment == .production ? .red : WewedColors.emerald)
                    .clipShape(Capsule())
                    .accessibilityLabel("Data environment \(appState.dataEnvironment.title)")
            }

            Spacer()

            Button(action: {
                showingPersonaPicker = true
            }) {
                Text("Switch")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Color.secondary.opacity(0.15))
                    .foregroundColor(WewedColors.gold)
                    .cornerRadius(WewedRadius.pill)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("dev-persona-switcher-button")
        }
        .padding(.horizontal, WewedSpacing.base)
        .padding(.top, 48)
        .padding(.bottom, 8)
        .background(Color.black.opacity(0.85))
        .ignoresSafeArea(edges: .top)
    }

    private var coupleShell: some View {
        TabView(selection: $appState.selectedTab) {
            HomeView()
                .tabItem {
                    Label(AppTab.home.rawValue, systemImage: AppTab.home.systemImage)
                }
                .tag(AppTab.home)

            PlannerView()
                .tabItem {
                    Label(AppTab.plan.rawValue, systemImage: AppTab.plan.systemImage)
                }
                .tag(AppTab.plan)

            GuestsView()
                .tabItem {
                    Label(AppTab.guests.rawValue, systemImage: AppTab.guests.systemImage)
                }
                .tag(AppTab.guests)

            PassView()
                .tabItem {
                    Label(AppTab.pass.rawValue, systemImage: AppTab.pass.systemImage)
                }
                .tag(AppTab.pass)

            LiveWallView()
                .tabItem {
                    Label(AppTab.live.rawValue, systemImage: AppTab.live.systemImage)
                }
                .tag(AppTab.live)
        }
        .tint(WewedColors.gold)
    }
}
