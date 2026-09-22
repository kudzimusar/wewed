package pro.wewed.app.invitation

import android.content.Context
import pro.wewed.app.services.AndroidKeystoreSecureStorage
import pro.wewed.app.services.SecureStorage

/**
 * The guest invitation's own dependency boundary.
 *
 * Deliberately built *outside* `NativeRepositoryFactory`. An invited guest opening their card
 * needs one thing — the guest-session authority — and nothing about tasks, budgets, vendors or
 * admin. Routing this through the general repository factory would mean a guest could not open an
 * invitation until the entire production workspace was enabled, which is far more production
 * surface than the invitation slice is authorized to turn on.
 *
 * So the two are independent:
 *
 * ```
 * production + incoming/remembered Guest → this bootstrap, Guest authority wins
 * production + ordinary account launch    → Phase-5 read-only account workspace bootstrap
 * ```
 *
 * One instance per process. The session must survive recomposition, and a second client would mean
 * a second copy of the credential.
 */
object GuestInvitationBootstrap {

    /** The production origin. The guest journey has exactly one home. */
    const val PRODUCTION_BASE_URL = "https://wewed.pro"

    @Volatile
    private var coordinator: LiveGuestInvitationCoordinator? = null

    @Volatile
    private var storage: SecureStorage? = null

    /** The origin the live coordinator was built against, for diagnostics and tests. */
    @Volatile
    var activeBaseUrl: String = PRODUCTION_BASE_URL
        private set

    /**
     * The live coordinator, created once.
     *
     * @param baseUrl overridable only so tests can point at a stub. It defaults to production
     *   because a guest's invitation is not a configurable destination.
     */
    @Synchronized
    fun coordinator(
        context: Context,
        baseUrl: String = PRODUCTION_BASE_URL
    ): LiveGuestInvitationCoordinator {
        coordinator?.let { return it }
        activeBaseUrl = baseUrl
        val secure = AndroidKeystoreSecureStorage(context.applicationContext)
        storage = secure
        return LiveGuestInvitationCoordinator(
            GuestSessionClient(baseUrl = baseUrl, secureStorage = secure)
        ).also { coordinator = it }
    }

    /** Whether this device already holds a guest session, without constructing anything live. */
    fun hasGuestSession(context: Context): Boolean =
        AndroidKeystoreSecureStorage(context.applicationContext)
            .get("wewed.guest.session") != null

    /**
     * Ends the Guest relationship on this device.
     *
     * Deliberately separate from account Sign Out: it clears the Guest session and nothing else,
     * so forgetting a wedding on a planner's phone cannot log the planner out of Wewed.
     */
    @Synchronized
    fun forgetGuest(context: Context) {
        AndroidKeystoreSecureStorage(context.applicationContext).apply {
            delete("wewed.guest.session")
            delete("wewed.guest.session.slug")
        }
        coordinator = null
        storage = null
        GuestOnlyEntryState.reset()
    }

    /** Test seam. Never called by the app. */
    @Synchronized
    fun reset() {
        coordinator = null
        storage = null
    }
}
