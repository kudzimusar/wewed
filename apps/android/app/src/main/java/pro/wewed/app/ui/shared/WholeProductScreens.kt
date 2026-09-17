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
    var selectedId by remember { mutableStateOf("w1") }

    SharedScaffold(title = "Event Switcher", onBack = onBack) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = WewedSpacing.base),
            verticalArrangement = Arrangement.spacedBy(WewedSpacing.md)
        ) {
            item {
                Text("Active Event Contexts", fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = WewedSpacing.sm))
            }
            val list = listOf(
                Triple("w1", "Tariro & Shadreck Musarurwa", "24 Oct 2026 • Imba Manor, Harare"),
                Triple("w2", "Ruvimbo & Farai Ndlovu", "12 Dec 2026 • Wild Geese Lodge"),
                Triple("w3", "Chido & Tinashe Moyo", "15 Jan 2027 • Raintree Estate")
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
                    placeholder = { Text("Search planners, venues & vendors...") },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                    modifier = Modifier.fillMaxWidth().padding(top = WewedSpacing.sm),
                    shape = RoundedCornerShape(WewedRadius.md),
                    colors = OutlinedTextFieldDefaults.colors(unfocusedContainerColor = Color.White, focusedContainerColor = Color.White)
                )
            }

            val providers = listOf(
                Triple("Kudzie Musarurwa Events", "Planners • Harare", "4.98 (42 reviews) • $$$"),
                Triple("Imba Manor Estate", "Venues • Glen Lorne", "5.00 (68 reviews) • $$$$"),
                Triple("AfroGlow Visuals", "Photographers • Harare", "4.95 (31 reviews) • $$"),
                Triple("Botanical Ivory Florals", "Florals • Harare", "4.89 (19 reviews) • $$")
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
                Triple("Kudzie Musar (Lead Planner)", "Timeline updated for 14:00 ceremony start.", "10:42 AM"),
                Triple("Imba Manor Venue Manager", "Marquee setup is complete and powered.", "09:15 AM"),
                Triple("AfroGlow Photography", "Lighting check looks excellent for bridal suite.", "Yesterday"),
                Triple("Gate Usher Command", "4 ushers briefed on ECDSA pass verification.", "Sep 15")
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
            val notifs = listOf(
                Triple("RSVP Confirmation Received", "Blessing & Tendai Moyo confirmed attending.", "15 mins ago"),
                Triple("Vendor Checked In", "AfroGlow Photography arrived on-site at Imba Manor.", "1 hour ago"),
                Triple("Gate Scanner Ready", "Offline trust anchor key #ww2-2026 synced successfully.", "3 hours ago")
            )
            items(notifs) { (title, desc, time) ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(WewedRadius.md),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Column(modifier = Modifier.padding(WewedSpacing.base)) {
                        Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                            Text(title, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            Text(time, fontSize = 11.sp, color = Color.Gray)
                        }
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(desc, fontSize = 12.sp, color = Color.Gray)
                    }
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
                Triple("SEP 22", "Final Menu Tasting & Wine Pairing", "Imba Manor Estate"),
                Triple("SEP 28", "Bridal Gown & Tuxedo Fitting", "Harare Atelier"),
                Triple("OCT 10", "On-Site Lighting & Sound Walkthrough", "Chapel Gardens"),
                Triple("OCT 24", "WEDDING DAY — TARIRO & SHADRECK", "Imba Manor Estate")
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
@Composable
fun SettingsScreen(sessionViewModel: SessionViewModel, onBack: (() -> Unit)? = null) {
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
                Pair("Account & Privacy Controls", Icons.Default.Shield),
                Pair("Notification Preferences", Icons.Default.Notifications),
                Pair("Event & Workspace Context", Icons.Default.Sync)
            )
            items(options) { (title, icon) ->
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
