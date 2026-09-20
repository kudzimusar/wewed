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
import pro.wewed.app.navigation.GuestCeremonialEntry
import pro.wewed.app.navigation.LaunchRouter
import pro.wewed.app.navigation.NativeAppEntryState
import pro.wewed.app.ui.auth.LoginScreen
import pro.wewed.app.ui.entry.ShadowEntryOption
import pro.wewed.app.ui.entry.SplashDestination
import pro.wewed.app.ui.entry.WewedAnimatedSplash
import pro.wewed.app.ui.entry.WewedWelcomeScreen
import pro.wewed.app.models.RSVPStatus
import pro.wewed.app.ui.invitation.GuestCeremonialCardScreen
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

    // The Guest Ceremonial Entry Contract. `remember` without keys is exactly the right scope:
    // it survives recomposition and a return from the background, but not a cold launch, a
    // relaunch after termination or a restore after process death — precisely the entry-session
    // boundary the contract describes.
    var entrySessionPresentedCard by remember { mutableStateOf(false) }

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
        // The splash leaves differently depending on what it hands over to. An invitation is
        // REVEALED — the stage lifts away leaving the ivory and ornament for the card to arrive
        // into — where a workspace is entered and the stage simply recedes. A splash that always
        // exits the same way reads as a loader.
        val splashDestination = when {
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

    // -----------------------------------------------------------------------------------------
    // Guest Ceremonial Entry.
    //
    // The Couple recognised this person; the card is that recognition, and it opens every visit —
    // before the Guest workspace, before the wedding site, before the pass. What changes with
    // RSVP state is what the card ASKS, never whether it appears. A guest who has already replied
    // is not asked again.
    // -----------------------------------------------------------------------------------------
    var recognisedGuestInvitation by remember(context.activePassToken) {
        mutableStateOf<InvitationContext?>(null)
    }
    val guestPassToken = context.activePassToken
    var graphWeddingDate by remember(context.activeWeddingId) { mutableStateOf<String?>(null) }
    LaunchedEffect(context.activeWeddingId) {
        graphWeddingDate = runCatching {
            appViewModel.repository.getWedding(context.activeWeddingId).date
        }.getOrNull()
    }

    LaunchedEffect(guestPassToken, context.activeRole) {
        recognisedGuestInvitation =
            if (context.activeRole == AppRole.GUEST && guestPassToken != null) {
                runCatching {
                    appViewModel.repository.resolveInvitation(
                        appViewModel.repository.weddingSlug(context.activeWeddingId).orEmpty(),
                        guestPassToken
                    )
                }.getOrNull()
            } else {
                null
            }
    }

    recognisedGuestInvitation
        ?.takeIf {
            GuestCeremonialEntry.shouldPresentCard(
                isRecognisedGuest = true,
                entrySessionPresentedCard = entrySessionPresentedCard
            )
        }
        ?.let { card ->
            val stage = LaunchRouter.stageFor(card)
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .semantics { testTagsAsResourceId = true }
            ) {
                if (stage == InvitationEntryStage.PENDING) {
                    // Still to answer: the full Ivory invitation, which carries the RSVP.
                    GuestInvitationJourneyScreen(
                        reference = GuestJourneyReference(card, GuestJourneyStage.INVITATION),
                        appViewModel = appViewModel,
                        onExit = { entrySessionPresentedCard = true }
                    )
                } else {
                    // Already answered. The card stays — a guest who has replied is never asked
                    // again — and its actions adapt to the answer and to where the wedding is in
                    // its own life. Sending them straight to the Pass would treat the invitation
                    // as a form they had finished with.
                    val rsvp = if (stage == InvitationEntryStage.CONFIRMED) {
                        RSVPStatus.ATTENDING
                    } else {
                        RSVPStatus.DECLINED
                    }
                    val daysRemaining = remember(graphWeddingDate) {
                        daysUntil(graphWeddingDate)
                    }
                    val presentation = GuestCeremonialEntry.presentation(
                        rsvp,
                        GuestCeremonialEntry.phaseFor(daysRemaining)
                    )
                    GuestCeremonialCardScreen(
                        invitation = card,
                        presentation = presentation,
                        countdownLabel = GuestCeremonialEntry.countdownLabel(daysRemaining),
                        onAction = { entrySessionPresentedCard = true },
                        // Continuing ends the ceremony for THIS entry session; the next cold
                        // launch stages it again.
                        onContinue = { entrySessionPresentedCard = true }
                    )
                }
            }
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


/**
 * Days between now and the wedding.
 *
 * The card's lifecycle phase and its reminder line are both derived from this, so neither has to
 * be maintained by hand as the date approaches and passes.
 */
private fun daysUntil(rawDate: String?): Int {
    val trimmed = rawDate?.trim().orEmpty().take(10)
    if (trimmed.isEmpty()) return Int.MAX_VALUE
    val target = runCatching {
        java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).parse(trimmed)
    }.getOrNull() ?: return Int.MAX_VALUE
    val millisPerDay = 86_400_000L
    val today = System.currentTimeMillis() / millisPerDay
    return (target.time / millisPerDay - today).toInt()
}
