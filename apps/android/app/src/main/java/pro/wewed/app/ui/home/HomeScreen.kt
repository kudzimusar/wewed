package pro.wewed.app.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Place
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.models.Wedding
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.theme.WewedColors
import pro.wewed.app.theme.WewedRadius
import pro.wewed.app.theme.WewedSpacing

@Composable
fun HomeScreen(appViewModel: AppViewModel) {
    var wedding by remember { mutableStateOf<Wedding?>(null) }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        wedding = appViewModel.repository.getWedding()
        isLoading = false
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Wedding Overview", fontWeight = FontWeight.SemiBold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = WewedColors.Ivory)
            )
        },
        containerColor = WewedColors.Ivory
    ) { innerPadding ->
        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = WewedColors.Gold)
            }
        } else {
            wedding?.let { w ->
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(innerPadding)
                        .padding(horizontal = WewedSpacing.base),
                    verticalArrangement = Arrangement.spacedBy(WewedSpacing.lg)
                ) {
                    item {
                        // Hero Card
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(WewedRadius.lg),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            elevation = CardDefaults.cardElevation(2.dp)
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(WewedSpacing.lg),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(WewedSpacing.sm)
                            ) {
                                Text(
                                    text = "T & S",
                                    fontSize = 32.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Serif,
                                    color = WewedColors.Gold
                                )
                                Text(
                                    text = w.coupleNames,
                                    fontSize = 22.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    fontFamily = FontFamily.Serif
                                )
                                Text(
                                    text = "24 October 2026 • Harare, Zimbabwe",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = WewedColors.TextSecondaryLight
                                )

                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(WewedSpacing.md),
                                    modifier = Modifier.padding(top = WewedSpacing.sm)
                                ) {
                                    CountdownBadge("37", "Days")
                                    CountdownBadge("04", "Hours")
                                    CountdownBadge("22", "Mins")
                                }
                            }
                        }
                    }

                    item {
                        // Venue Card
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(WewedRadius.lg),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            elevation = CardDefaults.cardElevation(2.dp)
                        ) {
                            Column(modifier = Modifier.padding(WewedSpacing.lg)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = Icons.Default.Place,
                                        contentDescription = null,
                                        tint = WewedColors.Emerald
                                    )
                                    Spacer(modifier = Modifier.width(WewedSpacing.sm))
                                    Text("The Venue", fontWeight = FontWeight.Bold)
                                }
                                Spacer(modifier = Modifier.height(WewedSpacing.xs))
                                Text(w.venueName, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                                Text(
                                    w.venueAddress,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = WewedColors.TextSecondaryLight
                                )
                            }
                        }
                    }

                    item {
                        Text(
                            text = "The Day's Programme",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = WewedColors.TextPrimaryLight
                        )
                    }

                    items(w.programme) { item ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(WewedRadius.md),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            elevation = CardDefaults.cardElevation(1.dp)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(WewedSpacing.base),
                                verticalAlignment = Alignment.Top
                            ) {
                                Text(
                                    text = item.time,
                                    fontWeight = FontWeight.Bold,
                                    color = WewedColors.Gold,
                                    modifier = Modifier.width(60.dp)
                                )
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(item.title, fontWeight = FontWeight.SemiBold)
                                    Text(
                                        item.location,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = WewedColors.Emerald
                                    )
                                    Text(
                                        item.description,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = WewedColors.TextSecondaryLight
                                    )
                                }
                            }
                        }
                    }

                    item {
                        Spacer(modifier = Modifier.height(WewedSpacing.xl))
                    }
                }
            }
        }
    }
}

@Composable
private fun CountdownBadge(value: String, label: String) {
    Box(
        modifier = Modifier
            .size(width = 64.dp, height = 54.dp)
            .background(
                WewedColors.GoldLight.copy(alpha = 0.3f),
                shape = RoundedCornerShape(WewedRadius.sm)
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(value, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = WewedColors.GoldDark)
            Text(label, fontSize = 10.sp, color = WewedColors.TextSecondaryLight)
        }
    }
}
