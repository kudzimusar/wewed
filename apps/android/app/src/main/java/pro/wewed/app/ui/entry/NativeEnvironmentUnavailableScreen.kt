package pro.wewed.app.ui.entry

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.theme.WeddingBrandMark
import pro.wewed.app.theme.WeddingIdentityPalette

/**
 * Shown when a requested data environment cannot be opened.
 *
 * Refusing to fall back to demo data when a protected snapshot is missing is deliberate: a Private
 * Real lane silently showing fixture rows would be the worst possible outcome. But the refusal used
 * to throw out of `onCreate`, so the app just disappeared back to the launcher. An honest,
 * legible failure is the difference between "this is not provisioned" and "this is broken".
 */
@Composable
fun NativeEnvironmentUnavailableScreen(
    environmentName: String,
    reason: String
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WeddingIdentityPalette.Ivory)
            .testTag("environment-unavailable"),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 30.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            WeddingBrandMark()
            Text(
                "$environmentName is not available",
                fontSize = 20.sp,
                fontWeight = FontWeight.Medium,
                fontFamily = FontFamily.Serif,
                color = WeddingIdentityPalette.Ink,
                textAlign = TextAlign.Center
            )
            Text(
                reason,
                fontSize = 13.sp,
                color = WeddingIdentityPalette.Muted,
                textAlign = TextAlign.Center
            )
            Text(
                "No demonstration data is substituted.",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = WeddingIdentityPalette.ChampagneDeep,
                textAlign = TextAlign.Center,
                modifier = Modifier.testTag("environment-unavailable-no-fallback")
            )
        }
    }
}
