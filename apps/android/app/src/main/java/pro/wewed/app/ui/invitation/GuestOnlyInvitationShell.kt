package pro.wewed.app.ui.invitation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.*
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import pro.wewed.app.invitation.*
import pro.wewed.app.ui.entry.SplashDestination
import pro.wewed.app.ui.entry.WewedAnimatedSplash
import pro.wewed.app.theme.WeddingIdentityPalette

/**
 * The whole app, for an invited guest, when nothing else is available.
 *
 * A production launch cannot build the general repository yet — that is a deliberate boundary, not
 * an oversight. But an invited guest tapping their own link needs the guest-session authority and
 * nothing else, so their invitation must not die behind a workspace they were never going to use.
 *
 * This shell is the narrow exception: guest-only, live, and incapable of reaching a planner,
 * couple, vendor or admin surface because it has no repository to reach one with.
 */
@Composable
fun GuestOnlyInvitationShell(
    coordinator: LiveGuestInvitationCoordinator,
    /** True when this launch carried a link. False means restore a remembered Guest instead. */
    hasIncomingInvitation: Boolean = true,
    onForgetWedding: () -> Unit = {}
) {
    // Observed rather than passed in, so a warm Guest B link replaces Guest A's card while this
    // same shell is on screen. Passing the entry as a parameter meant the shell only ever saw the
    // launch it was created with.
    val entry by GuestOnlyEntryState.entry.collectAsState()
    var state by remember { mutableStateOf<LiveInvitationState>(LiveInvitationState.Exchanging) }
    /** Bumped by a retry so the exchange is genuinely re-run rather than the UI merely reset. */
    var retryToken by remember { mutableStateOf(0) }

    // Keyed on the entry: a replacement runs the exchange exactly once more, and the same entry
    // recomposing does not replay it.
    LaunchedEffect(entry, retryToken) {
        val current = entry
        state = LiveInvitationState.Exchanging
        state = if (current != null) {
            coordinator.enter(current)
        } else {
            // An ordinary launch: the app icon, not a link. A Guest who opened their invitation
            // last month should find their wedding, not be asked to go back to WhatsApp.
            coordinator.restoreRememberedGuest()
        }
    }

    // The branded opening belongs to the real guest path too. The exchange runs underneath it, so
    // the splash costs nothing, and after it the first wedding UI is the configured invitation —
    // never Home, a login or a workspace.
    //
    // A replacement link restages it: Guest B arriving is a new arrival, and dropping them
    // straight into a card that just said someone else's name reads as a glitch.
    var splashComplete by remember(entry) { mutableStateOf(false) }
    if (!splashComplete && hasIncomingInvitation) {
        WewedAnimatedSplash(
            destination = SplashDestination.INVITATION,
            onFinished = { splashComplete = true }
        )
        return
    }

    // Which of the Guest's two surfaces is showing: their invitation, or their wedding.
    //
    // An explicit link opens on the invitation, because that is the ceremony. An ordinary relaunch
    // opens on Home, because replaying the whole card every time someone checks their table would
    // be tiresome rather than ceremonial. The invitation is always one tap away either way.
    var showingInvitation by remember(entry) { mutableStateOf(hasIncomingInvitation) }

    when (val current = state) {
        is LiveInvitationState.Presenting -> {
            val profile = LiveInvitationPresentation.from(current.snapshot)
            if (showingInvitation) {
                LiveGuestInvitationScreen(
                    presentation = profile,
                    coordinator = coordinator,
                    onRefreshed = { state = it },
                    // The dead end this replaces: Continue used to do nothing, which is why a
                    // guest could open their invitation and then have nowhere to go.
                    onContinue = { showingInvitation = false }
                )
            } else {
                LiveGuestShell(
                    profile = profile,
                    onOpenInvitation = { showingInvitation = true },
                    onForgetWedding = onForgetWedding
                )
            }
        }

        is LiveInvitationState.Refused -> InvitationRefusedScreen(
            reason = current.reason ?: InvitationEntry.Reason.MALFORMED_HANDOFF,
            onDismiss = {}
        )

        // A retry has to actually retry. Setting the state back to Exchanging without rerunning
        // the exchange left an indefinite spinner, which is a worse outcome than the error.
        is LiveInvitationState.Unavailable -> InvitationUnavailableScreen(
            onRetry = { retryToken++ }
        )

        LiveInvitationState.Exchanging, LiveInvitationState.Idle -> Box(
            modifier = Modifier
                .fillMaxSize()
                .background(WeddingIdentityPalette.Ivory)
                .testTag("invitation-exchanging"),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator(color = WeddingIdentityPalette.ChampagneDeep)
        }
    }
}
