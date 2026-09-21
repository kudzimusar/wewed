package pro.wewed.app.invitation

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * The invitation a guest-only launch is currently acting on.
 *
 * It exists because the guest-only shell has no `AppViewModel` — in production the general
 * repository is deliberately never built — and `onNewIntent` only forwarded links to that view
 * model. So Guest B arriving while Guest A's shell was on screen was silently dropped: the intent
 * was received, and nothing anywhere was listening.
 *
 * Owned above Compose so that both `onCreate` and `onNewIntent` can publish into it and the shell
 * observes replacement rather than being recreated.
 */
object GuestOnlyEntryState {

    private val _entry = MutableStateFlow<InvitationEntry?>(null)

    /** The latest invitation entry. A new one replaces the previous, which is the point. */
    val entry: StateFlow<InvitationEntry?> = _entry.asStateFlow()

    /**
     * Publishes a launch.
     *
     * Returns whether anything invitation-shaped was found, so the caller can decide between the
     * guest-only shell and the ordinary unavailable screen.
     */
    fun publish(rawUrl: String?, intentExtra: String? = null): Boolean {
        val parsed = InvitationEntryParser.fromUrl(rawUrl)
            ?: InvitationEntryParser.fromIntentExtra(intentExtra)
            ?: return false
        _entry.value = parsed
        return true
    }

    /** Clears the pending entry. Used when forgetting a wedding, and by tests. */
    fun reset() {
        _entry.value = null
    }
}
