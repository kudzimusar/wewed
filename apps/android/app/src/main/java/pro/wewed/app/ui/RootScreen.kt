package pro.wewed.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.models.AppRole
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
import pro.wewed.app.ui.roles.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RootScreen(
    sessionViewModel: SessionViewModel,
    appViewModel: AppViewModel
) {
    val isAuthenticated by sessionViewModel.isAuthenticated.collectAsState()
    val currentRole by sessionViewModel.currentRole.collectAsState()
    val currentUserName by sessionViewModel.currentUserName.collectAsState()
    val selectedTab by appViewModel.selectedTab.collectAsState()
    var isScannerOpen by remember { mutableStateOf(false) }
    var showPersonaPicker by remember { mutableStateOf(false) }

    if (!isAuthenticated) {
        LoginScreen(sessionViewModel = sessionViewModel)
        return
    }

    if (showPersonaPicker) {
        PersonaPickerDialog(
            sessionViewModel = sessionViewModel,
            onDismiss = { showPersonaPicker = false }
        )
    }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.Black.copy(alpha = 0.85f))
                .padding(horizontal = 16.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .background(Color.Green, CircleShape)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(currentUserName ?: "Tariro & Shadreck", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                Spacer(modifier = Modifier.width(6.dp))
                Text(currentRole.title, color = WewedColors.Gold, fontSize = 11.sp)
            }
            TextButton(onClick = { showPersonaPicker = true }) {
                Text("Switch", color = WewedColors.Gold, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }

        Box(modifier = Modifier.weight(1f)) {
            when (currentRole) {
                AppRole.PLANNER -> PlannerShell(
                    sessionViewModel = sessionViewModel,
                    appViewModel = appViewModel,
                    onOpenPersonaPicker = { showPersonaPicker = true }
                )
                AppRole.COORDINATOR -> CoordinatorShell(
                    sessionViewModel = sessionViewModel,
                    appViewModel = appViewModel,
                    onOpenPersonaPicker = { showPersonaPicker = true }
                )
                AppRole.VENDOR -> VendorShell(
                    sessionViewModel = sessionViewModel,
                    appViewModel = appViewModel,
                    onOpenPersonaPicker = { showPersonaPicker = true }
                )
                AppRole.USHER -> UsherShell(
                    sessionViewModel = sessionViewModel,
                    appViewModel = appViewModel,
                    onOpenPersonaPicker = { showPersonaPicker = true }
                )
                AppRole.GUEST -> GuestShell(
                    sessionViewModel = sessionViewModel,
                    appViewModel = appViewModel,
                    onOpenPersonaPicker = { showPersonaPicker = true }
                )
                AppRole.ADMIN -> AdminShell(
                    sessionViewModel = sessionViewModel,
                    appViewModel = appViewModel,
                    onOpenPersonaPicker = { showPersonaPicker = true }
                )
                AppRole.COUPLE -> {
                    if (isScannerOpen) {
                        UsherScannerScreen(
                            appViewModel = appViewModel,
                            onClose = { isScannerOpen = false }
                        )
                    } else {
                        Scaffold(
                            topBar = {
                                TopAppBar(
                                    title = { Text("WEWED", color = WewedColors.Gold) },
                                    actions = {
                                        TextButton(onClick = { showPersonaPicker = true }) {
                                            Text("Switch", color = WewedColors.Gold, fontWeight = FontWeight.Bold)
                                        }
                                    },
                                    colors = TopAppBarDefaults.topAppBarColors(containerColor = WewedColors.Ivory)
                                )
                            },
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
            }
        }
    }
}
