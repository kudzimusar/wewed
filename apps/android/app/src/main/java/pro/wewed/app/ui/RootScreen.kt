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
import pro.wewed.app.models.AppRole
import pro.wewed.app.models.GuestJourneyReference
import pro.wewed.app.models.GuestJourneyStage
import pro.wewed.app.models.InvitationContext
import pro.wewed.app.navigation.DeepLinkRouter
import pro.wewed.app.navigation.IANavigationContract
import pro.wewed.app.navigation.ActorAssignmentSources
import pro.wewed.app.navigation.NavigationContext
import pro.wewed.app.navigation.RoleShellAuthorization
import pro.wewed.app.state.AppViewModel
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
    val pendingInvitationDeepLink by appViewModel.pendingInvitationDeepLink.collectAsState()
    val rejectedInvitation by appViewModel.rejectedInvitation.collectAsState()
    val pendingInvitationEntry by appViewModel.pendingInvitationEntry.collectAsState()
    val pendingRouteDeepLink by appViewModel.pendingRouteDeepLink.collectAsState()

    var isScannerOpen by remember { mutableStateOf(false) }
    var showPersonaPicker by remember { mutableStateOf(false) }
    var deepLinkedInvitation by remember { mutableStateOf<InvitationContext?>(null) }
    var resolvingDeepLinkedInvitation by remember { mutableStateOf(false) }

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
    // Shadow authority only where Shadow personas exist; production/verify resolve nothing until
    // the production grant source exists (master plan §8.9, Phase 5).
    val assignmentSource = remember(appViewModel) {
        ActorAssignmentSources.forEnvironment(
            appViewModel.dataEnvironment,
            appViewModel.repository,
            appViewModel.plannerRepository
        )
    }
    var resolvedContext by remember { mutableStateOf<NavigationContext?>(null) }
    var resolvingContext by remember { mutableStateOf(true) }

    LaunchedEffect(currentRole, activePersonaId, weddingId, weddingTitle) {
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


