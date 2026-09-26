package pro.wewed.app.ui.invitation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.invitation.InvitationEntry
import pro.wewed.app.theme.WeddingIdentityPalette
import pro.wewed.app.theme.WewedColors

/**
 * What a refused invitation looks like.
 *
 * Failing closed has to be visible. A link that quietly does nothing is indistinguishable from the
 * app opening normally as whoever was already signed in — and that is precisely how someone ends
 * up looking at another guest's invitation and believing it is theirs.
 *
 * It deliberately says nothing about the wedding, the guest or why the credential failed. A
 * refusal that explains itself in detail is a way to probe for valid tokens.
 */
@Composable
fun InvitationRefusedScreen(
    reason: InvitationEntry.Reason,
    onDismiss: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WeddingIdentityPalette.Ivory)
            .testTag("invitation-refused"),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier.padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                "This invitation link can't be opened",
                fontFamily = FontFamily.Serif,
                fontSize = 20.sp,
                color = WeddingIdentityPalette.Ink,
                textAlign = TextAlign.Center
            )
            Text(
                // One message for every reason. Which check failed is not the guest's business,
                // and telling them would help someone guessing at links.
                "It may have expired, or already been used. Open the most recent invitation the " +
                    "couple sent you, or ask them to send it again.",
                fontSize = 14.sp,
                color = WeddingIdentityPalette.Muted,
                textAlign = TextAlign.Center,
                modifier = Modifier.testTag("invitation-refused-detail")
            )
            TextButton(
                onClick = onDismiss,
                modifier = Modifier.testTag("invitation-refused-dismiss")
            ) {
                Text("Continue to Wewed", fontWeight = FontWeight.SemiBold, color = WewedColors.Emerald)
            }
        }
    }
}
