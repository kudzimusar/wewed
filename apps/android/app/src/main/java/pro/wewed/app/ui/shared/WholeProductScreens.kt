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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.state.SessionViewModel
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
@Composable
fun WeddingContextSwitcherScreen(onBack: (() -> Unit)? = null) {
    var selectedId by remember { mutableStateOf("cmqos70cb0004q6vxe9g9aiu5") }

    SharedScaffold(title = "Event Switcher", onBack = onBack) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = WewedSpacing.base),
            verticalArrangement = Arrangement.spacedBy(WewedSpacing.md)
        ) {
            item {
                Text("Active Event Contexts", fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = WewedSpacing.sm))
            }
            val list = listOf(
                Triple("cmqos70cb0004q6vxe9g9aiu5", "Charity & Kudzie", "23 Dec 2026 • Imba Manor, Harare")
            )
            items(list) { (id, couple, meta) ->
                Card(
                    modifier = Modifier.fillMaxWidth().clickable { selectedId = id },
                    shape = RoundedCornerShape(WewedRadius.md),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Row(
                        modifier = Modifier.padding(WewedSpacing.base),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(couple, fontWeight = FontWeight.Bold)
                            Text(meta, fontSize = 12.sp, color = Color.Gray)
                        }
                        if (selectedId == id) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = WewedColors.Emerald)
                        }
                    }
                }
            }
        }
    }
}

// 3. Marketplace Directory Screen (PLAN-05)
@Composable
fun MarketplaceDirectoryScreen(onBack: (() -> Unit)? = null) {
    var searchQuery by remember { mutableStateOf("") }

    SharedScaffold(title = "Marketplace Directory", onBack = onBack) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = WewedSpacing.base),
            verticalArrangement = Arrangement.spacedBy(WewedSpacing.md)
        ) {
            item {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("Search verified vendors & venues...") },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                    modifier = Modifier.fillMaxWidth().padding(top = WewedSpacing.sm),
                    shape = RoundedCornerShape(WewedRadius.md),
                    colors = OutlinedTextFieldDefaults.colors(unfocusedContainerColor = Color.White, focusedContainerColor = Color.White)
                )
            }

            val providers = listOf(
                Triple("Eleven Eleven Testing", "Planners • Harare", "5.00 (Accepted Interest) • $$$"),
                Triple("Imba Manor", "Venues • Glen Lorne", "5.00 (Verified Venue) • $$$$"),
                Triple("FAUME MEDIA", "Photographers • Harare", "4.95 (Cinematography) • $$$"),
                Triple("The Glass Petal Atelier", "Florals • Harare", "4.90 (Floral Design) • $$"),
                Triple("Cake Gourmet", "Catering • Harare", "4.85 (Cake & Desserts) • $$"),
                Triple("MC Aloe The Avangelist", "Master of Ceremonies • Harare", "5.00 (Sound & MC) • $$")
            )
            items(providers) { (name, category, meta) ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(WewedRadius.md),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Row(
                        modifier = Modifier.padding(WewedSpacing.base),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(name, fontWeight = FontWeight.Bold)
                            Text(category, fontSize = 12.sp, color = Color.Gray)
                            Text(meta, fontSize = 11.sp, color = WewedColors.Gold, fontWeight = FontWeight.SemiBold)
                        }
                        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = Color.Gray)
                    }
                }
            }
        }
    }
}

// 4. Messages Inbox Screen (COMM-01)
@Composable
fun MessagesInboxScreen(onBack: (() -> Unit)? = null) {
    SharedScaffold(title = "Messages & Shared Inbox", onBack = onBack) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = WewedSpacing.base),
            verticalArrangement = Arrangement.spacedBy(WewedSpacing.md)
        ) {
            val threads = listOf(
                Triple("Eleven Eleven Testing (Lead Planner)", "Planning coordination for Charity & Kudzie active.", "10:42 AM")
            )
            items(threads) { (sender, preview, time) ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(WewedRadius.md),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Row(
                        modifier = Modifier.padding(WewedSpacing.base),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .background(WewedColors.GoldLight.copy(alpha = 0.3f), CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(sender.take(1), fontWeight = FontWeight.Bold, color = Color.Black)
                        }
                        Spacer(modifier = Modifier.width(WewedSpacing.sm))
                        Column(modifier = Modifier.weight(1f)) {
                            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                Text(sender, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                                Text(time, fontSize = 11.sp, color = Color.Gray)
                            }
                            Text(preview, fontSize = 12.sp, color = Color.Gray)
                        }
                    }
                }
            }
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

