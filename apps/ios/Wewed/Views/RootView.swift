import SwiftUI

public struct RootView: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var appState: AppState
    @State private var showingPersonaPicker = false
    @State private var deepLinkedInvitation: InvitationContext?
    @State private var resolvingDeepLinkedInvitation = false

    public init() {}

    public var body: some View {
        Group {
            if let deepLinkedInvitation {
                GuestInvitationJourneyView(
                    reference: GuestJourneyReference(
                        invitation: deepLinkedInvitation,
                        initialStage: .splash
                    ),
                    onExit: {
                        self.deepLinkedInvitation = nil
                    }
                )
            } else if resolvingDeepLinkedInvitation {
                ProgressView("Preparing invitation…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(WeddingIdentityPalette.ivory)
            } else if session.isAuthenticated {
                if session.currentRole == .couple {
                    coupleShell
                        .sheet(isPresented: $showingPersonaPicker) {
                            PersonaPickerSheet()
                                .environmentObject(session)
                        }
                } else {
                    VStack(spacing: 0) {
                        personaBanner

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
                }
            } else {
                LoginView()
            }
        }
        .onOpenURL { url in
            appState.handleIncomingURL(url)
        }
        .task(id: appState.pendingInvitationDeepLink) {
            await resolvePendingInvitationDeepLink()
        }
    }

    private func resolvePendingInvitationDeepLink() async {
        guard let pending = appState.pendingInvitationDeepLink else { return }

        resolvingDeepLinkedInvitation = true
        let resolved = try? await appState.repository.resolveInvitation(
            weddingSlug: pending.weddingSlug,
            token: pending.rsvpToken
        )
        appState.pendingInvitationDeepLink = nil
        resolvingDeepLinkedInvitation = false
        deepLinkedInvitation = resolved
    }

    private var personaBanner: some View {
        HStack {
            HStack(spacing: 6) {
                Circle()
                    .fill(Color.green)
                    .frame(width: 8, height: 8)
                Text(session.currentUserName ?? "Active User")
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
        .accessibilityIdentifier("shadow-source-" + appState.dataEnvironment.rawValue.replacingOccurrences(of: "_", with: "-"))
    }
}
