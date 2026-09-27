package pro.wewed.app.ui.invitation

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import pro.wewed.app.invitation.GuestBrowserDestination
import pro.wewed.app.invitation.LiveGuestInvitationCoordinator

/**
 * QRO06 — opens the Couple Website / Registry in the system browser through the server-authorized
 * Guest handoff, so a `link_only` wedding still recognises this Guest there. A failed handoff is
 * said plainly; the app never falls back to a plain URL the browser would refuse.
 */
@Composable
internal fun rememberGuestBrowserOpener(
    coordinator: LiveGuestInvitationCoordinator,
    weddingSlug: String,
): (GuestBrowserDestination) -> Unit {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    return remember(coordinator, weddingSlug, context, scope) {
        { destination ->
            scope.launch {
                try {
                    val url = coordinator.browserHandoff(weddingSlug, destination)
                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (_: Exception) {
                    Toast.makeText(context, "Couldn't open this page. Check your connection and try again.", Toast.LENGTH_LONG).show()
                }
            }
        }
    }
}
