package pro.wewed.app.invitation

import android.content.Context
import android.os.Handler
import android.os.Looper
import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerStateListener
import java.util.concurrent.atomic.AtomicBoolean

/**
 * QRO07-AT01 — deferred install continuity.
 *
 * A guest without Wewed who taps "Get Wewed" on their private invitation reaches Google Play with
 * `referrer=handoff=<opaque one-time secret>` (never the RSVP token). On the app's first launch this
 * reads that referrer ONCE and hands the opaque secret to the same [InvitationEntry.Handoff]
 * redemption an App Link uses, so the guest lands on the exact invitation that caused the install.
 *
 * Rules:
 * - read at most once per installation (a later icon launch must never replay a stale referrer);
 * - a fresh tapped link outranks the referrer ([markConsumed] on explicit launches);
 * - only the opaque handoff is accepted — [InvitationEntryParser.fromInstallReferrer] refuses a
 *   referrer carrying `rsvp`, and the server enforces one-time use, expiry and wedding/guest binding;
 * - any failure (no Play, no referrer, timeout, tampering) falls through to the normal launch.
 */
object PlayInstallReferrer {

    private const val PREFS = "wewed_install_referrer"
    private const val KEY_CONSUMED = "consumed_v1"
    private const val DEFAULT_TIMEOUT_MS = 4_000L

    fun isPending(context: Context): Boolean =
        !context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_CONSUMED, false)

    fun markConsumed(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_CONSUMED, true)
            .apply()
    }

    /**
     * Resolves the install referrer into an invitation entry, calling [onResult] exactly once on
     * the main thread. Only an [InvitationEntry.Handoff] is ever returned as actionable; a refused
     * referrer yields null so a tampered Play referrer cannot surface an error screen or identity.
     */
    fun fetchOnce(
        context: Context,
        timeoutMs: Long = DEFAULT_TIMEOUT_MS,
        onResult: (InvitationEntry.Handoff?) -> Unit,
    ) {
        val appContext = context.applicationContext
        val main = Handler(Looper.getMainLooper())
        val done = AtomicBoolean(false)
        val client = runCatching { InstallReferrerClient.newBuilder(appContext).build() }.getOrNull()

        fun finish(entry: InvitationEntry.Handoff?, consumed: Boolean) {
            if (!done.compareAndSet(false, true)) return
            if (consumed) markConsumed(appContext)
            runCatching { client?.endConnection() }
            main.post { onResult(entry) }
        }

        if (client == null) {
            finish(null, consumed = true)
            return
        }
        // A slow or absent Play service must never hold the app on a loading screen. On timeout the
        // referrer stays pending so the next launch can try again.
        main.postDelayed({ finish(null, consumed = false) }, timeoutMs)

        runCatching {
            client.startConnection(object : InstallReferrerStateListener {
                override fun onInstallReferrerSetupFinished(responseCode: Int) {
                    when (responseCode) {
                        InstallReferrerClient.InstallReferrerResponse.OK -> {
                            val raw = runCatching { client.installReferrer.installReferrer }.getOrNull()
                            finish(resolve(raw), consumed = true)
                        }
                        InstallReferrerClient.InstallReferrerResponse.SERVICE_UNAVAILABLE ->
                            finish(null, consumed = false)
                        else -> finish(null, consumed = true)
                    }
                }

                override fun onInstallReferrerServiceDisconnected() {
                    finish(null, consumed = false)
                }
            })
        }.onFailure { finish(null, consumed = false) }
    }

    /** Pure: the referrer string Play returned → an actionable handoff, or nothing. */
    fun resolve(rawReferrer: String?): InvitationEntry.Handoff? =
        InvitationEntryParser.fromInstallReferrer(rawReferrer) as? InvitationEntry.Handoff
}
