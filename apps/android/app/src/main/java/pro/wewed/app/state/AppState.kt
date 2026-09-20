package pro.wewed.app.state

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import pro.wewed.app.models.InvitationDeepLink
import pro.wewed.app.models.NativeDataEnvironment
import pro.wewed.app.models.NativeDeepLink
import pro.wewed.app.models.NativeDeepLinkParser
import pro.wewed.app.services.FixturePlannerDashboardRepository
import pro.wewed.app.services.FixtureWeddingRepository
import pro.wewed.app.services.PlannerDashboardRepository
import pro.wewed.app.services.NativeEnvironmentGuard
import pro.wewed.app.services.WeddingDayGateAwareRepository
import pro.wewed.app.services.WeddingDayGateOperations
import pro.wewed.app.services.ScopedWeddingRepository
import pro.wewed.app.services.WeddingRepository
import pro.wewed.app.services.forWedding

/**
 * Couple Level-1 destinations, mirroring the IA V2 couple taxonomy
 * (Home | Plan | Guests | Wedding Day | More).
 *
 * [destinationId] ties each tab to the shared navigation contract so deep links resolve to a
 * contract destination rather than a screen name.
 */
enum class AppTab(val title: String, val destinationId: String) {
    HOME("Home", "home"),
    PLAN("Plan", "plan"),
    GUESTS("Guests", "guests"),
    WEDDING_DAY("Wedding Day", "wedding_day"),
    MORE("More", "more");

    companion object {
        fun fromDestinationId(id: String): AppTab =
            entries.find { it.destinationId == id } ?: HOME
    }
}

class AppViewModel(
    baseRepository: WeddingRepository = FixtureWeddingRepository(),
    val plannerRepository: PlannerDashboardRepository = FixturePlannerDashboardRepository(),
    val dataEnvironment: NativeDataEnvironment = NativeDataEnvironment.FIXTURE,
    val dataBaseUrl: String? = null,
    val weddingDayGate: WeddingDayGateOperations? = null
) {
    init {
        NativeEnvironmentGuard.validate(dataBaseUrl, dataEnvironment)
    }

    val repository: WeddingRepository = if (weddingDayGate != null) {
        WeddingDayGateAwareRepository(baseRepository, weddingDayGate)
    } else {
        baseRepository
    }

    /**
     * The wedding every graph read is scoped to (P0-1).
     *
     * Bound once by the root from the resolved NavigationContext. It is deliberately not defaulted:
     * an unbound view model cannot read a wedding graph at all, so there is no ambient fallback for
     * a screen to accidentally rely on.
     */
    private val _activeWeddingId = MutableStateFlow<String?>(null)
    val activeWeddingId: StateFlow<String?> = _activeWeddingId.asStateFlow()

    fun bindActiveWedding(weddingId: String) {
        _activeWeddingId.value = weddingId.takeIf { it.isNotBlank() }
    }

    /**
     * The only way a screen reads the wedding graph. Throws if no wedding is bound, and
     * [forWedding] rejects a wedding this source does not serve.
     */
    suspend fun scopedRepository(): ScopedWeddingRepository {
        val weddingId = _activeWeddingId.value
            ?: error("No active wedding is bound; a wedding graph cannot be read without a scope.")
        return repository.forWedding(weddingId)
    }

    private val _selectedTab = MutableStateFlow(AppTab.HOME)
    val selectedTab: StateFlow<AppTab> = _selectedTab.asStateFlow()

    private val _isOffline = MutableStateFlow(false)
    val isOffline: StateFlow<Boolean> = _isOffline.asStateFlow()

    private val _pendingInvitationDeepLink = MutableStateFlow<InvitationDeepLink?>(null)
    val pendingInvitationDeepLink: StateFlow<InvitationDeepLink?> =
        _pendingInvitationDeepLink.asStateFlow()

    /**
     * A parsed but *unauthorized* route request. The root resolves it through
     * `DeepLinkRouter` against the active role and context; parsing alone never navigates.
     */
    private val _pendingRouteDeepLink = MutableStateFlow<NativeDeepLink?>(null)
    val pendingRouteDeepLink: StateFlow<NativeDeepLink?> = _pendingRouteDeepLink.asStateFlow()

    fun handleIncomingUrl(rawUrl: String?) {
        when (val deepLink = NativeDeepLinkParser.parse(rawUrl)) {
            is NativeDeepLink.Invitation -> {
                _pendingInvitationDeepLink.value = deepLink.value
                _pendingRouteDeepLink.value = null
                _selectedTab.value = AppTab.HOME
            }
            is NativeDeepLink.Pass -> {
                _pendingInvitationDeepLink.value = null
                _pendingRouteDeepLink.value = deepLink
                _selectedTab.value = AppTab.WEDDING_DAY
            }
            is NativeDeepLink.Wedding -> {
                _pendingInvitationDeepLink.value = null
                _pendingRouteDeepLink.value = deepLink
                _selectedTab.value = AppTab.HOME
            }
            is NativeDeepLink.Workspace -> {
                // Held unresolved: the root gates it against role/context before navigating.
                _pendingInvitationDeepLink.value = null
                _pendingRouteDeepLink.value = deepLink
            }
            null -> Unit
        }
    }

    fun consumePendingInvitationDeepLink() {
        _pendingInvitationDeepLink.value = null
    }

    fun consumePendingRouteDeepLink() {
        _pendingRouteDeepLink.value = null
    }

    fun selectTab(tab: AppTab) {
        _selectedTab.value = tab
    }

    companion object {
        /**
         * Builds the repositories for an environment, or reports why it could not.
         *
         * Constructing a PRIVATE_REAL_SHADOW repository on a device where the protected snapshot
         * is not provisioned threw out of `MainActivity.onCreate` and killed the process — the app
         * simply vanished back to the launcher, with nothing to tell anyone what was wrong. The
         * refusal to fall back to demo data is correct and stays; the crash is not.
         *
         * Returns null on failure, with [lastEnvironmentFailure] carrying the reason.
         */
        @Volatile
        var lastEnvironmentFailure: String? = null
            private set

        fun fromEnvironmentOrNull(
            environment: NativeDataEnvironment,
            baseUrl: String? = null
        ): AppViewModel? = runCatching { fromEnvironment(environment, baseUrl) }
            .onSuccess { lastEnvironmentFailure = null }
            .onFailure { lastEnvironmentFailure = it.message ?: "This data environment could not be opened." }
            .getOrNull()

        fun fromEnvironment(
            environment: NativeDataEnvironment,
            baseUrl: String? = null
        ): AppViewModel {
            val bundle = pro.wewed.app.services.NativeRepositoryFactory.make(environment, baseUrl)
            return AppViewModel(
                baseRepository = bundle.wedding,
                plannerRepository = bundle.planner,
                dataEnvironment = bundle.environment,
                dataBaseUrl = bundle.baseUrl
            )
        }
    }
}
