package pro.wewed.app.ui.shared

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.state.SessionViewModel
import pro.wewed.app.theme.WeddingIdentityPalette
import pro.wewed.app.theme.WewedColors
import pro.wewed.app.theme.WewedRadius
import pro.wewed.app.theme.WewedSpacing

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SharedScaffold(
    title: String,
    onBack: (() -> Unit)? = null,
    content: @Composable (PaddingValues) -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title, fontWeight = FontWeight.SemiBold, fontSize = 18.sp) },
                navigationIcon = {
                    if (onBack != null) {
                        IconButton(onClick = onBack) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = WewedColors.Ivory)
            )
        },
        containerColor = WewedColors.Ivory,
        content = content
    )
}

// 1. Account & Privacy Screen (AUTH-02)
@Composable
fun AccountPrivacyScreen(onBack: (() -> Unit)? = null) {
    var biometricEnabled by remember { mutableStateOf(true) }
    var shareDataEnabled by remember { mutableStateOf(false) }

    SharedScaffold(title = "Account & Privacy", onBack = onBack) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = WewedSpacing.base),
            verticalArrangement = Arrangement.spacedBy(WewedSpacing.md)
        ) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth().padding(top = WewedSpacing.sm),
                    shape = RoundedCornerShape(WewedRadius.lg),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Column(modifier = Modifier.padding(WewedSpacing.base)) {
                        Text("Account & Privacy Controls", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Text("Manage your personal data, biometric pass security, and account deletion requests.", fontSize = 12.sp, color = Color.Gray)
                    }
                }
            }

            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(WewedRadius.lg),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Column(modifier = Modifier.padding(WewedSpacing.base)) {
                        Text("Privacy Controls", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        Spacer(modifier = Modifier.height(WewedSpacing.sm))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Biometric Pass Security", fontWeight = FontWeight.Medium, fontSize = 13.sp)
                                Text("Require fingerprint/face to show QR pass", fontSize = 11.sp, color = Color.Gray)
                            }
                            Switch(
                                checked = biometricEnabled,
                                onCheckedChange = { biometricEnabled = it },
                                colors = SwitchDefaults.colors(checkedThumbColor = WewedColors.Emerald)
                            )
                        }
                        HorizontalDivider(modifier = Modifier.padding(vertical = WewedSpacing.sm))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Share Data with Verified Vendors", fontWeight = FontWeight.Medium, fontSize = 13.sp)
                                Text("Allows catering to scan dietary pass notes", fontSize = 11.sp, color = Color.Gray)
                            }
                            Switch(
                                checked = shareDataEnabled,
                                onCheckedChange = { shareDataEnabled = it },
                                colors = SwitchDefaults.colors(checkedThumbColor = WewedColors.Emerald)
                            )
                        }
                    }
                }
            }

            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(WewedRadius.lg),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Column(modifier = Modifier.padding(WewedSpacing.base), verticalArrangement = Arrangement.spacedBy(WewedSpacing.sm)) {
                        Text("GDPR & Erasure Rights", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        Button(
                            onClick = {},
                            colors = ButtonDefaults.buttonColors(containerColor = WewedColors.GoldLight.copy(alpha = 0.3f), contentColor = Color.Black),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Download Data Archive", fontWeight = FontWeight.SemiBold)
                        }
                        Button(
                            onClick = {},
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFFEBEE), contentColor = Color.Red),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Request Permanent Account Deletion", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

// 2. Wedding Context Switcher Screen (WEDD-01)
//
// The weddings an actor may switch between are a server answer about that actor (master plan
// Phases 2, 5 and 6). There is no such source in this build, so this says so. It used to list one
// hardcoded real wedding — the same one for every actor — as if it were the actor's portfolio
// (master plan §8.13).
@Composable
fun WeddingContextSwitcherScreen(onBack: (() -> Unit)? = null) {
    SharedScaffold(title = "Event Switcher", onBack = onBack) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(WewedSpacing.base)
                .testTag("wedding-context-switcher-unavailable"),
            verticalArrangement = Arrangement.spacedBy(WewedSpacing.sm)
        ) {
            Text("Active Event Contexts", fontWeight = FontWeight.Bold)
            Text(
                "Wedding switching is not connected in this build. The weddings you can open come " +
                    "from your Wewed account, and no account authority is available here.",
                color = Color.Gray,
                fontSize = 13.sp
            )
        }
    }
}

// 4. Messages Inbox Screen (COMM-01)
@Composable
fun MessagesInboxScreen(onBack: (() -> Unit)? = null) {
    // P0-14 fixture leak: this screen previously hard-coded a planner conversation with a
    // timestamp, which read as a real thread. No message or thread entity exists in the wedding
    // graph in any Shadow environment, so the honest answer is that the capability is unsupported.
    SharedScaffold(title = "Messages", onBack = onBack) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(WewedSpacing.base),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                "Messages",
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                color = WeddingIdentityPalette.Ink
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                "Native messaging has no contract in this environment. No conversations are recorded in the wedding graph, so none are shown.",
                fontSize = 12.sp,
                color = WeddingIdentityPalette.Muted,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )
        }
    }
}

