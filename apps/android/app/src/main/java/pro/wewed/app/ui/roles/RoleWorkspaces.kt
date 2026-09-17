package pro.wewed.app.ui.roles

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.state.SessionViewModel
import pro.wewed.app.theme.WewedColors
import pro.wewed.app.theme.WewedRadius
import pro.wewed.app.theme.WewedSpacing
import pro.wewed.app.ui.guests.GuestsScreen
import pro.wewed.app.ui.live.LiveWallScreen
import pro.wewed.app.ui.pass.PassScreen
import pro.wewed.app.ui.pass.UsherScannerScreen
import pro.wewed.app.ui.planner.*
import pro.wewed.app.ui.vendor.VendorPresenceScreen

// MARK: - Planner Shell
@Composable
fun PlannerShell(
    sessionViewModel: SessionViewModel,
    appViewModel: AppViewModel,
    onOpenPersonaPicker: () -> Unit
) {
    var selectedTab by remember { mutableStateOf(0) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Planner Workspace", fontWeight = FontWeight.SemiBold) },
                actions = {
                    IconButton(onClick = onOpenPersonaPicker) {
                        Icon(Icons.Default.ManageAccounts, contentDescription = "Switch Persona", tint = WewedColors.Emerald)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = WewedColors.Ivory)
            )
        },
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                NavigationBarItem(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    icon = { Icon(Icons.Default.FolderSpecial, contentDescription = "Portfolio") },
                    label = { Text("Portfolio") }
                )
                NavigationBarItem(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    icon = { Icon(Icons.Default.Checklist, contentDescription = "Plan & Tools") },
                    label = { Text("Plan & Tools") }
                )
                NavigationBarItem(
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 },
                    icon = { Icon(Icons.Default.Event, contentDescription = "Inquiries") },
                    label = { Text("Inquiries") }
                )
                NavigationBarItem(
                    selected = selectedTab == 3,
                    onClick = { selectedTab = 3 },
                    icon = { Icon(Icons.Default.EditNote, contentDescription = "Notebook") },
                    label = { Text("Notebook") }
                )
            }
        }
    ) { innerPadding ->
        Box(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
            when (selectedTab) {
                0 -> PortfolioDestination(onBack = { selectedTab = 1 })
                1 -> PlannerScreen(appViewModel = appViewModel)
                2 -> BookingsDestination(onBack = { selectedTab = 1 })
                3 -> NotebookDestination(onBack = { selectedTab = 1 })
            }
        }
    }
}

// MARK: - Coordinator Shell
@Composable
fun CoordinatorShell(
    sessionViewModel: SessionViewModel,
    appViewModel: AppViewModel,
    onOpenPersonaPicker: () -> Unit
) {
    var selectedTab by remember { mutableStateOf(0) }
    var isScannerOpen by remember { mutableStateOf(false) }

    if (isScannerOpen) {
        UsherScannerScreen(appViewModel = appViewModel, onClose = { isScannerOpen = false })
        return
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Ground Operations", fontWeight = FontWeight.SemiBold) },
                actions = {
                    IconButton(onClick = onOpenPersonaPicker) {
                        Icon(Icons.Default.ManageAccounts, contentDescription = "Switch Persona", tint = WewedColors.Burgundy)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = WewedColors.Ivory)
            )
        },
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                NavigationBarItem(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    icon = { Icon(Icons.Default.Schedule, contentDescription = "Timeline") },
                    label = { Text("Timeline") }
                )
                NavigationBarItem(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    icon = { Icon(Icons.Default.Bolt, contentDescription = "Operations") },
                    label = { Text("Operations") }
                )
                NavigationBarItem(
                    selected = false,
                    onClick = { isScannerOpen = true },
                    icon = { Icon(Icons.Default.QrCodeScanner, contentDescription = "Gate") },
                    label = { Text("Gate") }
                )
                NavigationBarItem(
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 },
                    icon = { Icon(Icons.Default.Sensors, contentDescription = "Radio") },
                    label = { Text("Radio") }
                )
            }
        }
    ) { innerPadding ->
        Box(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
            when (selectedTab) {
                0 -> TimelineDestination(appViewModel = appViewModel, onBack = {})
                1 -> OperationsDestination(onBack = {})
                2 -> EventCommandDestination(onBack = {})
            }
        }
    }
}

