package pro.wewed.app.ui.entry

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.invitation.InvitationEntry
import pro.wewed.app.invitation.InvitationEntryParser
import pro.wewed.app.theme.WeddingIdentityPalette
import pro.wewed.app.theme.WeddingOrnamentBackdrop
import pro.wewed.app.theme.WewedLogo

/**
 * Manual recovery path for a guest who opened Wewed from the app icon instead of the invitation
 * message/QR. It never authenticates or invents a wedding: it validates the exact private URL and
 * hands it back to the same parser-backed entry pipeline used by Android App Links.
 */
@Composable
fun InvitationLinkEntryScreen(
    onOpen: (String) -> Unit,
    onBack: () -> Unit,
) {
    var rawLink by remember { mutableStateOf("") }
    var validationMessage by remember { mutableStateOf<String?>(null) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WeddingIdentityPalette.Ivory)
            .testTag("invitation-link-entry"),
        contentAlignment = Alignment.Center,
    ) {
        WeddingOrnamentBackdrop(
            modifier = Modifier.fillMaxSize(),
            alpha = 0.07f,
        )

        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            WewedLogo(contentDescription = "Wewed")
            Text(
                "Open your invitation",
                fontSize = 28.sp,
                fontWeight = FontWeight.Medium,
                fontFamily = FontFamily.Serif,
                color = WeddingIdentityPalette.Ink,
            )
            Text(
                "Paste the private Wewed invitation link you received. You do not need a Wewed account.",
                fontSize = 14.sp,
                color = WeddingIdentityPalette.Muted,
                textAlign = TextAlign.Center,
            )

            OutlinedTextField(
                value = rawLink,
                onValueChange = {
                    rawLink = it
                    validationMessage = null
                },
                label = { Text("Private invitation link") },
                placeholder = { Text("https://wewed.pro/invite/…") },
                modifier = Modifier.fillMaxWidth().testTag("invitation-link-field"),
                singleLine = false,
                shape = RoundedCornerShape(14.dp),
            )

            validationMessage?.let {
                Text(
                    it,
                    fontSize = 12.sp,
                    color = WeddingIdentityPalette.Muted,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.testTag("invitation-link-error"),
                )
            }

            Button(
                onClick = {
                    val candidate = rawLink.trim()
                    when (InvitationEntryParser.fromUrl(candidate)) {
                        is InvitationEntry.PrivateInvitation,
                        is InvitationEntry.Handoff -> {
                            validationMessage = null
                            onOpen(candidate)
                        }
                        else -> {
                            validationMessage =
                                "That link is not a valid Wewed invitation. Check the full private link and try again."
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth().testTag("invitation-link-open"),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = WeddingIdentityPalette.Forest,
                    contentColor = WeddingIdentityPalette.IvorySoft,
                ),
            ) {
                Text("Open Invitation", fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            }

            TextButton(
                onClick = onBack,
                modifier = Modifier.testTag("invitation-link-back"),
            ) {
                Text(
                    "Back",
                    color = WeddingIdentityPalette.ChampagneDeep,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}
