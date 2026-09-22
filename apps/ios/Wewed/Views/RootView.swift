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
    @StateObject private var productionSectionMemory = WorkspaceSectionMemory()
    /// The context resolved from verified assignments (P0-3). Nil while resolving.
    @State private var resolvedContext: NavigationContext?
    @State private var deepLinkedInvitation: InvitationContext?
    // Entry lifecycle. Launch decisions used to be a chain of `else if` branches, so the rule that
    // an invitation outranks a sign-in form was a property of branch ORDER rather than a stated
    // one. LaunchRouter states it, and tests assert it without a device.
    @State private var splashComplete = false

    /// Whether this launch is handing over to an invitation rather than a workspace.
    private var isInvitationArrival: Bool {
        if appState.pendingInvitationEntry != nil { return true }
        if appState.pendingInvitationDeepLink != nil { return true }
        if deepLinkedInvitation != nil { return true }
        switch liveInvitation {
        case .exchanging, .presenting: return true
        default: return false
        }
    }
    /// True once `resolveContext` has answered, so "no workspace" is shown rather than a spinner.
    @State private var contextResolutionFinished = false
    @State private var authMode: AuthenticationMode?
    @State private var resolvingDeepLinkedInvitation = false

    /// The live guest invitation, resolved by the guest-session authority rather than a repository.
    ///
    /// The coordinator is created once by `GuestInvitationBootstrap`, deliberately outside
    /// `NativeRepositoryFactory`: an invited guest needs the guest-session API and nothing about
    /// tasks, budgets or admin, so their invitation must not wait on the whole production
    /// workspace being enabled.
    @State private var liveInvitation: LiveInvitationState = .idle
    private let liveCoordinator = GuestInvitationBootstrap.coordinator()

    public init() {}

    /// IA V2 §13.1 / P0-3 — the context envelope is *resolved from verified assignments*, never
    /// assembled from convenient defaults. No client id, gate id, engagement id or guest identity
    /// is invented here; an unresolved scope stays nil and the shell denies the workspace.
    private func resolveContext() async {
        defer { contextResolutionFinished = true }
        guard let role = session.currentRole else {
            // Authenticated with no resolved role: there is no workspace to open, and none is
            // chosen on the person's behalf.
            resolvedContext = nil
            return
        }
        // Shadow authority only where Shadow personas exist; production/verify resolve a real
        // ProductionActorAssignmentSource once an authority has actually been fetched (master plan
        // §8.9, Phase 5) — until then they still get no assignments at all.
        let source = ActorAssignmentSources.forEnvironment(
            appState.dataEnvironment,
            repository: appState.repository,
            plannerRepository: appState.plannerRepository,
            productionAuthority: session.productionAuthority,
            selectedGrantIds: session.selectedGrantIds
        )
        // No default actor: the actor is whoever the session holds, or nobody.
        let actorId = session.activePersona?.id ?? ""
        let assignment = await source.assignments(actorId: actorId)
            .first { $0.role == role }

        // The wedding comes from the verified assignment and nowhere else. There is no fallback to
        // a session default: an actor without an assignment has no wedding, and the shell denies
        // every wedding-scoped destination (master plan §8.9).
        let weddingId = assignment?.weddingId ?? ""

        resolvedContext = NavigationContext(
            actorId: actorId,
            activeRole: role,
            activeWeddingId: weddingId,
            activeWeddingTitle: assignment?.weddingId == nil ? "" : (session.weddingTitle ?? ""),
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

    /// Grants of the current role's kind that require an explicit choice and have none yet (master
    /// plan §9). A single grant, or a kind the contract does not mark `selectionRequired`, needs no
    /// picker.
    private var pendingGrantSelection: [ProductionWorkspaceGrant] {
        guard let authority = session.productionAuthority,
              ProductionGrantMapper.isUsable(authority)
        else { return [] }

        // Selection must be possible before an ActorAssignment/currentRole exists. Two Planner
        // wedding grants both require a choice; deriving the picker from currentRole deadlocks.
        guard let selection = authority.contextSelection.first(where: { context in
            context.selectionRequired
                && context.grantIds.count > 1
                && !context.grantIds.contains(where: session.selectedGrantIds.contains)
                && (session.currentRole == nil || context.workspaceKind == session.currentRole?.roleId)
        }) else { return [] }

        let ids = Set(selection.grantIds)
        return authority.workspaceGrants.filter { ids.contains($0.grantId) }
    }

    /// Guest Entry Contract (GuestCeremonialEntry, master plan §6.3).
    ///
    /// A Guest actor reaching the workspace root has not arrived through a link — links are handled
    /// in `body` and always open on the card. So this is an ordinary return, and it opens on Guest
    /// Home with the invitation one tap away, exactly as the production Guest shell does. This root
    /// used to replay the card on every entry session, which only Shadow did: the harness was
    /// qualifying behaviour production did not have (master plan §8.11).
    ///
    /// Live mode restores the remembered Guest from the server-issued session. Unreachable today —
    /// production resolves no assignments and applies no personas — and recorded as a Phase 5
    /// blocker: before the workspace is enabled, Guest entry must stay on the Guest shell's
    /// authority (master plan §8.12).
    private func restoreLiveGuestIfNeeded() async {
        guard !appState.dataEnvironment.allowsMutableNativeDevelopment,
              session.currentRole == .guest else { return }
        liveInvitation = await liveCoordinator.restoreRememberedGuest()
    }

    public var body: some View {
        Group {
            // The Wewed animated splash is global: it plays on an icon launch, an invitation link,
            // a returning session and a new account alike. The app used to have one splash for the
            // guest journey and a bare white window for everything else.
            if !splashComplete {
                // The splash leaves differently depending on what it hands over to. An invitation
                // is REVEALED — the stage lifts away leaving the ivory and ornament for the card
                // to arrive into — where a workspace is entered and the stage simply recedes.
                WewedAnimatedSplash(
                    // A live invitation counts: the splash should hand over to a card, not recede
                    // into a workspace, whichever path resolved the guest.
                    destination: isInvitationArrival
                        ? .invitation
                        : (session.isAuthenticated ? .workspace : .welcome),
                    onFinished: { splashComplete = true }
                )
            } else if case .exchanging = liveInvitation {
                ZStack {
                    WeddingIdentityPalette.ivory.ignoresSafeArea()
                    AccessibilityMarker("invitation-exchanging", label: "Opening your invitation")
                    ProgressView().tint(WeddingIdentityPalette.champagneDeep)
                }
            } else if case let .presenting(snapshot) = liveInvitation {
                // The guest's front door. Reached before Home, the couple site, a login or a
                // workspace.
                LiveGuestInvitationView(
                    presentation: LiveInvitationPresentation.from(snapshot),
                    coordinator: liveCoordinator,
                    onRefreshed: { liveInvitation = $0 },
                    onContinue: { liveInvitation = .idle }
                )
            } else if case let .refused(reason) = liveInvitation {
                // Refused and unavailable mean opposite things to a guest, so they are never
                // merged: one says "this link is not yours", the other says "try again".
                InvitationRefusedView(reason: reason ?? .malformedHandoff) {
                    liveInvitation = .idle
                }
            } else if case .unavailable = liveInvitation {
                InvitationUnavailableView { liveInvitation = .idle }
            } else if let reason = appState.rejectedInvitation {
                // A refused invitation outranks everything that follows. It must not fall through
                // to the ordinary launch and quietly present whoever was already active.
                InvitationRefusedView(reason: reason) { appState.clearRejectedInvitation() }
            } else if let deepLinkedInvitation {
                // An invitation outranks everything: no account, no sign-in, no role chooser — the
                // invitation token IS the guest's authorization. Every valid guest entry meets the
                // configured invitation first, whatever they have already answered.
                GuestInvitationJourneyView(
                    reference: GuestJourneyReference(
                        invitation: deepLinkedInvitation,
                        initialStage: .invitation
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
            } else if session.isAuthenticated && !pendingGrantSelection.isEmpty {
                GrantSelectionView(
                    grants: pendingGrantSelection,
                    onSelect: { grantId in session.selectGrant(grantId) },
                    onSignOut: { session.signOut() }
                )
            } else if session.isAuthenticated,
                      session.currentRole == nil,
                      session.activeGrantId != nil {
                if let snapshot = session.productionWorkspace,
                   snapshot.grantId == session.activeGrantId {
                    ProductionReadOnlyWorkspaceContent(
                        snapshot: snapshot,
                        onSignOut: { session.signOut() }
                    )
                } else {
                    VStack(spacing: 8) {
                        Text("This authorized workspace could not be refreshed.")
                        Text("No cached production data is shown.")
                            .font(.system(size: 12))
                            .foregroundStyle(WeddingIdentityPalette.muted)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(WeddingIdentityPalette.ivory)
                    .accessibilityIdentifier("production-workspace-unavailable")
                }
            } else if session.isAuthenticated {
                roleShell
                    .task(id: "\(session.currentRole?.roleId ?? "")|\(session.activePersona?.id ?? "")|\(session.selectedGrantIds.count)") {
                        contextResolutionFinished = false
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
                // Entry surfaces sit outside the role shell, so nothing else publishes a bounded
                // content width for them.
                WewedScreenContainer { WewedWelcomeView(
                    onOpenInvitation: { authMode = .signIn },
                    onSignIn: { authMode = .signIn },
                    onCreateAccount: { authMode = .createAccount },
                    shadowEntry: appState.dataEnvironment.allowsDevelopmentPersonaSwitching
                        ? ShadowEntryOption(environmentName: appState.dataEnvironment.displayName) {
                            session.enterShadowSession()
                        }
                        : nil
                ) }
            } else {
                WewedScreenContainer { LoginView(onBack: { authMode = nil }) }
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
        .task(id: appState.pendingInvitationEntry) {
            // The separation runs both ways. The legacy path is barred from live mode, and the
            // live path is equally barred from Shadow: a Shadow slug is not a real wedding, so
            // sending it to the production authority produced a refusal for a link that is
            // perfectly valid in the environment it belongs to.
            guard !appState.dataEnvironment.allowsMutableNativeDevelopment else { return }
            // Consumed exactly once: an exchange is not idempotent, and a view rebuild must not
            // replay it.
            guard let entry = appState.consumePendingInvitationEntry() else { return }
            liveInvitation = .exchanging
            liveInvitation = await liveCoordinator.enter(entry)
        }
        .task(id: appState.pendingInvitationDeepLink) {
            // The Shadow-era resolution stays, but only for Shadow. It is never a fallback for the
            // live path: if the guest-session authority refuses or cannot be reached, the guest is
            // told, rather than being shown fixture data that looks like their invitation.
            guard appState.dataEnvironment.allowsMutableNativeDevelopment else { return }
            await resolvePendingInvitationDeepLink()
        }
        .task(id: "\(session.currentRole?.roleId ?? "")|\(session.activePersona?.id ?? "")") {
            await restoreLiveGuestIfNeeded()
        }
    }

    @ViewBuilder
    private var roleShell: some View {
        // A workspace is composed only for a context that holds a verified assignment, every
        // required scope, and a relationship that actually holds (Phase 1 independent review).
        // Nothing missing is filled in: without that, the actor is at the no-workspace boundary.
        if let context = resolvedContext, RoleShellAuthorization.admitsWorkspace(context) {
            authorizedShell(context)
        } else if contextResolutionFinished {
            VStack(spacing: 8) {
                Text("No Wewed workspace is authorized for this session.")
                    .font(.system(size: 15))
                    .multilineTextAlignment(.center)
            }
            .padding(32)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(WeddingIdentityPalette.ivory)
            .accessibilityIdentifier("workspace-not-authorized")
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

        if appState.dataEnvironment == .production {
            if let snapshot = session.productionWorkspace,
               snapshot.grantId == session.activeGrantId {
                RoleShellScaffold(
                    context: context,
                    onSwitchPersona: nil,
                    pendingDeepLink: link,
                    sectionMemory: productionSectionMemory,
                    onDeepLinkHandled: handled
                ) { destination, _ in
                    ProductionReadOnlyWorkspaceContent(snapshot: snapshot, destination: destination)
                }
            } else {
                VStack(spacing: 8) {
                    Text("The authorized workspace could not be refreshed.")
                    Text("No cached production data is shown.")
                        .font(.system(size: 12))
                        .foregroundStyle(WeddingIdentityPalette.muted)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(WeddingIdentityPalette.ivory)
                .accessibilityIdentifier("production-workspace-unavailable")
            }
        } else {
        switch context.activeRole {
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
    }

    private func resolvePendingInvitationDeepLink() async {
        // Guarded here as well as at the call site: a Shadow-only path should be unreachable in
        // live mode however it is entered, not only through the one caller that remembered.
        guard appState.dataEnvironment.allowsMutableNativeDevelopment else { return }
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
