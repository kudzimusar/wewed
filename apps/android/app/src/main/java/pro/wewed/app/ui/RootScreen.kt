package pro.wewed.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.models.AppRole
import pro.wewed.app.models.GuestJourneyReference
import pro.wewed.app.models.GuestJourneyStage
import pro.wewed.app.models.InvitationContext
import pro.wewed.app.models.NativeDataEnvironment
import pro.wewed.app.navigation.DeepLinkRouter
import pro.wewed.app.navigation.IANavigationContract
import pro.wewed.app.navigation.ActorAssignmentSources
import pro.wewed.app.navigation.NavigationContext
import pro.wewed.app.navigation.RoleShellAuthorization
import pro.wewed.app.navigation.ProductionAuthority
import pro.wewed.app.navigation.ProductionGrantMapper
import pro.wewed.app.navigation.ProductionWorkspaceGrant
import pro.wewed.app.navigation.GrantScopeKind
import pro.wewed.app.services.NativeDomainApiClient
import pro.wewed.app.services.ProductionContractsRepository
import pro.wewed.app.services.ProductionPlannerDashboardRepository
import pro.wewed.app.services.ProductionAdminSystemRepository
import pro.wewed.app.services.ProductionVendorBusinessRepository
import pro.wewed.app.services.ProductionVendorEngagementRepository
import pro.wewed.app.services.ProductionWeddingRepository
import pro.wewed.app.services.UrlConnectionWeddingDayTransport
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.state.ProductionBinding
import pro.wewed.app.state.SessionViewModel
import pro.wewed.app.theme.WeddingIdentityPalette
import pro.wewed.app.navigation.AuthenticationMode
import pro.wewed.app.navigation.InvitationEntryStage
import pro.wewed.app.ui.entry.NativeEnvironmentUnavailableScreen
import pro.wewed.app.navigation.LaunchRouter
import pro.wewed.app.navigation.NativeAppEntryState
import pro.wewed.app.ui.auth.LoginScreen
import pro.wewed.app.ui.entry.ShadowEntryOption
import pro.wewed.app.ui.entry.SplashDestination
import pro.wewed.app.ui.entry.WewedAnimatedSplash
import pro.wewed.app.ui.entry.WewedWelcomeScreen
import pro.wewed.app.models.InvitationStyle
import pro.wewed.app.models.RSVPStatus
import pro.wewed.app.ui.invitation.ivory.IvoryActions
import pro.wewed.app.ui.invitation.ivoryDataFrom
import pro.wewed.app.ui.invitation.ivoryRsvpStateFrom
import pro.wewed.app.ui.invitation.GuestInvitationJourneyScreen
import androidx.compose.ui.platform.LocalContext
import pro.wewed.app.invitation.GuestInvitationBootstrap
import pro.wewed.app.invitation.InvitationEntry
import pro.wewed.app.invitation.LiveInvitationPresentation
import pro.wewed.app.invitation.LiveInvitationState
import pro.wewed.app.ui.invitation.InvitationUnavailableScreen
import pro.wewed.app.ui.invitation.LiveGuestInvitationScreen
import pro.wewed.app.ui.invitation.InvitationRefusedScreen
import pro.wewed.app.ui.pass.UsherScannerScreen
import pro.wewed.app.ui.roles.*

/**
 * IA V2 root.
 *
 * Resolves the active [NavigationContext] once and hands it to the role shell. Every role — Couple
 * included — now renders through [RoleShellScaffold], so no role shell can invent its own
 * bottom-navigation topology.
 */
