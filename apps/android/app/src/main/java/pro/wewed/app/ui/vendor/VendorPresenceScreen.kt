package pro.wewed.app.ui.vendor

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
import pro.wewed.app.models.VendorPresence
import pro.wewed.app.models.VendorPresenceState
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.theme.WewedColors
import pro.wewed.app.theme.WewedRadius
import pro.wewed.app.theme.WewedSpacing

/**
 * Dedicated native Jetpack Compose surface for Wedding Day vendors.
 * Handles instant status switches (En Route, Arrived, Start Service) and coordinator contact.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VendorPresenceScreen(
    appViewModel: AppViewModel,
    onClose: () -> Unit
) {
    var vendors by remember { mutableStateOf<List<VendorPresence>>(emptyList()) }
    var selectedVendorId by remember { mutableStateOf("v1") }
    var showContactDialog by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    fun refreshVendors() {
        scope.launch {
            vendors = appViewModel.repository.getVendors()
        }
    }

    LaunchedEffect(Unit) {
        refreshVendors()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Vendor Operations", fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = onClose) {
                        Icon(Icons.Default.Close, contentDescription = "Close")
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
                .padding(innerPadding)
                .padding(horizontal = WewedSpacing.base),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(vertical = 16.dp)
        ) {
            val currentVendor = vendors.firstOrNull { it.id == selectedVendorId }
            if (currentVendor != null) {
                // Header Card
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(WewedRadius.md),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(2.dp)
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(
                                        currentVendor.vendorName.uppercase(),
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        letterSpacing = 1.sp,
                                        color = WewedColors.GoldDark
                                    )
                                    Text(
                                        currentVendor.serviceCategory,
                                        fontSize = 18.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = WewedColors.TextPrimaryLight
                                    )
                                }
                                StateBadge(state = currentVendor.state)
                            }

                            HorizontalDivider()

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Column {
                                    Text("Service Area", fontSize = 10.sp, color = Color.Gray)
                                    Text(currentVendor.serviceArea, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                }
                                Column(horizontalAlignment = Alignment.End) {
                                    Text("Expected On-Site", fontSize = 10.sp, color = Color.Gray)
                                    Text(currentVendor.expectedTime, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                }
                            }
                        }
                    }
                }

                // Action Buttons
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("Update Your Status", fontWeight = FontWeight.SemiBold, fontSize = 15.sp)

                        OutlinedButton(
                            onClick = {
                                scope.launch {
                                    appViewModel.repository.updateVendorState(currentVendor.id, VendorPresenceState.EN_ROUTE)
                                    refreshVendors()
                                }
                            },
                            modifier = Modifier.fillMaxWidth().height(48.dp),
                            shape = RoundedCornerShape(WewedRadius.md),
                            colors = if (currentVendor.state == VendorPresenceState.EN_ROUTE) {
                                ButtonDefaults.outlinedButtonColors(containerColor = WewedColors.Gold, contentColor = Color.Black)
                            } else {
                                ButtonDefaults.outlinedButtonColors(containerColor = Color.White)
                            }
                        ) {
                            Icon(Icons.Default.DirectionsCar, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("EN ROUTE TO VENUE", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }

                        OutlinedButton(
                            onClick = {
                                scope.launch {
                                    appViewModel.repository.updateVendorState(currentVendor.id, VendorPresenceState.ARRIVED)
                                    refreshVendors()
                                }
                            },
                            modifier = Modifier.fillMaxWidth().height(48.dp),
                            shape = RoundedCornerShape(WewedRadius.md),
                            colors = if (currentVendor.state == VendorPresenceState.ARRIVED) {
                                ButtonDefaults.outlinedButtonColors(containerColor = WewedColors.Gold, contentColor = Color.Black)
                            } else {
                                ButtonDefaults.outlinedButtonColors(containerColor = Color.White)
                            }
                        ) {
                            Icon(Icons.Default.LocationOn, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("ARRIVED ON SITE", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }

                        OutlinedButton(
                            onClick = {
                                scope.launch {
                                    appViewModel.repository.updateVendorState(currentVendor.id, VendorPresenceState.SERVICE_ACTIVE)
                                    refreshVendors()
                                }
                            },
                            modifier = Modifier.fillMaxWidth().height(48.dp),
                            shape = RoundedCornerShape(WewedRadius.md),
                            colors = if (currentVendor.state == VendorPresenceState.SERVICE_ACTIVE) {
                                ButtonDefaults.outlinedButtonColors(containerColor = WewedColors.Gold, contentColor = Color.Black)
                            } else {
                                ButtonDefaults.outlinedButtonColors(containerColor = Color.White)
                            }
                        ) {
                            Icon(Icons.Default.PlayArrow, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("START SERVICE", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }

                        Button(
                            onClick = { showContactDialog = true },
                            modifier = Modifier.fillMaxWidth().height(48.dp),
                            shape = RoundedCornerShape(WewedRadius.md),
                            colors = ButtonDefaults.buttonColors(containerColor = Color.LightGray.copy(alpha = 0.35f))
                        ) {
                            Icon(Icons.Default.Phone, contentDescription = null, tint = WewedColors.TextPrimaryLight)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("CONTACT PLANNER", fontWeight = FontWeight.SemiBold, color = WewedColors.TextPrimaryLight, fontSize = 13.sp)
                        }
                    }
                }
            }

            // All Vendors Roster
            item {
                Text("Day-Of Vendor Roster", fontWeight = FontWeight.SemiBold, fontSize = 15.sp, modifier = Modifier.padding(top = 8.dp))
            }

            items(vendors) { v ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(WewedRadius.sm),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(v.vendorName, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                            Text("${v.serviceCategory} • ${v.serviceArea}", fontSize = 11.sp, color = Color.Gray)
                        }
                        StateBadge(state = v.state)
                    }
                }
            }
        }
    }

    if (showContactDialog) {
        AlertDialog(
            onDismissRequest = { showContactDialog = false },
            title = { Text("Contact Planner", fontWeight = FontWeight.Bold) },
            text = { Text("Call Lead Wedding Coordinator at Imba Manor: +263 77 123 4567") },
            confirmButton = {
                Button(
                    onClick = { showContactDialog = false },
                    colors = ButtonDefaults.buttonColors(containerColor = WewedColors.Gold)
                ) {
                    Text("Call Now", color = Color.Black)
                }
            },
            dismissButton = {
                TextButton(onClick = { showContactDialog = false }) {
                    Text("Dismiss", color = Color.Gray)
                }
            }
        )
    }
}

@Composable
private fun StateBadge(state: VendorPresenceState) {
    val (bg, fg) = when (state) {
        VendorPresenceState.SCHEDULED -> Pair(Color.LightGray.copy(alpha = 0.4f), Color.DarkGray)
        VendorPresenceState.EN_ROUTE -> Pair(WewedColors.Gold.copy(alpha = 0.25f), WewedColors.GoldDark)
        VendorPresenceState.ARRIVED -> Pair(WewedColors.Emerald.copy(alpha = 0.2f), WewedColors.Emerald)
        VendorPresenceState.SERVICE_ACTIVE -> Pair(WewedColors.Success.copy(alpha = 0.25f), WewedColors.Success)
        VendorPresenceState.COMPLETED -> Pair(Color.LightGray.copy(alpha = 0.4f), Color.DarkGray)
    }

    Surface(
        shape = RoundedCornerShape(WewedRadius.pill),
        color = bg
    ) {
        Text(
            state.title,
            color = fg,
            fontWeight = FontWeight.Bold,
            fontSize = 10.sp,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        )
    }
}
