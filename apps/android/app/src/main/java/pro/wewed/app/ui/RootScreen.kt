package pro.wewed.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import pro.wewed.app.state.AppTab
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.state.SessionViewModel
import pro.wewed.app.theme.WewedColors
import pro.wewed.app.ui.auth.LoginScreen
import pro.wewed.app.ui.guests.GuestsScreen
import pro.wewed.app.ui.home.HomeScreen
import pro.wewed.app.ui.live.LiveWallScreen
import pro.wewed.app.ui.pass.PassScreen
import pro.wewed.app.ui.pass.UsherScannerScreen
import pro.wewed.app.ui.planner.PlannerScreen

@Composable
fun RootScreen(
    sessionViewModel: SessionViewModel,
    appViewModel: AppViewModel
) {
    val isAuthenticated by sessionViewModel.isAuthenticated.collectAsState()
    val selectedTab by appViewModel.selectedTab.collectAsState()
    var isScannerOpen by remember { mutableStateOf(false) }

    if (!isAuthenticated) {
        LoginScreen(sessionViewModel = sessionViewModel)
    } else if (isScannerOpen) {
        UsherScannerScreen(
            appViewModel = appViewModel,
            onClose = { isScannerOpen = false }
        )
    } else {
        Scaffold(
            bottomBar = {
                NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                    NavigationBarItem(
                        selected = selectedTab == AppTab.HOME,
                        onClick = { appViewModel.selectTab(AppTab.HOME) },
                        icon = { Icon(Icons.Default.Favorite, contentDescription = "Home") },
                        label = { Text("Home") },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = WewedColors.Gold,
                            selectedTextColor = WewedColors.Gold,
                            indicatorColor = WewedColors.GoldLight.copy(alpha = 0.3f)
                        )
                    )
                    NavigationBarItem(
                        selected = selectedTab == AppTab.PLAN,
                        onClick = { appViewModel.selectTab(AppTab.PLAN) },
                        icon = { Icon(Icons.Default.Checklist, contentDescription = "Plan") },
                        label = { Text("Plan") },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = WewedColors.Gold,
                            selectedTextColor = WewedColors.Gold,
                            indicatorColor = WewedColors.GoldLight.copy(alpha = 0.3f)
                        )
                    )
                    NavigationBarItem(
                        selected = selectedTab == AppTab.GUESTS,
                        onClick = { appViewModel.selectTab(AppTab.GUESTS) },
                        icon = { Icon(Icons.Default.Group, contentDescription = "Guests") },
                        label = { Text("Guests") },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = WewedColors.Gold,
                            selectedTextColor = WewedColors.Gold,
                            indicatorColor = WewedColors.GoldLight.copy(alpha = 0.3f)
                        )
                    )
                    NavigationBarItem(
                        selected = selectedTab == AppTab.PASS,
                        onClick = { appViewModel.selectTab(AppTab.PASS) },
                        icon = { Icon(Icons.Default.QrCode, contentDescription = "Pass") },
                        label = { Text("Pass") },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = WewedColors.Gold,
                            selectedTextColor = WewedColors.Gold,
                            indicatorColor = WewedColors.GoldLight.copy(alpha = 0.3f)
                        )
                    )
                    NavigationBarItem(
                        selected = selectedTab == AppTab.LIVE,
                        onClick = { appViewModel.selectTab(AppTab.LIVE) },
                        icon = { Icon(Icons.Default.Forum, contentDescription = "Live") },
                        label = { Text("Live") },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = WewedColors.Gold,
                            selectedTextColor = WewedColors.Gold,
                            indicatorColor = WewedColors.GoldLight.copy(alpha = 0.3f)
                        )
                    )
                }
            }
        ) { innerPadding ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                when (selectedTab) {
                    AppTab.HOME -> HomeScreen(appViewModel = appViewModel)
                    AppTab.PLAN -> PlannerScreen(appViewModel = appViewModel)
                    AppTab.GUESTS -> GuestsScreen(appViewModel = appViewModel)
                    AppTab.PASS -> PassScreen(
                        appViewModel = appViewModel,
                        onOpenScanner = { isScannerOpen = true }
                    )
                    AppTab.LIVE -> LiveWallScreen()
                }
            }
        }
    }
}
