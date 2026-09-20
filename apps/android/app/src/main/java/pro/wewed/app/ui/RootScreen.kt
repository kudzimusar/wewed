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
import pro.wewed.app.navigation.ShadowActorAssignmentSource
import pro.wewed.app.navigation.NavigationContext
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.state.SessionViewModel
import pro.wewed.app.theme.WeddingIdentityPalette
import pro.wewed.app.navigation.AuthenticationMode
import pro.wewed.app.navigation.InvitationEntryStage
import pro.wewed.app.navigation.LaunchRouter
import pro.wewed.app.navigation.NativeAppEntryState
import pro.wewed.app.ui.auth.LoginScreen
import pro.wewed.app.ui.entry.ShadowEntryOption
import pro.wewed.app.ui.entry.WewedAnimatedSplash
import pro.wewed.app.ui.entry.WewedWelcomeScreen
import pro.wewed.app.ui.invitation.GuestInvitationJourneyScreen
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
    val currentUserName by sessionViewModel.currentUserName.collectAsState()
    val activePersonaId by sessionViewModel.activePersonaId.collectAsState()
    val weddingId by sessionViewModel.weddingId.collectAsState()
    val weddingTitle by sessionViewModel.weddingTitle.collectAsState()
    val pendingInvitationDeepLink by appViewModel.pendingInvitationDeepLink.collectAsState()
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

    LaunchedEffect(pendingInvitationDeepLink) {
        val pending = pendingInvitationDeepLink ?: return@LaunchedEffect
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
        WewedAnimatedSplash(onFinished = { splashComplete = true })
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
        authorizedRoles = if (isAuthenticated) listOf(currentRole) else emptyList(),
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
            GuestInvitationJourneyScreen(
                reference = GuestJourneyReference(
                    invitationState.invitation,
                    when (invitationState.stage) {
                        InvitationEntryStage.CONFIRMED -> GuestJourneyStage.CONFIRMED_ATTENDING
                        InvitationEntryStage.DECLINED -> GuestJourneyStage.DECLINED
                        InvitationEntryStage.PENDING -> GuestJourneyStage.INVITATION
                    }
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
    val assignmentSource = remember(appViewModel) { ShadowActorAssignmentSource(
            appViewModel.repository,
            appViewModel.dataEnvironment,
            appViewModel.plannerRepository
        ) }
    var resolvedContext by remember { mutableStateOf<NavigationContext?>(null) }
    var resolvingContext by remember { mutableStateOf(true) }

    LaunchedEffect(currentRole, activePersonaId, weddingId, weddingTitle) {
        resolvingContext = true
        val assignment = runCatching { assignmentSource.assignments(activePersonaId) }
            .getOrDefault(emptyList())
            .firstOrNull { it.role == currentRole }

        val systemScoped = IANavigationContract.forRole(currentRole).isSystemScoped
        resolvedContext = NavigationContext(
            actorId = activePersonaId,
            activeRole = currentRole,
            // A system-scoped role opens without a wedding; everyone else uses the assigned one.
            activeWeddingId = when {
                systemScoped -> assignment?.weddingId.orEmpty()
                else -> assignment?.weddingId ?: weddingId
            },
            activeWeddingTitle = if (systemScoped && assignment?.weddingId == null) "" else weddingTitle,
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

    val context = resolvedContext ?: return

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

    Box(
        modifier = Modifier
            .fillMaxSize()
            .semantics { testTagsAsResourceId = true }
            .testTag("shadow-source-${appViewModel.dataEnvironment.name.lowercase().replace('_', '-')}")
    ) {
        when (currentRole) {
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
