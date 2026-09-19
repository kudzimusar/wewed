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
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.models.AppRole
import pro.wewed.app.state.AppTab
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.state.NativeLaunchConfiguration
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

@OptIn(ExperimentalComposeUiApi::class)
@Composable
fun RootScreen(
    sessionViewModel: SessionViewModel,
    appViewModel: AppViewModel,
    launch: NativeLaunchConfiguration
) {
    val session by sessionViewModel.session.collectAsState()
    val activeGrant by sessionViewModel.activeGrant.collectAsState()

    // Every shell sits under one node carrying the data-source provenance, so acceptance
    // flows can prove which dataset produced the screen without any visible developer label.
    Box(
        modifier = Modifier
            .fillMaxSize()
            .semantics { testTagsAsResourceId = true }
            .testTag("shadow-source-${appViewModel.dataEnvironment.name.lowercase().replace('_', '-')}")
    ) {
        val current = session
        val grant = activeGrant
        when {
            current == null -> LoginScreen(
                appViewModel = appViewModel,
                launch = launch,
                onSignedIn = { sessionViewModel.establish(it) }
            )
            grant == null -> RoleChooserScreen(
                session = current,
                onChoose = { sessionViewModel.activate(it.role) },
                onSignOut = { sessionViewModel.signOut() }
            )
            else -> when (grant.role) {
                AppRole.COUPLE -> CoupleShell(appViewModel)
                AppRole.PLANNER -> PlannerShell(sessionViewModel, appViewModel, onOpenPersonaPicker = { sessionViewModel.clearActiveRole() })
                AppRole.COORDINATOR -> CoordinatorShell(sessionViewModel, appViewModel, onOpenPersonaPicker = { sessionViewModel.clearActiveRole() })
                AppRole.VENDOR -> VendorShell(sessionViewModel, appViewModel, onOpenPersonaPicker = { sessionViewModel.clearActiveRole() })
                AppRole.USHER -> UsherShell(sessionViewModel, appViewModel, onOpenPersonaPicker = { sessionViewModel.clearActiveRole() })
                AppRole.GUEST -> GuestShell(sessionViewModel, appViewModel, onOpenPersonaPicker = { sessionViewModel.clearActiveRole() })
                AppRole.ADMIN -> AdminShell(sessionViewModel, appViewModel, onOpenPersonaPicker = { sessionViewModel.clearActiveRole() })
            }
        }
    }
}

@Composable
private fun CoupleShell(appViewModel: AppViewModel) {
    val selectedTab by appViewModel.selectedTab.collectAsState()
    var isScannerOpen by remember { mutableStateOf(false) }

    if (isScannerOpen) {
        UsherScannerScreen(
            appViewModel = appViewModel,
            onClose = { isScannerOpen = false }
        )
        return
    }
    Scaffold(
        containerColor = WeddingIdentityPalette.Ivory,
        bottomBar = {
            Column(
                modifier = Modifier.background(WeddingIdentityPalette.IvorySoft)
            ) {
                HorizontalDivider(
                    thickness = 1.dp,
                    color = WeddingIdentityPalette.Hairline
                )
                NavigationBar(
                    containerColor = WeddingIdentityPalette.IvorySoft,
                    tonalElevation = 0.dp
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
            indicatorColor = Color.Transparent,
            unselectedIconColor = WeddingIdentityPalette.Muted,
            unselectedTextColor = WeddingIdentityPalette.Muted
        )
    )
}
