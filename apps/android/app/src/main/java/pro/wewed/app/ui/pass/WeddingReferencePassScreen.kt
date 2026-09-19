package pro.wewed.app.ui.pass

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material.icons.filled.QrCodeScanner
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.R
import pro.wewed.app.models.PassStage
import pro.wewed.app.models.VenueLocation
import pro.wewed.app.models.Wedding
import pro.wewed.app.models.WeddingPass
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.theme.WeddingIdentityPalette
import pro.wewed.app.theme.WeddingMonogram
import pro.wewed.app.ui.shared.Formatting
import pro.wewed.app.ui.shared.MinTouchTarget
import pro.wewed.app.ui.shared.OpenInMapsButton
import pro.wewed.app.ui.shared.exposeTestTags

/**
 * The ivory wedding pass card used by the couple's preview, the planner's pass preview and the guest's own pass.
 * Every value comes from the pass record; the venue link comes from the recorded venue.
 */
@Composable
fun WeddingPassCard(
    pass: WeddingPass,
    modifier: Modifier = Modifier,
    fallbackVenue: VenueLocation? = null,
    guestNameTag: String = "guest-pass-guest-name"
) {
    var showGuestDetails by remember { mutableStateOf(false) }
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(22.dp))
            .background(WeddingIdentityPalette.IvorySoft)
            .border(1.dp, WeddingIdentityPalette.Champagne.copy(alpha = 0.70f), RoundedCornerShape(22.dp))
            .testTag("wedding-pass-card")
    ) {
        Image(
            painter = painterResource(R.drawable.ornament_frame),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.matchParentSize().alpha(0.12f)
        )
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 18.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(9.dp)
        ) {
            WeddingMonogram(pass.coupleNames, sizeSp = 38)
            Text(
                pass.coupleNames,
                color = WeddingIdentityPalette.ChampagneDeep,
                fontFamily = FontFamily.Serif,
                fontStyle = FontStyle.Italic,
                fontSize = 22.sp,
                textAlign = TextAlign.Center
            )
            Text(
                pass.guestName,
                color = WeddingIdentityPalette.Ink,
                fontFamily = FontFamily.Serif,
                fontWeight = FontWeight.SemiBold,
                fontSize = 21.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.testTag(guestNameTag)
            )
            Text(
                if (pass.currentStage == PassStage.CHECKED_IN) "ADMITTED" else "ATTENDING",
                color = Color.White,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.2.sp,
                modifier = Modifier
                    .clip(RoundedCornerShape(100.dp))
                    .background(WeddingIdentityPalette.Forest)
                    .padding(horizontal = 14.dp, vertical = 5.dp)
            )
            val partyAndTable = listOfNotNull(
                "Party of ${pass.partySize}",
                pass.tableName?.takeIf { it.isNotBlank() }?.let { "Table: $it" }
            ).joinToString(" · ")
            Text(partyAndTable, color = WeddingIdentityPalette.Ink, fontSize = 15.sp, textAlign = TextAlign.Center)

            Box(
                modifier = Modifier
                    .size(170.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color.White),
                contentAlignment = Alignment.Center
            ) {
                WeddingQrCode(payload = pass.qrPayload)
            }
            Text("Show this code at the entrance", color = WeddingIdentityPalette.Muted, fontSize = 14.sp)

            Text(
                pass.venueName,
                color = WeddingIdentityPalette.Ink,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center
            )
            Text(
                Formatting.dateAndTime(pass.weddingDate),
                color = WeddingIdentityPalette.Muted,
                fontSize = 14.sp,
                textAlign = TextAlign.Center
            )
            OpenInMapsButton(venue = pass.venue, fallback = fallbackVenue, tag = "pass-open-maps")

            OutlinedButton(
                onClick = { showGuestDetails = true },
                modifier = Modifier.fillMaxWidth().heightIn(min = MinTouchTarget).testTag("pass-guest-details"),
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(1.dp, WeddingIdentityPalette.Champagne)
            ) {
                Text("View guest details", color = WeddingIdentityPalette.Ink, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
            }
        }
    }

    if (showGuestDetails) {
        AlertDialog(
            onDismissRequest = { showGuestDetails = false },
            modifier = Modifier.exposeTestTags(),
            title = { Text("Guest details") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(pass.guestName, fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
                    pass.householdName?.takeIf { it.isNotBlank() && it != pass.guestName }?.let { Text("Household: $it", fontSize = 16.sp) }
                    Text("Party of ${pass.partySize}", fontSize = 16.sp)
                    Text(pass.tableName?.takeIf { it.isNotBlank() }?.let { "Table: $it" } ?: "No table recorded", fontSize = 16.sp)
                    Text(pass.venueName, fontSize = 16.sp)
                    Text(Formatting.dateAndTime(pass.weddingDate), color = WeddingIdentityPalette.Muted, fontSize = 15.sp)
                }
            },
            confirmButton = {
                TextButton(onClick = { showGuestDetails = false }, modifier = Modifier.heightIn(min = MinTouchTarget)) {
                    Text("Done", fontSize = 16.sp, color = pro.wewed.app.ui.shared.Ui.Positive)
                }
            }
        )
    }
}

/**
 * Couple "Pass" tab: a preview of the pass an accepted guest carries, plus the gate scanner.
 * The couple may keep the repositories (spec §2 rule 3).
 */
@Composable
fun WeddingReferencePassScreen(
    appViewModel: AppViewModel,
    onOpenScanner: () -> Unit
) {
    var pass by remember { mutableStateOf<WeddingPass?>(null) }
    var wedding by remember { mutableStateOf<Wedding?>(null) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        wedding = runCatching { appViewModel.repository.getWedding() }.getOrNull()
        pass = runCatching { appViewModel.repository.getWeddingPass("shadow-attending-guest") }.getOrNull()
            ?: runCatching { appViewModel.repository.getWeddingPass("native-reference-guest") }.getOrNull()
        loading = false
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WeddingIdentityPalette.Ivory)
            .testTag("pass-root")
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "Wedding Pass",
                        color = WeddingIdentityPalette.Ink,
                        fontFamily = FontFamily.Serif,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 24.sp
                    )
                    Text("Preview of a guest's pass", color = WeddingIdentityPalette.Muted, fontSize = 14.sp)
                }
                TextButton(
                    onClick = onOpenScanner,
                    modifier = Modifier.heightIn(min = MinTouchTarget).testTag("pass-open-scanner")
                ) {
                    Icon(Icons.Default.QrCodeScanner, contentDescription = null, tint = WeddingIdentityPalette.ChampagneDeep)
                    Spacer(Modifier.width(6.dp))
                    Text("Scan pass", color = WeddingIdentityPalette.ChampagneDeep, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                }
            }

            when {
                loading -> CircularProgressIndicator(color = WeddingIdentityPalette.ChampagneDeep, modifier = Modifier.padding(40.dp))
                pass == null -> Column(
                    modifier = Modifier.padding(30.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(Icons.Default.QrCode, contentDescription = null, tint = WeddingIdentityPalette.ChampagneDeep, modifier = Modifier.size(42.dp))
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        "No guest has accepted yet, so there is no pass to preview.",
                        color = WeddingIdentityPalette.Ink,
                        fontSize = 16.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.testTag("pass-unavailable")
                    )
                }
                else -> WeddingPassCard(pass = pass!!, fallbackVenue = wedding?.venueLocation)
            }
            Spacer(modifier = Modifier.height(12.dp))
        }
    }
}
