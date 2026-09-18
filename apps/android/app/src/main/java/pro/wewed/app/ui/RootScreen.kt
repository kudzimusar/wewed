package pro.wewed.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import pro.wewed.app.theme.WeddingIdentityPalette
import pro.wewed.app.theme.WewedColors
import pro.wewed.app.ui.auth.LoginScreen
import pro.wewed.app.ui.guests.WeddingReferenceGuestsScreen
import pro.wewed.app.ui.home.WeddingReferenceHomeScreen
import pro.wewed.app.ui.more.WeddingReferenceMoreScreen
import pro.wewed.app.ui.pass.UsherScannerScreen
import pro.wewed.app.ui.pass.WeddingReferencePassScreen
import pro.wewed.app.ui.planner.WeddingReferencePlannerScreen
import pro.wewed.app.ui.roles.*

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

    if (currentRole == AppRole.COUPLE) {
        if (isScannerOpen) {
            UsherScannerScreen(
                appViewModel = appViewModel,
                onClose = { isScannerOpen = false }
            )
        } else {
            Scaffold(
                containerColor = WeddingIdentityPalette.Ivory,
                bottomBar = {
                    NavigationBar(
                        containerColor = WeddingIdentityPalette.IvorySoft,
                        tonalElevation = 2.dp
                    ) {
                        ReferenceNavItem(
                            selected = selectedTab == AppTab.HOME,
                            label = "Home",
                            icon = Icons.Default.Home
                        ) { appViewModel.selectTab(AppTab.HOME) }

                        ReferenceNavItem(
                            selected = selectedTab == AppTab.PLAN,
                            label = "Plan",
                            icon = Icons.Default.CalendarMonth
                        ) { appViewModel.selectTab(AppTab.PLAN) }

                        ReferenceNavItem(
                            selected = selectedTab == AppTab.GUESTS,
                            label = "Guests",
                            icon = Icons.Default.Group
                        ) { appViewModel.selectTab(AppTab.GUESTS) }

                        ReferenceNavItem(
                            selected = selectedTab == AppTab.PASS,
                            label = "Pass",
                            icon = Icons.Default.QrCode
                        ) { appViewModel.selectTab(AppTab.PASS) }

                        ReferenceNavItem(
                            selected = selectedTab == AppTab.LIVE,
                            label = "More",
                            icon = Icons.Default.Menu
                        ) { appViewModel.selectTab(AppTab.LIVE) }
                    }
                }
            ) { innerPadding ->
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(innerPadding)
                ) {
                    when (selectedTab) {
                        AppTab.HOME -> WeddingReferenceHomeScreen(appViewModel)
                        AppTab.PLAN -> WeddingReferencePlannerScreen(appViewModel)
                        AppTab.GUESTS -> WeddingReferenceGuestsScreen(appViewModel)
                        AppTab.PASS -> WeddingReferencePassScreen(
                            appViewModel = appViewModel,
                            onOpenScanner = { isScannerOpen = true }
                        )
                        AppTab.LIVE -> WeddingReferenceMoreScreen(appViewModel)
                    }
                }
            }
        }
        return
    }

    Column(modifier = Modifier.fillMaxSize()) {
        DeveloperPersonaBanner(
            currentUserName = currentUserName,
            currentRole = currentRole,
            appViewModel = appViewModel,
            onSwitch = { showPersonaPicker = true }
        )

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
                AppRole.COUPLE -> Unit
            }
        }
    }
}

@Composable
private fun RowScope.ReferenceNavItem(
    selected: Boolean,
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit
) {
    NavigationBarItem(
        selected = selected,
        onClick = onClick,
        icon = { Icon(icon, contentDescription = label) },
        label = { Text(label, fontSize = 11.sp) },
        colors = NavigationBarItemDefaults.colors(
            selectedIconColor = WeddingIdentityPalette.ChampagneDeep,
            selectedTextColor = WeddingIdentityPalette.ChampagneDeep,
            indicatorColor = WeddingIdentityPalette.Champagne.copy(alpha = 0.12f),
            unselectedIconColor = WeddingIdentityPalette.Muted,
            unselectedTextColor = WeddingIdentityPalette.Muted
        )
    )
}

@Composable
private fun DeveloperPersonaBanner(
    currentUserName: String?,
    currentRole: AppRole,
    appViewModel: AppViewModel,
    onSwitch: () -> Unit
) {
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
            Text(
                currentUserName ?: "Active User",
                color = Color.White,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(currentRole.title, color = WewedColors.Gold, fontSize = 11.sp)
            Spacer(modifier = Modifier.width(6.dp))
            Surface(
                shape = RoundedCornerShape(50),
                color = Color.White.copy(alpha = 0.12f)
            ) {
                Text(
                    appViewModel.dataEnvironment.title.uppercase(),
                    color = if (appViewModel.dataEnvironment.name == "PRODUCTION") Color.Red else WewedColors.Emerald,
                    fontSize = 8.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                )
            }
        }

        TextButton(onClick = onSwitch) {
            Text(
                "Switch",
                color = WewedColors.Gold,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}