@OptIn(ExperimentalComposeUiApi::class)
@Composable
fun RootScreen(
    sessionViewModel: SessionViewModel,
    appViewModel: AppViewModel
) {
    val isAuthenticated by sessionViewModel.isAuthenticated.collectAsState()
    val currentRole by sessionViewModel.currentRole.collectAsState()
    val authorizedRoles by sessionViewModel.authorizedRoles.collectAsState()
    val currentUserName by sessionViewModel.currentUserName.collectAsState()
    val activePersonaId by sessionViewModel.activePersonaId.collectAsState()
    val weddingId by sessionViewModel.weddingId.collectAsState()
    val weddingTitle by sessionViewModel.weddingTitle.collectAsState()
    val productionAuthority by sessionViewModel.productionAuthority.collectAsState()
    val selectedGrantIds by sessionViewModel.selectedGrantIds.collectAsState()
    val selectedEngagementId by sessionViewModel.selectedEngagementId.collectAsState()
    val activeGrantId by sessionViewModel.activeGrantId.collectAsState()
    val productionWorkspace by sessionViewModel.productionWorkspace.collectAsState()
    val pendingInvitationDeepLink by appViewModel.pendingInvitationDeepLink.collectAsState()
    val rejectedInvitation by appViewModel.rejectedInvitation.collectAsState()
    val pendingInvitationEntry by appViewModel.pendingInvitationEntry.collectAsState()
    val pendingRouteDeepLink by appViewModel.pendingRouteDeepLink.collectAsState()

    var isScannerOpen by remember { mutableStateOf(false) }
    var showPersonaPicker by remember { mutableStateOf(false) }
    var deepLinkedInvitation by remember { mutableStateOf<InvitationContext?>(null) }
    var resolvingDeepLinkedInvitation by remember { mutableStateOf(false) }

    // Master plan Phase 8 closure round 3 §4 — sign-out and session-invalidation both drive
    // isAuthenticated to false; clearing the production binding here means no role shell can ever
    // render against a previous account's repository afterward, for either reason. Direct account
    // replacement (never signed out) does not toggle isAuthenticated, but is already made safe by
    // bindProductionRepositories/bindProductionAdminRepository/bindProductionContractsRepository
    // keying each binding to the (accessUserId, grantId) that produced it, not grantId alone.
    LaunchedEffect(isAuthenticated) {
        if (!isAuthenticated) appViewModel.clearProductionBinding()
    }

    // -----------------------------------------------------------------------------------------
    // Entry lifecycle.
    //
    // Launch decisions used to be a sequence of early returns: resolve a link, then check
    // authentication, then resolve a context. Nothing named the lifecycle, so the rule that an
    // invitation outranks a sign-in form was a property of statement ORDER — a reordering would
    // have silently sent an invited guest to a login screen. The state is now explicit, and
    // LaunchRouter decides it as a pure function that tests can assert directly.
    // -----------------------------------------------------------------------------------------
    var splashComplete by remember { mutableStateOf(false) }
    var authMode by remember { mutableStateOf<AuthenticationMode?>(null) }

    // --- The live guest invitation path -------------------------------------------------------
    //
    // A credential-bearing launch is resolved by the guest-session authority, not by a repository.
    // The coordinator is created once per process by `GuestInvitationBootstrap`, deliberately
    // outside `NativeRepositoryFactory`: an invited guest needs the guest-session API and nothing
    // about tasks, budgets or admin, so their invitation must not wait on the whole production
    // workspace being enabled.
    val androidContext = LocalContext.current
    val liveCoordinator = remember {
        GuestInvitationBootstrap.coordinator(androidContext)
    }
    var liveInvitation by remember { mutableStateOf<LiveInvitationState>(LiveInvitationState.Idle) }

    LaunchedEffect(pendingInvitationEntry) {
        // The separation runs both ways. The legacy path is barred from live mode, and the live
        // path is equally barred from Shadow: a Shadow slug is not a real wedding, so sending it
        // to the production authority produced a refusal for a link that is perfectly valid in
        // the environment it belongs to.
        if (appViewModel.dataEnvironment.allowsMutableNativeDevelopment) return@LaunchedEffect
        // Consumed exactly once: an exchange is not idempotent, and a recomposition must not
        // replay it.
        val entry = appViewModel.consumePendingInvitationEntry() ?: return@LaunchedEffect
        liveInvitation = LiveInvitationState.Exchanging
        liveInvitation = liveCoordinator.enter(entry)
    }

    // The Shadow-era resolution stays, but only for Shadow. It is never a fallback for the live
    // path: if the guest-session authority refuses or cannot be reached, the guest is told, rather
    // than being shown fixture data that looks like their invitation.
    LaunchedEffect(pendingInvitationDeepLink) {
        val pending = pendingInvitationDeepLink ?: return@LaunchedEffect
        if (!appViewModel.dataEnvironment.allowsMutableNativeDevelopment) {
            appViewModel.consumePendingInvitationDeepLink()
            return@LaunchedEffect
        }
        resolvingDeepLinkedInvitation = true
        deepLinkedInvitation = runCatching {
            appViewModel.repository.resolveInvitation(
                pending.weddingSlug,
                pending.rsvpToken
            )
        }.getOrNull()
        appViewModel.consumePendingInvitationDeepLink()
        resolvingDeepLinkedInvitation = false
    }

    // The Wewed animated splash is global: it plays on an icon launch, an invitation link, a
    // returning session and a new account alike. The app used to have one splash for the guest
    // journey and a bare window for everything else.
    if (!splashComplete) {
        // The splash leaves differently depending on what it hands over to. An invitation is
        // REVEALED — the stage lifts away leaving the ivory and ornament for the card to arrive
        // into — where a workspace is entered and the stage simply recedes. A splash that always
        // exits the same way reads as a loader.
        val splashDestination = when {
            // A live invitation counts: the splash should hand over to a card, not recede into a
            // workspace, whichever path resolved the guest.
            pendingInvitationEntry != null ||
                liveInvitation is LiveInvitationState.Exchanging ||
                liveInvitation is LiveInvitationState.Presenting ->
                SplashDestination.INVITATION
            pendingInvitationDeepLink != null || deepLinkedInvitation != null ->
                SplashDestination.INVITATION
            isAuthenticated -> SplashDestination.WORKSPACE
            else -> SplashDestination.WELCOME
        }
        WewedAnimatedSplash(
            destination = splashDestination,
            onFinished = { splashComplete = true }
        )
        return
    }

    // The live invitation outranks everything that follows. It is the guest's front door, and it
    // must be reached before Home, the couple site, a login or a workspace.
    when (val live = liveInvitation) {
        is LiveInvitationState.Exchanging -> {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(WeddingIdentityPalette.Ivory)
                    .semantics { testTagsAsResourceId = true }
                    .testTag("invitation-exchanging"),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = WeddingIdentityPalette.ChampagneDeep)
            }
            return
        }

        is LiveInvitationState.Presenting -> {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .semantics { testTagsAsResourceId = true }
            ) {
                LiveGuestInvitationScreen(
                    presentation = LiveInvitationPresentation.from(live.snapshot),
                    coordinator = liveCoordinator,
                    onRefreshed = { liveInvitation = it },
                    onContinue = { liveInvitation = LiveInvitationState.Idle }
                )
            }
            return
        }

        // Refused and Unavailable mean opposite things to a guest, so they are never merged:
        // one says "this link is not yours", the other says "try again in a moment".
        is LiveInvitationState.Refused -> {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .semantics { testTagsAsResourceId = true }
            ) {
                InvitationRefusedScreen(
                    reason = live.reason ?: InvitationEntry.Reason.MALFORMED_HANDOFF,
                    onDismiss = { liveInvitation = LiveInvitationState.Idle }
                )
            }
            return
        }

        is LiveInvitationState.Unavailable -> {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .semantics { testTagsAsResourceId = true }
            ) {
                InvitationUnavailableScreen(
                    onRetry = { liveInvitation = LiveInvitationState.Idle }
                )
            }
            return
        }

        LiveInvitationState.Idle -> Unit
    }

    // A refused invitation outranks everything that follows. It must not fall through to the
    // ordinary launch and quietly present whoever was already active.
    rejectedInvitation?.let { reason ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .semantics { testTagsAsResourceId = true }
        ) {
            InvitationRefusedScreen(
                reason = reason,
                onDismiss = { appViewModel.clearRejectedInvitation() }
            )
        }
        return
    }

    if (resolvingDeepLinkedInvitation || pendingInvitationDeepLink != null) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(WeddingIdentityPalette.Ivory)
                .testTag("entry-resolving-deep-link"),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator(color = WeddingIdentityPalette.ChampagneDeep)
        }
        return
    }

    val entryState = LaunchRouter.route(
        invitation = deepLinkedInvitation,
        hasValidSession = isAuthenticated,
        authorizedRoles = if (isAuthenticated) authorizedRoles else emptyList(),
        hasResolvedContext = true
    )

    // An invitation outranks everything. No account, no sign-in, no role chooser: the invitation
    // token IS the guest's authorization, and a confirmed guest goes straight to their pass rather
    // than being asked to RSVP a second time.
    (entryState as? NativeAppEntryState.Invitation)?.let { invitationState ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .semantics { testTagsAsResourceId = true }
        ) {
            // Every valid guest entry meets the configured invitation first, whatever they have
            // already answered. RSVP state changes what the card offers, never which card it is.
            GuestInvitationJourneyScreen(
                reference = GuestJourneyReference(
                    invitationState.invitation,
                    GuestJourneyStage.INVITATION
                ),
                appViewModel = appViewModel,
                onExit = { deepLinkedInvitation = null }
            )
        }
        return
    }

    if (entryState is NativeAppEntryState.Welcome && authMode == null) {
        WewedWelcomeScreen(
            onOpenInvitation = { authMode = AuthenticationMode.SIGN_IN },
            onSignIn = { authMode = AuthenticationMode.SIGN_IN },
            onCreateAccount = { authMode = AuthenticationMode.CREATE_ACCOUNT },
            shadowEntry = appViewModel.dataEnvironment
                .takeIf { it.allowsDevelopmentPersonaSwitching }
                ?.let { environment ->
                    ShadowEntryOption(environment.displayName) { sessionViewModel.enterShadowSession() }
                }
        )
        return
    }

    if (!isAuthenticated) {
        LoginScreen(
            sessionViewModel = sessionViewModel,
            environment = appViewModel.dataEnvironment,
            onBack = { authMode = null }
        )
        return
    }

    // P0-16: production/verify builds must not expose an arbitrary role switcher.
    val personaSwitchingAllowed = appViewModel.dataEnvironment.allowsDevelopmentPersonaSwitching
    val onOpenPersonaPicker: (() -> Unit)? =
        if (personaSwitchingAllowed) ({ showPersonaPicker = true }) else null

    if (showPersonaPicker && personaSwitchingAllowed) {
        PersonaPickerDialog(
            sessionViewModel = sessionViewModel,
            onDismiss = { showPersonaPicker = false }
        )
    }

    // IA V2 §13.1 / P0-3 — the context envelope is *resolved from verified assignments*, never
    // assembled from convenient defaults. No client id, gate id, engagement id or guest identity
    // is invented here; an unresolved scope stays null and the shell denies the workspace.
    // Shadow authority only where Shadow personas exist; production/verify resolve a real
    // ProductionActorAssignmentSource once an authority has actually been fetched (master plan
    // §8.9, Phase 5) — until then they still get no assignments at all.
    val assignmentSource = remember(appViewModel, productionAuthority, selectedGrantIds, selectedEngagementId) {
        ActorAssignmentSources.forEnvironment(
            appViewModel.dataEnvironment,
            appViewModel.repository,
            appViewModel.plannerRepository,
            productionAuthority,
            selectedGrantIds,
            selectedEngagementId
        )
    }

    // Master plan Phase 8 — rebinds appViewModel's domain repositories to real, grant-scoped
    // production adapters as soon as a wedding-scoped workspace snapshot is available. Keyed on
    // the snapshot's own grantId/weddingId (already freshly revalidated by Phase 5/6's
    // refreshActiveWorkspace), not on context resolution below, so the swap is ready before
    // RoleWorkspaces/rememberWeddingGraph ever read appViewModel.repository for this wedding. A
    // portfolio/business/system snapshot (weddingId null) does nothing here — those render through
    // ProductionReadOnlyWorkspaceContent exactly as before (see the branch above, line ~393).
    if (appViewModel.dataEnvironment == NativeDataEnvironment.PRODUCTION) {
        val snapshotWeddingId = productionWorkspace?.weddingId
        val snapshotGrantId = productionWorkspace?.grantId
        val snapshotAccessUserId = productionAuthority?.accessUserId
        // Master plan Phase 8 closure round 3 §4 — accessUserId is part of the LaunchedEffect key
        // too, not just an argument passed into the bind call: a same-account refresh that only
        // changes grantId/weddingId already re-triggers this effect, but an account replacement
        // that happens to resolve the SAME grantId/weddingId strings (two accounts sharing a
        // wedding, both as coordinator) would not otherwise re-run it at all.
        LaunchedEffect(snapshotGrantId, snapshotWeddingId, snapshotAccessUserId, sessionViewModel) {
            if (snapshotGrantId == null || snapshotWeddingId == null || snapshotAccessUserId == null) return@LaunchedEffect
            val token = sessionViewModel.currentSessionToken() ?: return@LaunchedEffect
            val client = NativeDomainApiClient(
                transport = UrlConnectionWeddingDayTransport(appViewModel.dataBaseUrl ?: return@LaunchedEffect),
                onSessionInvalid = { sessionViewModel.handleNativeDomainSessionInvalid() },
                onGrantRevoked = { revokedGrantId -> sessionViewModel.handleNativeDomainGrantRevoked(revokedGrantId) },
            )
            appViewModel.bindProductionRepositories(
                accessUserId = snapshotAccessUserId,
                grantId = snapshotGrantId,
                wedding = ProductionWeddingRepository(client, token, snapshotGrantId, snapshotWeddingId),
                planner = ProductionPlannerDashboardRepository(client, token, snapshotGrantId),
            )
            appViewModel.bindProductionContractsRepository(
                accessUserId = snapshotAccessUserId,
                grantId = snapshotGrantId,
                contracts = ProductionContractsRepository(client, token, snapshotGrantId),
            )
        }
    }

    // Master plan §9 — multiple grants of the current role's kind require an explicit choice; none
    // is picked on the person's behalf. A single grant, or a grant kind the contract does not mark
    // selectionRequired, needs no picker and falls straight through to the ordinary context
    // resolution below.
    val pendingGrantChoice = remember(productionAuthority, currentRole, selectedGrantIds) {
        pendingGrantSelection(productionAuthority, currentRole, selectedGrantIds)
    }
    if (pendingGrantChoice.isNotEmpty()) {
        GrantSelectionScreen(
            grants = pendingGrantChoice,
            onSelect = { grantId -> sessionViewModel.selectGrant(grantId) },
            onSignOut = { sessionViewModel.signOut() }
        )
        return
    }

    // Master plan Phase 6 §1, §2, §11 — an explicit switcher reachable AFTER a workspace is open,
    // for every axis the account genuinely holds (Planner A/B/C, a second role such as Admin, a
    // Coordinator's own wedding). Only offered when more than one grant actually exists; selecting
    // one calls the same selectGrant() Phase 5 already uses for the forced pre-workspace choice.
    var showContextSwitcher by remember { mutableStateOf(false) }
    val canSwitchProductionContext = appViewModel.dataEnvironment == NativeDataEnvironment.PRODUCTION &&
        (productionAuthority?.grants?.size ?: 0) > 1
    productionAuthority?.let { authority ->
        if (showContextSwitcher) {
            ContextSwitcherDialog(
                authority = authority,
                activeGrantId = activeGrantId,
                onSelect = { grantId -> sessionViewModel.selectGrant(grantId) },
                onDismiss = { showContextSwitcher = false },
            )
        }
    }
    val onOpenContextSwitcher: (() -> Unit)? = if (canSwitchProductionContext) ({ showContextSwitcher = true }) else null

    // Portfolio/business authority is a real workspace even though it deliberately has no wedding
    // ActorAssignment. Render the revalidated server snapshot instead of claiming "no workspace".
    if (appViewModel.dataEnvironment == NativeDataEnvironment.PRODUCTION &&
        isAuthenticated && currentRole == null && activeGrantId != null
    ) {
        val snapshot = productionWorkspace
        if (snapshot == null) {
            NativeEnvironmentUnavailableScreen(
                environmentName = appViewModel.dataEnvironment.displayName,
                reason = "This authorized workspace could not be refreshed. No cached production data is shown."
            )
            return
        }

        // Master plan Phase 8 closure §A — a Vendor business grant (scopeKind "business") gets its
        // OWN real production shell (identity/catalog/offerings/bookings from
        // /api/native/vendor/*), never the wedding graph, and never fabricated content. A Planner
        // portfolio (scopeKind "portfolio") keeps the existing minimal snapshot — its own domains
        // (Overview/Tasks/etc.) are already reachable once a real wedding is selected.
        if (snapshot.workspaceKind == "vendor" && snapshot.scopeKind == "business") {
            // Master plan Phase 8 closure round 3 §4 — accessUserId is part of these `remember` keys
            // too: two different accounts (e.g. two members of the same vendor business) can
            // independently resolve the identical `vendor:business:<id>` grant id. Without
            // accessUserId in the key, `remember` would keep Account A's repository (with Account
            // A's token closed over inside it) across a switch to Account B whose grantId happens to
            // coincide, since `snapshot.grantId` alone would not have changed.
            val vendorAccessUserId = productionAuthority?.accessUserId
            val vendorClient = remember(snapshot.grantId, vendorAccessUserId, appViewModel.dataBaseUrl) {
                appViewModel.dataBaseUrl?.let { baseUrl ->
                    NativeDomainApiClient(
                        transport = UrlConnectionWeddingDayTransport(baseUrl),
                        onSessionInvalid = { sessionViewModel.handleNativeDomainSessionInvalid() },
                        onGrantRevoked = { revokedGrantId -> sessionViewModel.handleNativeDomainGrantRevoked(revokedGrantId) },
                    )
                }
            }
            val vendorRepository = remember(vendorClient, snapshot.grantId, vendorAccessUserId) {
                val token = sessionViewModel.currentSessionToken()
                if (vendorClient != null && token != null && vendorAccessUserId != null) {
                    ProductionVendorBusinessRepository(vendorClient, token, snapshot.grantId)
                } else null
            }
            if (vendorRepository != null) {
                ProductionVendorBusinessContent(
                    repository = vendorRepository,
                    onSignOut = { sessionViewModel.signOut() },
                    onSwitchContext = onOpenContextSwitcher,
                )
            } else {
                NativeEnvironmentUnavailableScreen(
                    environmentName = appViewModel.dataEnvironment.displayName,
                    reason = "This authorized workspace could not be refreshed. No cached production data is shown."
                )
            }
            return
        }

        ProductionReadOnlyWorkspaceContent(
            snapshot = snapshot,
            onSignOut = { sessionViewModel.signOut() },
            onSwitchContext = onOpenContextSwitcher,
        )
        return
    }

    var resolvedContext by remember { mutableStateOf<NavigationContext?>(null) }
    var resolvingContext by remember { mutableStateOf(true) }

    LaunchedEffect(
        currentRole,
        activePersonaId,
        weddingId,
        weddingTitle,
        productionAuthority,
        selectedGrantIds,
        selectedEngagementId,
        activeGrantId
    ) {
        resolvingContext = true
        val role = currentRole
        if (role == null) {
            // Authenticated with no resolved role: there is no workspace to open, and none is
            // chosen on the person's behalf.
            resolvedContext = null
            resolvingContext = false
            return@LaunchedEffect
        }
        val actorId = activePersonaId.orEmpty()
        val assignment = runCatching { assignmentSource.assignments(actorId) }
            .getOrDefault(emptyList())
            .firstOrNull { it.role == role }

        resolvedContext = NavigationContext(
            actorId = actorId,
            activeRole = role,
            // The wedding comes from the verified assignment and nowhere else. There is no
            // fallback to a session default: an actor without an assignment has no wedding, and
            // the shell denies every wedding-scoped destination (master plan §8.9).
            activeWeddingId = assignment?.weddingId.orEmpty(),
            activeWeddingTitle = if (assignment?.weddingId == null) "" else weddingTitle.orEmpty(),
            environment = appViewModel.dataEnvironment,
            activeClientId = assignment?.clientId,
            activeVendorId = assignment?.vendorId,
            activeEngagementId = assignment?.engagementId,
            activeGateId = assignment?.gateId,
            activeGuestId = assignment?.guestId,
            activePassToken = assignment?.passToken,
            assignment = assignment
        )
        resolvingContext = false
    }

    if (resolvingContext) {
        Box(
            modifier = Modifier.fillMaxSize().background(WeddingIdentityPalette.Ivory),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator(color = WeddingIdentityPalette.ChampagneDeep)
        }
        return
    }

    // A workspace is composed only for a context that holds a verified assignment, every required
    // scope, and a relationship that actually holds (Phase 1 independent review). Nothing missing
    // is filled in: an actor without that is at the no-workspace boundary.
    val context = resolvedContext?.takeIf { RoleShellAuthorization.admitsWorkspace(it) } ?: run {
        NativeEnvironmentUnavailableScreen(
            environmentName = appViewModel.dataEnvironment.displayName,
            reason = "No Wewed workspace is authorized for this session."
        )
        return
    }

    // P0-8: the parsed link is handed to the shell intact; the shell resolves it against the
    // active context through DeepLinkRouter rather than reducing it to a destination id here.
    val onDeepLinkHandled = { appViewModel.consumePendingRouteDeepLink() }

    // Legacy screens that still read ambiently resolve through the same bound wedding.
    LaunchedEffect(context.activeWeddingId) {
        appViewModel.bindActiveWedding(context.activeWeddingId)
    }

    if (isScannerOpen) {
        UsherScannerScreen(
            appViewModel = appViewModel,
            onClose = { isScannerOpen = false }
        )
        return
    }

    // -----------------------------------------------------------------------------------------
    // Guest Entry Contract (GuestCeremonialEntry, master plan §6.3).
    //
    // A Guest actor reaching the workspace root has not arrived through a link — links are handled
    // above and always open on the card. So this is an ordinary return, and it opens on Guest
    // Home with the invitation one tap away, exactly as the production Guest shell does. This root
    // used to replay the card on every entry session, which only Shadow did: the harness was
    // qualifying behaviour production did not have (master plan §8.11).
    // -----------------------------------------------------------------------------------------
    LaunchedEffect(context.activeRole) {
        // Live mode restores the remembered Guest from the server-issued session. Unreachable
        // today — production resolves no assignments and applies no personas — and recorded as a
        // Phase 5 blocker: before the workspace is enabled, Guest entry must stay on the Guest
        // shell's authority (master plan §8.12).
        if (!appViewModel.dataEnvironment.allowsMutableNativeDevelopment &&
            context.activeRole == AppRole.GUEST
        ) {
            liveInvitation = liveCoordinator.restoreRememberedGuest()
        }
    }

    // Master plan Phase 8 closure round 3 §6 — Couple/Planner/Coordinator/Admin/Vendor now render
    // through the SAME real role shells every other environment uses, backed by the production
    // repositories bound above/below. Usher/Guest reaching this point still render the Phase 5/6
    // minimal read-only snapshot below — that mature-domain native UI is not wired yet (see
    // docs/native-mobile/WEWED_NATIVE_PHASE8_FIELD_CLASSIFICATION.md), and falling back to it here
    // is an honest "not yet" rather than a broken real shell.
    val productionRoleWired = appViewModel.dataEnvironment == NativeDataEnvironment.PRODUCTION &&
        context.activeRole in setOf(AppRole.COUPLE, AppRole.PLANNER, AppRole.COORDINATOR, AppRole.ADMIN, AppRole.VENDOR)

    // Master plan Phase 8 closure round 3 §6 — reactively binds the real Vendor-wedding-engagement
    // adapter as soon as a vendor:wedding snapshot is available. Deliberately keyed on
    // `snapshot.workspaceKind == "vendor" && scopeKind == "wedding"`, which is a DIFFERENT authority
    // axis from the Vendor business-portfolio grant (scopeKind "business", handled entirely by the
    // earlier no-ActorAssignment branch above and never reaching this point at all).
    if (appViewModel.dataEnvironment == NativeDataEnvironment.PRODUCTION && context.activeRole == AppRole.VENDOR) {
        val vendorSnapshot = productionWorkspace?.takeIf { it.workspaceKind == "vendor" && it.scopeKind == "wedding" }
        val vendorSnapshotGrantId = vendorSnapshot?.grantId
        val vendorAccessUserId = productionAuthority?.accessUserId
        LaunchedEffect(vendorSnapshotGrantId, vendorAccessUserId, sessionViewModel) {
            if (vendorSnapshotGrantId == null || vendorAccessUserId == null) return@LaunchedEffect
            val token = sessionViewModel.currentSessionToken() ?: return@LaunchedEffect
            val baseUrl = appViewModel.dataBaseUrl ?: return@LaunchedEffect
            val client = NativeDomainApiClient(
                transport = UrlConnectionWeddingDayTransport(baseUrl),
                onSessionInvalid = { sessionViewModel.handleNativeDomainSessionInvalid() },
                onGrantRevoked = { revokedGrantId -> sessionViewModel.handleNativeDomainGrantRevoked(revokedGrantId) },
            )
            appViewModel.bindProductionVendorEngagementRepository(
                accessUserId = vendorAccessUserId,
                grantId = vendorSnapshotGrantId,
                engagement = ProductionVendorEngagementRepository(client, token, vendorSnapshotGrantId),
            )
        }
    }

    // Master plan Phase 8 closure §B — reactively binds the real Admin adapter as soon as an
    // admin:system snapshot is available. Admin has no wedding, so this is keyed on the snapshot's
    // own workspaceKind rather than a weddingId (which is always null/absent for this scope).
    if (appViewModel.dataEnvironment == NativeDataEnvironment.PRODUCTION && context.activeRole == AppRole.ADMIN) {
        val adminSnapshotGrantId = productionWorkspace?.takeIf { it.workspaceKind == "admin" }?.grantId
        val adminAccessUserId = productionAuthority?.accessUserId
        LaunchedEffect(adminSnapshotGrantId, adminAccessUserId, sessionViewModel) {
            if (adminSnapshotGrantId == null || adminAccessUserId == null) return@LaunchedEffect
            val token = sessionViewModel.currentSessionToken() ?: return@LaunchedEffect
            val baseUrl = appViewModel.dataBaseUrl ?: return@LaunchedEffect
            val client = NativeDomainApiClient(
                transport = UrlConnectionWeddingDayTransport(baseUrl),
                onSessionInvalid = { sessionViewModel.handleNativeDomainSessionInvalid() },
                onGrantRevoked = { revokedGrantId -> sessionViewModel.handleNativeDomainGrantRevoked(revokedGrantId) },
            )
            appViewModel.bindProductionAdminRepository(
                accessUserId = adminAccessUserId,
                grantId = adminSnapshotGrantId,
                admin = ProductionAdminSystemRepository(client, token, adminSnapshotGrantId),
            )
        }
    }

    if (productionRoleWired) {
        val snapshot = productionWorkspace
        val weddingScopeMatches = context.activeRole == AppRole.ADMIN || snapshot?.weddingId == context.activeWeddingId
        if (snapshot == null || snapshot.grantId != activeGrantId || !weddingScopeMatches) {
            NativeEnvironmentUnavailableScreen(
                environmentName = appViewModel.dataEnvironment.displayName,
                reason = "The authorized workspace could not be refreshed. No cached production data is shown."
            )
            return
        }

        // Master plan Phase 8 closure §1/round 3 §4/§5 (NativeRepositoryFactory.PRODUCTION
        // closure) — the snapshot looking right is necessary but not sufficient: it says the
        // *context* is authorized, not that appViewModel.repository/plannerRepository/
        // adminRepository have actually been swapped from the unbound ProductionBoundary*Repository
        // placeholder to the real grant-scoped adapter yet (that swap runs from a LaunchedEffect
        // above, which starts asynchronously relative to this composition). Waiting for the
        // confirmed [ProductionBinding.Bound] — keyed on BOTH accessUserId and grantId, not grantId
        // alone — is what makes this deterministic even across an account replacement that happens
        // to resolve the same grantId string a previous account already bound: no role shell that
        // "appears functional" is ever composed over the always-throwing boundary repository, and no
        // role shell is ever composed over a DIFFERENT account's bound repository either.
        val currentAccessUserId = productionAuthority?.accessUserId
        val boundKey by when (context.activeRole) {
            AppRole.ADMIN -> appViewModel.productionAdminBinding
            AppRole.VENDOR -> appViewModel.productionVendorEngagementBinding
            else -> appViewModel.productionWeddingBinding
        }.collectAsState()
        val isBoundToCurrentAccountAndGrant = (boundKey as? ProductionBinding.Bound<*>)?.let {
            it.accessUserId == currentAccessUserId && it.grantId == activeGrantId
        } ?: false
        if (!isBoundToCurrentAccountAndGrant) {
            Box(
                modifier = Modifier.fillMaxSize().background(WeddingIdentityPalette.Ivory),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = WeddingIdentityPalette.ChampagneDeep)
            }
            return
        }
        Box(
            modifier = Modifier
                .fillMaxSize()
                .semantics { testTagsAsResourceId = true }
                .testTag("shadow-source-${appViewModel.dataEnvironment.name.lowercase().replace('_', '-')}")
        ) {
            when (context.activeRole) {
                AppRole.COUPLE -> CoupleShell(
                    sessionViewModel = sessionViewModel,
                    appViewModel = appViewModel,
                    context = context,
                    pendingDeepLink = pendingRouteDeepLink,
                    onDeepLinkHandled = onDeepLinkHandled,
                    onOpenScanner = { isScannerOpen = true },
                    onOpenPersonaPicker = onOpenPersonaPicker
                )
                AppRole.PLANNER -> PlannerShell(
                    sessionViewModel = sessionViewModel,
                    appViewModel = appViewModel,
                    context = context,
                    pendingDeepLink = pendingRouteDeepLink,
                    onDeepLinkHandled = onDeepLinkHandled,
                    onOpenPersonaPicker = onOpenPersonaPicker
                )
                AppRole.COORDINATOR -> CoordinatorShell(
                    sessionViewModel = sessionViewModel,
                    appViewModel = appViewModel,
                    context = context,
                    pendingDeepLink = pendingRouteDeepLink,
                    onDeepLinkHandled = onDeepLinkHandled,
                    onOpenPersonaPicker = onOpenPersonaPicker
                )
                AppRole.ADMIN -> AdminShell(
                    sessionViewModel = sessionViewModel,
                    appViewModel = appViewModel,
                    context = context,
                    pendingDeepLink = pendingRouteDeepLink,
                    onDeepLinkHandled = onDeepLinkHandled,
                    onOpenPersonaPicker = onOpenPersonaPicker
                )
                // Master plan Phase 8 closure round 3 §6 — a real vendor:wedding grant now renders
                // the SAME VendorShell every other environment uses. A Vendor business-portfolio
                // grant never reaches this branch at all (it stays on the earlier
                // no-ActorAssignment path above), so this is exclusively the wedding-engagement axis.
                AppRole.VENDOR -> VendorShell(
                    sessionViewModel = sessionViewModel,
                    appViewModel = appViewModel,
                    context = context,
                    pendingDeepLink = pendingRouteDeepLink,
                    onDeepLinkHandled = onDeepLinkHandled,
                    onOpenPersonaPicker = onOpenPersonaPicker
                )
                else -> Unit
            }
        }
        return
    }

    // Production Phase 5 renders the existing IA shell around only the minimal, freshly
    // revalidated read-only snapshot. Legacy mutable repositories remain boundary adapters.
    if (appViewModel.dataEnvironment == NativeDataEnvironment.PRODUCTION) {
        val snapshot = productionWorkspace
        if (snapshot == null || snapshot.grantId != activeGrantId) {
            NativeEnvironmentUnavailableScreen(
                environmentName = appViewModel.dataEnvironment.displayName,
                reason = "The authorized workspace could not be refreshed. No cached production data is shown."
            )
            return
        }
        val sectionMemory = rememberWorkspaceSectionMemory()
        RoleShellScaffold(
            context = context,
            onSwitchPersona = onOpenContextSwitcher,
            pendingDeepLink = pendingRouteDeepLink,
            sectionMemory = sectionMemory,
            onDeepLinkHandled = onDeepLinkHandled
        ) { destination, _ ->
            ProductionReadOnlyWorkspaceContent(
                snapshot = snapshot,
                destination = destination,
                onSelectEngagement = { engagementId -> sessionViewModel.selectEngagement(engagementId) },
            )
        }
        return
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .semantics { testTagsAsResourceId = true }
            .testTag("shadow-source-${appViewModel.dataEnvironment.name.lowercase().replace('_', '-')}")
    ) {
        when (context.activeRole) {
            AppRole.COUPLE -> CoupleShell(
                sessionViewModel = sessionViewModel,
                appViewModel = appViewModel,
                context = context,
                pendingDeepLink = pendingRouteDeepLink,
                onDeepLinkHandled = onDeepLinkHandled,
                onOpenScanner = { isScannerOpen = true },
                onOpenPersonaPicker = onOpenPersonaPicker
            )
            AppRole.PLANNER -> PlannerShell(
                sessionViewModel = sessionViewModel,
                appViewModel = appViewModel,
                context = context,
                pendingDeepLink = pendingRouteDeepLink,
                onDeepLinkHandled = onDeepLinkHandled,
                onOpenPersonaPicker = onOpenPersonaPicker
            )
            AppRole.COORDINATOR -> CoordinatorShell(
                sessionViewModel = sessionViewModel,
                appViewModel = appViewModel,
                context = context,
                pendingDeepLink = pendingRouteDeepLink,
                onDeepLinkHandled = onDeepLinkHandled,
                onOpenPersonaPicker = onOpenPersonaPicker
            )
            AppRole.VENDOR -> VendorShell(
                sessionViewModel = sessionViewModel,
                appViewModel = appViewModel,
                context = context,
                pendingDeepLink = pendingRouteDeepLink,
                onDeepLinkHandled = onDeepLinkHandled,
                onOpenPersonaPicker = onOpenPersonaPicker
            )
            AppRole.USHER -> UsherShell(
                sessionViewModel = sessionViewModel,
                appViewModel = appViewModel,
                context = context,
                pendingDeepLink = pendingRouteDeepLink,
                onDeepLinkHandled = onDeepLinkHandled,
                onOpenPersonaPicker = onOpenPersonaPicker
            )
            AppRole.GUEST -> GuestShell(
                sessionViewModel = sessionViewModel,
                appViewModel = appViewModel,
                context = context,
                pendingDeepLink = pendingRouteDeepLink,
                onDeepLinkHandled = onDeepLinkHandled,
                onOpenPersonaPicker = onOpenPersonaPicker
            )
            AppRole.ADMIN -> AdminShell(
                sessionViewModel = sessionViewModel,
                appViewModel = appViewModel,
                context = context,
                pendingDeepLink = pendingRouteDeepLink,
                onDeepLinkHandled = onDeepLinkHandled,
                onOpenPersonaPicker = onOpenPersonaPicker
            )
        }
    }
}

