package pro.wewed.app.state

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import pro.wewed.app.services.FixtureWeddingRepository
import pro.wewed.app.services.WeddingDayGateAwareRepository
import pro.wewed.app.services.WeddingDayGateOperations
import pro.wewed.app.services.WeddingRepository

enum class AppTab(val title: String) {
    HOME("Home"),
    PLAN("Plan"),
    GUESTS("Guests"),
    PASS("Pass"),
    LIVE("Live Wall")
}

class AppViewModel(
    baseRepository: WeddingRepository = FixtureWeddingRepository(),
    val weddingDayGate: WeddingDayGateOperations? = null,
    /** Active guest pass token resolved after RSVP; null in fixture/anonymous mode. */
    val activePassToken: String? = null,
    /** When true, UI may show simulation/demo controls (fixture & isolated modes only). */
    val showDemoSimulations: Boolean = true
) {
    val repository: WeddingRepository = if (weddingDayGate != null) {
        WeddingDayGateAwareRepository(baseRepository, weddingDayGate)
    } else {
        baseRepository
    }

    private val _selectedTab = MutableStateFlow(AppTab.HOME)
    val selectedTab: StateFlow<AppTab> = _selectedTab.asStateFlow()

    private val _isOffline = MutableStateFlow(false)
    val isOffline: StateFlow<Boolean> = _isOffline.asStateFlow()

    fun selectTab(tab: AppTab) {
        _selectedTab.value = tab
    }

    companion object {
        /** Convenience factory that reads all configuration from an [AppComposition]. */
        fun from(composition: AppComposition, activePassToken: String? = null): AppViewModel =
            AppViewModel(
                baseRepository = composition.repository,
                weddingDayGate = composition.gate,
                activePassToken = activePassToken,
                showDemoSimulations = composition.showDemoSimulations
            )
    }
}

