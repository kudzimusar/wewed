import SwiftUI

public struct RootView: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var appState: AppState

    public init() {}

    public var body: some View {
        // Every shell sits under one node carrying the data-source provenance, so acceptance
        // flows can prove which dataset produced the screen without any visible developer label.
        content
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("shadow-source-" + appState.dataEnvironment.rawValue.replacingOccurrences(of: "_", with: "-"))
    }

    @ViewBuilder
    private var content: some View {
        if let current = session.session {
            if let grant = session.activeGrant {
                switch grant.role {
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
            } else {
                RoleChooserView(
                    authorizedSession: current,
                    onChoose: { session.activate($0.role) },
                    onSignOut: { session.signOut() }
                )
            }
        } else {
            LoginView()
        }
    }

    @ViewBuilder
    private var coupleShell: some View {
        #if os(iOS)
        coupleTabs
            .toolbarBackground(WeddingIdentityPalette.ivorySoft, for: .tabBar)
            .toolbarBackground(.visible, for: .tabBar)
            .toolbarColorScheme(.light, for: .tabBar)
        #else
        coupleTabs
        #endif
    }

    private var coupleTabs: some View {
        TabView(selection: $appState.selectedTab) {
            WeddingReferenceHomeView()
                .tabItem {
                    Label(AppTab.home.rawValue, systemImage: "house.fill")
                }
                .tag(AppTab.home)

            WeddingReferencePlannerView()
                .tabItem {
                    Label(AppTab.plan.rawValue, systemImage: "calendar.badge.checkmark")
                }
                .tag(AppTab.plan)

            WeddingReferenceGuestsView()
                .tabItem {
                    Label(AppTab.guests.rawValue, systemImage: "person.2.fill")
                }
                .tag(AppTab.guests)

            WeddingReferencePassView()
                .tabItem {
                    Label(AppTab.pass.rawValue, systemImage: "qrcode")
                }
                .tag(AppTab.pass)

            WeddingReferenceMoreView()
                .tabItem {
                    Label(AppTab.live.rawValue, systemImage: "line.3.horizontal")
                }
                .tag(AppTab.live)
        }
        .tint(WeddingIdentityPalette.champagneDeep)
    }
}
