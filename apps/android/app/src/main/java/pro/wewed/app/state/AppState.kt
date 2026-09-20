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
import pro.wewed.app.services.WeddingRepository

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
            NativeDeepLink.Pass -> {
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
