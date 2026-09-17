import SwiftUI

public struct RootView: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var appState: AppState

    public init() {}

    public var body: some View {
        Group {
            if session.isAuthenticated {
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
            } else {
                LoginView()
            }
        }
    }
}