// 5. Notifications Center Screen (COMM-02)
@Composable
fun NotificationsCenterScreen(onBack: (() -> Unit)? = null) {
    SharedScaffold(title = "Notifications Center", onBack = onBack) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = WewedSpacing.base),
            verticalArrangement = Arrangement.spacedBy(WewedSpacing.md)
        ) {
            item {
                Box(
                    modifier = Modifier.fillMaxWidth().padding(WewedSpacing.base),
                    contentAlignment = Alignment.Center
                ) {
                    Text("No notifications recorded.", color = Color.Gray, fontSize = 14.sp)
                }
            }
        }
    }
}

// 7. Settings Screen (SETT-01)
private enum class SettingsSubRoute {
    MAIN,
    ACCOUNT_PRIVACY,
    NOTIFICATIONS,
    EVENT_CONTEXT
}

@Composable
fun SettingsScreen(sessionViewModel: SessionViewModel, onBack: (() -> Unit)? = null) {
    var subRoute by remember { mutableStateOf(SettingsSubRoute.MAIN) }

    when (subRoute) {
        SettingsSubRoute.ACCOUNT_PRIVACY -> {
            AccountPrivacyScreen(onBack = { subRoute = SettingsSubRoute.MAIN })
            return
        }
        SettingsSubRoute.NOTIFICATIONS -> {
            NotificationsCenterScreen(onBack = { subRoute = SettingsSubRoute.MAIN })
            return
        }
        SettingsSubRoute.EVENT_CONTEXT -> {
            WeddingContextSwitcherScreen(onBack = { subRoute = SettingsSubRoute.MAIN })
            return
        }
        SettingsSubRoute.MAIN -> {
            // Render main settings list
        }
    }

    val userName by sessionViewModel.currentUserName.collectAsState()
    val role by sessionViewModel.currentRole.collectAsState()
    // Only what the session actually holds. No invented account name or e-mail: an unresolved
    // identity is shown as unresolved (master plan Rule 5).
    val displayName = userName?.takeIf { it.isNotBlank() } ?: "Identity not resolved"

    SharedScaffold(title = "Settings & Profile", onBack = onBack) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = WewedSpacing.base),
            verticalArrangement = Arrangement.spacedBy(WewedSpacing.md)
        ) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth().padding(top = WewedSpacing.sm),
                    shape = RoundedCornerShape(WewedRadius.lg),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Row(modifier = Modifier.padding(WewedSpacing.base), verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier.size(50.dp).background(WewedColors.GoldLight.copy(alpha = 0.3f), CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(displayName.take(1), fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color.Black)
                        }
                        Spacer(modifier = Modifier.width(WewedSpacing.base))
                        Column {
                            Text(displayName, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            Text(
                                role?.title ?: "No workspace role",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = WewedColors.Gold
                            )
                        }
                    }
                }
            }

            val options = listOf(
                Triple("Account & Privacy Controls", Icons.Default.Shield, SettingsSubRoute.ACCOUNT_PRIVACY),
                Triple("Notification Preferences", Icons.Default.Notifications, SettingsSubRoute.NOTIFICATIONS),
                Triple("Event & Workspace Context", Icons.Default.Sync, SettingsSubRoute.EVENT_CONTEXT)
            )
            items(options) { (title, icon, targetRoute) ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { subRoute = targetRoute },
                    shape = RoundedCornerShape(WewedRadius.md),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Row(
                        modifier = Modifier.padding(WewedSpacing.base),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(icon, contentDescription = null, tint = WewedColors.Gold)
                            Spacer(modifier = Modifier.width(WewedSpacing.sm))
                            Text(title, fontWeight = FontWeight.Medium)
                        }
                        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = Color.Gray)
                    }
                }
            }
        }
    }
}

// Master plan Phase 8 (P1-N4): MarketplaceDirectoryScreen, MasterCalendarScreen,
// VendorCatalogScreen and AdminGovernanceScreen were removed here — all four were compiled into
// release with zero callers and hardcoded fabricated content (a named "Charity & Kudzie" wedding,
// invented vendor ratings, invented compliance documents). Their real domains are wired instead
// through ProductionWeddingRepository/ProductionPlannerDashboardRepository/
// ProductionAdminSystemRepository and the existing role-shell architecture; see
// docs/native-mobile/WEWED_NATIVE_PHASE8_FIELD_CLASSIFICATION.md for what is LIVE vs UNSUPPORTED.
