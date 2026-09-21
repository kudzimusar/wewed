package pro.wewed.app.ui.invitation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import pro.wewed.app.invitation.*
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
    entry: InvitationEntry,
    coordinator: LiveGuestInvitationCoordinator
) {
    var state by remember { mutableStateOf<LiveInvitationState>(LiveInvitationState.Exchanging) }

    LaunchedEffect(entry) {
        state = coordinator.enter(entry)
    }

    when (val current = state) {
        is LiveInvitationState.Presenting -> LiveGuestInvitationScreen(
            presentation = LiveInvitationPresentation.from(current.snapshot),
            coordinator = coordinator,
            onRefreshed = { state = it },
            // There is no workspace to continue into here, so the card stays. Dropping the guest
            // onto an empty shell would be worse than leaving their invitation open.
            onContinue = {}
        )

        is LiveInvitationState.Refused -> InvitationRefusedScreen(
            reason = current.reason ?: InvitationEntry.Reason.MALFORMED_HANDOFF,
            onDismiss = {}
        )

        is LiveInvitationState.Unavailable -> InvitationUnavailableScreen(
            onRetry = { state = LiveInvitationState.Exchanging }
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
