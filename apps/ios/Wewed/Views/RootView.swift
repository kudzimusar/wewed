import SwiftUI

/// IA V2 root.
///
/// Resolves the active `NavigationContext` once and hands it to the role shell. Every role —
/// Couple included — now renders through `RoleShellScaffold`, so no role shell can invent its own
/// bottom-navigation topology.
public struct RootView: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var appState: AppState
    @State private var showingPersonaPicker = false
    @State private var deepLinkedInvitation: InvitationContext?
    @State private var resolvingDeepLinkedInvitation = false

    public init() {}

    /// IA V2 §13.1 — one context envelope, resolved once, handed to every role shell.
    private var navigationContext: NavigationContext {
        NavigationContext(
            actorId: session.activePersona?.id ?? "couple_owner",
            activeRole: session.currentRole,
            activeWeddingId: session.weddingId,
            activeWeddingTitle: session.weddingTitle,
            environment: appState.dataEnvironment,
            // Scoped context the role owns; resolved from the active actor rather than guessed.
            activeClientId: session.currentRole == .planner ? session.weddingId : nil,
            activeEngagementId: nil,
            activeGateId: session.currentRole == .usher ? "Gate A — Main Entrance" : nil
        )
    }

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
                roleShell
                    .sheet(isPresented: $showingPersonaPicker) {
                        PersonaPickerSheet()
                            .environmentObject(session)
                    }
                    .accessibilityIdentifier(
                        "shadow-source-" + appState.dataEnvironment.rawValue.replacingOccurrences(of: "_", with: "-")
                    )
            } else {
                LoginView()
            }
        }
        .onOpenURL { url in
            appState.handleIncomingURL(url)
        }
        .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
            if let url = activity.webpageURL {
                appState.handleIncomingURL(url)
            }
        }
        .task(id: appState.pendingInvitationDeepLink) {
            await resolvePendingInvitationDeepLink()
        }
    }

    @ViewBuilder
    private var roleShell: some View {
        let context = navigationContext
        let switchPersona: () -> Void = { showingPersonaPicker = true }
        // IA V2 §14 — a deep link resolves to a destination *request*; the shell then gates it.
        let requested = appState.pendingRouteDeepLink.flatMap {
            DeepLinkRouter.destinationFor($0, role: session.currentRole)
        }
        let handled: () -> Void = { appState.pendingRouteDeepLink = nil }

        switch session.currentRole {
        case .couple:
            CoupleShellView(
                context: context,
                onSwitchPersona: switchPersona,
                requestedDestinationId: requested,
                onRequestedDestinationHandled: handled
            )
        case .planner:
            PlannerShellView(
                context: context,
                onSwitchPersona: switchPersona,
                requestedDestinationId: requested,
                onRequestedDestinationHandled: handled
            )
        case .coordinator:
            CoordinatorShellView(
                context: context,
                onSwitchPersona: switchPersona,
                requestedDestinationId: requested,
                onRequestedDestinationHandled: handled
            )
        case .vendor:
            VendorShellView(
                context: context,
                onSwitchPersona: switchPersona,
                requestedDestinationId: requested,
                onRequestedDestinationHandled: handled
            )
        case .usher:
            UsherShellView(
                context: context,
                onSwitchPersona: switchPersona,
                requestedDestinationId: requested,
                onRequestedDestinationHandled: handled
            )
        case .guest:
            GuestShellView(
                context: context,
                onSwitchPersona: switchPersona,
                requestedDestinationId: requested,
                onRequestedDestinationHandled: handled
            )
        case .admin:
            AdminShellView(
                context: context,
                onSwitchPersona: switchPersona,
                requestedDestinationId: requested,
                onRequestedDestinationHandled: handled
            )
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
}