// 6. Master Calendar Screen (CALN-01)
@Composable
fun MasterCalendarScreen(onBack: (() -> Unit)? = null) {
    SharedScaffold(title = "Master Calendar", onBack = onBack) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = WewedSpacing.base),
            verticalArrangement = Arrangement.spacedBy(WewedSpacing.md)
        ) {
            val events = listOf(
                Triple("DEC 22", "Florist Delivery & Setup", "Imba Manor"),
                Triple("DEC 23", "WEDDING DAY — CHARITY & KUDZIE", "Imba Manor, Harare")
            )
            items(events) { (date, title, location) ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(WewedRadius.md),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Row(modifier = Modifier.padding(WewedSpacing.base), verticalAlignment = Alignment.CenterVertically) {
                        Text(date, fontWeight = FontWeight.Bold, color = WewedColors.Gold, fontSize = 14.sp, modifier = Modifier.width(60.dp))
                        Spacer(modifier = Modifier.width(WewedSpacing.sm))
                        Column {
                            Text(title, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                            Text(location, fontSize = 12.sp, color = Color.Gray)
                        }
                    }
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
    val displayName = userName ?: "Active User"

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
                            Text("wewed.mobile@pro.wewed", fontSize = 12.sp, color = Color.Gray)
                            Text(role.title, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = WewedColors.Gold)
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

// 8. Vendor Catalog Screen (VBIZ-01)
@Composable
fun VendorCatalogScreen(onBack: (() -> Unit)? = null) {
    SharedScaffold(title = "Vendor Catalog & Vault", onBack = onBack) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = WewedSpacing.base),
            verticalArrangement = Arrangement.spacedBy(WewedSpacing.md)
        ) {
            val docs = listOf(
                Triple("Public Liability Insurance Policy", "Valid thru Dec 2026", "Verified"),
                Triple("Zimbabwe Tax Clearance Certificate", "ITF262 Active", "Verified"),
                Triple("Master Services & Rate Sheet v2", "2026/2027 Season", "Published")
            )
            items(docs) { (title, expiry, status) ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(WewedRadius.md),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Row(
                        modifier = Modifier.padding(WewedSpacing.base),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(title, fontWeight = FontWeight.SemiBold)
                            Text(expiry, fontSize = 12.sp, color = Color.Gray)
                        }
                        Text(
                            status,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = WewedColors.Emerald,
                            modifier = Modifier
                                .background(WewedColors.Emerald.copy(alpha = 0.15f), RoundedCornerShape(WewedRadius.sm))
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                }
            }
        }
    }
}

// 9. Admin Governance Screen (ADMN-01)
@Composable
fun AdminGovernanceScreen(onBack: (() -> Unit)? = null) {
    SharedScaffold(title = "Admin Governance Console", onBack = onBack) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = WewedSpacing.base),
            verticalArrangement = Arrangement.spacedBy(WewedSpacing.md)
        ) {
            val stats = listOf(
                Pair("ECDSA Pass Key Anchor", "ww2-2026-prod (Active)"),
                Pair("Offline Sync Queues", "0 stuck messages across 8 weddings"),
                Pair("System Security Level", "Strict ECDSA P-256 Enforced")
            )
            items(stats) { (label, value) ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(WewedRadius.md),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Column(modifier = Modifier.padding(WewedSpacing.base)) {
                        Text(label, fontSize = 12.sp, color = Color.Gray)
                        Text(value, fontWeight = FontWeight.Bold, color = WewedColors.Emerald)
                    }
                }
            }
        }
    }
}