/**
 * Grants of [role]'s kind that require an explicit choice and have none yet (master plan §9).
 * A single grant, or a kind the contract does not mark `selectionRequired`, needs no picker.
 */
private fun pendingGrantSelection(
    authority: ProductionAuthority?,
    currentRole: AppRole?,
    selectedGrantIds: Set<String>
): List<ProductionWorkspaceGrant> {
    if (authority == null || !ProductionGrantMapper.isUsable(authority)) return emptyList()

    // With an active role, do not interrupt it to force selection for some other axis; cross-role
    // switching/isolation is Phase 6. With NO role, however, selection must still be reachable:
    // two same-kind wedding grants cannot create an ActorAssignment until one is chosen.
    val selection = authority.contextSelection.firstOrNull { context ->
        context.selectionRequired &&
            context.grantIds.size > 1 &&
            context.grantIds.none { it in selectedGrantIds } &&
            (currentRole == null || context.workspaceKindWire == currentRole.roleId)
    } ?: return emptyList()

    val ids = selection.grantIds.toSet()
    return authority.grants.filter { it.grantId in ids }
}

/**
 * The real context selector master plan §9 requires: the account holds more than one grant of the
 * same kind (typically a Planner or Coordinator on several weddings), and none is chosen on their
 * behalf. Deliberately minimal — a plain, functional list rather than a designed surface; visual
 * polish for this screen belongs to Phase 8, same as the rest of native feature parity.
 */
