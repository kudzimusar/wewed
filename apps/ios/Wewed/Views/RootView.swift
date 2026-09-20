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
    /// The Guest Ceremonial Entry Contract's session boundary: a recognised Guest meets their
    /// card once per app-entry session, not once per lifetime and not on every glance back.
    @State private var entrySessionPresentedCard = false
    @State private var recognisedGuestInvitation: InvitationContext?
    /// The Guest's own pass credential, resolved from their verified assignment.
    ///
    /// It deliberately does NOT come from `SessionStore.passToken`, which nothing assigns: reading
    /// it there meant the ceremonial entry could never find a credential, so the workspace always
    /// won and the invitation was silently skipped.
    @State private var guestPassToken: String?
    /// Whether the Guest's card has been looked for yet. Until it has, the root holds rather than
    /// committing to the workspace — otherwise a slow repository skips the ceremony.
    @State private var guestCardResolved = false
    /// The wedding's SAVED invitation style decides the design.
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
    /// The card a recognised Guest meets on entry.
    ///
    /// The invitation is the wedding's configured product object. RSVP state changes what it
    /// OFFERS; it never changes which object is shown, and it never skips the card. Presentation
    /// (closed/opening/open/details) and RSVP state are orthogonal: a returning confirmed guest is
    /// .closed + .attending, which is ordinary and correct.
    @ViewBuilder
    private func guestCeremonialEntry(_ card: InvitationContext) -> some View {
        GuestInvitationJourneyView(
            reference: GuestJourneyReference(invitation: card, initialStage: .invitation),
            // Continuing ends the ceremony for THIS entry session; the next cold launch stages it
            // again.
            onExit: { entrySessionPresentedCard = true }
        )
    }

    /// Resolves the active Guest's own card, keyed on their credential so switching guests
    /// resolves a different card rather than reusing the previous one.
    private func resolveRecognisedGuestCard() async {
        defer { guestCardResolved = true }
        guard session.currentRole == .guest else {
            recognisedGuestInvitation = nil
            guestPassToken = nil
            return
        }
        // The credential comes from the verified assignment, the same place the Guest workspace
        // gets it. Resolving it here rather than inside the workspace is what lets the invitation
        // precede the workspace at all.
        let source = ShadowActorAssignmentSource(
            repository: appState.repository,
            environment: appState.dataEnvironment,
            plannerRepository: appState.plannerRepository
        )
        let actorId = session.activePersona?.id ?? "couple_owner"
        let assignment = await source.assignments(actorId: actorId)
            .first { $0.role == .guest }
        guestPassToken = assignment?.passToken
        guard let token = guestPassToken else {
            recognisedGuestInvitation = nil
            return
        }
        let weddingId = assignment?.weddingId ?? session.weddingId
        let slug = (try? await appState.repository.weddingSlug(weddingId: weddingId)) ?? nil
        recognisedGuestInvitation = try? await appState.repository.resolveInvitation(
            weddingSlug: slug ?? "", token: token
        )
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
                    destination: appState.pendingInvitationDeepLink != nil || deepLinkedInvitation != nil
                        ? .invitation
                        : (session.isAuthenticated ? .workspace : .welcome),
                    onFinished: { splashComplete = true }
                )
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
            } else if session.isAuthenticated,
                      session.currentRole == .guest,
                      !entrySessionPresentedCard,
                      !guestCardResolved {
                // Holding, not skipping. The workspace must not win this race: a Guest whose card
                // is still resolving has not yet been offered their invitation.
                ZStack {
                    WeddingIdentityPalette.ivory.ignoresSafeArea()
                    ProgressView()
                        .tint(WeddingIdentityPalette.champagneDeep)
                }
                .accessibilityIdentifier("entry-staging-invitation")
            } else if let card = recognisedGuestInvitation,
                      !entrySessionPresentedCard,
                      session.currentRole == .guest {
                // Guest Ceremonial Entry. The Couple recognised this person; the card is that
                // recognition, and it opens every visit — before the Guest workspace, before the
                // wedding site, before the pass. What changes with RSVP state is what the card
                // ASKS, never whether it appears.
                guestCeremonialEntry(card)
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
        .task(id: appState.pendingInvitationDeepLink) {
            await resolvePendingInvitationDeepLink()
        }
        .task(id: "\(session.currentRole.roleId)|\(session.activePersona?.id ?? "")") {
            guestCardResolved = false
            await resolveRecognisedGuestCard()
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
