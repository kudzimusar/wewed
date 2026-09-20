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
    /// The context resolved from verified assignments (P0-3). Nil while resolving.
    @State private var resolvedContext: NavigationContext?
    @State private var deepLinkedInvitation: InvitationContext?
    // Entry lifecycle. Launch decisions used to be a chain of `else if` branches, so the rule that
    // an invitation outranks a sign-in form was a property of branch ORDER rather than a stated
    // one. LaunchRouter states it, and tests assert it without a device.
    @State private var splashComplete = false
    @State private var authMode: AuthenticationMode?
    @State private var resolvingDeepLinkedInvitation = false

    public init() {}

    /// IA V2 §13.1 / P0-3 — the context envelope is *resolved from verified assignments*, never
    /// assembled from convenient defaults. No client id, gate id, engagement id or guest identity
    /// is invented here; an unresolved scope stays nil and the shell denies the workspace.
    private func resolveContext() async {
        let source = ShadowActorAssignmentSource(
            repository: appState.repository,
            environment: appState.dataEnvironment,
            plannerRepository: appState.plannerRepository
        )
        let actorId = session.activePersona?.id ?? "couple_owner"
        let assignment = await source.assignments(actorId: actorId)
            .first { $0.role == session.currentRole }

        let systemScoped = IANavigationContract.forRole(session.currentRole).isSystemScoped
        let weddingId: String = {
            if systemScoped { return assignment?.weddingId ?? "" }
            return assignment?.weddingId ?? session.weddingId
        }()

        resolvedContext = NavigationContext(
            actorId: actorId,
            activeRole: session.currentRole,
            activeWeddingId: weddingId,
            activeWeddingTitle: (systemScoped && assignment?.weddingId == nil) ? "" : session.weddingTitle,
            environment: appState.dataEnvironment,
            activeClientId: assignment?.clientId,
            activeVendorId: assignment?.vendorId,
            activeEngagementId: assignment?.engagementId,
            activeGateId: assignment?.gateId,
            activeGuestId: assignment?.guestId,
            activePassToken: assignment?.passToken,
            assignment: assignment
        )
        if !weddingId.isEmpty {
            appState.bindActiveWedding(weddingId)
        }
    }

    /// Where an invited guest lands. A confirmed guest goes to their pass; a guest who already
    /// declined sees their response, not the RSVP form again.
    private static func journeyStage(for invitation: InvitationContext) -> GuestJourneyStage {
        switch LaunchRouter.stage(for: invitation) {
        case .confirmed: return .confirmedAttending
        case .declined: return .declined
        case .pending: return .invitation
        }
    }

    public var body: some View {
        Group {
            // The Wewed animated splash is global: it plays on an icon launch, an invitation link,
            // a returning session and a new account alike. The app used to have one splash for the
            // guest journey and a bare white window for everything else.
            if !splashComplete {
                WewedAnimatedSplash(onFinished: { splashComplete = true })
            } else if let deepLinkedInvitation {
                // An invitation outranks everything. No account, no sign-in, no role chooser: the
                // invitation token IS the guest's authorization, and a confirmed guest goes
                // straight to their pass rather than being asked to RSVP a second time.
                GuestInvitationJourneyView(
                    reference: GuestJourneyReference(
                        invitation: deepLinkedInvitation,
                        initialStage: Self.journeyStage(for: deepLinkedInvitation)
                    ),
                    onExit: {
                        self.deepLinkedInvitation = nil
                    }
                )
            } else if resolvingDeepLinkedInvitation {
                ProgressView("Preparing invitation…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(WeddingIdentityPalette.ivory)
                    .accessibilityIdentifier("entry-resolving-deep-link")
            } else if session.isAuthenticated {
                roleShell
                    .task(id: "\(session.currentRole.roleId)|\(session.activePersona?.id ?? "")") {
                        await resolveContext()
                    }
                    .sheet(isPresented: $showingPersonaPicker) {
                        if appState.dataEnvironment.allowsDevelopmentPersonaSwitching {
                            PersonaPickerSheet()
                                .environmentObject(session)
                        }
                    }
                    // The environment marker is attached to a dedicated hidden element rather
                    // than the whole authenticated tree: on iOS an identifier applied to a
                    // container propagates to its descendants and overrides every nested
                    // identifier, which hid role-shell-* and every workspace id from UI tests.
                    .overlay(alignment: .top) {
                        Color.clear
                            .frame(width: 1, height: 1)
                            .accessibilityIdentifier(
                                "shadow-source-" + appState.dataEnvironment.rawValue.replacingOccurrences(of: "_", with: "-")
                            )
                    }
            } else if authMode == nil {
                WewedWelcomeView(
                    onOpenInvitation: { authMode = .signIn },
                    onSignIn: { authMode = .signIn },
                    onCreateAccount: { authMode = .createAccount },
                    shadowEntry: appState.dataEnvironment.allowsDevelopmentPersonaSwitching
                        ? ShadowEntryOption(environmentName: appState.dataEnvironment.displayName) {
                            session.enterShadowSession()
                        }
                        : nil
                )
            } else {
                LoginView(onBack: { authMode = nil })
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
        if let context = resolvedContext {
            authorizedShell(context)
        } else {
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(WeddingIdentityPalette.ivory)
        }
    }

    @ViewBuilder
    private func authorizedShell(_ context: NavigationContext) -> some View {
        // P0-16: production/verify builds must not expose an arbitrary role switcher.
        let switchPersona: (() -> Void)? = appState.dataEnvironment.allowsDevelopmentPersonaSwitching
            ? { showingPersonaPicker = true }
            : nil
        // P0-8: the parsed link is handed to the shell intact; the shell resolves it against the
        // active context through DeepLinkRouter rather than reducing it to a destination id here.
        let link = appState.pendingRouteDeepLink
        let handled: () -> Void = { appState.pendingRouteDeepLink = nil }

        switch session.currentRole {
        case .couple:
            CoupleShellView(
                context: context,
                onSwitchPersona: switchPersona,
                pendingDeepLink: link,
                onDeepLinkHandled: handled
            )
        case .planner:
            PlannerShellView(
                context: context,
                onSwitchPersona: switchPersona,
                pendingDeepLink: link,
                onDeepLinkHandled: handled
            )
        case .coordinator:
            CoordinatorShellView(
                context: context,
                onSwitchPersona: switchPersona,
                pendingDeepLink: link,
                onDeepLinkHandled: handled
            )
        case .vendor:
            VendorShellView(
                context: context,
                onSwitchPersona: switchPersona,
                pendingDeepLink: link,
                onDeepLinkHandled: handled
            )
        case .usher:
            UsherShellView(
                context: context,
                onSwitchPersona: switchPersona,
                pendingDeepLink: link,
                onDeepLinkHandled: handled
            )
        case .guest:
            GuestShellView(
                context: context,
                onSwitchPersona: switchPersona,
                pendingDeepLink: link,
                onDeepLinkHandled: handled
            )
        case .admin:
            AdminShellView(
                context: context,
                onSwitchPersona: switchPersona,
                pendingDeepLink: link,
                onDeepLinkHandled: handled
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