@OptIn(ExperimentalComposeUiApi::class)
@Composable
private fun GrantSelectionScreen(
    grants: List<ProductionWorkspaceGrant>,
    onSelect: (String) -> Unit,
    onSignOut: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WeddingIdentityPalette.Ivory)
            .semantics { testTagsAsResourceId = true }
            .testTag("grant-selection"),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("Choose a workspace", fontSize = 22.sp, fontWeight = FontWeight.Medium)
            Text(
                "Your account has more than one authorized context. Choose which workspace to open.",
                fontSize = 13.sp,
                color = WeddingIdentityPalette.Muted
            )
            grants.forEach { grant ->
                OutlinedButton(
                    onClick = { onSelect(grant.grantId) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("grant-option-${grant.grantId}")
                ) {
                    Text(grant.weddingTitle ?: grant.businessAccountId ?: grant.grantId)
                }
            }
            TextButton(onClick = onSignOut, modifier = Modifier.testTag("grant-selection-sign-out")) {
                Text("Sign out")
            }
        }
    }
}

/**
 * Explicit production context switcher (master plan Phase 6 §1, §2, §11) — reachable AFTER a
 * workspace is already open, unlike [GrantSelectionScreen] which only forces a pre-workspace
 * choice. Lists every grant the account currently holds, of every workspace kind: a Planner's
 * wedding A/B/C, a second axis such as Admin/system, a Coordinator's assigned wedding, and so on.
 * Selecting one calls the same [pro.wewed.app.state.SessionViewModel.selectGrant] that already
 * replaces same-kind selections singularly and clears stale workspace state (§9, §14) — this
 * dialog only makes that existing, tested mechanism reachable from an open workspace, and adds no
 * new authority logic. Deliberately minimal; full visual redesign remains Phase 8.
 */
