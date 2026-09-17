package pro.wewed.app.ui.pass

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.models.WeddingPass
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.theme.WewedColors
import pro.wewed.app.theme.WewedRadius
import pro.wewed.app.theme.WewedSpacing

@Composable
fun PassScreen(appViewModel: AppViewModel, onOpenScanner: () -> Unit) {
    var pass by remember { mutableStateOf<WeddingPass?>(null) }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        pass = appViewModel.repository.getWeddingPass("w1-j8doe-7x9")
        isLoading = false
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Wedding Pass", fontWeight = FontWeight.SemiBold) },
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
            pass?.let { p ->
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(innerPadding)
                        .padding(horizontal = WewedSpacing.xl)
                        .verticalScroll(rememberScrollState()),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(WewedSpacing.lg)
                ) {
                    // The Wewed Wedding Pass Card
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(WewedRadius.xl),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(6.dp)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(WewedSpacing.lg),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(WewedSpacing.sm)
                        ) {
                            Text(
                                text = "WEWED WEDDING PASS",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 2.sp,
                                color = WewedColors.Gold
                            )

                            Text(
                                text = p.coupleNames,
                                fontSize = 22.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Serif
                            )

                            Text(
                                text = "24 October 2026 • 14:00",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color.Gray
                            )

                            Divider(modifier = Modifier.padding(vertical = WewedSpacing.sm))

                            Text(p.guestName, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                            Text("Party of ${p.partySize}", fontSize = 14.sp, color = Color.Gray)

                            p.tableName?.let { table ->
                                Box(
                                    modifier = Modifier
                                        .background(
                                            WewedColors.Emerald.copy(alpha = 0.1f),
                                            RoundedCornerShape(WewedRadius.pill)
                                        )
                                        .padding(horizontal = 12.dp, vertical = 6.dp)
                                ) {
                                    Text(
                                        text = table,
                                        fontWeight = FontWeight.Bold,
                                        color = WewedColors.Emerald
                                    )
                                }
                            }

                            // QR Representation
                            Box(
                                modifier = Modifier
                                    .size(160.dp)
                                    .background(WewedColors.Ivory, RoundedCornerShape(WewedRadius.md)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.QrCode,
                                    contentDescription = "QR Code",
                                    modifier = Modifier.size(120.dp),
                                    tint = WewedColors.TextPrimaryLight
                                )
                            }

                            Text(
                                text = "Scan at venue entrance",
                                fontSize = 11.sp,
                                color = Color.Gray
                            )

                            Text(p.venueName, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                            Text(p.venueAddress, fontSize = 12.sp, color = Color.Gray)
                        }
                    }

                    Button(
                        onClick = { /* Save to gallery */ },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp),
                        shape = RoundedCornerShape(WewedRadius.lg),
                        colors = ButtonDefaults.buttonColors(containerColor = WewedColors.Gold)
                    ) {
                        Icon(Icons.Default.Download, contentDescription = null)
                        Spacer(modifier = Modifier.width(WewedSpacing.sm))
                        Text("Save Pass to Gallery", color = Color.White, fontWeight = FontWeight.Bold)
                    }

                    Button(
                        onClick = onOpenScanner,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp),
                        shape = RoundedCornerShape(WewedRadius.lg),
                        colors = ButtonDefaults.buttonColors(containerColor = WewedColors.Emerald)
                    ) {
                        Icon(Icons.Default.CameraAlt, contentDescription = null)
                        Spacer(modifier = Modifier.width(WewedSpacing.sm))
                        Text("Usher Check-In Mode", color = Color.White, fontWeight = FontWeight.Bold)
                    }

                    Spacer(modifier = Modifier.height(72.dp))
                }
            }
        }
    }
}
