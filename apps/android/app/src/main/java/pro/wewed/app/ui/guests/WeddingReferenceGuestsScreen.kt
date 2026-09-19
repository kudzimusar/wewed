package pro.wewed.app.ui.guests

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.models.Guest
import pro.wewed.app.models.RSVPStatus
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.theme.*

@Composable
fun WeddingReferenceGuestsScreen(appViewModel: AppViewModel) {
    var guests by remember { mutableStateOf<List<Guest>>(emptyList()) }
    var wedding by remember { mutableStateOf<pro.wewed.app.models.Wedding?>(null) }
    var query by remember { mutableStateOf("") }
    var selectedFilter by remember { mutableStateOf(ReferenceGuestFilter.ALL) }
    var showFilterMenu by remember { mutableStateOf(false) }
    var selectedGuest by remember { mutableStateOf<Guest?>(null) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        try {
            guests = appViewModel.repository.getGuests()
            wedding = appViewModel.repository.getWedding()
        } finally {
            loading = false
        }
    }

    val filtered = remember(guests, query, selectedFilter) {
        guests.filter { guest ->
            val matchesFilter = when (selectedFilter) {
                ReferenceGuestFilter.ALL -> true
                ReferenceGuestFilter.ATTENDING -> guest.rsvpStatus == RSVPStatus.ATTENDING
                ReferenceGuestFilter.PENDING -> guest.rsvpStatus == RSVPStatus.PENDING
                ReferenceGuestFilter.DECLINED -> guest.rsvpStatus == RSVPStatus.DECLINED
            }
            val trimmed = query.trim()
            val matchesQuery = trimmed.isBlank() ||
                guest.name.contains(trimmed, ignoreCase = true) ||
                (guest.tableName?.contains(trimmed, ignoreCase = true) == true)
            matchesFilter && matchesQuery
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WeddingIdentityPalette.Ivory)
            .testTag("guests-root")
    ) {
        WeddingOrnamentBackdrop(
            modifier = Modifier.matchParentSize(),
            alpha = 0.018f
        )

        Column(
            modifier = Modifier.fillMaxSize().padding(horizontal = 14.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.Top
            ) {
                    Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "Guests",
                        color = WeddingIdentityPalette.Ink,
                        fontFamily = FontFamily.Serif,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 28.sp
                    )
                    Text(
                        "The people who make it special.",
                        color = WeddingIdentityPalette.Muted,
                        fontSize = 14.sp
                    )
                }
                wedding?.coupleNames?.let { coupleNames ->
                    WeddingMonogramBadge(names = coupleNames, size = 58)
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    modifier = Modifier.weight(1f).heightIn(min = 52.dp).testTag("guests-search"),
                    singleLine = true,
                    leadingIcon = {
                        Icon(Icons.Default.Search, contentDescription = null, tint = WeddingIdentityPalette.Muted)
                    },
                    placeholder = {
                        Text("Search guests by name…", fontSize = 15.sp)
                    },
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = WeddingIdentityPalette.ChampagneDeep,
                        unfocusedBorderColor = WeddingIdentityPalette.Hairline,
                        focusedContainerColor = WeddingIdentityPalette.IvorySoft,
                        unfocusedContainerColor = WeddingIdentityPalette.IvorySoft
                    ),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(onSearch = {})
                )

                Box {
                    Surface(
                        onClick = { showFilterMenu = true },
                        modifier = Modifier.size(50.dp),
                        shape = RoundedCornerShape(12.dp),
                        color = WeddingIdentityPalette.IvorySoft,
                        border = androidx.compose.foundation.BorderStroke(1.dp, WeddingIdentityPalette.Hairline)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                Icons.Default.FilterList,
                                contentDescription = "Guest filters",
                                tint = WeddingIdentityPalette.Ink
                            )
                        }
                    }

                    DropdownMenu(
                        expanded = showFilterMenu,
                        onDismissRequest = { showFilterMenu = false }
                    ) {
                        ReferenceGuestFilter.entries.forEach { option ->
                            DropdownMenuItem(
                                text = { Text(option.title) },
                                onClick = {
                                    selectedFilter = option
                                    showFilterMenu = false
                                }
                            )
                        }
                    }
                }
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(7.dp)
            ) {
                ReferenceGuestFilter.entries.forEach { filter ->
                    val count = when (filter) {
                        ReferenceGuestFilter.ALL -> guests.size
                        ReferenceGuestFilter.ATTENDING -> guests.count { it.rsvpStatus == RSVPStatus.ATTENDING }
                        ReferenceGuestFilter.PENDING -> guests.count { it.rsvpStatus == RSVPStatus.PENDING }
                        ReferenceGuestFilter.DECLINED -> guests.count { it.rsvpStatus == RSVPStatus.DECLINED }
                    }
                    val selected = filter == selectedFilter
                    Box(
                        modifier = Modifier
                            .heightIn(min = 48.dp)
                            .clip(CircleShape)
                            .background(if (selected) WeddingIdentityPalette.Forest else WeddingIdentityPalette.IvorySoft)
                            .border(
                                if (selected) 0.dp else 1.dp,
                                WeddingIdentityPalette.Hairline,
                                CircleShape
                            )
                            .clickable(role = androidx.compose.ui.semantics.Role.Tab) { selectedFilter = filter }
                            .testTag("guests-filter-${filter.name.lowercase()}")
                            .padding(horizontal = 14.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "${filter.title} ($count)",
                            color = if (selected) Color.White else WeddingIdentityPalette.Ink,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            if (loading) {
                Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = WeddingIdentityPalette.ChampagneDeep)
                }
            } else {
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = PaddingValues(bottom = 8.dp)
                ) {
                    items(filtered, key = { it.id }) { guest ->
                        ReferenceGuestRow(guest) { selectedGuest = guest }
                    }
                }
            }

        }

        selectedGuest?.let { guest ->
            AlertDialog(
                onDismissRequest = { selectedGuest = null },
                title = { Text("Guest Details") },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(guest.name, fontWeight = FontWeight.SemiBold)
                        Text(guest.rsvpStatus.title)
                        Text("Party of ${guest.partySize}")
                        guest.tableName?.let { Text(it) }
                    }
                },
                confirmButton = {
                    TextButton(onClick = { selectedGuest = null }) { Text("Done") }
                }
            )
        }
    }
}

