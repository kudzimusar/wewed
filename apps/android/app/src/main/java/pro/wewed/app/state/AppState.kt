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

enum class AppTab(val title: String) {
    HOME("Home"),
    PLAN("Plan"),
    GUESTS("Guests"),
    PASS("Pass"),
    LIVE("More")
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

    fun handleIncomingUrl(rawUrl: String?) {
        when (val deepLink = NativeDeepLinkParser.parse(rawUrl)) {
            is NativeDeepLink.Invitation -> {
                _pendingInvitationDeepLink.value = deepLink.value
                _selectedTab.value = AppTab.HOME
            }
            NativeDeepLink.Pass -> {
                _pendingInvitationDeepLink.value = null
                _selectedTab.value = AppTab.PASS
            }
            is NativeDeepLink.Wedding -> {
                _pendingInvitationDeepLink.value = null
                _selectedTab.value = AppTab.HOME
            }
            null -> Unit
        }
    }

    fun consumePendingInvitationDeepLink() {
        _pendingInvitationDeepLink.value = null
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