@Composable
fun ContextSwitcherDialog(
    authority: ProductionAuthority,
    activeGrantId: String?,
    onSelect: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Switch context") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                authority.grants.forEach { grant ->
                    val kindLabel = grant.workspaceKindWire.replaceFirstChar { it.uppercase() }
                    val safeBusinessName = grant.businessAccountId?.let(authority.businessNamesById::get)
                    val safeVendorName = grant.vendorId?.let(authority.vendorNamesById::get)
                    val label = when {
                        grant.scopeKind == GrantScopeKind.SYSTEM -> "$kindLabel · Wewed platform"
                        grant.weddingTitle != null -> "$kindLabel · ${grant.weddingTitle}"
                        safeVendorName != null -> "$kindLabel · $safeVendorName"
                        safeBusinessName != null -> "$kindLabel · $safeBusinessName"
                        grant.businessAccountId != null -> "$kindLabel · ${grant.businessAccountId}"
                        else -> "$kindLabel · ${grant.grantId}"
                    }
                    OutlinedButton(
                        onClick = { onSelect(grant.grantId); onDismiss() },
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("context-switch-option-${grant.grantId}"),
                        enabled = grant.grantId != activeGrantId,
                    ) {
                        Text(if (grant.grantId == activeGrantId) "$label (current)" else label)
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss, modifier = Modifier.testTag("context-switch-close")) { Text("Close") }
        },
        modifier = Modifier.testTag("context-switcher"),
    )
}
