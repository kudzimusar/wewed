package pro.wewed.app.state

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import pro.wewed.app.services.FixtureWeddingRepository
import pro.wewed.app.services.WeddingRepository

enum class AppTab(val title: String) {
    HOME("Home"),
    PLAN("Plan"),
    GUESTS("Guests"),
    PASS("Pass"),
    LIVE("Live Wall")
}

class AppViewModel(
    val repository: WeddingRepository = FixtureWeddingRepository()
) {
    private val _selectedTab = MutableStateFlow(AppTab.HOME)
    val selectedTab: StateFlow<AppTab> = _selectedTab.asStateFlow()

    private val _isOffline = MutableStateFlow(false)
    val isOffline: StateFlow<Boolean> = _isOffline.asStateFlow()

    fun selectTab(tab: AppTab) {
        _selectedTab.value = tab
    }
}
