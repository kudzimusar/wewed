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
import pro.wewed.app.navigation.NavigationContext
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.state.SessionViewModel
import pro.wewed.app.theme.WeddingIdentityPalette
import pro.wewed.app.ui.auth.LoginScreen
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

    deepLinkedInvitation?.let { invitation ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .semantics { testTagsAsResourceId = true }
        ) {
            GuestInvitationJourneyScreen(
                reference = GuestJourneyReference(
                    invitation,
                    GuestJourneyStage.SPLASH
                ),
                appViewModel = appViewModel,
                onExit = { deepLinkedInvitation = null }
            )
        }
        return
    }

    if (resolvingDeepLinkedInvitation) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(WeddingIdentityPalette.Ivory),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator(color = WeddingIdentityPalette.ChampagneDeep)
        }
        return
    }

    if (!isAuthenticated) {
        LoginScreen(sessionViewModel = sessionViewModel)
        return
    }

    if (showPersonaPicker) {
        PersonaPickerDialog(
            sessionViewModel = sessionViewModel,
            onDismiss = { showPersonaPicker = false }
        )
    }

    // IA V2 §13.1 — one context envelope, resolved once, handed to every role shell.
    val context = remember(currentRole, weddingId, weddingTitle, activePersonaId) {
        NavigationContext(
            actorId = activePersonaId,
            activeRole = currentRole,
            activeWeddingId = weddingId,
            activeWeddingTitle = weddingTitle,
            environment = appViewModel.dataEnvironment,
            // Scoped context the role owns; resolved from the active actor rather than guessed.
            activeClientId = if (currentRole == AppRole.PLANNER) weddingId else null,
            activeGateId = if (currentRole == AppRole.USHER) "Gate A — Main Entrance" else null
        )
    }

    // IA V2 §14 — a deep link resolves to a destination *request*; the shell then gates it.
    val requestedDestinationId = pendingRouteDeepLink?.let {
        DeepLinkRouter.destinationFor(it, currentRole)
    }
    val onRequestedDestinationHandled = { appViewModel.consumePendingRouteDeepLink() }

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
                requestedDestinationId = requestedDestinationId,
                onRequestedDestinationHandled = onRequestedDestinationHandled,
                onOpenScanner = { isScannerOpen = true },
                onOpenPersonaPicker = { showPersonaPicker = true }
            )
            AppRole.PLANNER -> PlannerShell(
                sessionViewModel = sessionViewModel,
                appViewModel = appViewModel,
                context = context,
                requestedDestinationId = requestedDestinationId,
                onRequestedDestinationHandled = onRequestedDestinationHandled,
                onOpenPersonaPicker = { showPersonaPicker = true }
            )
            AppRole.COORDINATOR -> CoordinatorShell(
                sessionViewModel = sessionViewModel,
                appViewModel = appViewModel,
                context = context,
                requestedDestinationId = requestedDestinationId,
                onRequestedDestinationHandled = onRequestedDestinationHandled,
                onOpenPersonaPicker = { showPersonaPicker = true }
            )
            AppRole.VENDOR -> VendorShell(
                sessionViewModel = sessionViewModel,
                appViewModel = appViewModel,
                context = context,
                requestedDestinationId = requestedDestinationId,
                onRequestedDestinationHandled = onRequestedDestinationHandled,
                onOpenPersonaPicker = { showPersonaPicker = true }
            )
            AppRole.USHER -> UsherShell(
                sessionViewModel = sessionViewModel,
                appViewModel = appViewModel,
                context = context,
                requestedDestinationId = requestedDestinationId,
                onRequestedDestinationHandled = onRequestedDestinationHandled,
                onOpenPersonaPicker = { showPersonaPicker = true }
            )
            AppRole.GUEST -> GuestShell(
                sessionViewModel = sessionViewModel,
                appViewModel = appViewModel,
                context = context,
                requestedDestinationId = requestedDestinationId,
                onRequestedDestinationHandled = onRequestedDestinationHandled,
                onOpenPersonaPicker = { showPersonaPicker = true }
            )
            AppRole.ADMIN -> AdminShell(
                sessionViewModel = sessionViewModel,
                appViewModel = appViewModel,
                context = context,
                requestedDestinationId = requestedDestinationId,
                onRequestedDestinationHandled = onRequestedDestinationHandled,
                onOpenPersonaPicker = { showPersonaPicker = true }
            )
        }
    }
}
