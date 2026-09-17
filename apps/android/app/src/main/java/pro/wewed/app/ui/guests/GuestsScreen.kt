package pro.wewed.app.ui.guests

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.models.Guest
import pro.wewed.app.models.RSVPStatus
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.theme.WewedColors
import pro.wewed.app.theme.WewedRadius
import pro.wewed.app.theme.WewedSpacing

@Composable
fun GuestsScreen(appViewModel: AppViewModel) {
    var guests by remember { mutableStateOf<List<Guest>>(emptyList()) }
    var searchQuery by remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        guests = appViewModel.repository.getGuests()
    }

    val filteredGuests = remember(guests, searchQuery) {
        if (searchQuery.isBlank()) guests
        else {
            val q = searchQuery.lowercase()
            guests.filter {
                it.name.lowercase().contains(q) ||
                (it.householdName?.lowercase()?.contains(q) == true) ||
                (it.tableName?.lowercase()?.contains(q) == true)
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Guest List", fontWeight = FontWeight.SemiBold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = WewedColors.Ivory)
            )
        },
        containerColor = WewedColors.Ivory
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = WewedSpacing.base)
        ) {
            // Stats Banner
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(WewedRadius.md),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(2.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(WewedSpacing.base),
                    horizontalArrangement = Arrangement.SpaceAround
                ) {
                    AttendanceColumn("Invited", "${guests.sumOf { it.partySize }}")
                    AttendanceColumn("Attending", "${guests.filter { it.rsvpStatus == RSVPStatus.ATTENDING }.sumOf { it.partySize }}")
                    AttendanceColumn("Checked In", "${guests.sumOf { it.checkedInCount }}")
                }
            }

            Spacer(modifier = Modifier.height(WewedSpacing.sm))

            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("Search guest name, household, table") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                shape = RoundedCornerShape(WewedRadius.md),
                singleLine = true
            )

            Spacer(modifier = Modifier.height(WewedSpacing.sm))

            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(WewedSpacing.sm),
                modifier = Modifier.fillMaxSize()
            ) {
                items(filteredGuests, key = { it.id }) { guest ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(WewedRadius.md),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(1.dp)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(WewedSpacing.base)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(guest.name, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                                RsvpChip(guest.rsvpStatus)
                            }

                            Spacer(modifier = Modifier.height(4.dp))

                            Row(horizontalArrangement = Arrangement.spacedBy(WewedSpacing.sm)) {
                                Text(
                                    "Party of ${guest.partySize}",
                                    fontSize = 12.sp,
                                    color = Color.Gray
                                )
                                guest.tableName?.let { table ->
                                    Text(
                                        table,
                                        fontSize = 12.sp,
                                        color = WewedColors.Emerald,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                }
                            }

                            if (guest.checkedIn) {
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    "✓ Checked In (${guest.checkedInCount}/${guest.partySize})",
                                    fontSize = 12.sp,
                                    color = WewedColors.Success,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }

                item {
                    Spacer(modifier = Modifier.height(72.dp))
                }
            }
        }
    }
}

@Composable
private fun AttendanceColumn(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = WewedColors.GoldDark)
        Text(label, fontSize = 11.sp, color = Color.Gray)
    }
}

@Composable
private fun RsvpChip(status: RSVPStatus) {
    val (color, text) = when (status) {
        RSVPStatus.ATTENDING -> WewedColors.Success to "Attending"
        RSVPStatus.DECLINED -> WewedColors.Error to "Declined"
        RSVPStatus.PENDING -> WewedColors.Warning to "Pending"
    }

    Box(
        modifier = Modifier
            .background(color.copy(alpha = 0.15f), RoundedCornerShape(WewedRadius.pill))
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Text(text, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = color)
    }
}