@Composable
private fun ReferenceGuestRow(guest: Guest, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(15.dp))
            .heightIn(min = 56.dp)
            .clickable(role = androidx.compose.ui.semantics.Role.Button) { onClick() }
            .background(WeddingIdentityPalette.IvorySoft)
            .border(1.dp, WeddingIdentityPalette.Hairline, RoundedCornerShape(15.dp))
            .padding(13.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(42.dp)
                .clip(CircleShape)
                .background(WeddingIdentityPalette.Champagne.copy(alpha = 0.18f)),
            contentAlignment = Alignment.Center
        ) {
            Text(
                initials(guest.name),
                color = WeddingIdentityPalette.ChampagneDeep,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold
            )
        }

        Spacer(modifier = Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                guest.name,
                color = WeddingIdentityPalette.Ink,
                fontFamily = FontFamily.Serif,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(7.dp)
                        .clip(CircleShape)
                        .background(statusColor(guest.rsvpStatus))
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(guest.rsvpStatus.title, color = WeddingIdentityPalette.Ink, fontSize = 14.sp)
                Text("  ·  ", color = WeddingIdentityPalette.Muted, fontSize = 14.sp)
                Text("Party of ${guest.partySize}", color = WeddingIdentityPalette.Muted, fontSize = 14.sp)
            }
        }

        Icon(
            Icons.Default.ChevronRight,
            contentDescription = null,
            tint = WeddingIdentityPalette.Muted,
            modifier = Modifier.size(18.dp)
        )
    }
}

private fun initials(name: String): String =
    name.split(" ")
        .filter { it.isNotBlank() }
        .take(2)
        .mapNotNull { it.firstOrNull()?.toString() }
        .joinToString("")
        .uppercase()

private fun statusColor(status: RSVPStatus): Color = when (status) {
    RSVPStatus.ATTENDING -> WeddingIdentityPalette.Forest
    RSVPStatus.PENDING -> Color(0xFFF2A31B)
    RSVPStatus.DECLINED -> Color(0xFFD84A4A)
}

private enum class ReferenceGuestFilter(val title: String) {
    ALL("All"),
    ATTENDING("Attending"),
    PENDING("Pending"),
    DECLINED("Declined")
}
