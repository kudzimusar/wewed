package pro.wewed.app.ui.pass

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import kotlinx.coroutines.launch
import pro.wewed.app.models.CheckInAuditRecord
import pro.wewed.app.models.CheckInStatus
import pro.wewed.app.models.CheckInVerificationResult
import pro.wewed.app.models.Guest
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.theme.WewedColors
import pro.wewed.app.theme.WewedRadius
import pro.wewed.app.theme.WewedSpacing
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UsherScannerScreen(appViewModel: AppViewModel, onClose: () -> Unit) {
    var scanResult by remember { mutableStateOf<CheckInVerificationResult?>(null) }
    var manualQuery by remember { mutableStateOf("") }
    var searchResults by remember { mutableStateOf<List<Guest>>(emptyList()) }
    var checkInCount by remember { mutableIntStateOf(1) }
    var auditRecords by remember { mutableStateOf<List<CheckInAuditRecord>>(emptyList()) }
    var showAuditDialog by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    fun refreshAudit() {
        scope.launch {
            auditRecords = appViewModel.scopedRepository().getAuditRecords()
        }
    }

    LaunchedEffect(Unit) {
        refreshAudit()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Gate Scanner", fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = onClose) {
                        Icon(Icons.Default.Close, contentDescription = "Close")
                    }
                },
                actions = {
                    IconButton(onClick = {
                        refreshAudit()
                        showAuditDialog = true
                    }) {
                        Icon(Icons.Default.History, contentDescription = "Gate Audit Log", tint = WewedColors.Gold)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = WewedColors.Ivory)
            )
        },
        containerColor = WewedColors.Ivory
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
            contentPadding = PaddingValues(bottom = 32.dp)
        ) {
            // Viewfinder Area
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(310.dp)
                        .background(Color.Black),
                    contentAlignment = Alignment.Center
                ) {
                    CameraBarcodeScannerView(
                        modifier = Modifier.matchParentSize(),
                        onScanned = { token ->
                            scope.launch {
                                scanResult = appViewModel.scopedRepository().checkInGuest(token, checkInCount, "usher_android_gate1")
                                refreshAudit()
                            }
                        }
                    )

                    Column(
                        modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 12.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {

                        // Admittance Count Stepper
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text("Admitting Now:", color = Color.White, fontSize = 12.sp)
                            Surface(
                                shape = RoundedCornerShape(WewedRadius.pill),
                                color = Color.White.copy(alpha = 0.15f)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                                ) {
                                    IconButton(
                                        onClick = { if (checkInCount > 1) checkInCount-- },
                                        modifier = Modifier.size(28.dp)
                                    ) {
                                        Icon(Icons.Default.Remove, contentDescription = "Decrease", tint = if (checkInCount > 1) WewedColors.Gold else Color.Gray)
                                    }
                                    Text(
                                        "$checkInCount",
                                        color = Color.White,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        modifier = Modifier.padding(horizontal = 8.dp)
                                    )
                                    IconButton(
                                        onClick = { if (checkInCount < 10) checkInCount++ },
                                        modifier = Modifier.size(28.dp)
                                    ) {
                                        Icon(Icons.Default.Add, contentDescription = "Increase", tint = WewedColors.Gold)
                                    }
                                }
                            }
                        }

                    }
                }
            }

            // Results Card
            scanResult?.let { result ->
                item {
                    val statusColor = when (result.status) {
                        CheckInStatus.VALID_PASS -> WewedColors.Success
                        CheckInStatus.PARTIAL_CHECKED_IN -> WewedColors.Emerald
                        CheckInStatus.ALREADY_CHECKED_IN -> WewedColors.Error
                        CheckInStatus.CAPACITY_EXCEEDED -> WewedColors.Warning
                        CheckInStatus.INVALID_PASS -> WewedColors.Error
                    }
                    val statusTitle = when (result.status) {
                        CheckInStatus.VALID_PASS -> "Admitted — Full Party"
                        CheckInStatus.PARTIAL_CHECKED_IN -> "Admitted — Partial Arrival"
                        CheckInStatus.ALREADY_CHECKED_IN -> "Duplicate Entry Rejected"
                        CheckInStatus.CAPACITY_EXCEEDED -> "Gate Capacity Exceeded"
                        CheckInStatus.INVALID_PASS -> "Invalid Pass Rejected"
                    }
                    val statusIcon = when (result.status) {
                        CheckInStatus.VALID_PASS -> Icons.Default.CheckCircle
                        CheckInStatus.PARTIAL_CHECKED_IN -> Icons.Default.Group
                        CheckInStatus.ALREADY_CHECKED_IN -> Icons.Default.Warning
                        CheckInStatus.CAPACITY_EXCEEDED -> Icons.Default.GroupAdd
                        CheckInStatus.INVALID_PASS -> Icons.Default.Cancel
                    }

                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(WewedSpacing.base),
                        shape = RoundedCornerShape(WewedRadius.md),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(3.dp)
                    ) {
                        Column(
                            modifier = Modifier.padding(WewedSpacing.base),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(statusIcon, contentDescription = null, tint = statusColor)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(statusTitle, fontWeight = FontWeight.Bold, color = statusColor)
                            }

                            HorizontalDivider()

                            Text(result.guestName, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = WewedColors.TextPrimaryLight)
                            result.householdName?.let {
                                Text("Household: $it", fontSize = 12.sp, color = Color.Gray)
                            }
                            result.tableName?.let { table ->
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.Restaurant, contentDescription = null, tint = WewedColors.Emerald, modifier = Modifier.size(14.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("Seated at: $table", color = WewedColors.Emerald, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                                }
                            }

                            if (result.partySize > 0) {
                                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Text("Admitted: ${result.alreadyCheckedInCount} of ${result.partySize}", fontSize = 12.sp, fontWeight = FontWeight.Medium)
                                        if (result.remainingCount > 0) {
                                            Text("${result.remainingCount} still to arrive", fontSize = 12.sp, color = WewedColors.GoldDark, fontWeight = FontWeight.SemiBold)
                                        } else {
                                            Text("All Present", fontSize = 12.sp, color = WewedColors.Success, fontWeight = FontWeight.Bold)
                                        }
                                    }
                                    LinearProgressIndicator(
                                        progress = { (result.alreadyCheckedInCount.toFloat() / result.partySize.toFloat()).coerceIn(0f, 1f) },
                                        modifier = Modifier.fillMaxWidth().height(6.dp),
                                        color = statusColor,
                                        trackColor = Color.LightGray.copy(alpha = 0.4f)
                                    )
                                }
                            }

                            Text(result.gateMessage, fontSize = 12.sp, color = Color.Gray)
                        }
                    }
                }
            }

            // Manual Gate Search Section
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = WewedSpacing.base),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("Manual Gate Search", fontWeight = FontWeight.SemiBold, fontSize = 16.sp, color = WewedColors.TextPrimaryLight)

                    OutlinedTextField(
                        value = manualQuery,
                        onValueChange = { q ->
                            manualQuery = q
                            scope.launch {
                                searchResults = appViewModel.scopedRepository().searchGuests(q)
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Search by guest or household name") },
                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                        shape = RoundedCornerShape(WewedRadius.md),
                        singleLine = true
                    )
                }
            }

            if (searchResults.isNotEmpty()) {
                items(searchResults) { g ->
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = WewedSpacing.base, vertical = 4.dp),
                        shape = RoundedCornerShape(WewedRadius.sm),
                        colors = CardDefaults.cardColors(containerColor = Color.White)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(g.name, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                Text("Party of ${g.partySize} • ${g.tableName ?: "No table"}", fontSize = 12.sp, color = Color.Gray)
                            }
                            Button(
                                onClick = {
                                    scope.launch {
                                        val dummy = "WW1.wedts26.${g.passSerial ?: "WW0000"}.0e.66f001ab.sig"
                                        scanResult = appViewModel.scopedRepository().checkInGuest(dummy, checkInCount, "usher_android_gate1")
                                        manualQuery = ""
                                        searchResults = emptyList()
                                        refreshAudit()
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = WewedColors.Gold)
                            ) {
                                Text("Admit ($checkInCount)", fontSize = 11.sp, color = Color.Black, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }

    if (showAuditDialog) {
        AlertDialog(
            onDismissRequest = { showAuditDialog = false },
            title = { Text("Gate Audit Log", fontWeight = FontWeight.Bold) },
            text = {
                if (auditRecords.isEmpty()) {
                    Text("No gate admissions recorded yet.", color = Color.Gray)
                } else {
                    val timeFormat = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
                    LazyColumn(
                        modifier = Modifier.heightIn(max = 300.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(auditRecords.reversed()) { rec ->
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(WewedRadius.sm),
                                colors = CardDefaults.cardColors(containerColor = WewedColors.Ivory)
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(8.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column {
                                        Text(rec.guestName, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                                        Text("${rec.gateName} • ${timeFormat.format(Date(rec.scannedAtMillis))}", fontSize = 10.sp, color = Color.Gray)
                                    }
                                    Text("+${rec.countAdmitted}", fontWeight = FontWeight.Bold, color = WewedColors.Emerald)
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showAuditDialog = false }) {
                    Text("Close", color = WewedColors.GoldDark)
                }
            }
        )
    }
}
