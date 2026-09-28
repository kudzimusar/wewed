package pro.wewed.app.ui.entry

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.theme.WeddingIdentityPalette
import pro.wewed.app.theme.WewedLogo

/**
 * Shown for the brief first-launch moment in which Wewed checks whether it was installed from a
 * private invitation (Play install referrer). Bounded by a timeout; names no wedding or guest.
 */
@Composable
fun OpeningInvitationScreen() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WeddingIdentityPalette.Ivory)
            .testTag("opening-invitation"),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 30.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            WewedLogo(contentDescription = "Wewed")
            CircularProgressIndicator(
                modifier = Modifier.size(28.dp),
                color = WeddingIdentityPalette.Ink,
                strokeWidth = 2.dp
            )
            Text(
                "Opening Wewed…",
                fontSize = 16.sp,
                fontFamily = FontFamily.Serif,
                color = WeddingIdentityPalette.Ink
            )
        }
    }
}