// MARK: - Vendor Shell
@Composable
fun VendorShell(
    sessionViewModel: SessionViewModel,
    appViewModel: AppViewModel,
    onOpenPersonaPicker: () -> Unit
) {
    var selectedTab by remember { mutableStateOf(0) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Vendor Operations", fontWeight = FontWeight.SemiBold) },
                actions = {
                    IconButton(onClick = onOpenPersonaPicker) {
                        Icon(Icons.Default.ManageAccounts, contentDescription = "Switch Persona", tint = Color(0xFF1976D2))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = WewedColors.Ivory)
            )
        },
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                NavigationBarItem(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    icon = { Icon(Icons.Default.Storefront, contentDescription = "Job Day") },
                    label = { Text("Job Day") }
                )
                NavigationBarItem(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    icon = { Icon(Icons.Default.CalendarMonth, contentDescription = "Schedule") },
                    label = { Text("Schedule") }
                )
                NavigationBarItem(
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 },
                    icon = { Icon(Icons.Default.Description, contentDescription = "Documents") },
                    label = { Text("Documents") }
                )
            }
        }
    ) { innerPadding ->
        Box(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
            when (selectedTab) {
                0 -> VendorPresenceScreen(appViewModel = appViewModel, onClose = {})
                1 -> TimelineDestination(appViewModel = appViewModel, onBack = {})
                2 -> ContractGovernanceDestination(onBack = {})
            }
        }
    }
}

// MARK: - Usher Shell
@Composable
fun UsherShell(
    sessionViewModel: SessionViewModel,
    appViewModel: AppViewModel,
    onOpenPersonaPicker: () -> Unit
) {
    var selectedTab by remember { mutableStateOf(0) }
    var isScannerOpen by remember { mutableStateOf(false) }

    if (isScannerOpen) {
        UsherScannerScreen(appViewModel = appViewModel, onClose = { isScannerOpen = false })
        return
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Gate Usher Console", fontWeight = FontWeight.SemiBold) },
                actions = {
                    IconButton(onClick = onOpenPersonaPicker) {
                        Icon(Icons.Default.ManageAccounts, contentDescription = "Switch Persona", tint = Color(0xFF7B1FA2))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = WewedColors.Ivory)
            )
        },
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                NavigationBarItem(
                    selected = false,
                    onClick = { isScannerOpen = true },
                    icon = { Icon(Icons.Default.QrCodeScanner, contentDescription = "Scanner") },
                    label = { Text("Scanner") }
                )
                NavigationBarItem(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    icon = { Icon(Icons.Default.Group, contentDescription = "Roster") },
                    label = { Text("Roster") }
                )
                NavigationBarItem(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    icon = { Icon(Icons.Default.Sync, contentDescription = "Sync Status") },
                    label = { Text("Sync Status") }
                )
            }
        }
    ) { innerPadding ->
        Box(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
            when (selectedTab) {
                0 -> GuestsScreen(appViewModel = appViewModel)
                1 -> UsherGateStatusScreen()
            }
        }
    }
}

@Composable
fun UsherGateStatusScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(WewedColors.Ivory)
            .padding(WewedSpacing.base),
        verticalArrangement = Arrangement.spacedBy(WewedSpacing.md)
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(WewedRadius.md),
            colors = CardDefaults.cardColors(containerColor = Color.White)
        ) {
            Column(modifier = Modifier.padding(WewedSpacing.base)) {
                Text("Gate A — Main Entrance", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Spacer(modifier = Modifier.height(4.dp))
                Text("Cryptographic Engine: WW2 ECDSA P-256 Offline Active", fontSize = 12.sp, color = WewedColors.Emerald)
                Text("Manifest Cache: 4 Guest records loaded", fontSize = 12.sp, color = Color.Gray)
                Text("Unsynced Local Scans: 0 pending", fontSize = 12.sp, color = Color.Gray)
            }
        }
    }
}

