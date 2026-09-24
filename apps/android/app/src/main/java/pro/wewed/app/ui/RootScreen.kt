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
import pro.wewed.app.navigation.resolveActorAssignmentSource
import pro.wewed.app.navigation.NavigationContext
import pro.wewed.app.navigation.RoleShellAuthorization
import pro.wewed.app.navigation.ProductionAuthority
import pro.wewed.app.navigation.ProductionGrantMapper
import pro.wewed.app.navigation.ProductionWorkspaceGrant
import pro.wewed.app.navigation.ProductionOperationalGrant
import pro.wewed.app.navigation.GateOperationalContext
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
    val selectedGateGrantId by sessionViewModel.selectedGateGrantId.collectAsState()
    val activeGateContext by sessionViewModel.activeGateContext.collectAsState()
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
    var showingInvitationHelp by remember { mutableStateOf(false) }

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

    if (entryState is NativeAppEntryState.Welcome && showingInvitationHelp) {
        InvitationLinkEntryScreen(onBack = { showingInvitationHelp = false })
        return
    }

    if (entryState is NativeAppEntryState.Welcome && authMode == null) {
        WewedWelcomeScreen(
            onOpenInvitation = { showingInvitationHelp = true },
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
    //
    // Master plan Phase 8 closure round 5 — delegates to the extracted, directly unit-tested
    // `resolveActorAssignmentSource` (ActorAssignment.kt) rather than evaluating
    // `appViewModel.repository`/`plannerRepository` unconditionally as call arguments to a single
    // `forEnvironment(...)` function. Reading `appViewModel.repository` here for PRODUCTION used to
    // throw `ProductionRepositoryUnbound` (Kotlin evaluates call arguments eagerly, before the
    // callee runs) during this very composition — i.e. before the `LaunchedEffect` below has had
    // any chance to bind a real repository, and before the render gate further down gets a chance
    // to show its loading state. `resolveActorAssignmentSource` only reads a repository inside the
    // Shadow/dev-persona branch, so a PRODUCTION `appViewModel` (bound or not) never reaches it.
    val assignmentSource = remember(
        appViewModel,
        productionAuthority,
        selectedGrantIds,
        selectedEngagementId,
        selectedGateGrantId
    ) {
        resolveActorAssignmentSource(
            appViewModel,
            productionAuthority,
            selectedGrantIds,
            selectedEngagementId,
            selectedGateGrantId
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


    // Operational Gate grants use their own selector. A pure Usher with two gates must choose one;
    // no planning workspace is invented to make that choice reachable.
    val pendingGateChoice = remember(productionAuthority, currentRole, selectedGateGrantId) {
        pendingGateSelection(productionAuthority, currentRole, selectedGateGrantId)
    }
    if (pendingGateChoice.isNotEmpty()) {
        GateGrantSelectionScreen(
            grants = pendingGateChoice,
            onSelect = { grantId -> sessionViewModel.selectGateGrant(grantId) },
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
        ((productionAuthority?.grants?.size ?: 0) + (productionAuthority?.operationalGrants?.size ?: 0)) > 1
    productionAuthority?.let { authority ->
        if (showContextSwitcher) {
            ContextSwitcherDialog(
                authority = authority,
                activeGrantId = activeGrantId,
                activeGateGrantId = selectedGateGrantId.takeIf { currentRole == AppRole.USHER },
                onSelect = { grantId -> sessionViewModel.selectGrant(grantId) },
                onSelectGate = { grantId -> sessionViewModel.selectGateGrant(grantId) },
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
        selectedGateGrantId,
        activeGateContext,
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
        // Production actor identity comes from the verified authority document. A Shadow
        // persona id is never substituted for a live account and a live account never depends on
        // a development persona existing.
        val actorId = productionAuthority?.accessUserId ?: activePersonaId.orEmpty()
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
            gateContext = activeGateContext,
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
    // Phase 10: Gate authority has no production Wedding Day write runtime yet. Render the
    // server-derived assignment itself and keep admission activation explicitly deferred to Phase 11.
    if (appViewModel.dataEnvironment == NativeDataEnvironment.PRODUCTION &&
        context.activeRole == AppRole.USHER
    ) {
        val gate = activeGateContext
        if (gate == null ||
            gate.operatorUserId != context.actorId ||
            gate.weddingId != context.activeWeddingId ||
            gate.gateId != context.activeGateId
        ) {
            NativeEnvironmentUnavailableScreen(
                environmentName = appViewModel.dataEnvironment.displayName,
                reason = "This Gate assignment is no longer authorized."
            )
            return
        }
        ProductionGateAuthorityContent(
            gateContext = gate,
            onSwitchContext = onOpenContextSwitcher,
            onSignOut = { sessionViewModel.signOut() }
        )
        return
    }

    val productionRoleWired = appViewModel.dataEnvironment == NativeDataEnvironment.PRODUCTION &&
        context.activeRole in setOf(AppRole.COUPLE, AppRole.PLANNER, AppRole.COORDINATOR, AppRole.ADMIN, AppRole.VENDOR)

    // Master plan Phase 8 closure round 3 §6, hardened round 4 §2 — reactively binds the real
    // Vendor-wedding-engagement adapter as soon as a vendor:wedding snapshot is available.
    // Deliberately keyed on `snapshot.workspaceKind == "vendor" && scopeKind == "wedding"`, which is
    // a DIFFERENT authority axis from the Vendor business-portfolio grant (scopeKind "business",
    // handled entirely by the earlier no-ActorAssignment branch above and never reaching this point
    // at all). `selectedEngagementId` is part of the effect's OWN key (not just an argument passed
    // into the constructed repository): a Vendor's grant may carry several `serviceEngagementIds`,
    // so switching the selected engagement — same grantId, same account — must re-run this effect
    // and produce a NEW binding, not silently keep serving the previous engagement's repository.
    if (appViewModel.dataEnvironment == NativeDataEnvironment.PRODUCTION && context.activeRole == AppRole.VENDOR) {
        val vendorSnapshot = productionWorkspace?.takeIf { it.workspaceKind == "vendor" && it.scopeKind == "wedding" }
        val vendorSnapshotGrantId = vendorSnapshot?.grantId
        val vendorAccessUserId = productionAuthority?.accessUserId
        LaunchedEffect(vendorSnapshotGrantId, vendorAccessUserId, selectedEngagementId, sessionViewModel) {
            if (vendorSnapshotGrantId == null || vendorAccessUserId == null) return@LaunchedEffect
            // A grant with more than one engagement must not bind until the person has actually
            // chosen one (the picker below, reusing the existing Phase 6 selection mechanism) — an
            // unselected multi-engagement grant binds nothing rather than guessing engagementId[0].
            if (vendorSnapshot?.engagementSelectionRequired == true && selectedEngagementId == null) return@LaunchedEffect
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
                engagementId = selectedEngagementId,
                engagement = ProductionVendorEngagementRepository(client, token, vendorSnapshotGrantId, selectedEngagementId),
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

        // Master plan Phase 8 closure round 4 §2 — a Vendor grant with more than one
        // serviceEngagementId must not fall through to VendorShell until the person has explicitly
        // picked one; this reuses the EXACT same picker/mechanism Phase 6's minimal snapshot path
        // already established (`sessionViewModel.selectEngagement`), now reachable from the real
        // wired shell instead of only from the pre-Phase-8 fallback.
        if (context.activeRole == AppRole.VENDOR && snapshot.engagementSelectionRequired) {
            ProductionReadOnlyWorkspaceContent(
                snapshot = snapshot,
                onSelectEngagement = { engagementId -> sessionViewModel.selectEngagement(engagementId) },
            )
            return
        }

        // Master plan Phase 8 closure §1/round 3 §4/§5, hardened round 4 §1/§2 (NativeRepositoryFactory
        // .PRODUCTION closure) — the snapshot looking right is necessary but not sufficient: it says
        // the *context* is authorized, not that appViewModel.repository/plannerRepository/
        // adminRepository/vendorEngagementRepository have actually been bound to the real, grant-
        // scoped (and for Vendor, engagement-scoped) adapter yet (that bind runs from a
        // LaunchedEffect above, which starts asynchronously relative to this composition). Waiting
        // for the confirmed [ProductionBinding.Bound] — keyed on accessUserId + grantId (+
        // engagementId for Vendor) — is what makes this deterministic even across an account
        // replacement that happens to resolve the same grantId string a previous account already
        // bound, or a same-grant engagement switch: no role shell that "appears functional" is ever
        // composed while [ProductionBinding.Unbound], over a different account's binding, or over a
        // different engagement's binding.
        val currentAccessUserId = productionAuthority?.accessUserId
        val boundKey by when (context.activeRole) {
            AppRole.ADMIN -> appViewModel.productionAdminBinding
            AppRole.VENDOR -> appViewModel.productionVendorEngagementBinding
            else -> appViewModel.productionWeddingBinding
        }.collectAsState()
        val isBoundToCurrentAccountAndGrant = (boundKey as? ProductionBinding.Bound<*>)?.let {
            it.accessUserId == currentAccessUserId &&
                it.grantId == activeGrantId &&
                (context.activeRole != AppRole.VENDOR || it.engagementId == selectedEngagementId)
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
private fun pendingGateSelection(
    authority: ProductionAuthority?,
    currentRole: AppRole?,
    selectedGateGrantId: String?
): List<ProductionOperationalGrant> {
    if (authority == null || !ProductionGrantMapper.isUsable(authority)) return emptyList()
    val selection = authority.gateContextSelection ?: return emptyList()
    val selectedStillLive = selectedGateGrantId != null && selectedGateGrantId in selection.grantIds
    if (selectedStillLive) return emptyList()
    val staleSelectionNeedsReplacement = selectedGateGrantId != null && !selectedStillLive
    if (!selection.selectionRequired && !staleSelectionNeedsReplacement) return emptyList()
    // Do not interrupt an already-open ordinary workspace just because the same person also has
    // operational authority. Pure Usher / explicitly-entered Usher is where the Gate picker belongs.
    if (currentRole != null && currentRole != AppRole.USHER) return emptyList()
    val ids = selection.grantIds.toSet()
    return authority.operationalGrants.filter { it.grantId in ids }
}

@OptIn(ExperimentalComposeUiApi::class)
@Composable
private fun GateGrantSelectionScreen(
    grants: List<ProductionOperationalGrant>,
    onSelect: (String) -> Unit,
    onSignOut: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WeddingIdentityPalette.Ivory)
            .semantics { testTagsAsResourceId = true }
            .testTag("gate-grant-selection")
    ) {
        Column(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("Choose your gate", fontSize = 22.sp, fontWeight = FontWeight.Medium)
            Text(
                "You have more than one active Gate assignment. Wewed will not choose one for you.",
                fontSize = 13.sp,
                color = WeddingIdentityPalette.Muted
            )
            grants.forEach { grant ->
                OutlinedButton(
                    onClick = { onSelect(grant.grantId) },
                    modifier = Modifier.fillMaxWidth().testTag("gate-grant-option-${grant.grantId}")
                ) {
                    Text("${grant.gateName} · ${grant.weddingTitle}")
                }
            }
            TextButton(onClick = onSignOut) { Text("Sign out") }
        }
    }
}

@Composable
private fun ProductionGateAuthorityContent(
    gateContext: GateOperationalContext,
    onSwitchContext: (() -> Unit)?,
    onSignOut: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(WeddingIdentityPalette.Ivory)
            .padding(24.dp)
            .testTag("production-gate-authority"),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Text("Gate Operations", fontSize = 24.sp, fontWeight = FontWeight.Medium)
        Text(gateContext.weddingTitle, color = WeddingIdentityPalette.Muted)
        Text(gateContext.gateName, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
        Text(
            "Assignment: ${gateContext.assignmentId}",
            fontSize = 12.sp,
            color = WeddingIdentityPalette.Muted
        )
        Text(
            "Capabilities: ${gateContext.capabilities.sorted().joinToString(", ")}",
            fontSize = 12.sp,
            color = WeddingIdentityPalette.Muted
        )
        HorizontalDivider()
        Text(
            "Gate admission and offline Wedding Pass activation remain disabled until Phase 11. " +
                "This screen proves the real server assignment without fabricating a scanner credential.",
            fontSize = 13.sp,
            color = WeddingIdentityPalette.Muted
        )
        if (onSwitchContext != null) {
            OutlinedButton(
                onClick = onSwitchContext,
                modifier = Modifier.testTag("gate-switch-context")
            ) {
                Text("Switch context")
            }
        }
        TextButton(onClick = onSignOut) { Text("Sign out") }
    }
}

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
    activeGateGrantId: String?,
    onSelect: (String) -> Unit,
    onSelectGate: (String) -> Unit,
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
                authority.operationalGrants.forEach { grant ->
                    val label = "Usher · ${grant.gateName} · ${grant.weddingTitle}"
                    OutlinedButton(
                        onClick = { onSelectGate(grant.grantId); onDismiss() },
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("context-switch-option-${grant.grantId}"),
                        enabled = grant.grantId != activeGateGrantId,
                    ) {
                        Text(if (grant.grantId == activeGateGrantId) "$label (current)" else label)
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


@Composable
private fun InvitationLinkEntryScreen(onBack: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WeddingIdentityPalette.Ivory)
            .semantics { testTagsAsResourceId = true }
            .testTag("invitation-link-help"),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            Text(
                text = "Open your invitation",
                fontSize = 30.sp,
                fontWeight = FontWeight.Medium,
                color = WeddingIdentityPalette.Ink
            )
            Text(
                text = "Use the private Wewed invitation link you received in WhatsApp, Messages, email or your browser. Wewed will open your invitation directly — no account is required.",
                fontSize = 15.sp,
                color = WeddingIdentityPalette.Muted
            )
            Text(
                text = "If the link is on this phone, return to it and tap it now.",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = WeddingIdentityPalette.Ink
            )
            OutlinedButton(
                onClick = onBack,
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 50.dp)
                    .testTag("invitation-link-help-back")
            ) {
                Text("Back")
            }
        }
    }
}
