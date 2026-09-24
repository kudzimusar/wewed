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
    @State private var invitationEntryRequested = false
    @State private var resolvingDeepLinkedInvitation = false
    /// Master plan Phase 6 §1, §2, §11 — an explicit switcher reachable AFTER a workspace is open.
    @State private var showingContextSwitcher = false

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
        //
        // Master plan Phase 8 closure round 5 — delegates to the extracted, directly unit-tested
        // `resolveActorAssignmentSource` (ActorAssignment.swift) rather than eagerly evaluating
        // `appState.repository`/`plannerRepository` as call arguments. The previous
        // `(try? appState.repository) ?? FixtureWeddingRepository()` was an invalid production
        // fallback that existed only because `ActorAssignmentSources.forEnvironment` still demanded
        // a repository parameter PRODUCTION never needed — a moderator finding, not a demonstrated
        // leak (the production branch never actually read it), but removed outright:
        // `resolveActorAssignmentSource` only reads a repository inside the Shadow/dev-persona
        // branch, so a PRODUCTION `appState` (bound or not) never reaches it and no Fixture/Shadow
        // repository is ever constructed for it.
        let source = resolveActorAssignmentSource(
            appState: appState,
            productionAuthority: session.productionAuthority,
            selectedGrantIds: session.selectedGrantIds,
            selectedEngagementId: session.selectedEngagementId,
            selectedGateGrantId: session.selectedGateGrantId
        )
        // Production identity comes from the verified authority document; Shadow uses its persona.
        let actorId = session.productionAuthority?.accessUserId ?? session.activePersona?.id ?? ""
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

    private var pendingGateSelection: [ProductionOperationalGrant] {
        guard let authority = session.productionAuthority,
              ProductionGrantMapper.isUsable(authority),
              let selection = authority.gateContextSelection
        else { return [] }

        let selectedStillLive = session.selectedGateGrantId.map(selection.grantIds.contains) ?? false
        if selectedStillLive { return [] }
        let staleSelectionNeedsReplacement = session.selectedGateGrantId != nil && !selectedStillLive
        if !selection.selectionRequired && !staleSelectionNeedsReplacement { return [] }
        if let role = session.currentRole, role != .usher {
            return []
        }
        let ids = Set(selection.grantIds)
        return authority.operationalGrants.filter { ids.contains($0.grantId) }
    }

    /// Only offered once more than one grant genuinely exists — a single-context account has
    /// nothing to switch to (master plan Phase 6 §11: minimal UI, no unnecessary chrome).
    private var canSwitchProductionContext: Bool {
        guard appState.dataEnvironment == .production, let authority = session.productionAuthority else { return false }
        return authority.workspaceGrants.count + authority.operationalGrants.count > 1
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

    /// Master plan Phase 8 — rebinds `appState`'s domain repositories to real, grant-scoped
    /// production adapters as soon as a wedding-scoped workspace snapshot is available. Keyed on
    /// the snapshot's own grantId/weddingId (already freshly revalidated by Phase 5/6's
    /// `refreshActiveWorkspace`), not on context resolution, so the swap is ready before
    /// `WeddingGraphState.load`/`RoleWorkspaces` ever read `appState.repository` for this wedding. A
    /// portfolio/business/system snapshot (weddingId nil) does nothing here — those still render
    /// through `ProductionReadOnlyWorkspaceContent` exactly as before.
    private func bindProductionRepositoriesIfNeeded() async {
        guard appState.dataEnvironment == .production else { return }
        guard let grantId = session.productionWorkspace?.grantId,
              let weddingId = session.productionWorkspace?.weddingId,
              let accessUserId = session.productionAuthority?.accessUserId,
              let token = session.currentSessionToken(),
              let baseURL = appState.dataBaseURL
        else { return }
        let client = NativeDomainApiClient(
            baseURL: baseURL,
            onSessionInvalid: {
                Task { @MainActor in
                    session.handleNativeDomainSessionInvalid()
                }
            },
            onGrantRevoked: { revokedGrantId in
                Task { @MainActor in
                    session.handleNativeDomainGrantRevoked(revokedGrantId)
                }
            }
        )
        appState.bindProductionRepositories(
            accessUserId: accessUserId,
            grantId: grantId,
            wedding: ProductionWeddingRepository(client: client, sessionToken: token, grantId: grantId, weddingId: weddingId),
            planner: ProductionPlannerDashboardRepository(client: client, sessionToken: token, grantId: grantId)
        )
        // Master plan Phase 8 closure round 3 §3 — Contracts/Deal-Room is bound alongside the
        // wedding/planner pair: it becomes reachable exactly when a real wedding-scoped grant does.
        appState.bindProductionContractsRepository(
            accessUserId: accessUserId,
            grantId: grantId,
            ProductionContractsRepository(client: client, sessionToken: token, grantId: grantId)
        )
    }

    /// Master plan Phase 8 closure §A — a real, grant-scoped repository for a Vendor business grant
    /// (`workspaceKind == "vendor" && scopeKind == "business"`, no wedding ActorAssignment). Built
    /// the same way as `bindProductionRepositoriesIfNeeded`'s client, but never touches the wedding
    /// graph: it only ever calls `/api/native/vendor/{business,catalog,bookings}`.
    private func vendorBusinessRepository(for snapshot: ProductionWorkspaceSnapshot) -> VendorBusinessRepositoryProtocol? {
        guard let token = session.currentSessionToken(), let baseURL = appState.dataBaseURL else { return nil }
        let client = NativeDomainApiClient(
            baseURL: baseURL,
            onSessionInvalid: {
                Task { @MainActor in
                    session.handleNativeDomainSessionInvalid()
                }
            },
            onGrantRevoked: { revokedGrantId in
                Task { @MainActor in
                    session.handleNativeDomainGrantRevoked(revokedGrantId)
                }
            }
        )
        return ProductionVendorBusinessRepository(client: client, sessionToken: token, grantId: snapshot.grantId)
    }

    /// Master plan Phase 8 closure §B — reactively binds the real Admin adapter as soon as an
    /// admin:system snapshot is available. Admin has no wedding, so this is keyed on the snapshot's
    /// own workspaceKind rather than a weddingId (which is always nil/absent for this scope).
    private func bindProductionAdminRepositoryIfNeeded() async {
        guard appState.dataEnvironment == .production else { return }
        guard let workspace = session.productionWorkspace, workspace.workspaceKind == "admin" else { return }
        guard let accessUserId = session.productionAuthority?.accessUserId else { return }
        guard let token = session.currentSessionToken(), let baseURL = appState.dataBaseURL else { return }
        let client = NativeDomainApiClient(
            baseURL: baseURL,
            onSessionInvalid: {
                Task { @MainActor in
                    session.handleNativeDomainSessionInvalid()
                }
            },
            onGrantRevoked: { revokedGrantId in
                Task { @MainActor in
                    session.handleNativeDomainGrantRevoked(revokedGrantId)
                }
            }
        )
        appState.bindProductionAdminRepository(
            accessUserId: accessUserId,
            grantId: workspace.grantId,
            ProductionAdminSystemRepository(client: client, sessionToken: token, grantId: workspace.grantId)
        )
    }

    /// Master plan Phase 8 closure round 3 §6, hardened round 4 §2 — reactively binds the real
    /// Vendor-wedding-engagement adapter as soon as a `vendor:wedding` snapshot is available.
    /// Deliberately keyed on `workspaceKind == "vendor" && scopeKind == "wedding"`, which is a
    /// DIFFERENT authority axis from the Vendor business-portfolio grant (`scopeKind == "business"`,
    /// handled entirely by the earlier no-ActorAssignment branch in `body` and never reaching this
    /// point at all). `session.selectedEngagementId` is part of this effect's OWN `.task(id:)` key
    /// (not just an argument passed into the constructed repository): a Vendor's grant may carry
    /// several `serviceEngagementIds`, so switching the selected engagement — same grantId, same
    /// account — must re-run this effect and produce a NEW binding, not silently keep serving the
    /// previous engagement's repository.
    private func bindProductionVendorEngagementRepositoryIfNeeded() async {
        guard appState.dataEnvironment == .production else { return }
        guard let workspace = session.productionWorkspace,
              workspace.workspaceKind == "vendor", workspace.scopeKind == "wedding"
        else { return }
        guard let accessUserId = session.productionAuthority?.accessUserId else { return }
        // A grant with more than one engagement must not bind until the person has actually chosen
        // one (the picker in `authorizedShell`, reusing the existing Phase 5/6 selection mechanism) —
        // an unselected multi-engagement grant binds nothing rather than guessing engagementId[0].
        if workspace.engagementSelectionRequired && session.selectedEngagementId == nil { return }
        guard let token = session.currentSessionToken(), let baseURL = appState.dataBaseURL else { return }
        let client = NativeDomainApiClient(
            baseURL: baseURL,
            onSessionInvalid: {
                Task { @MainActor in
                    session.handleNativeDomainSessionInvalid()
                }
            },
            onGrantRevoked: { revokedGrantId in
                Task { @MainActor in
                    session.handleNativeDomainGrantRevoked(revokedGrantId)
                }
            }
        )
        appState.bindProductionVendorEngagementRepository(
            accessUserId: accessUserId,
            grantId: workspace.grantId,
            engagementId: session.selectedEngagementId,
            ProductionVendorEngagementRepository(
                client: client,
                sessionToken: token,
                grantId: workspace.grantId,
                engagementId: session.selectedEngagementId
            )
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
            } else if session.isAuthenticated && !pendingGateSelection.isEmpty {
                GateGrantSelectionView(
                    grants: pendingGateSelection,
                    onSelect: { grantId in session.selectGateGrant(grantId) },
                    onSignOut: { session.signOut() }
                )
            } else if session.isAuthenticated,
                      session.currentRole == nil,
                      session.activeGrantId != nil {
                // Master plan Phase 8 closure §A — a Vendor business grant (scopeKind "business")
                // gets its OWN real production shell (identity/catalog/offerings/bookings from
                // /api/native/vendor/*), never the wedding graph, and never fabricated content. A
                // Planner portfolio (scopeKind "portfolio") keeps the existing minimal snapshot —
                // its own domains (Overview/Tasks/etc.) are already reachable once a real wedding
                // is selected.
                if let snapshot = session.productionWorkspace,
                   snapshot.grantId == session.activeGrantId,
                   snapshot.workspaceKind == "vendor",
                   snapshot.scopeKind == "business" {
                    if let vendorRepository = vendorBusinessRepository(for: snapshot) {
                        ProductionVendorBusinessContent(
                            repository: vendorRepository,
                            onSignOut: { session.signOut() },
                            onSwitchContext: canSwitchProductionContext ? { showingContextSwitcher = true } : nil
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
                } else if let snapshot = session.productionWorkspace,
                   snapshot.grantId == session.activeGrantId {
                    ProductionReadOnlyWorkspaceContent(
                        snapshot: snapshot,
                        onSignOut: { session.signOut() },
                        onSwitchContext: canSwitchProductionContext ? { showingContextSwitcher = true } : nil
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
                    .task(
                        id: "\(session.currentRole?.roleId ?? "")|\(session.productionAuthority?.accessUserId ?? session.activePersona?.id ?? "")|\(session.activeGrantId ?? "")|\(session.selectedGrantIds.sorted().joined(separator: ","))|\(session.selectedEngagementId ?? "")|\(session.selectedGateGrantId ?? "")"
                    ) {
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
                // "I Have an Invitation" is a guest door, never an alias for account sign-in.
                // If the OS did not deliver a Universal Link (for example the guest launched from
                // the app icon), this recovery surface accepts the exact private invitation URL
                // and sends it through the same parser/authority pipeline.
                if invitationEntryRequested {
                    WewedScreenContainer {
                        InvitationLinkEntryView(
                            onOpen: { url in
                                invitationEntryRequested = false
                                appState.handleIncomingURL(url)
                            },
                            onBack: { invitationEntryRequested = false }
                        )
                    }
                } else {
                    WewedScreenContainer { WewedWelcomeView(
                        onOpenInvitation: { invitationEntryRequested = true },
                        onSignIn: { authMode = .signIn },
                        onCreateAccount: { authMode = .createAccount },
                        shadowEntry: appState.dataEnvironment.allowsDevelopmentPersonaSwitching
                            ? ShadowEntryOption(environmentName: appState.dataEnvironment.displayName) {
                                session.enterShadowSession()
                            }
                            : nil
                    ) }
                }
            } else {
                WewedScreenContainer { LoginView(onBack: { authMode = nil }) }
            }
        }
        .onOpenURL { url in
            invitationEntryRequested = false
            appState.handleIncomingURL(url)
        }
        .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
            if let url = activity.webpageURL {
                invitationEntryRequested = false
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
        // Master plan Phase 8 closure round 3 §4 — accessUserId is part of this key too, not just an
        // argument passed into the bind call: a same-account refresh that only changes grantId/
        // weddingId already re-triggers this task, but an account replacement that happens to
        // resolve the SAME grantId/weddingId strings (two accounts sharing a wedding, both as
        // coordinator) would not otherwise re-run it at all.
        .task(id: "\(session.productionWorkspace?.grantId ?? "")|\(session.productionWorkspace?.weddingId ?? "")|\(session.productionAuthority?.accessUserId ?? "")") {
            await bindProductionRepositoriesIfNeeded()
        }
        .task(id: "\(session.productionWorkspace?.workspaceKind ?? "")|\(session.productionWorkspace?.grantId ?? "")|\(session.productionAuthority?.accessUserId ?? "")") {
            await bindProductionAdminRepositoryIfNeeded()
        }
        // Master plan Phase 8 closure round 3 §6, hardened round 4 §2 — same treatment for the
        // Vendor's own wedding engagement, a distinct axis from the Vendor business-portfolio grant
        // above. `session.selectedEngagementId` is part of the key so a same-grant engagement switch
        // re-runs this effect and produces a new binding rather than being a no-op.
        .task(id: "\(session.productionWorkspace?.workspaceKind ?? "")|\(session.productionWorkspace?.scopeKind ?? "")|\(session.productionWorkspace?.grantId ?? "")|\(session.productionAuthority?.accessUserId ?? "")|\(session.selectedEngagementId ?? "")") {
            await bindProductionVendorEngagementRepositoryIfNeeded()
        }
        // Master plan Phase 8 closure round 3 §4 — sign-out and session-invalidation both drive
        // `isAuthenticated` to false; clearing the production binding here means no role shell can
        // ever render against a previous account's repository afterward, for either reason. Direct
        // account replacement (never signed out) does not toggle `isAuthenticated`, but is already
        // made safe by bindProductionRepositories/bindProductionAdminRepository/
        // bindProductionContractsRepository/bindProductionVendorEngagementRepository keying each
        // binding to the (accessUserId, grantId) that produced it, not grantId alone.
        .task(id: session.isAuthenticated) {
            if !session.isAuthenticated {
                appState.clearProductionBinding()
            }
        }
        // Attached at the outer level so it works from both authenticated production surfaces: the
        // role-shell workspace and the Planner-portfolio/Vendor-business read-only landing.
        .sheet(isPresented: $showingContextSwitcher) {
            if let authority = session.productionAuthority {
                ContextSwitcherSheet(
                    authority: authority,
                    activeGrantId: session.activeGrantId,
                    activeGateGrantId: session.currentRole == .usher ? session.selectedGateGrantId : nil,
                    onSelect: { grantId in session.selectGrant(grantId) },
                    onSelectGate: { grantId in session.selectGateGrant(grantId) }
                )
            }
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

    /// Shared "refresh failed, no stale data shown" state for the production-scoped branches of
    /// `authorizedShell`, matching the messaging/identifier already used by the pre-Phase-8
    /// read-only path.
    private var productionWorkspaceUnavailable: some View {
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

    /// Master plan Phase 8 closure §1/round 3 §4/§5, hardened round 4 §1 (NativeRepositoryFactory
    /// .PRODUCTION closure) — the snapshot looking right is necessary but not sufficient: it says the
    /// *context* is authorized, not that `appState.repository`/`plannerRepository`/`adminRepository`/
    /// `vendorEngagementRepository` have actually been bound to the real, grant-scoped adapter yet
    /// (unbound, they throw `ProductionRepositoryUnbound` rather than returning anything repository-
    /// shaped — that bind runs from the `.task(id:)` effects above, which start asynchronously
    /// relative to this body evaluation). Waiting for the confirmed binding — keyed on BOTH
    /// accessUserId and grantId, not grantId alone — is what makes this deterministic even across an
    /// account replacement that happens to resolve the same grantId string a previous account already
    /// bound: no role shell that "appears functional" is ever composed while unbound, and
    /// no role shell is ever rendered over a DIFFERENT account's bound repository either.
    ///
    /// A plain (non-`@ViewBuilder`) helper on purpose: a bare `switch` embedded directly inside
    /// `authorizedShell`'s `@ViewBuilder` body would be transformed as if it were meant to produce a
    /// `View` per case, which fails to compile for a `switch` whose cases only assign a `Bool`.
    ///
    /// Master plan Phase 8 closure round 4 §2 — for `.vendor` specifically, this ALSO compares the
    /// binding's own `engagementId` against `session.selectedEngagementId`: the other roles have no
    /// engagement selection, so `ProductionBinding.isCurrent` (accessUserId + grantId only) is
    /// sufficient for them, but a Vendor's `(accessUserId, grantId)` pair can legitimately serve more
    /// than one engagement — a stale binding for engagement A must never validate a fresh requirement
    /// for engagement B under the SAME grant.
    private func isProductionBindingCurrent(for role: AppRole) -> Bool {
        let currentAccessUserId = session.productionAuthority?.accessUserId
        let activeGrantId = session.activeGrantId
        switch role {
        case .admin:
            return appState.productionAdminBinding.isCurrent(accessUserId: currentAccessUserId, grantId: activeGrantId)
        case .vendor:
            guard case let .bound(boundAccessUserId, boundGrantId, _, boundEngagementId) = appState.productionVendorEngagementBinding else {
                return false
            }
            return boundAccessUserId == currentAccessUserId
                && boundGrantId == activeGrantId
                && boundEngagementId == session.selectedEngagementId
        default:
            return appState.productionWeddingBinding.isCurrent(accessUserId: currentAccessUserId, grantId: activeGrantId)
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
            if context.activeRole == .usher {
                if let gate = session.activeGateContext,
                   gate.operatorUserId == context.actorId,
                   gate.weddingId == context.activeWeddingId,
                   gate.gateId == context.activeGateId {
                    ProductionGateAuthorityView(
                        gateContext: gate,
                        onSwitchContext: canSwitchProductionContext ? { showingContextSwitcher = true } : nil,
                        onSignOut: { session.signOut() }
                    )
                } else {
                    productionWorkspaceUnavailable
                }
            } else {
            // Master plan Phase 8 closure round 3 §6 — Couple/Planner/Coordinator/Admin/Vendor now
            // render through the SAME real role shells every other environment uses, backed by the
            // production repositories bound above/below. Usher/Guest reaching this point still render
            // the Phase 5/6 minimal read-only snapshot below — that mature-domain native UI is not
            // wired yet, and falling back to it here is an honest "not yet" rather than a broken real
            // shell.
            let productionRoleWired: [AppRole] = [.couple, .planner, .coordinator, .admin, .vendor]
            if productionRoleWired.contains(context.activeRole) {
                // Admin has no wedding, so its snapshot's weddingId is always nil while
                // context.activeWeddingId defaults to "" — the same escape hatch Couple/Planner/
                // Coordinator do not need, since they always have a real wedding to match against.
                let weddingScopeMatches = context.activeRole == .admin
                    || session.productionWorkspace?.weddingId == context.activeWeddingId
                if let snapshot = session.productionWorkspace,
                   snapshot.grantId == session.activeGrantId,
                   weddingScopeMatches {
                    // Master plan Phase 8 closure §1/round 3 §4/§5, hardened round 4 §1
                    // (NativeRepositoryFactory.PRODUCTION closure) — the snapshot looking right is
                    // necessary but not sufficient: it says the *context* is authorized, not that
                    // appState.repository/plannerRepository/adminRepository/vendorEngagementRepository
                    // have actually been bound to the real, grant-scoped adapter yet (unbound, they
                    // throw ProductionRepositoryUnbound rather than returning anything repository-
                    // shaped — that bind runs from the `.task(id:)` effects above, which start
                    // asynchronously relative to this body evaluation). Waiting for the confirmed
                    // binding — keyed on BOTH accessUserId and grantId, not grantId alone — is what
                    // makes this deterministic even across an account replacement that happens to
                    // resolve the same grantId string a previous account already bound: no role shell
                    // that "appears functional" is ever composed while unbound, and no role shell is
                    // ever rendered over a DIFFERENT account's bound
                    // repository either.
                    //
                    // Master plan Phase 8 closure round 4 §2 — a Vendor grant with more than one
                    // serviceEngagementId must not fall through to VendorShellView until the person
                    // has explicitly picked one; this reuses the EXACT same picker/mechanism Phase
                    // 5/6's minimal snapshot path already established
                    // (`session.selectEngagement(_:)`), now reachable from the real wired shell
                    // instead of only from the pre-Phase-8 fallback further below. This picker had
                    // become unreachable for Vendor once Vendor joined `productionRoleWired` above —
                    // it used to only render via the generic fallback path Vendor no longer reaches —
                    // so this is a real regression fix, re-inserting the check specifically for the
                    // Vendor role.
                    if context.activeRole == .vendor && snapshot.engagementSelectionRequired {
                        ProductionReadOnlyWorkspaceContent(
                            snapshot: snapshot,
                            onSelectEngagement: { engagementId in session.selectEngagement(engagementId) }
                        )
                    } else if isProductionBindingCurrent(for: context.activeRole) {
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
                        case .admin:
                            AdminShellView(
                                context: context,
                                onSwitchPersona: switchPersona,
                                pendingDeepLink: link,
                                onDeepLinkHandled: handled
                            )
                        // Master plan Phase 8 closure round 3 §6 — a real vendor:wedding grant now
                        // renders the SAME VendorShellView every other environment uses. A Vendor
                        // business-portfolio grant never reaches this branch at all (it stays on the
                        // earlier no-ActorAssignment path above), so this is exclusively the
                        // wedding-engagement axis.
                        case .vendor:
                            VendorShellView(
                                context: context,
                                onSwitchPersona: switchPersona,
                                pendingDeepLink: link,
                                onDeepLinkHandled: handled
                            )
                        default:
                            EmptyView()
                        }
                    } else {
                        ProgressView()
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .background(WeddingIdentityPalette.ivory)
                    }
                } else {
                    productionWorkspaceUnavailable
                }
            } else if let snapshot = session.productionWorkspace,
               snapshot.grantId == session.activeGrantId {
                RoleShellScaffold(
                    context: context,
                    onSwitchPersona: canSwitchProductionContext ? { showingContextSwitcher = true } : nil,
                    pendingDeepLink: link,
                    sectionMemory: productionSectionMemory,
                    onDeepLinkHandled: handled
                ) { destination, _ in
                    ProductionReadOnlyWorkspaceContent(
                        snapshot: snapshot,
                        destination: destination,
                        onSelectEngagement: { engagementId in session.selectEngagement(engagementId) }
                    )
                }
            } else {
                productionWorkspaceUnavailable
            }
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

    private struct GateGrantSelectionView: View {
        let grants: [ProductionOperationalGrant]
        let onSelect: (String) -> Void
        let onSignOut: () -> Void

        var body: some View {
            VStack(alignment: .leading, spacing: 12) {
                Text("Choose your gate").font(.title2)
                Text("You have more than one active Gate assignment. Wewed will not choose one for you.")
                    .font(.caption)
                    .foregroundStyle(WeddingIdentityPalette.muted)
                ForEach(grants, id: \.grantId) { grant in
                    Button("\(grant.gateName) · \(grant.weddingTitle)") {
                        onSelect(grant.grantId)
                    }
                    .buttonStyle(.bordered)
                    .accessibilityIdentifier("gate-grant-option-\(grant.grantId)")
                }
                Button("Sign out", action: onSignOut)
                    .buttonStyle(.plain)
            }
            .padding(24)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(WeddingIdentityPalette.ivory)
            .accessibilityIdentifier("gate-grant-selection")
        }
    }

    private struct ProductionGateAuthorityView: View {
        let gateContext: GateOperationalContext
        let onSwitchContext: (() -> Void)?
        let onSignOut: () -> Void

        var body: some View {
            VStack(alignment: .leading, spacing: 14) {
                Text("Gate Operations").font(.title2)
                Text(gateContext.weddingTitle).foregroundStyle(WeddingIdentityPalette.muted)
                Text(gateContext.gateName).font(.headline)
                Text("Assignment: \(gateContext.assignmentId)")
                    .font(.caption)
                    .foregroundStyle(WeddingIdentityPalette.muted)
                Text("Capabilities: \(gateContext.capabilities.sorted().joined(separator: ", "))")
                    .font(.caption)
                    .foregroundStyle(WeddingIdentityPalette.muted)
                Divider()
                Text("Gate admission and offline Wedding Pass activation remain disabled until Phase 11. This screen proves the real server assignment without fabricating a scanner credential.")
                    .font(.caption)
                    .foregroundStyle(WeddingIdentityPalette.muted)
                if let onSwitchContext {
                    Button("Switch context", action: onSwitchContext)
                        .buttonStyle(.bordered)
                        .accessibilityIdentifier("gate-switch-context")
                }
                Button("Sign out", action: onSignOut)
            }
            .padding(24)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(WeddingIdentityPalette.ivory)
            .accessibilityIdentifier("production-gate-authority")
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