// MARK: - Guest Shell
@Composable
fun GuestShell(
    sessionViewModel: SessionViewModel,
    appViewModel: AppViewModel,
    onOpenPersonaPicker: () -> Unit
) {
    var selectedTab by remember { mutableStateOf(0) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Wedding Guest Pass", fontWeight = FontWeight.SemiBold) },
                actions = {
                    IconButton(onClick = onOpenPersonaPicker) {
                        Icon(Icons.Default.ManageAccounts, contentDescription = "Switch Persona", tint = Color(0xFFE65100))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = WewedColors.Ivory)
            )
        },
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                NavigationBarItem(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    icon = { Icon(Icons.Default.QrCode, contentDescription = "My Pass") },
                    label = { Text("My Pass") }
                )
                NavigationBarItem(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    icon = { Icon(Icons.Default.Schedule, contentDescription = "Schedule") },
                    label = { Text("Schedule") }
                )
                NavigationBarItem(
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 },
                    icon = { Icon(Icons.Default.CardGiftcard, contentDescription = "Registry") },
                    label = { Text("Registry") }
                )
                NavigationBarItem(
                    selected = selectedTab == 3,
                    onClick = { selectedTab = 3 },
                    icon = { Icon(Icons.Default.Forum, contentDescription = "Live Wall") },
                    label = { Text("Live Wall") }
                )
            }
        }
    ) { innerPadding ->
        Box(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
            when (selectedTab) {
                0 -> PassScreen(appViewModel = appViewModel, onOpenScanner = {})
                1 -> TimelineDestination(appViewModel = appViewModel, onBack = {})
                2 -> ContributionsDestination(onBack = {})
                3 -> LiveWallScreen()
            }
        }
    }
}

// MARK: - Admin Shell
@Composable
fun AdminShell(
    sessionViewModel: SessionViewModel,
    appViewModel: AppViewModel,
    onOpenPersonaPicker: () -> Unit
) {
    var selectedTab by remember { mutableStateOf(0) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Admin Supervisor", fontWeight = FontWeight.SemiBold) },
                actions = {
                    IconButton(onClick = onOpenPersonaPicker) {
                        Icon(Icons.Default.ManageAccounts, contentDescription = "Switch Persona", tint = Color(0xFFD32F2F))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = WewedColors.Ivory)
            )
        },
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                NavigationBarItem(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    icon = { Icon(Icons.Default.Dns, contentDescription = "System") },
                    label = { Text("System") }
                )
                NavigationBarItem(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    icon = { Icon(Icons.Default.Favorite, contentDescription = "Weddings") },
                    label = { Text("Weddings") }
                )
                NavigationBarItem(
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 },
                    icon = { Icon(Icons.Default.Shield, contentDescription = "Audits") },
                    label = { Text("Audits") }
                )
            }
        }
    ) { innerPadding ->
        Box(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
            when (selectedTab) {
                0 -> AdminHealthScreen()
                1 -> PortfolioDestination(onBack = {})
                2 -> ContractIntelligenceDestination(onBack = {})
            }
        }
    }
}

@Composable
fun AdminHealthScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(WewedColors.Ivory)
            .padding(WewedSpacing.base),
        verticalArrangement = Arrangement.spacedBy(WewedSpacing.md)
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(WewedRadius.md),
            colors = CardDefaults.cardColors(containerColor = Color.White)
        ) {
            Column(modifier = Modifier.padding(WewedSpacing.base)) {
                Text("Global System Operations", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Spacer(modifier = Modifier.height(4.dp))
                Text("Database & Sync Engine: Operational", fontSize = 12.sp, color = WewedColors.Emerald)
                Text("Offline Key Trust Anchors: 1 active", fontSize = 12.sp, color = Color.Gray)
                Text("Active Weddings Monitored: 8", fontSize = 12.sp, color = Color.Gray)
            }
        }
    }
}
