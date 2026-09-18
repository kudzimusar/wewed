package pro.wewed.app.ui.pass

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.R
import pro.wewed.app.models.PassStage
import pro.wewed.app.models.WeddingPass
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.theme.WeddingIdentityPalette
import pro.wewed.app.theme.WeddingMonogram
import java.text.SimpleDateFormat
import java.util.Locale

@Composable
fun WeddingReferencePassScreen(
    appViewModel: AppViewModel,
    onOpenScanner: () -> Unit,
    providedPass: WeddingPass? = null
) {
    var pass by remember { mutableStateOf<WeddingPass?>(null) }
    var showGuestDetails by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(providedPass) {
        if (providedPass != null) {
            pass = providedPass
            loading = false
            return@LaunchedEffect
        }
        pass = runCatching {
            appViewModel.repository.getWeddingPass("shadow-attending-guest")
        }.getOrNull()
            ?: runCatching {
                appViewModel.repository.getWeddingPass("native-reference-guest")
            }.getOrNull()
            ?: runCatching {
                appViewModel.repository.getWeddingPass("w1-j8doe-7x9")
            }.getOrNull()
        loading = false
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WeddingIdentityPalette.Ivory)
            .testTag("pass-root")
    ) {
        when {
            loading -> {
                CircularProgressIndicator(
                    color = WeddingIdentityPalette.ChampagneDeep,
                    modifier = Modifier.align(Alignment.Center)
                )
            }
            pass == null -> {
                Column(
                    modifier = Modifier.align(Alignment.Center).padding(30.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        Icons.Default.QrCode,
                        contentDescription = null,
                        tint = WeddingIdentityPalette.ChampagneDeep,
                        modifier = Modifier.size(42.dp)
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Text("Wedding Pass unavailable", fontWeight = FontWeight.SemiBold)
                    Text(
                        "No attending Shadow guest pass is available.",
                        color = WeddingIdentityPalette.Muted,
                        fontSize = 12.sp
                    )
                }
            }
            else -> {
                val p = pass!!
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 18.dp, vertical = 12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(18.dp)
                ) {
                    Box(modifier = Modifier.fillMaxWidth()) {
                        Text(
                            "Wedding Pass",
                            color = WeddingIdentityPalette.Ink,
                            fontFamily = FontFamily.Serif,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 22.sp,
                            modifier = Modifier.align(Alignment.Center)
                        )
                        IconButton(
                            onClick = onOpenScanner,
                            modifier = Modifier.align(Alignment.CenterEnd).testTag("pass-open-scanner")
                        ) {
                            Icon(
                                Icons.Default.QrCode,
                                contentDescription = "Open gate scanner",
                                tint = WeddingIdentityPalette.Ink
                            )
                        }
                    }

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(22.dp))
                            .background(WeddingIdentityPalette.IvorySoft)
                            .border(
                                1.dp,
                                WeddingIdentityPalette.Champagne.copy(alpha = 0.70f),
                                RoundedCornerShape(22.dp)
                            )
                            .testTag("wedding-pass-card")
                    ) {
                        Image(
                            painter = painterResource(R.drawable.ornament_frame),
                            contentDescription = null,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.matchParentSize().alpha(0.22f)
                        )

                        Column(
                            modifier = Modifier.fillMaxWidth().padding(22.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(11.dp)
                        ) {
                            WeddingMonogram(p.coupleNames, sizeSp = 42)

                            Text(
                                p.coupleNames,
                                color = WeddingIdentityPalette.ChampagneDeep,
                                fontFamily = FontFamily.Serif,
                                fontStyle = FontStyle.Italic,
                                fontSize = 22.sp
                            )

                            Text(
                                p.guestName,
                                color = WeddingIdentityPalette.Ink,
                                fontFamily = FontFamily.Serif,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 20.sp
                            )

                            Text(
                                if (p.currentStage == PassStage.CHECKED_IN) "ADMITTED" else "ATTENDING",
                                color = Color.White,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.2.sp,
                                modifier = Modifier
                                    .clip(RoundedCornerShape(100.dp))
                                    .background(WeddingIdentityPalette.Forest)
                                    .padding(horizontal = 14.dp, vertical = 5.dp)
                            )

                            Text(
                                "Party of ${p.partySize}",
                                color = WeddingIdentityPalette.Muted,
                                fontSize = 13.sp
                            )

                            Box(
                                modifier = Modifier
                                    .size(174.dp)
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(Color.White),
                                contentAlignment = Alignment.Center
                            ) {
                                WeddingQrCode(payload = p.qrPayload)
                            }

                            Text("Scan at venue", color = WeddingIdentityPalette.Muted, fontSize = 11.sp)

                            Text(
                                "WEWED VERIFIED PASS",
                                color = WeddingIdentityPalette.Muted,
                                fontSize = 9.sp,
                                fontWeight = FontWeight.SemiBold,
                                letterSpacing = 1.3.sp
                            )

                            p.tableName?.let {
                                Text(
                                    it,
                                    color = WeddingIdentityPalette.Forest,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }

                            Text(
                                p.venueName,
                                color = WeddingIdentityPalette.Ink,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold
                            )

                            Text(
                                displayPassDate(p.weddingDate),
                                color = WeddingIdentityPalette.Muted,
                                fontSize = 11.sp
                            )

                            OutlinedButton(
                                onClick = { showGuestDetails = true },
                                modifier = Modifier.fillMaxWidth().height(46.dp),
                                shape = RoundedCornerShape(12.dp),
                                border = androidx.compose.foundation.BorderStroke(
                                    1.dp,
                                    WeddingIdentityPalette.Champagne
                                )
                            ) {
                                Text(
                                    "View Guest Details",
                                    color = WeddingIdentityPalette.Ink,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(18.dp))
                }

                if (showGuestDetails) {
                    AlertDialog(
                        onDismissRequest = { showGuestDetails = false },
                        title = { Text("Guest Details") },
                        text = {
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text(p.guestName, fontWeight = FontWeight.SemiBold)
                                Text("Party of ${p.partySize}")
                                p.tableName?.let { Text(it) }
                                Text(p.venueName)
                                Text(displayPassDate(p.weddingDate), color = WeddingIdentityPalette.Muted)
                            }
                        },
                        confirmButton = {
                            TextButton(onClick = { showGuestDetails = false }) { Text("Done") }
                        }
                    )
                }
            }
        }
    }
}

private fun displayPassDate(raw: String): String {
    val parser = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)
    val date = runCatching { parser.parse(raw) }.getOrNull() ?: return raw
    return SimpleDateFormat("MMM d, yyyy • HH:mm", Locale.US).format(date)
}
